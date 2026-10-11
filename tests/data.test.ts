import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/build.ts';
import { formatNumber } from '../src/library/data.ts';
import { loadDeck } from '../src/library/load.ts';
import { cellRef, pickSheet, range, readSheets } from '../src/library/sheets.ts';

const DIR = join(import.meta.dirname, 'fixtures/data');

describe('spreadsheets', () => {
  it('reads .xlsx values, shared strings and cached formula results', () => {
    const sheet = pickSheet(readSheets(join(DIR, 'model.xlsx')), 'Plan');
    expect(range(sheet, 'A1:C2')).toEqual([
      ['Year', 'UK', 'Germany'],
      [2026, 42, 0],
    ]);
    expect(range(sheet, 'B6')).toEqual([[40000000]]);
    expect(cellRef('AA10')).toEqual({ r: 9, c: 26 });
  });

  it('reads .csv with quoted thousands', () => {
    const rows = readSheets(join(DIR, 'rates.csv'))[0]!.rows;
    expect(rows[1]).toEqual(['Rome', '1,450', 28, 8]);
  });

  it('formats numbers like a spreadsheet', () => {
    expect(formatNumber(40, '€0M')).toBe('€40M');
    expect(formatNumber(0.053, '0.0%')).toBe('5.3%');
    expect(formatNumber(1840, '#,##0')).toBe('1,840');
    expect(formatNumber(-9, '0')).toBe('−9');
  });
});

describe('facts and from-ranges in decks', () => {
  it('fills text, charts and tables from the files, and records them in the manifest', async () => {
    const d = loadDeck(join(DIR, 'deck.yaml'));
    expect(d.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    expect(d.deck.title).toBe('Germany adds €40M by 2028');
    expect((d.slides[0] as unknown as { title: string }).title).toContain('churn stays at 5%');
    expect((d.slides[0] as unknown as { chart: unknown }).chart).toEqual({
      categories: ['2026', '2027', '2028'],
      series: [
        { name: 'UK', values: [42, 49, 58] },
        { name: 'Germany', values: [0, 12, 40] },
      ],
      highlight: [2],
    });
    expect((d.slides[1] as unknown as { header: string[] }).header).toEqual([
      'City',
      'Hotel per night',
      'Meal',
      'Metro day pass',
    ]);
    const out = mkdtempSync(join(tmpdir(), 'sc-data-'));
    const r = await buildDeck(join(DIR, 'deck.yaml'), { outDir: out, formats: ['pptx'] });
    const manifest = JSON.parse(readFileSync(r.manifestPath!, 'utf8'));
    expect(manifest.data.facts['rev-2028']).toMatchObject({
      display: '€40M',
      from: 'model.xlsx!Plan!B6',
    });
    expect(manifest.data.files.map((f: { path: string }) => f.path)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/model\.xlsx$/),
        expect.stringMatching(/rates\.csv$/),
      ]),
    );
  });

  it('reports a missing file, an unknown fact and a bad range', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-data-bad-'));
    cpSync(DIR, dir, { recursive: true });
    const deck = join(dir, 'deck.yaml');
    writeFileSync(
      deck,
      readFileSync(deck, 'utf8')
        .replace('file: rates.csv', 'file: missing.csv')
        .replace('{{churn}}', '{{nope}}'),
    );
    const codes = loadDeck(deck).diagnostics.map((x) => x.code);
    expect(codes).toEqual(expect.arrayContaining(['SC-DATA-001', 'SC-DATA-003']));
  });
});
