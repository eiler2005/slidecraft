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
import { pngSize } from '../qa/pptx-verify.ts';
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

interface OpenverseResults {
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
}

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
      // large photos first (sharp on a full-height cover panel), then everything else
      const get = async (extra: string) => {
        const res = await fetchImpl(`https://api.openverse.org/v1/images/?${q}${extra}`);
        if (!res.ok) throw new Error(`Openverse ${res.status}`);
        return (await res.json()) as OpenverseResults;
      };
      const large = await get('&size=large');
      const all = await get('');
      const seen = new Set(large.results.map((r) => r.url));
      const json = { results: [...large.results, ...all.results.filter((r) => !seen.has(r.url))] };
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

/** Licences that allow commercial use and changes (cropping); NC and ND are refused. */
const OPEN_LICENCE = /^(cc0( 1\.0)?|public domain|pd|cc by(-sa)?( [\d.]+)?)$/i;

/** Wikimedia Commons: original files (often 3000–7000 px), no key; free licences only. */
export function wikimediaProvider(fetchImpl: Fetch = fetch): StockProvider {
  return {
    id: 'wikimedia',
    async search(query) {
      const q = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: `${query} filetype:bitmap`,
        gsrlimit: '20',
        prop: 'imageinfo',
        iiprop: 'url|size|extmetadata',
        // Commons serves thumbnails only at its standard steps (…, 1280, 1920, 3840)
        iiurlwidth: '1920',
      });
      const res = await fetchImpl(`https://commons.wikimedia.org/w/api.php?${q}`, {
        headers: { 'user-agent': 'SlideCraft (https://github.com/eiler2005/slidecraft)' },
      });
      if (!res.ok) throw new Error(`Wikimedia ${res.status}`);
      const json = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title: string;
              index?: number;
              imageinfo?: {
                url: string;
                thumburl?: string;
                width: number;
                height: number;
                descriptionurl: string;
                extmetadata?: Record<string, { value?: string }>;
              }[];
            }
          >;
        };
      };
      const plain = (html?: string) =>
        (html ?? '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      return Object.values(json.query?.pages ?? {})
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .flatMap((p) => {
          const ii = p.imageinfo?.[0];
          const m = ii?.extmetadata ?? {};
          const licence = plain(m.LicenseShortName?.value);
          if (!ii || !OPEN_LICENCE.test(licence)) return [];
          const author = plain(m.Artist?.value) || 'Unknown author';
          return [
            {
              // a 1920 px rendition keeps downloads small and is sharp on any slide panel;
              // the rendition's real width is in its URL, the API may round it up
              url: ii.thumburl ?? ii.url,
              width: thumbWidth(ii.thumburl, ii.width),
              height: Math.round((ii.height * thumbWidth(ii.thumburl, ii.width)) / ii.width),
              credit: {
                author: author.length > 80 ? `${author.slice(0, 78)}…` : author,
                provider: 'Wikimedia Commons',
                license: licence,
                ...(m.LicenseUrl?.value ? { licenseUrl: m.LicenseUrl.value } : {}),
                source: ii.descriptionurl,
                title:
                  plain(m.ObjectName?.value) || p.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
              },
            },
          ];
        });
    },
  };
}

const thumbWidth = (url: string | undefined, original: number) =>
  Math.min(original, Number(url?.match(/\/(\d+)px-[^/]*$/)?.[1] ?? original));

/** Openverse and Wikimedia together: sharp landscape photos first, each in its own order. */
export function autoProvider(fetchImpl: Fetch = fetch): StockProvider {
  const sources = [openverseProvider(fetchImpl), wikimediaProvider(fetchImpl)];
  return {
    id: 'auto',
    async search(query) {
      const lists = await Promise.all(
        sources.map((s) => s.search(query).catch(() => [] as StockHit[])),
      );
      const all = lists.flat();
      const sharp = (h: StockHit) => h.width >= 1600 && h.width >= h.height;
      return [...all.filter(sharp), ...all.filter((h) => !sharp(h))];
    },
  };
}

export function stockProvider(id: string, env = process.env): StockProvider {
  if (id === 'pexels') return pexelsProvider(env);
  if (id === 'pixabay') return pixabayProvider(env);
  if (id === 'openverse') return openverseProvider();
  if (id === 'wikimedia') return wikimediaProvider();
  if (id === 'auto') return autoProvider();
  throw new Error(`unknown stock provider "${id}" (auto, openverse, wikimedia, pexels, pixabay)`);
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

/** Width that keeps a photo sharp on a full-height slide panel. */
export const SHARP_WIDTH = 1600;

/** Landscape hits sharp on a full-height panel (≥ 1600 px) first, then ≥ 1000 px, then the rest by width. */
export function rankHits(hits: StockHit[]): StockHit[] {
  const landscape = hits.filter((h) => h.width >= h.height);
  const sharp = landscape.filter((h) => h.width >= SHARP_WIDTH);
  const fair = landscape.filter((h) => h.width >= 1000 && h.width < SHARP_WIDTH);
  const rest = hits
    .filter((h) => !sharp.includes(h) && !fair.includes(h))
    .sort((a, b) => b.width - a.width);
  return [...sharp, ...fair, ...rest];
}

/** The first landscape hit sharp on a full-height panel (≥ 1600 px), else ≥ 1000 px, else the widest. */
export function pickHit(hits: StockHit[]): StockHit | undefined {
  return rankHits(hits)[0];
}

const UA = { 'user-agent': 'SlideCraft (https://github.com/eiler2005/slidecraft)' };

/** Candidates downloaded before settling for the widest one seen. */
const DOWNLOAD_TRIES = 4;

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
      let ranked: StockHit[] = [];
      let used = job.query;
      for (const q of fallbackQueries(job.query)) {
        const hits = await provider.search(q);
        const chosen =
          pick > 1
            ? hits.filter((h) => h.width >= 1000 && h.width >= h.height)[pick - 1]
            : undefined;
        ranked = pick > 1 ? (chosen ? [chosen] : []) : rankHits(hits);
        used = q;
        if (ranked.length) break;
      }
      if (!ranked.length) throw new Error(`no photo found for "${job.query}"`);
      // listed sizes can be the original's while the URL serves a smaller rendition:
      // measure each download and move on until one is really sharp
      let best: { hit: StockHit; buf: Buffer; width: number } | undefined;
      let lastError = '';
      for (const hit of ranked.slice(0, DOWNLOAD_TRIES)) {
        const res = await fetchImpl(hit.url, { headers: UA }).catch((e: Error) => e);
        if (res instanceof Error || !res.ok) {
          lastError = res instanceof Error ? res.message : `download ${res.status}`;
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const size = pngSize(buf);
        if (!size) {
          lastError = 'download is not a JPEG or PNG image';
          continue;
        }
        if (!best || size.w > best.width) best = { hit, buf, width: size.w };
        if (size.w >= SHARP_WIDTH && size.w >= size.h) break;
      }
      if (!best) throw new Error(lastError || `no photo found for "${job.query}"`);
      const { hit, buf } = best;
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
