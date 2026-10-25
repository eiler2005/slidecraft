/** Deterministic, data-preserving geometry shared by editable diagram layouts. */
import type { Box } from './scene.ts';
import type { PathSeg } from './svg-path.ts';

export type Point = [number, number];

export function extent(values: number[], includeZero = false): [number, number] {
  if (!values.length || values.some((v) => !Number.isFinite(v)))
    throw new Error('A numeric exhibit requires finite observations');
  let lo = Math.min(...values),
    hi = Math.max(...values);
  if (includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    const d = Math.abs(lo) * 0.1 || 1;
    lo -= d;
    hi += d;
  }
  if (!Number.isFinite(hi - lo)) throw new Error('Numeric range exceeds finite geometry');
  return [lo, hi];
}

export function scale(domain: [number, number], a: number, b: number) {
  const [lo, hi] = domain;
  if (![lo, hi, a, b].every(Number.isFinite) || hi <= lo)
    throw new Error('A scale requires a finite increasing domain');
  return (v: number) => a + ((v - lo) / (hi - lo)) * (b - a);
}

/** Squarified treemap. Values and tie order are preserved; zero items have no area. */
export function squarify(items: { id: string; value: number }[], area: Box): Map<string, Box> {
  if (new Set(items.map((v) => v.id)).size !== items.length)
    throw new Error('Treemap item IDs must be unique');
  if (items.some((v) => !Number.isFinite(v.value) || v.value < 0))
    throw new Error('Treemap values must be finite and nonnegative');
  const total = items.reduce((a, v) => a + v.value, 0);
  if (!Number.isFinite(total) || total <= 0)
    throw new Error('Treemap needs a positive finite total');
  const k = (area.w * area.h) / total;
  if (!Number.isFinite(k) || k <= 0 || items.some((v) => v.value > 0 && v.value * k === 0))
    throw new Error('Treemap values exceed finite drawable geometry');
  const pending = items
    .map((v, i) => ({ ...v, a: v.value * k, i }))
    .filter((v) => v.a > 0)
    .sort((a, b) => b.a - a.a || a.i - b.i);
  const out = new Map<string, Box>();
  let rest = { ...area };
  const worst = (row: typeof pending, side: number) => {
    if (!row.length) return Infinity;
    const sum = row.reduce((s, v) => s + v.a, 0);
    return Math.max(
      (side * side * row[0]!.a) / (sum * sum),
      (sum * sum) / (side * side * row.at(-1)!.a),
    );
  };
  while (pending.length) {
    const row = [pending.shift()!];
    const side = Math.min(rest.w, rest.h);
    while (pending.length && worst([...row, pending[0]!], side) <= worst(row, side))
      row.push(pending.shift()!);
    const sum = row.reduce((s, v) => s + v.a, 0);
    if (rest.w >= rest.h) {
      const w = sum / rest.h;
      let y = rest.y;
      for (const v of row) {
        const h = v.a / w;
        out.set(v.id, { x: rest.x, y, w, h });
        y += h;
      }
      rest = { ...rest, x: rest.x + w, w: Math.max(0, rest.w - w) };
    } else {
      const h = sum / rest.w;
      let x = rest.x;
      for (const v of row) {
        const w = v.a / h;
        out.set(v.id, { x, y: rest.y, w, h });
        x += w;
      }
      rest = { ...rest, y: rest.y + h, h: Math.max(0, rest.h - h) };
    }
  }
  return out;
}

/** A quantity ribbon has exactly the same thickness at its two ends. */
export function ribbon(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
): PathSeg[] {
  const mid = (x0 + x1) / 2;
  return [
    { op: 'M', x: x0, y: y0 },
    { op: 'C', x1: mid, y1: y0, x2: mid, y2: y1, x: x1, y: y1 },
    { op: 'L', x: x1, y: y1 + thickness },
    { op: 'C', x1: mid, y1: y1 + thickness, x2: mid, y2: y0 + thickness, x: x0, y: y0 + thickness },
    { op: 'Z' },
  ];
}

/** Spread labels, never the observations themselves. Refuse an impossible budget. */
export function spreadLabels(positions: number[], lo: number, hi: number, gap: number): number[] {
  if (Math.max(0, positions.length - 1) * gap > hi - lo + 1e-9)
    throw new Error('Labels need a taller region or fewer observations');
  const sorted = positions.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const ys: number[] = [];
  sorted.forEach((v, i) => {
    ys[i] = Math.max(lo, v.y, i ? ys[i - 1]! + gap : lo);
  });
  if (ys.length && ys.at(-1)! > hi) {
    ys[ys.length - 1] = hi;
    for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i]!, ys[i + 1]! - gap);
  }
  const out: number[] = [];
  sorted.forEach((v, i) => {
    out[v.i] = ys[i]!;
  });
  return out;
}
