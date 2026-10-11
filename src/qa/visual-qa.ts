/**
 * Visual QA pack: the final, LLM-driven quality stage. Rules and calibration make HTML and
 * the editable PPTX agree; a reviewer model then looks at what was actually rendered — the
 * PowerPoint page, the HTML page and their difference — together with measured facts, and
 * judges what rules cannot: craft, colour, template conformance, meaning and readiness.
 * Findings are recorded as a user-facing report. Checklist: library/references/visual-qa.md.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { convertToPdf, pptxConvertEngine } from '../backends/pptx-convert.ts';
import { buildDeck } from '../build.ts';
import { contrast } from '../engine/color.ts';
import type { Box, Scene, SceneNode, SceneSlide, TextNode } from '../engine/scene.ts';
import { getTheme } from '../library/load.ts';
import type { Diagnostic } from './codes.ts';
import { diffOverlay, encodePng, type Raster, readPpm, visualMetrics } from './raster.ts';
import { appendReviewLog, diffAgainstSnapshot, snapshotSources } from './review-log.ts';
import { bgAt } from './scene-checks.ts';

export const VISUAL_QA_TARGET = 0.95;

export interface SlideFacts {
  slide: number;
  id: string;
  title: string;
  layout: string;
  images: { pptx?: string; html: string; diff?: string };
  parity?: { worstRegion: number; hotspots: { region: string; score: number; box: Box }[] };
  diagnostics: Pick<Diagnostic, 'code' | 'severity' | 'message' | 'pointer'>[];
  contrast: { text: string; ratio: number; needs: number; fg: string; bg: string }[];
  offPalette: string[];
  nearMisalignments: { a: string; b: string; edge: 'left' | 'top'; deltaPt: number }[];
  outsideSafeArea: string[];
  tightText: { text: string; fill: number }[];
  fonts: string[];
}

export interface VisualQaPack {
  dir: string;
  deck: string;
  theme: string;
  renderer: string;
  target: number;
  slides: SlideFacts[];
  deckFacts: { titleTopSpreadPt: number; paletteSize: number; pagesBelowTarget: number };
}

const pt = (inch: number) => Math.round(inch * 72 * 100) / 100;
const label = (n: SceneNode) =>
  (n.kind === 'text'
    ? n.paragraphs
        .flatMap((p) => p.runs.map((r) => r.text))
        .join(' ')
        .slice(0, 48)
    : `${n.kind}`) + (n.role ? ` [${n.role}]` : '');

function boxOf(n: SceneNode): Box | undefined {
  if (n.kind === 'line')
    return {
      x: Math.min(n.x1, n.x2),
      y: Math.min(n.y1, n.y2),
      w: Math.abs(n.x2 - n.x1),
      h: Math.abs(n.y2 - n.y1),
    };
  return 'box' in n ? n.box : undefined;
}

function colorsOf(n: SceneNode, out: Set<string>) {
  const add = (c?: string) => c && out.add(c.toUpperCase());
  if (n.kind === 'text') for (const l of n.lines) for (const s of l.segments) add(s.color);
  if ('fill' in n) add(n.fill);
  if ('stroke' in n && n.stroke) add(n.stroke.color);
  if (n.kind === 'chart') for (const p of n.primitives) colorsOf(p, out);
  if (n.kind === 'table')
    for (const row of n.cells)
      for (const c of row) {
        add(c.fill);
        colorsOf(c.text, out);
      }
}

/** Measured facts the reviewer cannot read off a picture reliably. */
export function slideFacts(scene: Scene, slide: SceneSlide, palette: Set<string>) {
  const bg = slide.background ?? scene.masters[slide.master]!.background;
  const contrastRows: SlideFacts['contrast'] = [];
  const used = new Set<string>();
  const tight: SlideFacts['tightText'] = [];
  const fonts = new Set<string>();
  slide.nodes.forEach((n, i) => {
    colorsOf(n, used);
    if (n.kind !== 'text') return;
    fonts.add(n.style.family);
    const back = bgAt(
      slide.nodes,
      i,
      n.box.x + 0.05,
      n.box.y + Math.min(n.contentHeight, n.box.h) / 2,
      bg,
    );
    const fg = n.lines[0]?.segments[0]?.color ?? n.style.color;
    const ratio = contrast(fg, back);
    const needs = n.style.size >= 18 || (n.style.size >= 14 && n.style.bold) ? 3 : 4.5;
    if (ratio < needs + 1.5)
      contrastRows.push({
        text: label(n),
        ratio: Math.round(ratio * 100) / 100,
        needs,
        fg,
        bg: back,
      });
    const fill = n.contentHeight / Math.max(1e-6, n.box.h);
    if (n.lines.length > 1 && fill > 0.97)
      tight.push({ text: label(n), fill: Math.round(fill * 100) / 100 });
  });
  const boxes = slide.nodes
    .map((n) => ({ n, b: boxOf(n) }))
    .filter((x): x is { n: SceneNode; b: Box } => !!x.b && x.b.w > 0.05 && x.b.h > 0.05);
  const near: SlideFacts['nearMisalignments'] = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      for (const edge of ['left', 'top'] as const) {
        const d = Math.abs(edge === 'left' ? a.b.x - b.b.x : a.b.y - b.b.y);
        // 0.5–4 pt apart: almost aligned, which reads as a mistake rather than a choice.
        if (d * 72 > 0.5 && d * 72 < 4)
          near.push({ a: label(a.n), b: label(b.n), edge, deltaPt: Math.round(d * 72 * 10) / 10 });
      }
    }
  const W = scene.format.w;
  const H = scene.format.h;
  const margin = 0.25;
  const outside = boxes
    .filter(({ b }) => !(b.w > W * 0.9 || b.h > H * 0.9))
    .filter(
      ({ b }) => b.x < margin || b.y < margin || b.x + b.w > W - margin || b.y + b.h > H - margin,
    )
    .filter(({ n }) => n.kind === 'text')
    .map(({ n }) => label(n));
  return {
    contrast: contrastRows,
    offPalette: [...used].filter((c) => !palette.has(c)),
    nearMisalignments: near.slice(0, 12),
    outsideSafeArea: outside,
    tightText: tight,
    fonts: [...fonts],
  };
}

function rasterPages(pdf: string, width: number): Raster[] {
  const dir = mkdtempSync(join(tmpdir(), 'slidecraft-vqa-'));
  try {
    execFileSync(
      'pdftoppm',
      ['-scale-to-x', String(width), '-scale-to-y', '-1', pdf, join(dir, 'p')],
      {
        timeout: 300000,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return readdirSync(dir)
      .filter((f) => f.endsWith('.ppm'))
      .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))
      .map((f) => readPpm(readFileSync(join(dir, f))));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Build, render through PowerPoint and Chrome, and write the review pack. */
export async function visualQaPack(
  deckPath: string,
  opts: { outDir?: string; width?: number } = {},
): Promise<VisualQaPack> {
  if (spawnSync('pdftoppm', ['-v']).status !== 0)
    throw new Error('Visual QA needs Poppler (pdftoppm) to rasterise the rendered pages');
  const outDir = resolve(opts.outDir ?? join(dirname(resolve(deckPath)), 'dist'));
  const dir = join(outDir, 'visual-qa');
  mkdirSync(dir, { recursive: true });
  // Keep the review history (record.json, REPORT.md, findings) across rounds.
  for (const f of readdirSync(dir))
    if (/\.(png|pdf)$/.test(f) || f === 'qa.json' || f === 'index.md')
      rmSync(join(dir, f), { force: true });
  // Its own build folder: the user's dist/ outputs and manifest stay untouched.
  const built = await buildDeck(deckPath, {
    formats: ['pptx', 'html', 'pdf'],
    pdfEngine: 'html',
    outDir: join(dir, 'build'),
  });
  const scene = built.scene;
  const file = (k: string) => built.files.find((f) => f.kind === k)?.path;
  if (!scene || !file('pdf')) throw new Error('Build failed; run `slidecraft check` first');
  const sources = snapshotSources(deckPath, join(dir, 'baseline'));
  const width = opts.width ?? 1600;
  const html = rasterPages(file('pdf')!, width);
  const office = await pptxConvertEngine.detect();
  let pptx: Raster[] | undefined;
  if (office.available && file('pptx')) {
    const pdf = join(dir, 'pptx-office.pdf');
    convertToPdf(file('pptx')!, pdf);
    pptx = rasterPages(pdf, width);
  }
  const theme = getTheme(scene.themeId);
  const palette = new Set(
    [...Object.values(theme?.colors ?? {}), ...(theme?.chart ?? []), '#FFFFFF', '#000000'].map(
      (c) => String(c).toUpperCase(),
    ),
  );
  const slides: SlideFacts[] = scene.slides.map((slide, i) => {
    const stem = `${String(i + 1).padStart(2, '0')}-${slide.id}`;
    const save = (name: string, r: Raster) => {
      const path = join(dir, `${stem}-${name}.png`);
      writeFileSync(path, encodePng(r));
      return relative(dir, path);
    };
    const images: SlideFacts['images'] = { html: save('html', html[i]!) };
    let parity: SlideFacts['parity'];
    if (pptx?.[i]) {
      images.pptx = save('pptx', pptx[i]!);
      images.diff = save('diff', diffOverlay(pptx[i]!, html[i]!));
      const m = visualMetrics(pptx[i]!, html[i]!);
      parity = {
        worstRegion: m.worstRegion,
        hotspots: m.regions
          .map((r) => ({ ...r, score: Math.min(r.similarity, r.detailSimilarity) }))
          .filter((r) => r.score < VISUAL_QA_TARGET)
          .map((r) => ({
            region: `row ${r.row + 1}, column ${r.column + 1}`,
            score: Math.round(r.score * 1000) / 1000,
            box: {
              x: pt((r.column * scene.format.w) / 4),
              y: pt((r.row * scene.format.h) / 4),
              w: pt(scene.format.w / 4),
              h: pt(scene.format.h / 4),
            },
          })),
      };
    }
    return {
      slide: i + 1,
      id: slide.id,
      title: slide.title,
      layout: slide.layout,
      images,
      ...(parity ? { parity } : {}),
      diagnostics: built.diagnostics
        .filter((d) => d.slide === slide.id)
        .map(({ code, severity, message, pointer }) => ({ code, severity, message, pointer })),
      ...slideFacts(scene, slide, palette),
    };
  });
  const titleTops = scene.slides
    .filter((s) => s.master === 'content')
    .map((s) => s.nodes.find((n): n is TextNode => n.kind === 'text' && n.role === 'title'))
    .filter((t): t is TextNode => !!t)
    .map((t) => t.box.y * 72);
  const allColors = new Set<string>();
  for (const s of scene.slides) for (const n of s.nodes) colorsOf(n, allColors);
  const pack: VisualQaPack = {
    dir: relative(process.cwd(), dir) || '.',
    deck: relative(process.cwd(), resolve(deckPath)),
    theme: scene.themeId,
    renderer: pptx
      ? (office.detail ?? 'Office')
      : 'none (HTML only — install PowerPoint or LibreOffice for parity)',
    target: VISUAL_QA_TARGET,
    slides,
    deckFacts: {
      titleTopSpreadPt: titleTops.length
        ? Math.round((Math.max(...titleTops) - Math.min(...titleTops)) * 10) / 10
        : 0,
      paletteSize: allColors.size,
      pagesBelowTarget: slides.filter((s) => s.parity && s.parity.worstRegion < VISUAL_QA_TARGET)
        .length,
    },
  };
  writeFileSync(join(dir, 'qa.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(join(dir, 'index.md'), packMarkdown(pack));
  appendReviewLog(deckPath, {
    stage: 'visual-qa',
    summary: `Review pack for ${slides.length} slides (${pack.renderer}); ${pack.deckFacts.pagesBelowTarget} page(s) below ${Math.round(VISUAL_QA_TARGET * 100)} % PowerPoint↔HTML parity. Sources snapshotted: ${sources.join(', ')}.`,
    data: {
      parity: Object.fromEntries(slides.map((s) => [s.id, s.parity?.worstRegion ?? null])),
    },
  });
  return pack;
}

function packMarkdown(p: VisualQaPack): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const lines = [
    '# Visual QA pack',
    '',
    `Deck: \`${p.deck}\` · theme \`${p.theme}\` · renderer: ${p.renderer}.`,
    `Checklist: \`library/references/visual-qa.md\` in the SlideCraft package. Record findings with \`slidecraft visual-qa <deck> --record findings.json\`.`,
    '',
    `Deck facts: title top spread ${p.deckFacts.titleTopSpreadPt} pt · ${p.deckFacts.paletteSize} colours in use · ${p.deckFacts.pagesBelowTarget} page(s) below ${pct(p.target)} PowerPoint↔HTML parity.`,
    '',
  ];
  for (const s of p.slides) {
    lines.push(
      `## ${s.slide} · ${s.id} — ${s.title}`,
      '',
      `Layout \`${s.layout}\`. Fonts: ${s.fonts.join(', ') || '—'}.`,
      '',
    );
    lines.push(
      `Images: ${[
        s.images.pptx && `[PowerPoint](${s.images.pptx})`,
        `[HTML](${s.images.html})`,
        s.images.diff && `[difference](${s.images.diff})`,
      ]
        .filter(Boolean)
        .join(' · ')}`,
    );
    if (s.parity)
      lines.push(
        `Parity ${pct(s.parity.worstRegion)}${s.parity.hotspots.length ? `; hotspots: ${s.parity.hotspots.map((h) => `${h.region} (${pct(h.score)})`).join(', ')}` : ''}.`,
      );
    const facts = [
      ...s.diagnostics.map((d) => `${d.severity} ${d.code}: ${d.message}`),
      ...s.contrast.map((c) => `contrast ${c.ratio}:1 (needs ${c.needs}:1) — ${c.text}`),
      ...(s.offPalette.length ? [`colours outside the theme: ${s.offPalette.join(', ')}`] : []),
      ...s.nearMisalignments.map(
        (m) => `almost aligned (${m.edge}, ${m.deltaPt} pt): ${m.a} ↔ ${m.b}`,
      ),
      ...s.outsideSafeArea.map((t) => `text outside the 0.25 in safe area: ${t}`),
      ...s.tightText.map((t) => `text fills ${Math.round(t.fill * 100)}% of its box: ${t.text}`),
    ];
    lines.push('', ...(facts.length ? facts.map((f) => `- ${f}`) : ['- no measured issues']), '');
  }
  return `${lines.join('\n')}\n`;
}

// ───────────────────────────── review record and user report ─────────────────────────────

export interface Finding {
  slide: string | number;
  severity: 'blocker' | 'major' | 'minor';
  area:
    | 'parity'
    | 'layout'
    | 'color'
    | 'typography'
    | 'chart'
    | 'template'
    | 'meaning'
    | 'consistency'
    | 'other';
  issue: string;
  fix?: string;
  status: 'fixed' | 'open' | 'needs-user';
}
export interface ReviewRound {
  round?: number;
  changes?: { file: string; added: number; removed: number }[];
  reviewer?: string;
  verdict: 'ready' | 'ready-with-notes' | 'not-ready';
  summary: string;
  findings: Finding[];
}

const SEVERITY = ['blocker', 'major', 'minor'];
const AREAS = [
  'parity',
  'layout',
  'color',
  'typography',
  'chart',
  'template',
  'meaning',
  'consistency',
  'other',
];
const STATUS = ['fixed', 'open', 'needs-user'];

export function validateRound(r: ReviewRound): string[] {
  const errors: string[] = [];
  if (!['ready', 'ready-with-notes', 'not-ready'].includes(r.verdict))
    errors.push('verdict must be ready | ready-with-notes | not-ready');
  if (!r.summary?.trim()) errors.push('summary is required');
  if (!Array.isArray(r.findings)) errors.push('findings must be an array');
  for (const [i, f] of (r.findings ?? []).entries()) {
    if (!SEVERITY.includes(f.severity)) errors.push(`findings[${i}].severity`);
    if (!AREAS.includes(f.area)) errors.push(`findings[${i}].area`);
    if (!STATUS.includes(f.status)) errors.push(`findings[${i}].status`);
    if (!f.issue?.trim()) errors.push(`findings[${i}].issue`);
  }
  if (
    r.verdict === 'ready' &&
    r.findings?.some((f) => f.status !== 'fixed' && f.severity !== 'minor')
  )
    errors.push('verdict "ready" is not allowed while a blocker or major is open');
  return errors;
}

/** Append one review round and rewrite the user-facing REPORT.md. */
export function recordReview(deckPath: string, packDir: string, round: ReviewRound) {
  const errors = validateRound(round);
  if (errors.length) throw new Error(`Invalid review record: ${errors.join('; ')}`);
  const path = join(packDir, 'record.json');
  const rounds: ReviewRound[] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  // What the reviewer actually changed since this round's pack was built.
  const diffs = diffAgainstSnapshot(deckPath, join(packDir, 'baseline'));
  rounds.push({
    ...round,
    round: rounds.length + 1,
    changes: diffs.map((d) => ({ file: d.file, added: d.added, removed: d.removed })),
  });
  appendReviewLog(deckPath, {
    stage: 'visual-qa-round',
    ...(round.reviewer ? { actor: round.reviewer } : {}),
    summary: `Round ${rounds.length}: ${round.verdict}. ${round.summary} Findings: ${round.findings.length} (${round.findings.filter((f) => f.status === 'fixed').length} fixed, ${round.findings.filter((f) => f.status === 'needs-user').length} for the user).`,
    diffs,
    data: { findings: round.findings },
  });
  writeFileSync(path, `${JSON.stringify(rounds, null, 2)}\n`);
  const report = reviewReport(rounds);
  writeFileSync(join(packDir, 'REPORT.md'), report);
  return { rounds: rounds.length, report: join(packDir, 'REPORT.md'), verdict: round.verdict };
}

export function reviewReport(rounds: ReviewRound[]): string {
  const last = rounds.at(-1)!;
  const fixed = rounds.flatMap((r) => r.findings.filter((f) => f.status === 'fixed'));
  const attention = last.findings.filter((f) => f.status !== 'fixed');
  const verdict = {
    ready: 'Ready to hand over',
    'ready-with-notes': 'Ready, with points for you to check',
    'not-ready': 'Not ready — needs your decision or more work',
  }[last.verdict];
  const row = (f: Finding) =>
    `| ${f.slide} | ${f.severity} | ${f.area} | ${f.issue.replace(/\|/g, '\\|')} | ${(f.fix ?? '').replace(/\|/g, '\\|')} |`;
  return [
    '# Visual review report',
    '',
    `**${verdict}.** ${last.summary}`,
    '',
    `Rounds: ${rounds.length}${last.reviewer ? ` · reviewer: ${last.reviewer}` : ''}. Rules, calibration and Office parity ran first; this review covers what rules cannot judge.`,
    '',
    '## Needs your attention',
    '',
    ...(attention.length
      ? [
          '| Slide | Severity | Area | What the reviewer saw | Suggested action |',
          '|---|---|---|---|---|',
          ...attention.map(row),
        ]
      : ['Nothing open.']),
    '',
    '## Fixed during review',
    '',
    ...(fixed.length
      ? ['| Slide | Severity | Area | Issue | Fix |', '|---|---|---|---|---|', ...fixed.map(row)]
      : ['No changes were needed.']),
    '',
    '## Changes made during review',
    '',
    ...(rounds.some((r) => r.changes?.length)
      ? rounds.flatMap((r) =>
          (r.changes ?? []).map(
            (c) => `- Round ${r.round}: \`${c.file}\` +${c.added} −${c.removed} lines`,
          ),
        )
      : ['No source files were edited.']),
    '',
    'Field-by-field before/after and full diffs: `REVIEW-LOG.md` next to deck.yaml.',
    '',
    '`visual_review` in the manifest stays false until you have looked at every slide yourself.',
    '',
  ].join('\n');
}
