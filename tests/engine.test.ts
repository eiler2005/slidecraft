import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDeck, checkDeck } from '../src/build.ts';
import { buildChart, formatCode, formatNumber, niceAxis } from '../src/engine/charts.ts';
import { textWidthPt } from '../src/engine/fonts.ts';
import type { TextStyle } from '../src/engine/scene.ts';
import { fitText, layoutText, para, parseInline } from '../src/engine/text.ts';
import { getTheme } from '../src/library/load.ts';

const FIXTURE = join(import.meta.dirname, 'fixtures/skeleton/deck.yaml');
const style = (size = 14): TextStyle => ({
  family: 'Arial',
  measure: 'liberation-sans',
  size,
  lineSpacing: size * 1.2,
  color: '#000000',
  align: 'left',
  valign: 'top',
});

describe('text measurement', () => {
  it('measures Arial-compatible widths', () => {
    // Liberation Sans is metric-compatible with Arial: "Hello" at 100pt = 227.9pt (H 72.2 + e 55.6 + l 22.2 ×2 + o 55.6).
    expect(textWidthPt('liberation-sans', 'regular', 100, 'Hello')).toBeCloseTo(227.9, 1);
  });

  it('parses inline bold and italic', () => {
    expect(parseInline('a **b** *c*')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
    ]);
  });

  it('wraps greedily and never exceeds the width', () => {
    const laid = layoutText(
      [para('The quick brown fox jumps over the lazy dog '.repeat(4))],
      style(),
      3,
    );
    expect(laid.lines.length).toBeGreaterThan(2);
    expect(laid.maxLineWidth).toBeLessThanOrEqual(3 + 1e-6);
  });

  it('steps the size down and reports overflow instead of truncating', () => {
    const text = [para('word '.repeat(200))];
    const box = { x: 0, y: 0, w: 3, h: 1 };
    const s = {
      family: 'Arial',
      measure: 'liberation-sans' as const,
      color: '#000000',
      align: 'left' as const,
      valign: 'top' as const,
    };
    const r = fitText(text, box, s, [14, 12, 10], 1.2);
    expect(r.fits).toBe(false);
    expect(r.size).toBe(10);
    expect(r.node.paragraphs[0]!.runs[0]!.text).toContain('word');
  });
});

describe('charts', () => {
  it('builds nice axes with headroom', () => {
    expect(niceAxis(0, 42)).toEqual({ min: 0, max: 50, major: 10 });
    expect(niceAxis(-12, 30).min).toBeLessThan(-12);
  });

  it('formats numbers and Excel codes consistently', () => {
    expect(formatNumber(1234.5, 1, '€')).toBe('€1,234.5');
    expect(formatNumber(-3, 0, '%')).toBe('−3%');
    expect(formatNumber(4, 0, '', true)).toBe('+4');
    expect(formatCode(0, '%')).toBe('#,##0"%";-#,##0"%";;');
  });

  it('decomposes a waterfall that crosses zero into stacked series', () => {
    const theme = getTheme('consulting-classic')!;
    const c = buildChart(
      {
        type: 'waterfall',
        categories: ['Start', 'Loss', 'Gain', 'End'],
        series: [{ name: 'Δ', values: [10, -25, 8, -7] }],
        highlight: [0, 3],
      },
      { x: 0, y: 0, w: 8, h: 4 },
      { theme, font: theme.fonts.body },
    );
    const byName = Object.fromEntries(c.series.map((s) => [s.name, s.values]));
    // Loss bar spans 10 → −15: +10 above zero, −15 below zero, no base.
    expect(byName.Decrease![1]).toBe(10);
    expect(byName['Decrease (below zero)']![1]).toBe(-15);
    expect(byName.Base![1]).toBe(0);
    // Gain bar spans −15 → −7, entirely below zero: base −7, part −8.
    expect(byName.Base![2]).toBe(-7);
    expect(byName['Increase (below zero)']![2]).toBe(-8);
    expect(c.nativeLabels).toBe(false);
    expect(c.axis.min).toBeLessThan(-15);
  });
});

describe('deck pipeline', () => {
  it('checks the skeleton deck with no errors', () => {
    const r = checkDeck(FIXTURE);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(r.scene?.slides).toHaveLength(4);
  });

  it('builds byte-identical PPTX and PDF twice (deterministic)', async () => {
    const a = mkdtempSync(join(tmpdir(), 'sc-a-'));
    const b = mkdtempSync(join(tmpdir(), 'sc-b-'));
    const ra = await buildDeck(FIXTURE, { outDir: a, formats: ['pptx', 'pdf'] });
    const rb = await buildDeck(FIXTURE, { outDir: b, formats: ['pptx', 'pdf'] });
    const h = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
    for (const kind of ['pptx', 'pdf'] as const) {
      const fa = ra.files.find((f) => f.kind === kind)!.path;
      const fb = rb.files.find((f) => f.kind === kind)!.path;
      expect(h(fa), kind).toBe(h(fb));
    }
    // every visible string made it into the PPTX
    expect(ra.diagnostics.filter((d) => d.code === 'SC-PPTX-001')).toEqual([]);
  });
});
