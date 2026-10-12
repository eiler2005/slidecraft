/**
 * Data in decks (v0.5): numbers defined once and pulled from the client's own files.
 *
 *   facts:                                  # deck level
 *     revenue-2028: { from: { file: model.xlsx, sheet: Plan, cell: F12 }, format: "€0M" }
 *     churn: { value: 0.05, format: "0%" }
 *   …
 *   title: Germany adds {{revenue-2028}} by 2028          # any text field
 *   chart: { from: { file: model.xlsx, sheet: Plan, range: "A1:C6" } }
 *   rows:  { from: { file: data.csv, range: "A2:D9" } }
 *
 * Every build reads the files again, so the deck follows the model; the manifest records
 * each file's hash and every fact's value.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { culture } from '../engine/i18n.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import { type Cell, pickSheet, range, readSheets } from './sheets.ts';

export const From = z
  .object({
    file: z.string().describe('.xlsx or .csv, relative to deck.yaml'),
    sheet: z.string().optional().describe('Worksheet name (default: the first)'),
    cell: z.string().optional().describe('One cell, e.g. "F12" (facts)'),
    range: z.string().optional().describe('A range, e.g. "A1:C6" (charts, tables)'),
    series: z
      .enum(['columns', 'rows'])
      .optional()
      .describe('Charts: series in columns (default) or rows'),
    header: z.boolean().optional().describe('Tables: the first row of the range is the header'),
    format: z.string().optional().describe('Number format for table cells, e.g. "#,##0" or "0.0%"'),
  })
  .strict();

export const Fact = z
  .object({
    value: z.union([z.number(), z.string()]).optional(),
    from: From.optional(),
    format: z.string().optional().describe('e.g. "€0.0M", "#,##0", "0%", "0.0x"'),
    divide: z
      .number()
      .optional()
      .describe('Divide before formatting, e.g. 1000000 to show millions'),
    label: z
      .string()
      .max(80)
      .optional()
      .describe('What the number is, for reviews and the manifest'),
    source: z.string().optional().describe('Source id from the deck `sources:`'),
  })
  .strict();
export type Fact = z.infer<typeof Fact>;

/** Excel-like number format: prefix, digits pattern (0, #, ",", "."), suffix; "%" multiplies by 100. */
export function formatNumber(v: number, format = '#,##0.##', language?: string): string {
  const m = /^(.*?)([#0][#0,]*(?:\.[#0]+)?)(.*)$/.exec(format);
  if (!m) return String(v);
  const [, pre, pattern, suf] = m as unknown as [string, string, string, string];
  const value = suf.includes('%') ? v * 100 : v;
  const [, dec = ''] = pattern.split('.');
  const minDec = (dec.match(/0/g) ?? []).length;
  const maxDec = dec.length;
  const s = Math.abs(value).toLocaleString(culture(language), {
    minimumFractionDigits: minDec,
    maximumFractionDigits: maxDec,
    useGrouping: pattern.includes(','),
  });
  return `${value < 0 ? '−' : ''}${pre}${s}${suf}`;
}

export interface DataReport {
  facts: Record<string, { value: number | string; display: string; label?: string; from?: string }>;
  files: { path: string; sha256: string }[];
}

export function resolveData(
  facts: Record<string, Fact> | undefined,
  slides: unknown[],
  baseDir: string,
  language?: string,
): {
  slides: unknown[];
  diagnostics: Diagnostic[];
  report: DataReport;
  /** {{fact}} substitution for deck-level text (title, subtitle, footer). */
  text: (s: string) => string;
} {
  const diagnostics: Diagnostic[] = [];
  const report: DataReport = { facts: {}, files: [] };
  const seen = new Set<string>();
  const sheetFor = (f: z.infer<typeof From>, pointer: string) => {
    const path = isAbsolute(f.file) ? f.file : resolve(baseDir, f.file);
    if (!existsSync(path)) {
      diagnostics.push(diag('SC-DATA-001', `Data file not found: ${f.file}`, { pointer }));
      return undefined;
    }
    if (!seen.has(path)) {
      seen.add(path);
      report.files.push({
        path,
        sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
      });
    }
    try {
      return pickSheet(readSheets(path), f.sheet);
    } catch (e) {
      diagnostics.push(diag('SC-DATA-001', (e as Error).message, { pointer }));
      return undefined;
    }
  };

  // 1. facts
  const display = new Map<string, string>();
  for (const [id, f] of Object.entries(facts ?? {})) {
    const pointer = `/facts/${id}`;
    let v: Cell | undefined = f.value;
    if (f.from) {
      const sheet = sheetFor(f.from, pointer);
      if (!sheet) continue;
      if (!f.from.cell) {
        diagnostics.push(diag('SC-DATA-002', `Fact "${id}" needs from.cell`, { pointer }));
        continue;
      }
      v = range(sheet, f.from.cell)[0]?.[0] ?? null;
    }
    if (v === undefined || v === null || v === '') {
      diagnostics.push(diag('SC-DATA-002', `Fact "${id}" has no value`, { pointer }));
      continue;
    }
    const shown =
      typeof v === 'number'
        ? formatNumber(f.divide ? v / f.divide : v, f.format, language)
        : String(v);
    display.set(id, shown);
    report.facts[id] = {
      value: v,
      display: shown,
      ...(f.label ? { label: f.label } : {}),
      ...(f.from
        ? { from: `${f.from.file}${f.from.sheet ? `!${f.from.sheet}` : ''}!${f.from.cell}` }
        : {}),
    };
  }

  // 2. {{fact}} in text, `from:` in content
  const cellText = (c: Cell, fmt?: string) =>
    c === null
      ? ''
      : typeof c === 'number'
        ? fmt
          ? formatNumber(c, fmt, language)
          : String(c)
        : c;
  const num = (c: Cell, pointer: string) => {
    if (typeof c === 'number') return c;
    const n = Number(String(c ?? '').replace(/[,\s]/g, ''));
    if (Number.isFinite(n) && c !== null && c !== '') return n;
    diagnostics.push(
      diag('SC-DATA-002', `Not a number in the data range: "${c ?? ''}"`, { pointer }),
    );
    return 0;
  };
  const fromValue = (key: string, f: z.infer<typeof From>, pointer: string): unknown => {
    const sheet = sheetFor(f, pointer);
    if (!sheet || !f.range) {
      if (sheet) diagnostics.push(diag('SC-DATA-002', 'from.range is required here', { pointer }));
      return undefined;
    }
    let grid = range(sheet, f.range);
    if (key === 'chart') {
      if (f.series === 'rows') grid = grid[0]!.map((_, c) => grid.map((r) => r[c] ?? null));
      const [head, ...body] = grid;
      return {
        categories: body.map((r) => cellText(r[0] ?? null)),
        series: (head ?? []).slice(1).map((name, k) => ({
          name: cellText(name) || `Series ${k + 1}`,
          values: body.map((r, i) => num(r[k + 1] ?? null, `${pointer}/${i}`)),
        })),
      };
    }
    if (key === 'rows')
      return (f.header ? grid.slice(1) : grid).map((r) => r.map((c) => cellText(c, f.format)));
    if (key === 'header') return (grid[0] ?? []).map((c) => cellText(c));
    if (key === 'values') return grid.flat().map((c, i) => num(c, `${pointer}/${i}`));
    if (key === 'categories') return grid.flat().map((c) => cellText(c));
    diagnostics.push(diag('SC-DATA-002', `"${key}" cannot be filled from a range`, { pointer }));
    return undefined;
  };
  const walk = (v: unknown, pointer: string, key = ''): unknown => {
    if (typeof v === 'string')
      return v.replace(/\{\{\s*([a-z0-9][a-z0-9-]*)\s*\}\}/g, (m, id: string) => {
        const d = display.get(id);
        if (d === undefined) {
          diagnostics.push(diag('SC-DATA-003', `Unknown fact {{${id}}}`, { pointer }));
          return m;
        }
        return d;
      });
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${pointer}/${i}`));
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      // `{ from }` alone, or a chart that also sets its own options (decimals, highlight, unit…)
      if (
        o.from &&
        typeof o.from === 'object' &&
        (Object.keys(o).length === 1 || key === 'chart')
      ) {
        const p = From.safeParse(o.from);
        if (!p.success) {
          diagnostics.push(
            diag('SC-DATA-002', p.error.issues[0]?.message ?? 'Invalid from', {
              pointer: `${pointer}/from`,
            }),
          );
          return v;
        }
        const filled = fromValue(key, p.data, pointer);
        if (filled === undefined) return v;
        if (key !== 'chart') return filled;
        const rest: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(o))
          if (k !== 'from') rest[k] = walk(x, `${pointer}/${k}`, k);
        return { ...(filled as object), ...rest };
      }
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(o)) out[k] = walk(x, `${pointer}/${k}`, k);
      // data-table: `rows: { from: { header: true } }` also fills a missing header
      const rowsFrom = (o.rows as { from?: z.infer<typeof From> } | undefined)?.from;
      if (rowsFrom?.header && out.header === undefined && rowsFrom.range) {
        const sheet = sheetFor(rowsFrom, `${pointer}/rows`);
        if (sheet) out.header = (range(sheet, rowsFrom.range)[0] ?? []).map((c) => cellText(c));
      }
      return out;
    }
    return v;
  };
  return {
    slides: slides.map((s, i) => walk(s, `/slides/${i}`)),
    diagnostics,
    report,
    text: (s: string) => walk(s, '') as string,
  };
}
