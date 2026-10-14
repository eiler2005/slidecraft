/**
 * Renders the explainer GIF (scripts/launch/story.ts) from vector slides of the example decks:
 *   npx tsx scripts/launch/gif-story.ts
 * Writes docs/media/launch/slidecraft-story.gif (16:9, README), docs/media/launch/ph-story.gif
 * (the same story at 5:3 for the Product Hunt gallery, 1270×760 there) and one key frame per
 * scene to docs/media/launch/gif-frames/. The "checks" scene uses the FDE v2 budget slide with its
 * month-2 total set wrong, as in the review that caught it.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { slideSvg } from '../../src/backends/svg.ts';
import { checkDeck } from '../../src/build.ts';
import { composeDeck } from '../../src/engine/compose.ts';
import type { Scene } from '../../src/engine/scene.ts';
import { encodePng } from '../../src/qa/raster.ts';
import { encodeGif, type Frame } from './gif.ts';
import { storyFrames } from './story.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'docs/media/launch');
const work = mkdtempSync(join(tmpdir(), 'sc-story-'));
const svg = (name: string, scene: Scene, id: string) => {
  const s = scene.slides.find((x) => x.id === id)!;
  const p = join(work, `${name}.svg`);
  writeFileSync(p, slideSvg(scene, s));
  return relative(ROOT, p);
};

// the example made from one prompt (Codex)
const ex = checkDeck(join(ROOT, 'examples/llm-concepts/deck.yaml'));
const slides = ex.scene!.slides.map((s, i) => svg(`llm-${i + 1}`, ex.scene!, s.id));
// cover options: the same cover with the two motifs `slidecraft covers` offered
const covers = (['network', 'growth'] as const).map((art, i) => {
  const l = ex.loaded;
  const { scene } = composeDeck({
    ...l,
    slides: [{ ...(l.slides[0] as object), art } as never],
    diagnostics: [],
  });
  return svg(`cover-${i}`, scene, scene.slides[0]!.id);
});
// FDE v2: the combo chart, and the budget with the planted error
const v2dir = join(ROOT, 'examples/fde-engineer-en-v2');
const v2 = checkDeck(join(v2dir, 'deck.yaml')).scene!;
const chart = svg('chart', v2, 'pilot-plan');
const wrongDir = join(work, 'wrong');
cpSync(v2dir, wrongDir, { recursive: true });
const deckPath = join(wrongDir, 'deck.yaml');
writeFileSync(
  deckPath,
  readFileSync(deckPath, 'utf8').replace('$69k, $67k, $70k', '$69k, $69k, $70k'),
);
const wrong = checkDeck(deckPath);
if (!wrong.diagnostics.some((d) => d.code === 'SC-CONSIST-002'))
  throw new Error('the planted total was not caught');
const budget = svg('budget-wrong', wrong.scene!, 'budget');

const frames = await storyFrames({
  root: ROOT,
  prompt: [
    'Study github.com/eiler2005/slidecraft and make me an editable PowerPoint deck.',
    'Topic: Key concepts for understanding LLMs and AI agents',
    'For whom: managers and engineers new to AI',
    'Length: 10–12 slides · Style: calm consulting look',
  ],
  titles: ex.scene!.slides.map((s) => s.title ?? ''),
  covers,
  recommended: 0,
  why: 'A — the network motif stands for "AI" and "agents" in the title; B is generic.',
  slides,
  totalSlide: budget,
  totalRow: { x: 0.045, y: 0.388, w: 0.5, h: 0.146 },
  wrongCell: { x: 0.437, w: 0.075 },
  chartSlide: chart,
  notes: ['[Sources]', '- Pilot planning assumptions for a typical enterprise — illustrative data'],
});
mkdirSync(join(OUT, 'gif-frames'), { recursive: true });
writeFileSync(join(OUT, 'slidecraft-story.gif'), encodeGif(frames));

/** Grows a frame to `height` by repeating its top and bottom rows, so the bands match the scene. */
function letterbox(f: Frame, height: number): Frame {
  const row = f.width * 4;
  const top = Math.floor((height - f.height) / 2);
  const rgba = new Uint8Array(row * height);
  const first = f.rgba.subarray(0, row);
  const last = f.rgba.subarray(row * (f.height - 1), row * f.height);
  for (let y = 0; y < height; y++) {
    const src = y - top;
    rgba.set(
      src < 0 ? first : src >= f.height ? last : f.rgba.subarray(row * src, row * (src + 1)),
      row * y,
    );
  }
  return { ...f, height, rgba };
}
// Product Hunt shows gallery media at 1270×760 (5:3); a 16:9 GIF there loses its edges
const ph = frames.map((f) => letterbox(f, Math.round((f.width * 3) / 5)));
writeFileSync(join(OUT, 'ph-story.gif'), encodeGif(ph));
// one key frame per scene: the last frame before each cross-fade
const keys = frames.filter((f, i) => f.delay >= 2000 || i === frames.length - 1);
const names = ['problem', 'prompt', 'storyline', 'cover', 'build', 'checks', 'editable', 'result'];
keys.slice(0, names.length).forEach((f, i) => {
  const rgb = new Uint8Array((f.rgba.length / 4) * 3);
  for (let a = 0, b = 0; a < f.rgba.length; a += 4, b += 3) rgb.set(f.rgba.subarray(a, a + 3), b);
  writeFileSync(
    join(OUT, 'gif-frames', `${String(i + 1).padStart(2, '0')}-${names[i]}.png`),
    encodePng({ width: f.width, height: f.height, rgb }),
  );
});
rmSync(work, { recursive: true, force: true });
console.log(
  `✔ ${frames.length} frames, ${(frames.reduce((a, f) => a + f.delay, 0) / 1000).toFixed(1)} s → docs/media/launch/slidecraft-story.gif`,
);
