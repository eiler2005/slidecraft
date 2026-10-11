import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import { type ReviewRound, recordReview, slideFacts, validateRound } from '../src/qa/visual-qa.ts';

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
