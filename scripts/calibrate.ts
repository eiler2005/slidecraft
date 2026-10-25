/**
 * Calibration mode: measure how the local PowerPoint renders text and decks, derive the
 * shared Office rendering rules from that evidence, and gate fidelity on a deck corpus.
 * Slow and needs Chrome + PowerPoint (or LibreOffice) + Poppler: run it when rendering or
 * export changed materially, Office was updated, or a new font/theme family is added —
 * not on every commit. Guide: docs/how-to/calibrate-rendering.md.
 *
 *   npm run calibrate                         # both stages, report only
 *   npm run calibrate -- --stage probe --write   # refit and rewrite src/engine/office-rules.gen.ts
 *   npm run calibrate -- --stage corpus --deck pitch-deck
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import * as fontkit from 'fontkit';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { convertToPdf, pptxConvertEngine } from '../src/backends/pptx-convert.ts';
import { renderPptx } from '../src/backends/pptxgenjs.ts';
import { buildDeck, checkDeck } from '../src/build.ts';
import {
  ascentRatios,
  type Face,
  fontPath,
  hasGlyphs,
  registerMeasureFont,
  vmetrics,
} from '../src/engine/fonts.ts';
import { OFFICE_RULES, type OfficeRules } from '../src/engine/office-rules.gen.ts';
import type { Paragraph, SceneNode, SceneSlide, TextStyle } from '../src/engine/scene.ts';
import { findFontFiles } from '../src/engine/system-fonts.ts';
import { layoutText, makeTextNode } from '../src/engine/text.ts';
import { rebuildPptx } from '../src/library/pptx-rebuild.ts';
import { readPpm, visualMetrics } from './lib/deck-regression.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const stage = value('stage') ?? 'all';
const OUT = resolve('tests/.output/calibration');
const TARGET = Number(value('target') ?? 0.95);
const round = (v: number) => Math.floor(v + 0.5);
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : Number.NaN);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
mkdirSync(OUT, { recursive: true });
process.env.SLIDECRAFT_OFFICE_RECOVER ??= '1';

const officeVersion = () => {
  const plist = '/Applications/Microsoft PowerPoint.app/Contents/Info.plist';
  if (!existsSync(plist)) return 'LibreOffice or unknown Office';
  const r = spawnSync('defaults', ['read', plist, 'CFBundleShortVersionString'], {
    encoding: 'utf8',
  });
  return `Microsoft PowerPoint for Mac ${r.stdout.trim()} (PDF export)`;
};

interface TextItem {
  s: string;
  x: number;
  y: number;
  size: number;
}
async function pdfItems(file: string): Promise<TextItem[][]> {
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0 });
  try {
    const doc = await task.promise;
    const pages: TextItem[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const h = page.view[3]!;
      const tc = await page.getTextContent({ disableNormalization: true });
      pages.push(
        (tc.items as { str: string; transform: number[] }[])
          .filter((i) => i.str.trim())
          .map((i) => ({
            s: i.str,
            x: i.transform[4]!,
            y: h - i.transform[5]!,
            size: Math.hypot(i.transform[2]!, i.transform[3]!),
          })),
      );
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
function pdfWords(file: string, page: number) {
  const x = execFileSync(
    'pdftotext',
    ['-f', String(page), '-l', String(page), '-bbox', file, '-'],
    { encoding: 'utf8' },
  );
  return [
    ...x.matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</g),
  ].map((m) => ({
    x: Number(m[1]),
    y: Number(m[4]),
    t: m[5]!
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"'),
  }));
}
function rasterPages(pdf: string, dir: string): string[] {
  mkdirSync(dir, { recursive: true });
  const run = mkdtempSync(join(dir, 'run-'));
  execFileSync('pdftoppm', ['-scale-to-x', '1600', '-scale-to-y', '-1', pdf, join(run, 'p')], {
    timeout: 300000,
  });
  return readdirSync(run)
    .filter((f) => f.endsWith('.ppm'))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))
    .map((f) => join(run, f));
}

// ───────────────────────────── stage 1: probe → rules ─────────────────────────────

interface Probe {
  tag: string;
  slide: number;
  family: string;
  measure: string;
  face: Face;
  size: number;
  mode: Mode;
  ratio: number;
  kerning: boolean;
  anchor: 'top' | 'middle';
  boxH: number;
  /** Baselines the engine itself predicts (pt below the box top), with the current rules. */
  predicted: number[];
  /** Engine baselines before anchoring (pt below the text top) and block heights (pt). */
  raw: number[];
  pitchH: number;
  inkH: number;
  top: number; // pt
  left: number; // pt
  right: number; // pt
  lines: string[];
}

const SIZES = [9, 10.5, 12, 12.75, 13.5, 15, 16.5, 18, 20, 24, 28, 36, 44, 54];
/** generated: point spacing from a theme (no flag), which SlideCraft exports as a multiple */
type Mode = 'auto' | 'percent' | 'exact' | 'generated';
const MODES: [Mode, number][] = [
  ['auto', 1],
  ['percent', 0.85],
  ['percent', 0.9],
  ['percent', 0.95],
  ['percent', 1],
  ['percent', 1.05],
  ['percent', 1.1],
  ['percent', 1.25],
  ['exact', 1],
  ['exact', 1.1],
  ['exact', 1.2],
  ['exact', 1.3],
  ['generated', 1.12],
  ['generated', 1.2],
  ['generated', 1.3],
];
const SAMPLES = [
  ['Wave', 'AV', 'Tower', '2026'],
  ['Мягкий', 'ёж', 'съел', 'Тот'],
  ['1 000', '75%', 'Office', '(Q4)'],
];

function probeFamilies(): { family: string; measure: string }[] {
  const out = [
    { family: 'Arial', measure: 'liberation-sans' },
    { family: 'Georgia', measure: 'gelasio' },
    { family: 'Times New Roman', measure: 'liberation-serif' },
  ];
  const calibri = findFontFiles('Calibri');
  if (calibri) {
    registerMeasureFont('probe-calibri', calibri, 'Calibri');
    out.push({ family: 'Calibri', measure: 'probe-calibri' });
  }
  return out;
}

function probeScene(families: { family: string; measure: string }[]) {
  const shell = checkDeck('tests/fixtures/chrome/deck.yaml').scene!;
  const template = shell.slides[0]!;
  shell.masters = Object.fromEntries(
    Object.entries(shell.masters).map(([k, m]) => [k, { ...m, nodes: [], slideNumber: undefined }]),
  );
  const probes: Probe[] = [];
  const slides: SceneSlide[] = [];
  const W = shell.format.w * 72;
  const H = shell.format.h * 72;
  let slide: SceneSlide | undefined;
  let x = 18;
  let y = 18;
  let colW = 0;
  const newSlide = () => {
    slide = {
      ...template,
      id: `probe-${slides.length + 1}`,
      index: slides.length,
      nodes: [],
      requiredRoles: [],
      title: 'probe',
    };
    slides.push(slide);
    x = 18;
    y = 18;
    colW = 0;
  };
  newSlide();
  let n = 0;
  for (const { family, measure } of families)
    SIZES.forEach((size, si) =>
      MODES.forEach(([mode, ratio]) => {
        const anchors: ('top' | 'middle')[] =
          si % 3 === 0 &&
          (mode === 'auto' || ratio === 1.2 || (mode === 'percent' && ratio === 1.1))
            ? ['top', 'middle']
            : ['top'];
        for (const anchor of anchors) {
          const face: Face = si % 2 ? 'bold' : 'regular';
          const kerning = n % 2 === 0;
          const tag = `q${(n++).toString(36)}`;
          const lines = SAMPLES.map((words, k) => {
            const text = words.filter((w) => hasGlyphs(measure as never, w)).join(' ');
            return `${tag}${'abc'[k]} ${text}`;
          });
          const { asc, desc } = vmetrics(measure as never, face);
          const autoPitch =
            size *
            (OFFICE_RULES.autoSpacing.pitchEm[family] ??
              OFFICE_RULES.autoSpacing.pitchEm['*'] ??
              asc + desc);
          const pitch = mode === 'exact' || mode === 'generated' ? size * ratio : autoPitch * ratio;
          const style: TextStyle = {
            family,
            measure: measure as never,
            size,
            lineSpacing: +pitch.toFixed(2),
            ...(mode === 'auto' ? { lineSpacingAuto: true, lineSpacingMultiple: 1 } : {}),
            ...(mode === 'percent' ? { lineSpacingMultiple: ratio } : {}),
            ...(mode === 'exact' ? { lineSpacingExact: true } : {}),
            bold: face === 'bold',
            kerning,
            color: '#000000',
            align: 'left',
            valign: anchor,
          };
          const paragraphs: Paragraph[] = lines.map((t) => ({ runs: [{ text: t }] }));
          const laid = layoutText(paragraphs, style, 20);
          const w = (laid.maxLineWidth + 0.05) * 72;
          const h = Math.max(laid.contentHeight * 72, pitch * 3) + (anchor === 'middle' ? 48 : 6);
          if (y + h > H - 12) {
            y = 18;
            x += colW + 14;
            colW = 0;
          }
          if (x + w > W - 12) newSlide();
          const node = makeTextNode(
            paragraphs,
            { x: x / 72, y: y / 72, w: w / 72, h: h / 72 },
            style,
            laid,
            { role: tag },
          );
          slide!.nodes.push(node as SceneNode);
          probes.push({
            tag,
            slide: slides.length,
            family,
            measure,
            face,
            size,
            mode,
            ratio,
            kerning,
            anchor,
            boxH: h,
            predicted: node.lines.map((l) => l.baseline * 72),
            raw: laid.lines.map((l) => l.baseline * 72),
            pitchH: laid.contentHeight * 72,
            inkH:
              (laid.lines.at(-1)!.baseline +
                (size / 72) *
                  (OFFICE_RULES.descentEmByFamily[family] ??
                    vmetrics(measure as never, face).desc)) *
              72,
            top: y,
            left: x,
            right: x + w,
            lines,
          });
          y += h + 6;
          colW = Math.max(colW, w);
        }
      }),
    );
  shell.slides = slides;
  return { scene: shell, probes };
}

type Variant<T> = { id: string; params: T };

function advanceModel(
  measure: string,
  face: Face,
  size: number,
  text: string,
  grid: number,
  snapKern: boolean,
  kern: boolean,
) {
  const f = fontkit.create(readFileSync(fontPath(measure as never, face))) as fontkit.Font;
  const opts = { liga: false, clig: false };
  const xs: number[] = [];
  let x = 0;
  for (const part of text.split(/( +)/)) {
    if (!part) continue;
    const plain = f.layout(part, { ...opts, kern: false } as never);
    const run = kern ? f.layout(part, { ...opts, kern: true } as never) : plain;
    const snap = (v: number) => (grid ? Math.round((v * grid) / 72) * (72 / grid) : v);
    plain.positions.forEach((p, i) => {
      xs.push(x);
      const base = (p.xAdvance * size) / f.unitsPerEm;
      const k = (run.positions[i]!.xAdvance * size) / f.unitsPerEm - base;
      x += snap(base) + (snapKern ? snap(k) : k);
    });
  }
  return xs;
}

async function probeStage() {
  if (!(await pptxConvertEngine.detect()).available)
    throw new Error('PowerPoint or LibreOffice is required');
  const dir = join(OUT, 'probe');
  mkdirSync(dir, { recursive: true });
  const families = probeFamilies();
  const { scene, probes } = probeScene(families);
  const pptx = join(dir, 'probe.pptx');
  writeFileSync(pptx, await renderPptx(scene, new Date(0)));
  const pdf = join(dir, 'probe-office.pdf');
  convertToPdf(pptx, pdf);
  const pages = await pdfItems(pdf);
  type Obs = {
    probe: Probe;
    line: number;
    baseline: number;
    size: number;
    words: { x: number; offset: number }[];
  };
  const obs: Obs[] = [];
  const wordCache = new Map<number, ReturnType<typeof pdfWords>>();
  for (const p of probes) {
    const items = pages[p.slide - 1] ?? [];
    if (!wordCache.has(p.slide)) wordCache.set(p.slide, pdfWords(pdf, p.slide));
    const words = wordCache.get(p.slide)!;
    p.lines.forEach((text, line) => {
      const head = text.split(' ')[0]!;
      const item = items.find((i) => i.s.trim().split(/\s+/)[0] === head);
      const start = words.find((w) => w.t === head && Math.abs(w.x - p.left) < 3);
      if (!item || !start) return;
      // Words of this line in reading order, with their character offset in the line.
      const lineWords = words
        .filter((w) => Math.abs(w.y - start.y) < 0.5 && w.x >= start.x - 0.5 && w.x < p.right)
        .sort((a, b) => a.x - b.x);
      const offsets: { x: number; offset: number }[] = [];
      let cursor = 0;
      for (const w of lineWords) {
        const at = text.indexOf(w.t, cursor);
        if (at < 0) break;
        offsets.push({ x: w.x - start.x, offset: [...text.slice(0, at)].length });
        cursor = at + w.t.length;
      }
      obs.push({ probe: p, line, baseline: item.y - p.top, size: item.size, words: offsets });
    });
  }
  writeFileSync(
    join(dir, 'observations.json'),
    `${JSON.stringify(obs.map((o) => ({ ...o.probe, lines: undefined, predicted: o.probe.predicted[o.line], line: o.line, baseline: o.baseline, drawn: o.size })))}\n`,
  );
  if (obs.length < probes.length * 2)
    throw new Error(`Only ${obs.length} probe lines were found in Office output`);

  // R1 — horizontal advances.
  const advanceVariants: Variant<{ grid: number; snapKern: boolean }>[] = [
    0, 288, 300, 576, 600, 1200,
  ].flatMap((grid) =>
    [false, true]
      .filter((s) => grid || !s)
      .map((snapKern) => ({
        id: grid ? `1/${grid} in, kerning ${snapKern ? 'snapped' : 'exact'}` : 'raw font units',
        params: { grid, snapKern },
      })),
  );
  const advanceScores = advanceVariants.map((v) => {
    const errs: number[] = [];
    for (const o of obs) {
      const xs = advanceModel(
        o.probe.measure,
        o.probe.face,
        o.probe.size,
        o.probe.lines[o.line]!,
        v.params.grid,
        v.params.snapKern,
        o.probe.kerning,
      );
      for (const w of o.words.slice(1))
        if (xs[w.offset] !== undefined) errs.push(Math.abs(xs[w.offset]! - w.x));
    }
    // A >2 pt miss is a word-matching failure, not a metric difference; count it apart.
    const kept = errs.filter((e) => e <= 2);
    return {
      ...v,
      n: kept.length,
      mismatched: errs.length - kept.length,
      mean: mean(kept),
      max: Math.max(...kept),
    };
  });
  const bestAdvance = [...advanceScores].sort((a, b) => a.mean - b.mean)[0]!;

  // R2 — drawn glyph size.
  const drawScores = (['nominal', 'whole-point'] as const).map((id) => {
    const errs = obs.map((o) =>
      Math.abs((id === 'nominal' ? o.probe.size : round(o.probe.size)) - o.size),
    );
    return { id, n: errs.length, mean: mean(errs), max: Math.max(...errs) };
  });
  const bestDraw = [...drawScores].sort((a, b) => a.mean - b.mean)[0]!;

  // R3/R4 — baselines of automatic and exact spacing.
  const baselineOf = (
    o: Obs,
    model: string,
    fraction: number,
    snapPitch: number,
    snap: number,
    pitchEm?: number,
  ) => {
    const { asc, desc } = vmetrics(o.probe.measure as never, o.probe.face);
    const s = o.probe.size;
    let pitch =
      o.probe.mode === 'exact' || o.probe.mode === 'generated'
        ? s * o.probe.ratio
        : s * (pitchEm ?? asc + desc) * o.probe.ratio;
    if (snapPitch) pitch = Math.floor(pitch / snapPitch + 0.5) * snapPitch;
    const first =
      model === 'ascent-ratio'
        ? (pitch * asc) / (asc + desc)
        : model === 'pitch-fraction'
          ? pitch * fraction
          : (pitch - s * (asc + desc)) / 2 + s * asc;
    const v = o.line * pitch + first;
    return snap ? Math.floor(v / snap + 0.5 + 1e-9) * snap : v;
  };
  // Automatic pitch per family, measured from consecutive lines.
  const pitchEm: Record<string, number> = {};
  for (const { family } of families) {
    const ratios: number[] = [];
    for (const o of obs.filter(
      (o) =>
        o.probe.family === family &&
        o.probe.mode === 'auto' &&
        o.probe.anchor === 'top' &&
        o.line === 2,
    )) {
      const first = obs.find((x) => x.probe === o.probe && x.line === 0);
      if (first) ratios.push((o.baseline - first.baseline) / 2 / o.probe.size);
    }
    ratios.sort((a, b) => a - b);
    const { asc, desc } = vmetrics(families.find((f) => f.family === family)!.measure as never);
    const median = ratios[Math.floor(ratios.length / 2)] ?? asc + desc;
    // Keep the font's own box unless the renderer measurably differs from it.
    // Hundredths of an em: finer differences are PDF-grid noise and would make reruns flap.
    if (Math.abs(median - (asc + desc)) > 0.01) pitchEm[family] = Math.round(median * 100) / 100;
  }
  const spacingScores = (mode: 'auto' | 'exact') => {
    const set = obs.filter((o) => o.probe.mode === mode && o.probe.anchor === 'top');
    const models =
      mode === 'auto'
        ? ['ascent-ratio', 'centered']
        : ['centered', 'ascent-ratio', 'pitch-fraction'];
    const out: {
      id: string;
      baseline: string;
      fraction: number;
      snapPitchPt: number;
      snapPt: number;
      mean: number;
      max: number;
      n: number;
    }[] = [];
    for (const model of models)
      for (const fraction of model === 'pitch-fraction'
        ? [0.7, 0.72, 0.74, 0.75, 0.76, 0.78, 0.8]
        : [0.75])
        for (const snapPitchPt of mode === 'exact' ? [0, 1] : [0])
          for (const snapPt of [0, 0.5, 1]) {
            const errs = set.map((o) =>
              Math.abs(
                baselineOf(o, model, fraction, snapPitchPt, snapPt, pitchEm[o.probe.family]) -
                  o.baseline,
              ),
            );
            out.push({
              id: `${model}${model === 'pitch-fraction' ? ` ${fraction}` : ''}, pitch snap ${snapPitchPt || 'none'}, baseline snap ${snapPt || 'none'}`,
              baseline: model,
              fraction,
              snapPitchPt,
              snapPt,
              mean: mean(errs),
              max: Math.max(...errs),
              n: errs.length,
            });
          }
    return out.sort((a, b) => a.mean - b.mean);
  };
  const auto = spacingScores('auto');
  const exact = spacingScores('exact');

  // Per-family vertical fractions, compared with the real Office font's own metrics so an
  // uncalibrated (brand) family can fall back to the metric that predicts PowerPoint best.
  const fitFraction = (
    mode: 'auto' | 'exact',
    family: string,
    snapPitch: number,
    snap: number,
    current?: number,
  ) => {
    const set = obs.filter(
      (o) => o.probe.mode === mode && o.probe.anchor === 'top' && o.probe.family === family,
    );
    let best = { fraction: 0, mean: Number.POSITIVE_INFINITY };
    for (let f = 0.68; f <= 0.86; f += 0.0025) {
      const e = mean(
        set.map((o) =>
          Math.abs(
            baselineOf(o, 'pitch-fraction', f, snapPitch, snap, pitchEm[o.probe.family]) -
              o.baseline,
          ),
        ),
      );
      if (e < best.mean - 1e-9) best = { fraction: Math.round(f * 10000) / 10000, mean: e };
    }
    // Hysteresis: keep the current value unless the refit is clearly better.
    if (current !== undefined) {
      const e = mean(
        set.map((o) =>
          Math.abs(
            baselineOf(o, 'pitch-fraction', current, snapPitch, snap, pitchEm[o.probe.family]) -
              o.baseline,
          ),
        ),
      );
      if (e - best.mean < 0.01) return { fraction: current, mean: e };
    }
    return best;
  };
  const realRatios = (family: string) => {
    const file = findFontFiles(family)?.regular;
    if (!file) return { hhea: Number.NaN, typo: Number.NaN };
    const f = fontkit.create(readFileSync(file)) as fontkit.Font & {
      hhea: { ascent: number; descent: number };
      'OS/2': { typoAscender: number; typoDescender: number };
    };
    return {
      hhea: f.hhea.ascent / (f.hhea.ascent - f.hhea.descent),
      typo: f['OS/2'].typoAscender / (f['OS/2'].typoAscender - f['OS/2'].typoDescender),
    };
  };
  const perFamily = families.map(({ family }) => ({
    family,
    auto: fitFraction(
      'auto',
      family,
      0,
      auto[0]!.snapPt,
      OFFICE_RULES.autoSpacing.ratioByFamily[family] ??
        ascentRatios(families.find((f) => f.family === family)!.measure as never)[
          OFFICE_RULES.autoSpacing.ratio
        ],
    ),
    exact: fitFraction(
      'exact',
      family,
      exact[0]!.snapPitchPt,
      exact[0]!.snapPt,
      OFFICE_RULES.exactSpacing.ratio === 'centered'
        ? undefined
        : (OFFICE_RULES.exactSpacing.ratioByFamily[family] ??
            ascentRatios(families.find((f) => f.family === family)!.measure as never)[
              OFFICE_RULES.exactSpacing.ratio
            ]),
    ),
    ...realRatios(family),
  }));

  // R5 — vertical anchoring: which block height PowerPoint centres, and where it rounds.
  const realDescent = (family: string) => {
    const file = findFontFiles(family)?.regular;
    if (!file) return Number.NaN;
    const f = fontkit.create(readFileSync(file)) as fontkit.Font & { hhea: { descent: number } };
    return -f.hhea.descent / f.unitsPerEm;
  };
  const anchorScores = (['pitch', 'ink'] as const).flatMap((height) =>
    (['none', 'total', 'shift'] as const).map((round1) => {
      // Mirrors makeTextNode: the engine's own baselines and block heights per candidate.
      const errs = obs
        .filter((x) => x.probe.anchor === 'middle')
        .map((o) => {
          const raw = o.probe.raw[o.line]!;
          const dy = Math.max(
            0,
            (o.probe.boxH - (height === 'pitch' ? o.probe.pitchH : o.probe.inkH)) / 2,
          );
          const predicted =
            round1 === 'total' ? round(dy + raw) : round1 === 'shift' ? round(dy) + raw : dy + raw;
          return Math.abs(predicted - o.baseline);
        });
      return {
        id: `${height}, rounding ${round1}`,
        height,
        round1,
        n: errs.length,
        mean: mean(errs),
        max: Math.max(...errs),
      };
    }),
  );
  const bestAnchor = [...anchorScores].sort((a, b) => a.mean - b.mean)[0]!;
  const byFamily = (rows: typeof obs, model: (typeof exact)[number]) =>
    families
      .map(({ family }) => {
        const e = rows
          .filter((o) => o.probe.family === family)
          .map((o) =>
            Math.abs(
              baselineOf(
                o,
                model.baseline,
                model.fraction,
                model.snapPitchPt,
                model.snapPt,
                pitchEm[family],
              ) - o.baseline,
            ),
          );
        return `${family} ${mean(e).toFixed(3)}`;
      })
      .join(', ');

  // Engine check: the current rules as the engine applies them, against PowerPoint.
  const engineRows = (['auto', 'percent', 'exact', 'generated'] as const).flatMap((mode) =>
    (['top', 'middle'] as const).map((anchor) => {
      const e = obs
        .filter((o) => o.probe.mode === mode && o.probe.anchor === anchor)
        .map((o) => Math.abs(o.probe.predicted[o.line]! - o.baseline));
      return { id: `${mode} spacing, ${anchor}`, n: e.length, mean: mean(e), max: Math.max(...e) };
    }),
  );

  // R6 — multiples above 100 %: one share of the pitch for every font.
  const above = obs.filter(
    (o) => o.probe.mode === 'percent' && o.probe.ratio > 1 && o.probe.anchor === 'top',
  );
  const aboveScores = Array.from({ length: 61 }, (_, i) => 0.7 + i * 0.0025).map((f) => {
    const e = above.map((o) => {
      const p = o.probe.size * (pitchEm[o.probe.family] ?? 1.2) * o.probe.ratio;
      return Math.abs(round(o.line * p + p * f) - o.baseline);
    });
    return { id: `${f.toFixed(4)} × pitch`, f, n: e.length, mean: mean(e), max: Math.max(...e) };
  });
  aboveScores.sort((a, b) => a.mean - b.mean);
  const percentError = mean(
    obs
      .filter((o) => o.probe.mode === 'percent' && o.probe.anchor === 'top')
      .map((o) => Math.abs(o.probe.predicted[o.line]! - o.baseline)),
  );
  const exactEngineError = mean(
    obs
      .filter((o) => o.probe.mode === 'exact' && o.probe.anchor === 'top')
      .map((o) => Math.abs(o.probe.predicted[o.line]! - o.baseline)),
  );

  // Ratio kind that best explains the per-family fits, from each real Office font.
  const kindFor = (pick: (f: (typeof perFamily)[number]) => number) =>
    (['hhea', 'typo'] as const)
      .map((k) => ({ k, e: mean(perFamily.map((f) => Math.abs(f[k] - pick(f)))) }))
      .sort((a, b) => a.e - b.e)[0]!.k;
  const autoKind = kindFor((f) => f.auto.fraction);
  const exactKind = kindFor((f) => f.exact.fraction);
  // Store a family only where the engine's measuring font would predict a different share.
  const overrides = (kind: 'hhea' | 'typo', pick: (f: (typeof perFamily)[number]) => number) =>
    Object.fromEntries(
      perFamily
        .filter((f) => {
          const m = families.find((x) => x.family === f.family)!.measure;
          return Math.abs(ascentRatios(m as never)[kind] - pick(f)) > 0.004;
        })
        .map((f) => [f.family, pick(f)]),
    );
  const exactFractionError = mean(perFamily.map((f) => f.exact.mean));
  const centeredError = exact.find((r) => r.baseline === 'centered')!.mean;
  const em = Object.values(pitchEm);
  const allSame = em.length === families.length && Math.max(...em) - Math.min(...em) < 0.005;
  // Hysteresis: keep the current advance rule unless a candidate is clearly better.
  const current = advanceScores.find(
    (a) =>
      a.params.grid === OFFICE_RULES.advance.unitsPerInch &&
      a.params.snapKern === OFFICE_RULES.advance.snapKerning,
  );
  const chosenAdvance = current && current.mean - bestAdvance.mean < 0.005 ? current : bestAdvance;

  const rules: OfficeRules = {
    renderer: officeVersion(),
    calibratedAt: new Date().toISOString().slice(0, 10),
    advance: {
      unitsPerInch: chosenAdvance.params.grid || 0,
      snapKerning: chosenAdvance.params.snapKern,
    },
    drawSize: bestDraw.id,
    anchorHeight: bestAnchor.height,
    anchorRounding: bestAnchor.round1,
    descentEmByFamily: Object.fromEntries(
      families
        .map(
          ({ family, measure }) =>
            [family, realDescent(family), vmetrics(measure as never).desc] as const,
        )
        .filter(([, real, own]) => Number.isFinite(real) && Math.abs(real - own) > 0.005)
        .map(([family, real]) => [family, Math.round(real * 10000) / 10000]),
    ),
    autoSpacing: {
      pitchEm: allSame ? { '*': Math.round(mean(em) * 100) / 100 } : pitchEm,
      aboveOneFraction:
        Math.abs(aboveScores[0]!.f - OFFICE_RULES.autoSpacing.aboveOneFraction) < 0.004
          ? OFFICE_RULES.autoSpacing.aboveOneFraction
          : Math.round(aboveScores[0]!.f * 10000) / 10000,
      ratio: autoKind,
      ratioByFamily: overrides(autoKind, (f) => f.auto.fraction),
      snapPt: auto[0]!.snapPt,
    },
    exactSpacing:
      centeredError <= exactFractionError
        ? {
            export: percentError < exactEngineError ? 'percent' : 'points',
            ratio: 'centered',
            ratioByFamily: {},
            snapPitchPt: 0,
            snapPt: 0,
          }
        : {
            export: percentError < exactEngineError ? 'percent' : 'points',
            ratio: exactKind,
            ratioByFamily: overrides(exactKind, (f) => f.exact.fraction),
            snapPitchPt: exact[0]!.snapPitchPt,
            snapPt: exact[0]!.snapPt,
          },
  };
  const table = (rows: { id: string; mean: number; max: number; n: number }[], chosen: string) =>
    [
      '| Candidate | Mean error (pt) | Max (pt) | Samples |',
      '|---|---|---|---|',
      ...rows
        .slice(0, 8)
        .map(
          (r) =>
            `| ${r.id === chosen ? `**${r.id}**` : r.id} | ${r.mean.toFixed(3)} | ${r.max.toFixed(2)} | ${r.n} |`,
        ),
    ].join('\n');
  const md = [
    '# Office rendering rules — calibration evidence',
    '',
    `Generated by \`npm run calibrate -- --stage probe\` on ${rules.calibratedAt} with ${rules.renderer}.`,
    `Probe: ${probes.length} text blocks, ${obs.length} lines — ${families.map((f) => f.family).join(', ')}; sizes ${SIZES.join(', ')} pt; automatic, percent, exact and generated spacing; regular and bold; Latin, Cyrillic and digits.`,
    'Office PDF output positions text on a 1/300-inch grid, so ±0.12 pt is measurement noise.',
    '',
    '## R1 · Glyph advances',
    table(
      advanceScores.sort((a, b) => a.mean - b.mean),
      bestAdvance.id,
    ),
    '',
    '## R2 · Drawn glyph size',
    table(
      drawScores.sort((a, b) => a.mean - b.mean),
      bestDraw.id,
    ),
    '',
    '## R3 · Automatic line spacing',
    `Measured automatic pitch (em) that differs from the font box: ${
      Object.entries(pitchEm)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') || 'none'
    }.`,
    '',
    table(auto, auto[0]!.id),
    '',
    '## R4 · Exact line spacing',
    table(exact, exact[0]!.id),
    '',
    `Per family (chosen auto rule): ${byFamily(
      obs.filter((o) => o.probe.mode === 'auto' && o.probe.anchor === 'top'),
      auto[0]!,
    )}.`,
    `Per family (chosen exact rule): ${byFamily(
      obs.filter((o) => o.probe.mode === 'exact' && o.probe.anchor === 'top'),
      exact[0]!,
    )}.`,
    '',
    '### Per-family fractions (first baseline ÷ line pitch)',
    '',
    '| Family | Auto: fitted | error (pt) | Exact: fitted | error (pt) | Office font hhea ratio | typo ratio |',
    '|---|---|---|---|---|---|---|',
    ...perFamily.map(
      (f) =>
        `| ${f.family} | ${f.auto.fraction.toFixed(4)} | ${f.auto.mean.toFixed(3)} | ${f.exact.fraction.toFixed(4)} | ${f.exact.mean.toFixed(3)} | ${f.hhea.toFixed(4)} | ${f.typo.toFixed(4)} |`,
    ),
    '',
    '## R6 · Multiples above 100 %',
    table(aboveScores, aboveScores[0]!.id),
    '',
    `Generated point spacing is exported as ${percentError < exactEngineError ? 'a multiple' : 'points'}: engine error with multiples ${percentError.toFixed(3)} pt vs exact points ${exactEngineError.toFixed(3)} pt.`,
    '',
    '## R5 · Vertical anchoring (middle)',
    table(
      anchorScores.sort((a, b) => a.mean - b.mean),
      bestAnchor.id,
    ),
    '',
    `Word-matching failures excluded from R1: ${chosenAdvance.mismatched}. Ties within 0.005 pt keep the current rule.`,
    '',
    '## Engine check — current rules vs PowerPoint (baselines)',
    table(engineRows, ''),
    '',
    '## Chosen rules',
    '',
    '```json',
    JSON.stringify(rules, null, 2),
    '```',
    '',
    'Written to `src/engine/office-rules.gen.ts` with `--write`; rerun the probe to see the engine check improve.',
    '',
  ].join('\n');
  mkdirSync('calibration', { recursive: true });
  writeFileSync(
    join(OUT, 'rules.json'),
    `${JSON.stringify({ rules, advanceScores, drawScores, auto, exact }, null, 2)}\n`,
  );
  if (flag('write')) {
    writeFileSync('calibration/RULES.md', md);
    const src = readFileSync('src/engine/office-rules.gen.ts', 'utf8');
    const body = `export const OFFICE_RULES: OfficeRules = ${JSON.stringify(rules, null, 2)
      .replace(/"([a-zA-Z]+)":/g, '$1:')
      .replace(/"/g, "'")};\n`;
    writeFileSync(
      'src/engine/office-rules.gen.ts',
      src.replace(/export const OFFICE_RULES[\s\S]*$/, body),
    );
    execFileSync('npx', ['biome', 'format', '--write', 'src/engine/office-rules.gen.ts'], {
      stdio: 'ignore',
    });
  }
  console.log(md);
  return rules;
}

// ─────────────────────────── stage 2: corpus → quality gate ───────────────────────────

interface CorpusDeck {
  id: string;
  kind: 'rebuild' | 'generated';
  source: string;
  theme?: string;
}

async function corpusStage() {
  const corpus: CorpusDeck[] = JSON.parse(readFileSync('calibration/corpus.json', 'utf8')).decks;
  const only = value('deck');
  const rows: {
    deck: string;
    kind: string;
    page: number;
    gate: number;
    pairs: Record<string, number>;
  }[] = [];
  const problems: string[] = [];
  for (const deck of corpus.filter((d) => !only || d.id === only)) {
    const dir = join(OUT, 'corpus', deck.id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    console.log(`▶ ${deck.id}`);
    const raster: Record<string, string[]> = {};
    let gatePair: [string, string];
    const extra: [string, string][] = [];
    if (deck.kind === 'rebuild') {
      const result = await rebuildPptx(deck.source, {
        formats: ['pptx', 'html', 'pdf'],
        pptxEngine: 'pptxgenjs',
        pdfEngine: 'html',
        outDir: join(dir, 'build'),
      });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      if (errors.length)
        problems.push(`${deck.id}: ${errors.length} import/export errors (${errors[0]!.message})`);
      const file = (k: string) => result.files.find((f) => f.kind === k)?.path;
      if (!file('pptx') || !file('pdf')) {
        problems.push(`${deck.id}: no editable PPTX/HTML produced`);
        continue;
      }
      convertToPdf(deck.source, join(dir, 'original-office.pdf'));
      convertToPdf(file('pptx')!, join(dir, 'pptx-office.pdf'));
      raster.original = rasterPages(join(dir, 'original-office.pdf'), join(dir, 'original'));
      raster.pptx = rasterPages(join(dir, 'pptx-office.pdf'), join(dir, 'pptx'));
      raster.html = rasterPages(file('pdf')!, join(dir, 'html'));
      gatePair = ['original', 'pptx'];
      extra.push(['original', 'html'], ['html', 'pptx']);
    } else {
      const work = join(dir, 'src');
      cpSync(resolve(deck.source, '..'), work, {
        recursive: true,
        filter: (p) => !p.includes('/dist'),
      });
      const deckFile = join(work, 'deck.yaml');
      if (deck.theme)
        writeFileSync(
          deckFile,
          readFileSync(deckFile, 'utf8').replace(/^theme:.*$/m, `theme: ${deck.theme}`),
        );
      const result = await buildDeck(deckFile, {
        formats: ['pptx', 'html', 'pdf'],
        pptxEngine: 'pptxgenjs',
        pdfEngine: 'html',
        outDir: join(dir, 'build'),
      });
      const file = (k: string) => result.files.find((f) => f.kind === k)?.path;
      if (!file('pptx') || !file('pdf')) {
        problems.push(`${deck.id}: build produced no PPTX/HTML`);
        continue;
      }
      convertToPdf(file('pptx')!, join(dir, 'pptx-office.pdf'));
      raster.pptx = rasterPages(join(dir, 'pptx-office.pdf'), join(dir, 'pptx'));
      raster.html = rasterPages(file('pdf')!, join(dir, 'html'));
      gatePair = ['html', 'pptx'];
    }
    const pages = raster[gatePair[0]]!.length;
    if (Object.values(raster).some((r) => r.length !== pages))
      problems.push(`${deck.id}: page counts differ`);
    for (let i = 0; i < pages; i++) {
      const score = ([a, b]: [string, string]) =>
        visualMetrics(readPpm(readFileSync(raster[a]![i]!)), readPpm(readFileSync(raster[b]![i]!)))
          .worstRegion;
      const pairs: Record<string, number> = { [`${gatePair[0]}↔${gatePair[1]}`]: score(gatePair) };
      for (const p of extra) pairs[`${p[0]}↔${p[1]}`] = score(p);
      rows.push({
        deck: deck.id,
        kind: deck.kind,
        page: i + 1,
        gate: pairs[`${gatePair[0]}↔${gatePair[1]}`]!,
        pairs,
      });
    }
  }
  const decks = [...new Set(rows.map((r) => r.deck))];
  const passRate = rows.filter((r) => r.gate >= TARGET).length / rows.length;
  const minPage = Math.min(...rows.map((r) => r.gate));
  const ok = problems.length === 0 && minPage >= TARGET;
  const md = [
    '# Calibration corpus report',
    '',
    `Generated by \`npm run calibrate -- --stage corpus\` on ${new Date().toISOString().slice(0, 10)} with ${officeVersion()}.`,
    '',
    `**Quality gate: every page ≥ ${pct(TARGET)} on the deck's gate pair — ${ok ? 'PASS' : 'FAIL'}.** Pages passing: ${pct(passRate)} (${rows.filter((r) => r.gate >= TARGET).length}/${rows.length}); worst page ${pct(minPage)}; mean ${pct(mean(rows.map((r) => r.gate)))}.`,
    '',
    'Score per page: worst of 16 regions (4×4 at 1600 px), each the lower of RGB similarity and edge-detail similarity — strict, not a perceptual percentage. Gate pair: original Office render ↔ rebuilt editable PPTX in Office (`rebuild` decks), or the deck HTML ↔ its editable PPTX in Office (`generated` decks).',
    '',
    '| Deck | Kind | Pages | Gate min | Gate median | Pages ≥ target | Other pairs (min) |',
    '|---|---|---|---|---|---|---|',
    ...decks.map((d) => {
      const r = rows.filter((x) => x.deck === d);
      const g = r.map((x) => x.gate).sort((a, b) => a - b);
      const others = Object.keys(r[0]!.pairs)
        .slice(1)
        .map((k) => `${k} ${pct(Math.min(...r.map((x) => x.pairs[k]!)))}`)
        .join(', ');
      return `| ${d} | ${r[0]!.kind} | ${r.length} | ${pct(g[0]!)} | ${pct(g[Math.floor(g.length / 2)]!)} | ${g.filter((v) => v >= TARGET).length} | ${others || '—'} |`;
    }),
    '',
    ...(problems.length ? ['## Problems', '', ...problems.map((p) => `- ${p}`), ''] : []),
  ].join('\n');
  writeFileSync(join(OUT, 'corpus.json'), `${JSON.stringify({ rows, problems }, null, 2)}\n`);
  if (!only) writeFileSync('calibration/REPORT.md', md);
  console.log(md);
  return ok;
}

let ok = true;
if (stage === 'probe' || stage === 'all') await probeStage();
if (stage === 'corpus' || stage === 'all') ok = await corpusStage();
process.exitCode = ok ? 0 : 1;
