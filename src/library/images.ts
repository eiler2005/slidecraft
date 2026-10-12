/**
 * Pictures for empty image slots: generated from `imagePrompt` (M6), or stock photos found
 * for `imageQuery` (Openverse, Pexels, Pixabay) with their licence and author recorded in
 * `imageCredit`.
 *
 * Image generation for empty image slots (M6).
 *
 * Slides with `imagePrompt` and no `image` get a picture from an OpenAI-compatible
 * images endpoint; the file lands in `assets/` next to the deck and the slide's `image:`
 * is written back into the YAML (comments preserved). Prompts leave the machine, so the
 * command lists them first and `--dry-run` sends nothing. Inside Codex, the agent can use
 * its own image tool instead and just save to the same path.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import YAML, { isMap, isSeq, type YAMLMap, type YAMLSeq } from 'yaml';
import { editYaml, type YamlEdit } from './yaml-edit.ts';

/** Appended to every prompt so pictures suit a slide: no text, calm, croppable. */
export const IMAGE_STYLE =
  'Photographic, natural light, calm and uncluttered, generous negative space so it can be cropped to a slide panel. No text, no captions, no logos, no watermarks.';

export interface ImageJob {
  slideId: string;
  prompt: string;
  /** Path written into the slide, relative to the YAML file that holds it. */
  image: string;
  file: string;
  yamlFile: string;
}

function slideMaps(file: string): { doc: YAML.Document; items: YAMLMap[]; includes: string[] } {
  const doc = YAML.parseDocument(readFileSync(file, 'utf8'));
  const root = doc.contents;
  const seq = isMap(root) ? root.get('slides', true) : isSeq(root) ? root : undefined;
  const items: YAMLMap[] = [];
  const includes: string[] = [];
  if (isSeq(seq))
    for (const it of seq.items) {
      if (!isMap(it)) continue;
      const inc = it.get('include');
      if (typeof inc === 'string') includes.push(resolve(dirname(file), inc));
      else items.push(it);
    }
  return { doc, items, includes };
}

export function planImages(deckPath: string, opts: { force?: boolean } = {}): ImageJob[] {
  const jobs: ImageJob[] = [];
  const visit = (file: string) => {
    const { items, includes } = slideMaps(file);
    for (const m of items) {
      const prompt = m.get('imagePrompt');
      const id = String(m.get('id') ?? '');
      if (typeof prompt !== 'string' || !id) continue;
      const current = m.get('image');
      const base = dirname(file);
      if (!opts.force && typeof current === 'string' && existsSync(resolve(base, current)))
        continue;
      const image = typeof current === 'string' && current ? current : `assets/${id}.png`;
      jobs.push({ slideId: id, prompt, image, file: resolve(base, image), yamlFile: file });
    }
    includes.forEach(visit);
  };
  visit(resolve(deckPath));
  return jobs;
}

export interface ImageProvider {
  id: string;
  generate(prompt: string): Promise<Buffer>;
}

export function openAiProvider(env = process.env): ImageProvider {
  const key = env.OPENAI_API_KEY;
  const base = (env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = env.SLIDECRAFT_IMAGE_MODEL ?? 'gpt-image-1';
  return {
    id: `openai:${model}`,
    async generate(prompt) {
      if (!key) throw new Error('OPENAI_API_KEY is not set');
      const res = await fetch(`${base}/images/generations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, prompt, size: '1536x1024', n: 1 }),
      });
      if (!res.ok) throw new Error(`images API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
      const d = json.data?.[0];
      if (d?.b64_json) return Buffer.from(d.b64_json, 'base64');
      if (d?.url) return Buffer.from(await (await fetch(d.url)).arrayBuffer());
      throw new Error('images API returned no image');
    },
  };
}

export interface ImageRunResult {
  generated: ImageJob[];
  failed: { job: ImageJob; error: string }[];
}

export async function generateImages(
  jobs: ImageJob[],
  provider: ImageProvider,
): Promise<ImageRunResult> {
  const out: ImageRunResult = { generated: [], failed: [] };
  for (const job of jobs) {
    try {
      const png = await provider.generate(`${job.prompt}\n\n${IMAGE_STYLE}`);
      mkdirSync(dirname(job.file), { recursive: true });
      writeFileSync(job.file, png);
      out.generated.push(job);
    } catch (e) {
      out.failed.push({ job, error: (e as Error).message });
    }
  }
  // write image paths back, one YAML file at a time
  const byFile = new Map<string, ImageJob[]>();
  for (const j of out.generated) byFile.set(j.yamlFile, [...(byFile.get(j.yamlFile) ?? []), j]);
  for (const [file, js] of byFile) {
    const { doc } = slideMaps(file);
    const root = doc.contents;
    const inDeck = isMap(root) && isSeq(root.get('slides', true));
    const seq = (inDeck ? (root as YAMLMap).get('slides', true) : root) as YAMLSeq;
    const edits: YamlEdit[] = [];
    for (const j of js) {
      const k = seq.items.findIndex((m) => isMap(m) && m.get('id') === j.slideId);
      if (k >= 0) edits.push({ path: [...(inDeck ? ['slides'] : []), k, 'image'], value: j.image });
    }
    writeFileSync(file, editYaml(readFileSync(file, 'utf8'), edits));
  }
  return out;
}

export function describeJob(j: ImageJob, cwd = process.cwd()): string {
  return `${j.slideId} → ${relative(cwd, j.file) || j.file}\n    "${j.prompt}"`;
}

// ---- stock photos ------------------------------------------------------------------

export interface ImageCredit {
  author: string;
  provider: string;
  license: string;
  licenseUrl?: string;
  source: string;
  title?: string;
}

export interface StockHit {
  url: string;
  width: number;
  height: number;
  credit: ImageCredit;
}

export interface StockProvider {
  id: string;
  search(query: string): Promise<StockHit[]>;
}

export interface StockJob {
  slideId: string;
  query: string;
  /** Path written into the slide, relative to its YAML file; the extension follows the download. */
  image: string;
  file: string;
  yamlFile: string;
}

type Fetch = typeof fetch;

export function planStock(deckPath: string, opts: { force?: boolean } = {}): StockJob[] {
  const jobs: StockJob[] = [];
  const visit = (file: string) => {
    const { items, includes } = slideMaps(file);
    for (const m of items) {
      const query = m.get('imageQuery');
      const id = String(m.get('id') ?? '');
      if (typeof query !== 'string' || !id) continue;
      const current = m.get('image');
      const base = dirname(file);
      if (!opts.force && typeof current === 'string' && existsSync(resolve(base, current)))
        continue;
      const image = `assets/${id}.jpg`;
      jobs.push({ slideId: id, query, image, file: resolve(base, image), yamlFile: file });
    }
    includes.forEach(visit);
  };
  visit(resolve(deckPath));
  return jobs;
}

const CC = (license: string, version?: string) =>
  /^(cc0|pdm)$/i.test(license)
    ? license.toUpperCase() === 'PDM'
      ? 'Public Domain Mark'
      : 'CC0'
    : `CC ${license.toUpperCase()}${version ? ` ${version}` : ''}`;

/** Openverse: openly licensed photos, no key; only licences that allow commercial use and edits. */
export function openverseProvider(fetchImpl: Fetch = fetch): StockProvider {
  return {
    id: 'openverse',
    async search(query) {
      const q = new URLSearchParams({
        q: query,
        license_type: 'commercial,modification',
        aspect_ratio: 'wide',
        mature: 'false',
        page_size: '20',
      });
      const res = await fetchImpl(`https://api.openverse.org/v1/images/?${q}`);
      if (!res.ok) throw new Error(`Openverse ${res.status}`);
      const json = (await res.json()) as {
        results: {
          url: string;
          width?: number;
          height?: number;
          title?: string;
          creator?: string;
          license: string;
          license_version?: string;
          license_url?: string;
          provider?: string;
          source?: string;
          foreign_landing_url?: string;
        }[];
      };
      return json.results.map((r) => ({
        url: r.url,
        width: r.width ?? 0,
        height: r.height ?? 0,
        credit: {
          author: r.creator || 'Unknown author',
          provider: `Openverse · ${(r.source ?? r.provider ?? 'web').replace(/^\w/, (c) => c.toUpperCase())}`,
          license: CC(r.license, r.license_version),
          ...(r.license_url ? { licenseUrl: r.license_url } : {}),
          source: r.foreign_landing_url ?? r.url,
          ...(r.title ? { title: r.title } : {}),
        },
      }));
    },
  };
}

/** Pexels: needs PEXELS_API_KEY; Pexels License (free use, no attribution required — we credit anyway). */
export function pexelsProvider(env = process.env, fetchImpl: Fetch = fetch): StockProvider {
  return {
    id: 'pexels',
    async search(query) {
      const key = env.PEXELS_API_KEY;
      if (!key) throw new Error('PEXELS_API_KEY is not set');
      const q = new URLSearchParams({ query, orientation: 'landscape', per_page: '20' });
      const res = await fetchImpl(`https://api.pexels.com/v1/search?${q}`, {
        headers: { authorization: key },
      });
      if (!res.ok) throw new Error(`Pexels ${res.status}`);
      const json = (await res.json()) as {
        photos: {
          width: number;
          height: number;
          url: string;
          alt?: string;
          photographer: string;
          src: { large2x?: string; large?: string; original: string };
        }[];
      };
      return json.photos.map((p) => ({
        url: p.src.large2x ?? p.src.large ?? p.src.original,
        width: p.width,
        height: p.height,
        credit: {
          author: p.photographer,
          provider: 'Pexels',
          license: 'Pexels License',
          licenseUrl: 'https://www.pexels.com/license/',
          source: p.url,
          ...(p.alt ? { title: p.alt } : {}),
        },
      }));
    },
  };
}

/** Pixabay: needs PIXABAY_API_KEY; Pixabay Content License. */
export function pixabayProvider(env = process.env, fetchImpl: Fetch = fetch): StockProvider {
  return {
    id: 'pixabay',
    async search(query) {
      const key = env.PIXABAY_API_KEY;
      if (!key) throw new Error('PIXABAY_API_KEY is not set');
      const q = new URLSearchParams({
        key,
        q: query,
        image_type: 'photo',
        orientation: 'horizontal',
        safesearch: 'true',
        per_page: '20',
      });
      const res = await fetchImpl(`https://pixabay.com/api/?${q}`);
      if (!res.ok) throw new Error(`Pixabay ${res.status}`);
      const json = (await res.json()) as {
        hits: {
          largeImageURL: string;
          imageWidth: number;
          imageHeight: number;
          pageURL: string;
          user: string;
          tags?: string;
        }[];
      };
      return json.hits.map((h) => ({
        url: h.largeImageURL,
        width: h.imageWidth,
        height: h.imageHeight,
        credit: {
          author: h.user,
          provider: 'Pixabay',
          license: 'Pixabay Content License',
          licenseUrl: 'https://pixabay.com/service/license-summary/',
          source: h.pageURL,
          ...(h.tags ? { title: h.tags } : {}),
        },
      }));
    },
  };
}

export function stockProvider(id: string, env = process.env): StockProvider {
  if (id === 'pexels') return pexelsProvider(env);
  if (id === 'pixabay') return pixabayProvider(env);
  if (id === 'openverse') return openverseProvider();
  throw new Error(`unknown stock provider "${id}" (openverse, pexels, pixabay)`);
}

/** The query, then its first four, three and two words. */
export function fallbackQueries(q: string): string[] {
  const w = q.trim().split(/\s+/);
  return [
    ...new Set([
      q.trim(),
      ...[4, 3, 2].filter((n) => n < w.length).map((n) => w.slice(0, n).join(' ')),
    ]),
  ];
}

export interface StockRunResult {
  found: (StockJob & { credit: ImageCredit; matched: string })[];
  failed: { job: StockJob; error: string }[];
}

/** First landscape hit wide enough for a slide panel (≥ 1000 px), else the widest one. */
export function pickHit(hits: StockHit[]): StockHit | undefined {
  const wide = hits.filter((h) => h.width >= 1000 && h.width >= h.height);
  return wide[0] ?? [...hits].sort((a, b) => b.width - a.width)[0];
}

/** Candidate photos for each job, best first, for a person or an agent to choose from. */
export async function listStock(
  jobs: StockJob[],
  provider: StockProvider,
  limit = 6,
): Promise<{ slideId: string; query: string; hits: StockHit[] }[]> {
  const out: { slideId: string; query: string; hits: StockHit[] }[] = [];
  for (const job of jobs) {
    let hits: StockHit[] = [];
    let used = job.query;
    for (const q of fallbackQueries(job.query)) {
      hits = (await provider.search(q)).filter((h) => h.width >= 1000 && h.width >= h.height);
      used = q;
      if (hits.length) break;
    }
    out.push({ slideId: job.slideId, query: used, hits: hits.slice(0, limit) });
  }
  return out;
}

export async function fetchStock(
  jobs: StockJob[],
  provider: StockProvider,
  fetchImpl: Fetch = fetch,
  /** 1-based candidate to take (from `listStock`); default the first. */
  pick = 1,
): Promise<StockRunResult> {
  const out: StockRunResult = { found: [], failed: [] };
  for (const job of jobs) {
    try {
      // search engines match every word: fall back to the leading words of the query
      let hit: StockHit | undefined;
      let used = job.query;
      for (const q of fallbackQueries(job.query)) {
        const hits = await provider.search(q);
        hit =
          pick > 1
            ? hits.filter((h) => h.width >= 1000 && h.width >= h.height)[pick - 1]
            : pickHit(hits);
        used = q;
        if (hit) break;
      }
      if (!hit) throw new Error(`no photo found for "${job.query}"`);
      const res = await fetchImpl(hit.url);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = buf[0] === 0x89 && buf[1] === 0x50 ? '.png' : '.jpg';
      const image = job.image.replace(/\.[a-z]+$/, ext);
      const file = job.file.replace(/\.[a-z]+$/, ext);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, buf);
      out.found.push({ ...job, image, file, credit: hit.credit, matched: used });
    } catch (e) {
      out.failed.push({ job, error: (e as Error).message });
    }
  }
  const byFile = new Map<string, StockRunResult['found']>();
  for (const j of out.found) byFile.set(j.yamlFile, [...(byFile.get(j.yamlFile) ?? []), j]);
  for (const [file, js] of byFile) {
    const { doc } = slideMaps(file);
    const root = doc.contents;
    const inDeck = isMap(root) && isSeq(root.get('slides', true));
    const seq = (inDeck ? (root as YAMLMap).get('slides', true) : root) as YAMLSeq;
    const edits: YamlEdit[] = [];
    for (const j of js) {
      const k = seq.items.findIndex((m) => isMap(m) && m.get('id') === j.slideId);
      if (k < 0) continue;
      const at = [...(inDeck ? ['slides'] : []), k];
      edits.push({ path: [...at, 'image'], value: j.image });
      edits.push({ path: [...at, 'imageCredit'], value: j.credit });
    }
    writeFileSync(file, editYaml(readFileSync(file, 'utf8'), edits));
  }
  return out;
}

export function describeStock(j: StockJob, cwd = process.cwd()): string {
  return `${j.slideId} → ${relative(cwd, j.file) || j.file}\n    "${j.query}"`;
}
