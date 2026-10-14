import { spawnSync } from 'node:child_process';
import {
  cpSync,
  createWriteStream,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDeck } from '../src/build.ts';
import { applyFixes } from '../src/library/fix.ts';
import { diffOverlay, encodePng, readPpm, visualMetrics } from '../src/qa/raster.ts';
import {
  diffAgainstSnapshot,
  diffLines,
  readReviewLog,
  snapshotSources,
} from '../src/qa/review-log.ts';
import {
  type ReviewRound,
  rasterPages,
  recordReview,
  slideFacts,
  validateRound,
} from '../src/qa/visual-qa.ts';

const dirs: string[] = [];
const work = () => {
  const d = mkdtempSync(join(tmpdir(), 'sc-vqa-'));
  dirs.push(d);
  cpSync('tests/fixtures/chrome', d, { recursive: true });
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const round = (over: Partial<ReviewRound> = {}): ReviewRound => ({
  reviewer: 'test',
  verdict: 'ready-with-notes',
  summary: 'Looks right.',
  findings: [
    {
      slide: 's1',
      severity: 'major',
      area: 'parity',
      issue: 'Wrap differs',
      fix: 'shared rule',
      status: 'fixed',
    },
    { slide: 's1', severity: 'minor', area: 'layout', issue: 'Empty corner', status: 'needs-user' },
  ],
  ...over,
});

describe('review log', () => {
  it('diffs lines with context and counts', () => {
    const d = diffLines('a.yaml', 'one\ntwo\nthree\n', 'one\nTWO\nthree\nfour\n')!;
    expect([d.added, d.removed]).toEqual([2, 1]);
    expect(d.lines).toContain('- two');
    expect(d.lines).toContain('+ TWO');
    expect(diffLines('a.yaml', 'same', 'same')).toBeUndefined();
  });

  it('logs every fit-fix rewrite with its value before and after', () => {
    const dir = work();
    const deck = join(dir, 'deck.yaml');
    const scene = checkDeck(deck).scene!;
    const pointer = scene.slides[0]!.nodes.find(
      (n) => n.kind === 'text' && n.role === 'title' && n.pointer,
    )!;
    if (pointer.kind !== 'text') throw new Error('title expected');
    const r = applyFixes(deck, [
      { pointer: pointer.pointer!, text: 'A shorter claim that still argues the point' },
    ]);
    expect(r.applied).toBe(1);
    const log = readReviewLog(deck);
    expect(log.at(-1)!.stage).toBe('fit-fix');
    expect(log.at(-1)!.changes![0]).toMatchObject({
      pointer: pointer.pointer,
      after: 'A shorter claim that still argues the point',
    });
    expect(readFileSync(join(dir, 'REVIEW-LOG.md'), 'utf8')).toContain('A shorter claim');
  });

  it('records review rounds with the source edits since the pack and a user report', () => {
    const dir = work();
    const deck = join(dir, 'deck.yaml');
    const pack = join(dir, 'dist', 'visual-qa');
    snapshotSources(deck, join(pack, 'baseline'));
    writeFileSync(deck, `${readFileSync(deck, 'utf8')}\n# reviewed\n`);
    expect(diffAgainstSnapshot(deck, join(pack, 'baseline'))[0]!.added).toBeGreaterThan(0);
    const r = recordReview(deck, pack, round());
    expect(r.rounds).toBe(1);
    const report = readFileSync(r.report, 'utf8');
    expect(report).toContain('Ready, with points for you to check');
    expect(report).toMatch(/Needs your attention[\s\S]*Empty corner/);
    expect(report).toMatch(/Fixed during review[\s\S]*Wrap differs/);
    expect(report).toContain('`deck.yaml` +');
    expect(readReviewLog(deck).at(-1)!.stage).toBe('visual-qa-round');
  });

  it('refuses an unfounded "ready" verdict and malformed findings', () => {
    expect(validateRound(round())).toEqual([]);
    const open = round({
      verdict: 'ready',
      findings: [{ ...round().findings[0]!, status: 'open' }],
    });
    expect(validateRound(open).join()).toContain('not allowed');
    expect(validateRound(round({ summary: '' })).join()).toContain('summary');
  });
});

describe('visual QA facts and rasters', () => {
  it('reports measured facts a reviewer cannot read off a picture', () => {
    const scene = checkDeck('tests/fixtures/chrome/deck.yaml').scene!;
    const facts = slideFacts(scene, scene.slides[0]!, new Set());
    expect(facts.fonts.length).toBeGreaterThan(0);
    expect(facts.offPalette.length).toBeGreaterThan(0); // empty palette: every colour is "off"
    expect(Array.isArray(facts.nearMisalignments)).toBe(true);
  });

  it('encodes PNG and overlays differences red/cyan', () => {
    const ppm = (rgb: number[]) => Buffer.concat([Buffer.from('P6\n2 1\n255\n'), Buffer.from(rgb)]);
    const a = readPpm(ppm([0, 0, 0, 255, 255, 255]));
    const b = readPpm(ppm([255, 255, 255, 255, 255, 255]));
    const o = diffOverlay(a, b);
    expect([...o.rgb.slice(0, 3)]).toEqual([255, 0, 0]);
    const png = encodePng(o);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(visualMetrics(a, a).worstRegion).toBe(1);
  });
});

describe('speaker notes say where the facts come from', () => {
  it('appends a [Sources] block from the registry and strips it again for sync', async () => {
    const { sourceNotes, stripSourceNotes, withSourceNotes } = await import(
      '../src/engine/notes.ts'
    );
    const registry = new Map([
      [
        'report',
        {
          id: 'report',
          title: 'Annual report 2025',
          publisher: 'Contoso',
          url: 'https://example.com/ar.pdf',
        },
      ],
      ['model', { id: 'model', title: 'Market model', illustrative: true }],
    ]);
    const block = sourceNotes(
      { sources: ['report#p14', 'model'], source: 'Team interviews' },
      registry as never,
      'ru',
    )!;
    expect(block.split('\n')).toEqual([
      '[Sources]',
      '- Annual report 2025 — Contoso — p. 14 — https://example.com/ar.pdf#page=14',
      '- Market model — иллюстративные данные',
      '- Team interviews',
    ]);
    const notes = withSourceNotes('Open with the answer.', block)!;
    expect(notes.startsWith('Open with the answer.\n\n[Sources]')).toBe(true);
    expect(stripSourceNotes(notes)).toBe('Open with the answer.');
    expect(sourceNotes({}, registry as never)).toBeUndefined();
  });

  it('writes the block into the notes of every exported deck', () => {
    const scene = checkDeck('examples/pitch-deck/deck.yaml').scene!;
    const traction = scene.slides.find((s) => s.id === 'traction')!;
    expect(traction.notes).toContain('[Sources]\n- Fabrikam platform metrics, Sep 2026');
  });

  it('gives each notes line its own PowerPoint paragraph', async () => {
    const { notesParagraphs } = await import('../src/backends/pptxgenjs.ts');
    const xml =
      '<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Say it.\n\n[Sources]\n- A — B</a:t></a:r><a:endParaRPr lang="en-US" dirty="0"/></a:p>';
    const out = notesParagraphs(xml);
    expect([...out.matchAll(/<a:p>/g)]).toHaveLength(4);
    expect([...out.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1])).toEqual([
      'Say it.',
      '[Sources]',
      '- A — B',
    ]);
  });
});

/** A one-page PDF of the given size in points. */
async function pdfOfSize(path: string, w: number, h: number): Promise<void> {
  const doc = new PDFDocument({ size: [w, h], margin: 0 });
  const done = new Promise<void>((ok) =>
    doc.pipe(createWriteStream(path)).on('finish', () => ok()),
  );
  doc.rect(10, 10, 100, 50).fill('#1F5FBF');
  doc.end();
  await done;
}

// Found in a ChatGPT agent-mode run: LibreOffice writes a 960 × 540 pt slide as 959.98 × 540,
// so a height derived from the page came out 901 px against Chrome's 900 and visual QA stopped
// with "Raster dimensions differ".
describe('visual QA rasters', () => {
  it.skipIf(spawnSync('pdftoppm', ['-v']).status !== 0)(
    'have the same size whatever page size the renderer wrote',
    async () => {
      const d = mkdtempSync(join(tmpdir(), 'sc-raster-'));
      dirs.push(d);
      await pdfOfSize(join(d, 'chrome.pdf'), 960, 540);
      await pdfOfSize(join(d, 'office.pdf'), 959.981, 540);
      const [a] = rasterPages(join(d, 'chrome.pdf'), 1600, 900);
      const [b] = rasterPages(join(d, 'office.pdf'), 1600, 900);
      expect([a!.width, a!.height]).toEqual([1600, 900]);
      expect([b!.width, b!.height]).toEqual([1600, 900]);
      expect(() => visualMetrics(a!, b!)).not.toThrow();
    },
    60_000,
  );
});

// Found in a ChatGPT agent-mode run: a source line anchored to the bottom of a box that overlaps
// the takeaway band above was sampled at the box top and reported at 1.12:1 on the band's accent.
describe('contrast is sampled where the text is drawn', () => {
  it('reads a bottom-anchored source line against the white below a takeaway band', () => {
    const d = mkdtempSync(join(tmpdir(), 'sc-contrast-'));
    dirs.push(d);
    const deck = join(d, 'deck.yaml');
    writeFileSync(
      deck,
      `schemaVersion: 1
id: contrast
title: Faster AI writing still needs evidence and a clear board decision
theme: consulting-classic
status: review
language: en
sources:
  - { id: study, title: "Noy & Zhang, Science (2023)" }
slides:
  - id: evidence
    layout: kpi-tiles
    variant: tiles
    title: Faster AI writing still needs evidence and a clear board decision
    lead: These studies cover writing tasks and board packs.
    tiles:
      - { value: "40%", label: Lower mean writing time }
      - { value: "18%", label: Higher rated output quality }
      - { value: "13%", label: Packs rated extremely effective }
    bottomLine: Retain AI drafting gains and require evidence for every board decision.
    sources: [study]
`,
    );
    const { scene } = checkDeck(deck);
    const facts = slideFacts(scene!, scene!.slides[0]!, new Set());
    const source = facts.contrast.find((c) => c.text.includes('[source]'));
    if (source) expect(source.bg).toBe('#FFFFFF');
    expect(facts.contrast.filter((c) => c.ratio < c.needs)).toEqual([]);
  });
});
