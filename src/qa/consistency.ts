/**
 * Cross-slide consistency: the same metric must show the same value everywhere (001), with
 * one period and one unit (003), and totals must add up (002).
 *
 * Two kinds of evidence:
 *  - structured pairs: KPI tiles, hero numbers and metrics carry a `value` with a `label`;
 *  - amounts in text: "€40M revenue by 2028", "churn of 5%".
 * A metric is keyed by its significant words (at least two, so "18 months" and "7 months"
 * never collide). Values that differ beyond rounding are reported with the slides they are on.
 */
import { type Diagnostic, diag } from './codes.ts';

const STOP = new Set(
  'the a an of for and or to in on at by with from into per vs than our we their its this that these those is are was be been will can could would should has have had more less up down over under about after before new total all each every year years month months week weeks day days time times'.split(
    ' ',
  ),
);

interface Mention {
  key: string;
  unit: string;
  value: number;
  /** Smallest step the written number can express ("€40M" → 1e6, "€40.2M" → 1e5). */
  precision: number;
  shown: string;
  slide: string;
}

const CURRENCY = new Set(['€', '$', '£', '¥', '₽', '₸']);

const MAG: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mn: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
};

/** "€40M" → { unit: "€", value: 40e6 }; "5%" → { unit: "%", value: 5 }. */
export function parseAmount(
  s: string,
): { unit: string; value: number; precision: number } | undefined {
  const paren = /^\s*\((.+)\)\s*$/.exec(s);
  if (paren) {
    const inner = parseAmount(paren[1]!);
    return inner && { ...inner, value: -inner.value };
  }
  const m =
    /^\s*([€$£¥₽₸])?\s*(-|−)?(\d[\d,]*(?:\.(\d+))?)\s*(k|m|mn|b|bn|thousand|million|billion)?\s*(%|pts|x)?\s*$/i.exec(
      s,
    );
  if (!m) return undefined;
  const mag = m[5] ? (MAG[m[5].toLowerCase()] ?? 1) : 1;
  const n = Number(m[3]!.replace(/,/g, '')) * (m[2] ? -1 : 1) * mag;
  return {
    unit: m[1] ?? m[6]?.toLowerCase() ?? '',
    value: n,
    precision: mag * 10 ** -(m[4]?.length ?? 0),
  };
}

const YEAR = /^(19|20)\d\d$/;

function keyOf(words: string, max: number): string {
  return words
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => (w && !STOP.has(w) && !/^\d+$/.test(w)) || YEAR.test(w))
    .slice(0, max)
    .join(' ');
}

/** Same metric: at least two shared words, and the same year when both name one. */
function sameMetric(a: string, b: string): boolean {
  const A = new Set(a.split(' '));
  const B = b.split(' ');
  const shared = B.filter((w) => A.has(w));
  if (shared.length < 2) return false;
  const ya = [...A].find((w) => YEAR.test(w));
  const yb = B.find((w) => YEAR.test(w));
  return !(ya && yb && ya !== yb);
}

const AMOUNT =
  /([€$£¥₽₸])\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m|mn|bn|b|million|billion)?\b|(\d[\d,]*(?:\.\d+)?)\s?(%)/gi;

function textMentions(text: string, slide: string, out: Mention[]) {
  for (const m of text.matchAll(AMOUNT)) {
    const shown = m[0]!.trim();
    const amount = parseAmount(shown);
    if (!amount) continue;
    // the metric is named by the words right after the amount ("€40M revenue by 2028")
    // the words up to the next number or clause belong to this amount
    const after =
      text
        .slice(m.index! + m[0]!.length, m.index! + m[0]!.length + 60)
        .split(/[.;:,()—–]|[€$£¥₽₸]|\b(?!(?:19|20)\d\d\b)\d/)[0] ?? '';
    const key = keyOf(after, 3);
    if (key.split(' ').length >= 2)
      out.push({
        key,
        unit: amount.unit,
        value: amount.value,
        precision: amount.precision,
        shown,
        slide,
      });
  }
}

/** Freeform HTML has visible copy as well as CSS dimensions such as `20%`. Only the
 * rendered text belongs in a metric-consistency check; parsing the raw markup creates
 * false positives from selectors and style declarations. */
function htmlText(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ');
}

function walk(v: unknown, slide: string, out: Mention[]) {
  if (typeof v === 'string') return textMentions(v, slide, out);
  if (Array.isArray(v)) return v.forEach((x) => walk(x, slide, out));
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // structured pairs: { value: "€42M", label: "Revenue, FY2025" } / { number, label }
    const val =
      typeof o.value === 'string' ? o.value : typeof o.number === 'string' ? o.number : undefined;
    if (val && typeof o.label === 'string') {
      const amount = parseAmount(val);
      const key = keyOf(o.label, 4);
      if (amount && key.split(' ').length >= 2)
        out.push({
          key,
          unit: amount.unit,
          value: amount.value,
          precision: amount.precision,
          shown: val,
          slide,
        });
    }
    for (const [k, x] of Object.entries(o)) {
      if (k === 'notes' || k === 'ghost' || k === 'css') continue;
      if (k === 'html' && typeof x === 'string') textMentions(htmlText(x), slide, out);
      else walk(x, slide, out);
    }
  }
}

/** Equal within the precision written: "€40M" and "€40.2M" agree, "€40M" and "€42M" do not. */
function agree(a: Mention, b: Mention): boolean {
  const step = Math.max(a.precision, b.precision);
  return Math.abs(a.value - b.value) < step / 2 + 1e-9;
}

export function checkConsistency(
  slides: ({ id: string; notes?: string } & Record<string, unknown>)[],
): Diagnostic[] {
  const mentions: Mention[] = [];
  for (const s of slides) walk({ ...s, notes: undefined }, s.id, mentions);
  // cluster mentions of the same metric (same unit, overlapping words)
  const clusters: Mention[][] = [];
  for (const m of mentions) {
    const c = clusters.find(
      (list) => list[0]!.unit === m.unit && list.some((x) => sameMetric(x.key, m.key)),
    );
    if (c) c.push(m);
    else clusters.push([m]);
  }
  const out: Diagnostic[] = [];
  for (const list of clusters) {
    const base = list[0]!;
    const differing = list.filter((m) => !agree(m, base));
    if (!differing.length) continue;
    const byValue = new Map<string, Set<string>>();
    for (const m of list) byValue.set(m.shown, (byValue.get(m.shown) ?? new Set()).add(m.slide));
    if (byValue.size < 2) continue;
    const detail = [...byValue]
      .map(([shown, ids]) => `${shown} on ${[...ids].join(', ')}`)
      .join('; ');
    out.push(
      diag('SC-CONSIST-001', `"${base.key}" is ${detail}`, {
        slide: differing[0]!.slide,
        hint: 'Use one value everywhere — define it in `facts:` and write {{id}} in the text.',
      }),
    );
  }
  out.push(...periodsAndUnits(mentions), ...slides.flatMap((s) => checkTotals(s)));
  return out;
}

const yearsOf = (key: string) => key.split(' ').filter((w) => YEAR.test(w));
const withoutYears = (key: string) =>
  key
    .split(' ')
    .filter((w) => !YEAR.test(w))
    .join(' ');

/** The same figure for the same metric, labelled with another year or currency elsewhere. */
function periodsAndUnits(mentions: Mention[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < mentions.length; i++)
    for (let j = i + 1; j < mentions.length; j++) {
      const a = mentions[i]!;
      const b = mentions[j]!;
      if (a.slide === b.slide) continue;
      const loose = sameMetric(withoutYears(a.key), withoutYears(b.key));
      if (!loose) continue;
      let what: string | undefined;
      const [ya, yb] = [yearsOf(a.key), yearsOf(b.key)];
      if (a.unit === b.unit && agree(a, b) && ya.length && yb.length && ya.join() !== yb.join())
        what = `period ${ya.join('/')} on ${a.slide}, ${yb.join('/')} on ${b.slide}`;
      else if (
        a.unit !== b.unit &&
        CURRENCY.has(a.unit) &&
        CURRENCY.has(b.unit) &&
        Math.abs(a.value - b.value) < Math.max(a.precision, b.precision) / 2 + 1e-9
      )
        what = `unit ${a.unit} on ${a.slide}, ${b.unit} on ${b.slide}`;
      if (!what) continue;
      const id = `${withoutYears(a.key)}|${what}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(
        diag('SC-CONSIST-003', `"${withoutYears(a.key)}" ${a.shown}/${b.shown}: ${what}`, {
          slide: b.slide,
          hint: 'One label is probably wrong — check the source and use one period and one unit.',
        }),
      );
    }
  return out;
}

// ---- totals ------------------------------------------------------------------------

const TOTAL = /^\s*(total|grand total|sum|итого|всего|gesamt|summe)\b/i;
const SUBTOTAL = /^\s*(subtotal|sub-total|промежуточный итог|zwischensumme)\b/i;

interface Num {
  value: number;
  precision: number;
  unit: string;
}

function num(cell: unknown): Num | undefined {
  if (typeof cell === 'number') {
    // data, not rounded text: an integer is exact, a decimal is rounded at its last digit
    const dec = String(cell).split('.')[1]?.length ?? 0;
    return { value: cell, precision: dec ? 10 ** -dec : 0, unit: '' };
  }
  if (typeof cell !== 'string' || !cell.trim()) return undefined;
  return parseAmount(cell.replace(/\s/g, '').replace(/−/g, '-'));
}

/** Parts add up to the total within one unit of the last written digit — what a reader
 * accepts as rounding; a larger gap needs a fix or an "Other" row. */
function addsUp(parts: Num[], total: Num): boolean {
  const sum = parts.reduce((a, p) => a + p.value, 0);
  const slack = Math.max(total.precision, ...parts.map((p) => p.precision)) + 1e-9;
  return Math.abs(sum - total.value) <= slack;
}

/** The sum written like the total it is compared with: "€1.9M" → "€1.8M". */
function like(total: string, v: number): string {
  const m =
    /^\s*\(?\s*([€$£¥₽₸])?\s*-?−?\d[\d,]*(?:\.(\d+))?\s*(k|m|mn|b|bn|thousand|million|billion)?\s*(%|pts|x)?/i.exec(
      total,
    );
  if (!m) return String(+v.toFixed(6));
  const mag = m[3] ? (MAG[m[3].toLowerCase()] ?? 1) : 1;
  const dec = (m[2]?.length ?? 0) + 1;
  const n = +(v / mag).toFixed(dec);
  return `${n < 0 ? '−' : ''}${m[1] ?? ''}${Math.abs(n)}${m[3] ?? ''}${m[4] ?? ''}`;
}

function checkTotals(slide: { id: string } & Record<string, unknown>): Diagnostic[] {
  const out: Diagnostic[] = [];
  const report = (where: string, total: string, sum: number) =>
    out.push(
      diag('SC-CONSIST-002', `${where}: total ${total}, parts add up to ${like(total, sum)}`, {
        slide: slide.id,
        hint: 'Correct the parts or the total, or add an "Other" row for what the parts leave out.',
      }),
    );
  const visit = (v: unknown, path: string) => {
    if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${path}/${i}`));
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    // charts: waterfall totals, or a "Total" category
    if (Array.isArray(o.categories) && Array.isArray(o.series)) {
      const cats = o.categories.map(String);
      const series = o.series as { name?: string; values?: unknown[] }[];
      if (o.type === 'waterfall' && Array.isArray(o.highlight)) {
        const totals = new Set(o.highlight as number[]);
        const vals = (series[0]?.values ?? []).map(num);
        let run = 0;
        vals.forEach((n, i) => {
          if (!n) return;
          if (totals.has(i) && i > 0) {
            const parts = vals.slice(0, i).filter((x): x is Num => !!x);
            if (Math.abs(n.value - run) > parts.length * 0.5 * n.precision + n.precision / 2 + 1e-9)
              report(`waterfall "${cats[i]}" (${path || 'chart'})`, String(n.value), run);
            run = n.value;
          } else run = totals.has(i) ? n.value : run + n.value;
        });
      } else if (!/stacked/.test(String(o.type ?? ''))) {
        const t = cats.findIndex((c) => TOTAL.test(c));
        if (t >= 0)
          for (const s of series) {
            const vals = (s.values ?? []).map(num);
            const total = vals[t];
            const parts = vals.filter(
              (x, i): x is Num => i !== t && !!x && !SUBTOTAL.test(cats[i]!),
            );
            if (total && parts.length >= 2 && !addsUp(parts, total))
              report(
                `"${cats[t]}" of ${s.name ?? 'series'}`,
                String(total.value),
                parts.reduce((a, p) => a + p.value, 0),
              );
          }
      }
    }
    // tables: a total row (first cell) or a total column (header)
    if (Array.isArray(o.rows) && o.rows.every((r) => Array.isArray(r))) {
      const rows = o.rows as unknown[][];
      const header = Array.isArray(o.header) ? (o.header as unknown[]).map(String) : [];
      const cols = Math.max(0, ...rows.map((r) => r.length));
      const label = (r: unknown[]) => String(r[0] ?? '');
      const totalRows = rows.filter((r) => TOTAL.test(label(r)));
      const parts = rows.filter((r) => !TOTAL.test(label(r)) && !SUBTOTAL.test(label(r)));
      const subs = rows.filter((r) => SUBTOTAL.test(label(r)));
      for (const tr of totalRows.slice(-1))
        for (let c = 1; c < cols; c++) {
          const total = num(tr[c]);
          if (!total) continue;
          if (total.unit === '%' && total.value !== 100) continue; // a rate, not a share
          const cellsOf = (list: unknown[][]) => list.map((r) => num(r[c]));
          const ps = cellsOf(parts);
          if (ps.length < 2 || ps.some((x) => !x || x.unit !== total.unit)) continue;
          const ss = cellsOf(subs);
          const okSubs =
            ss.length >= 2 &&
            ss.every((x) => x && x.unit === total.unit) &&
            addsUp(ss as Num[], total);
          if (!addsUp(ps as Num[], total) && !okSubs)
            report(
              `${label(tr)} row, ${header[c] ?? `column ${c + 1}`}`,
              String(tr[c]),
              (ps as Num[]).reduce((a, p) => a + p.value, 0),
            );
        }
      const tc = header.findIndex((h, i) => i > 0 && TOTAL.test(h));
      if (tc > 0)
        for (const r of rows) {
          const total = num(r[tc]);
          if (!total) continue;
          const ps = r
            .map((x, i) => (i > 0 && i !== tc && !/%/.test(header[i] ?? '') ? num(x) : undefined))
            .filter((x): x is Num => !!x && x.unit === total.unit);
          if (ps.length >= 2 && !addsUp(ps, total))
            report(
              `${label(r)}, ${header[tc]} column`,
              String(r[tc]),
              ps.reduce((a, p) => a + p.value, 0),
            );
        }
    }
    for (const [k, x] of Object.entries(o))
      if (k !== 'notes' && k !== 'ghost') visit(x, `${path}/${k}`);
  };
  visit(slide, '');
  return out;
}
