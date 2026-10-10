/**
 * Previews for choosing templates: contact sheets (all slides of a deck on one image),
 * layout thumbnails, the README gallery and the interactive picker page.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { rasterize } from './backends/resvg.ts';
import { esc, PX_PER_IN, slideSvg } from './backends/svg.ts';
import { composeDeck } from './engine/compose.ts';
import type { Scene } from './engine/scene.ts';
import { LAYOUTS } from './layouts/index.ts';
import { getStoryline, getTheme, type LoadedDeck, loadDeck } from './library/load.ts';
import type { TemplateOption } from './library/rank.ts';
import { DOCS_DIR, ROOT } from './paths.ts';
import { Deck, Slide } from './spec/deck.ts';
import type { Storyline } from './spec/storyline.ts';

/** All slides of a scene on one image, `cols` per row, with a thin frame per slide. */
export function contactSheetSvg(scene: Scene, cols = 4, max = 12): string {
  const slides = scene.slides.slice(0, max);
  const W = scene.format.w * PX_PER_IN;
  const H = scene.format.h * PX_PER_IN;
  const gap = 40;
  const rowsN = Math.ceil(slides.length / cols);
  const totalW = cols * W + (cols + 1) * gap;
  const totalH = rowsN * H + (rowsN + 1) * gap;
  const parts = slides.map((s, i) => {
    const x = gap + (i % cols) * (W + gap);
    const y = gap + Math.floor(i / cols) * (H + gap);
    const svg = slideSvg(scene, s).replace(/^<svg /, `<svg x="${x}" y="${y}" `);
    return `<rect x="${x - 2}" y="${y - 2}" width="${W + 4}" height="${H + 4}" fill="#D5DAE1"/>${svg}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}"><rect width="${totalW}" height="${totalH}" fill="#EEF1F5"/>${parts.join('')}</svg>`;
}

export async function contactSheetPng(
  scene: Scene,
  width = 2000,
  cols = 4,
  max = 12,
): Promise<Buffer> {
  return rasterize(contactSheetSvg(scene, cols, max), width);
}

/** A preview deck for a storyline: its example deck if present, else one slide per slot from layout examples. */
export function previewDeck(storyline: Storyline, themeId: string): LoadedDeck {
  const example = join(ROOT, 'examples', storyline.id, 'deck.yaml');
  if (existsSync(example)) {
    const l = loadDeck(example);
    l.deck = { ...l.deck, theme: themeId };
    return l;
  }
  const raws: Record<string, unknown>[] = [];
  const sources = new Set<string>();
  const used = new Map<string, number>();
  for (const sec of storyline.sections) {
    for (const slot of sec.slots) {
      const def = LAYOUTS.find((l) => slot.layouts.includes(l.id));
      if (!def) continue;
      // rotate through a layout's examples so repeated slots do not show the same slide
      const n = used.get(def.id) ?? 0;
      used.set(def.id, n + 1);
      const ex = def.examples[n % def.examples.length]!;
      ex.sources?.forEach((s) => sources.add(s));
      raws.push({
        id: `${slot.id}`,
        layout: def.id,
        title: ex.title,
        ...(ex.variant ? { variant: ex.variant } : {}),
        ...(ex.sources ? { sources: ex.sources } : {}),
        ...(def.frame === 'standard' ? { tracker: sec.name } : {}),
        ...(ex.content as object),
      });
    }
  }
  const deck = Deck.parse({
    schemaVersion: 1,
    id: `${storyline.id}-preview`,
    title: storyline.name,
    theme: themeId,
    storyline: storyline.id,
    sources: [...sources].map((id) => ({
      id,
      title: 'Illustrative sample data',
      illustrative: true,
    })),
    slides: raws,
  });
  return {
    deck,
    slides: raws.map((r) => Slide.parse(r) as never),
    path: join(ROOT, 'examples', `${storyline.id}.yaml`),
    baseDir: ROOT,
    diagnostics: [],
  };
}

export interface GalleryResult {
  files: string[];
}

/** docs/gallery: storyline × theme contact sheets and per-layout thumbnails. */
export async function buildGallery(opts: {
  out?: string;
  storylines: Storyline[];
  /** Themes to render; default: each storyline's recommended themes. */
  themes?: string[];
  width?: number;
}): Promise<GalleryResult> {
  const out = resolve(opts.out ?? join(DOCS_DIR, 'gallery'));
  mkdirSync(join(out, 'layouts'), { recursive: true });
  const files: string[] = [];
  for (const s of opts.storylines) {
    for (const t of opts.themes ?? s.themes) {
      const { scene } = composeDeck(previewDeck(s, t));
      const p = join(out, `${s.id}--${t}.png`);
      writeFileSync(p, await contactSheetPng(scene, opts.width ?? 1400));
      files.push(p);
    }
  }
  // layout thumbnails in the default theme, one per variant example
  for (const def of LAYOUTS) {
    for (const [i, ex] of def.examples.entries()) {
      const raw = {
        id: `${def.id}-${i}`,
        layout: def.id,
        title: ex.title,
        ...(ex.variant ? { variant: ex.variant } : {}),
        ...(ex.sources ? { sources: ex.sources } : {}),
        ...(ex.content as object),
      };
      const deck = Deck.parse({
        schemaVersion: 1,
        id: 'thumb',
        title: def.name,
        theme: 'consulting-classic',
        sources: (ex.sources ?? []).map((id) => ({
          id,
          title: 'Illustrative sample data',
          illustrative: true,
        })),
        slides: [raw],
      });
      const { scene } = composeDeck({
        deck,
        slides: [Slide.parse(raw) as never],
        path: '',
        baseDir: ROOT,
        diagnostics: [],
      });
      const p = join(out, 'layouts', `${def.id}--${ex.variant ?? def.variants[0]}.png`);
      writeFileSync(p, await rasterize(slideSvg(scene, scene.slides[0]!), 800));
      files.push(p);
    }
  }
  return { files };
}

/** Self-contained picker page with options A/B/C and their contact sheets. */
export async function writePicker(
  options: TemplateOption[],
  outPath: string,
  briefGoal: string,
): Promise<string> {
  mkdirSync(dirname(outPath), { recursive: true });
  const cards: string[] = [];
  for (const o of options) {
    const s = getStoryline(o.storyline);
    const t = getTheme(o.theme);
    if (!s || !t) continue;
    const cached = join(DOCS_DIR, 'gallery', `${o.storyline}--${o.theme}.png`);
    const png = existsSync(cached)
      ? readFileSync(cached)
      : await contactSheetPng(composeDeck(previewDeck(s, o.theme)).scene, 1800);
    const img = `data:image/png;base64,${png.toString('base64')}`;
    const sheet = join(dirname(outPath), `option-${o.option}.png`);
    writeFileSync(sheet, png);
    o.preview = sheet;
    cards.push(`<article class="card"><header><span class="badge">${o.option}</span><div><h2>${esc(o.storylineName)}</h2><p class="theme">${esc(o.themeName)} theme</p></div></header>
<img src="${img}" alt="Option ${o.option}: ${esc(o.storylineName)} in ${esc(o.themeName)}">
<p class="arc">${esc(o.arc)}</p><p class="why">Why: ${esc(o.why)}</p></article>`);
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SlideCraft — pick a template</title>
<style>
:root{--bg:#F4F6F9;--ink:#0B1F3A;--muted:#5B6B7F;--card:#fff;--accent:#1F5FBF}
@media (prefers-color-scheme:dark){:root{--bg:#0E1116;--ink:#EEF1F5;--muted:#A3ADBA;--card:#171B22;--accent:#6EA1F0}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
main{max-width:1500px;margin:0 auto;padding:32px 20px}h1{font-size:26px;margin:0 0 4px}.goal{color:var(--muted);margin:0 0 24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px}
.card{background:var(--card);border-radius:14px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card header{display:flex;gap:12px;align-items:center;margin-bottom:12px}.card h2{font-size:18px;margin:0}.theme{margin:0;color:var(--muted)}
.badge{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:18px}
img{width:100%;border-radius:8px;display:block}.arc{font-weight:600;margin:12px 0 4px}.why{color:var(--muted);margin:0}
footer{margin-top:24px;color:var(--muted)}
</style></head><body><main><h1>Pick a template</h1><p class="goal">${esc(briefGoal)}</p>
<div class="grid">${cards.join('\n')}</div>
<footer>Reply in Claude Code with A, B or C — or describe what you would change.</footer></main></body></html>`;
  writeFileSync(outPath, html);
  return outPath;
}
