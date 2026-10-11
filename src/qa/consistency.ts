/**
 * Cross-slide consistency (v0.5): the same metric must show the same value everywhere.
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
    for (const [k, x] of Object.entries(o)) if (k !== 'notes' && k !== 'ghost') walk(x, slide, out);
  }
}

/** Equal within the precision written: "€40M" and "€40.2M" agree, "€40M" and "€42M" do not. */
function agree(a: Mention, b: Mention): boolean {
  const step = Math.max(a.precision, b.precision);
  return Math.abs(a.value - b.value) < step / 2 + 1e-9;
}

export function checkConsistency(slides: { id: string; notes?: string }[]): Diagnostic[] {
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
  return out;
}
