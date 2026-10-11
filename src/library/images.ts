/**
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
import YAML, { isMap, isSeq, type YAMLMap } from 'yaml';

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
    const { doc, items } = slideMaps(file);
    for (const j of js) items.find((m) => m.get('id') === j.slideId)?.set('image', j.image);
    writeFileSync(file, doc.toString({ lineWidth: 0 }));
  }
  return out;
}

export function describeJob(j: ImageJob, cwd = process.cwd()): string {
  return `${j.slideId} → ${relative(cwd, j.file) || j.file}\n    "${j.prompt}"`;
}
