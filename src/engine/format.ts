import type { Box } from './scene.ts';

/**
 * Slide format: page size plus the fixed regions every content layout shares.
 * Layouts place content inside `body`; the title band, tracker and footer are
 * owned by the frame so every slide in a deck lines up.
 */
export interface Format {
  id: string;
  w: number;
  h: number;
  margin: { l: number; r: number; t: number; b: number };
  columns: number;
  gutter: number;
  /** Small section label above the title. */
  tracker: Box;
  /** Action title band (up to 2 lines). */
  title: Box;
  /** Optional lead / subtitle line under the title. */
  lead: Box;
  /** Content area for layouts. */
  body: Box;
  /** Content area when there is no lead line. */
  bodyNoLead: Box;
  /** Source line above the footer. */
  source: Box;
  footer: Box;
  pageNumber: Box;
}

const DEFAULT_MARGIN = { l: 0.6, r: 0.6, t: 0.42, b: 0.38 };

/** Same frame for every page size: fixed bands for tracker, title and footer; the body takes the rest. */
export function makeFormat(id: string, W: number, H: number, M = DEFAULT_MARGIN): Format {
  const inner = W - M.l - M.r;
  return {
    id,
    w: W,
    h: H,
    margin: M,
    columns: 12,
    gutter: 0.25,
    tracker: { x: M.l, y: M.t, w: inner, h: 0.24 },
    title: { x: M.l, y: M.t + 0.28, w: inner, h: 0.98 },
    lead: { x: M.l, y: M.t + 1.3, w: inner, h: 0.42 },
    // source line and body sit above the footer band, so a larger bottom margin moves them up
    body: { x: M.l, y: M.t + 1.86, w: inner, h: H - (M.t + 1.86) - (M.b + 0.48) },
    bodyNoLead: { x: M.l, y: M.t + 1.42, w: inner, h: H - (M.t + 1.42) - (M.b + 0.48) },
    source: { x: M.l, y: H - M.b - 0.6, w: inner - 1.2, h: 0.32 },
    footer: { x: M.l, y: H - M.b - 0.14, w: inner - 1.2, h: 0.2 },
    pageNumber: { x: W - M.r - 1.0, y: H - M.b - 0.14, w: 1.0, h: 0.2 },
  };
}

/** Add a format at runtime (brand formats from `theme import`). */
export function registerFormat(f: Format): void {
  FORMATS[f.id] = f;
}

/** Default: PowerPoint widescreen, 13.333 × 7.5 in. */
export const WIDE_16X9: Format = makeFormat('wide-16x9', 13.333, 7.5);
/** A4 landscape, 297 × 210 mm — for decks that will be printed or read as documents. */
export const A4_LANDSCAPE: Format = makeFormat('a4-landscape', 11.693, 8.268);

export const FORMATS: Record<string, Format> = {
  [WIDE_16X9.id]: WIDE_16X9,
  [A4_LANDSCAPE.id]: A4_LANDSCAPE,
};

/** Split a box into `n` equal columns with a gutter. */
export function columns(box: Box, n: number, gutter: number): Box[] {
  const w = (box.w - gutter * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({
    x: box.x + i * (w + gutter),
    y: box.y,
    w,
    h: box.h,
  }));
}

/** Split a box into rows with given relative weights and a gap. */
export function rows(box: Box, weights: number[], gap: number): Box[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const free = box.h - gap * (weights.length - 1);
  let y = box.y;
  return weights.map((wt) => {
    const h = (free * wt) / total;
    const r = { x: box.x, y, w: box.w, h };
    y += h + gap;
    return r;
  });
}

/** Split horizontally with relative weights. */
export function cols(box: Box, weights: number[], gap: number): Box[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const free = box.w - gap * (weights.length - 1);
  let x = box.x;
  return weights.map((wt) => {
    const w = (free * wt) / total;
    const r = { x, y: box.y, w, h: box.h };
    x += w + gap;
    return r;
  });
}

export function inset(
  box: Box,
  d: number | { l?: number; r?: number; t?: number; b?: number },
): Box {
  const p = typeof d === 'number' ? { l: d, r: d, t: d, b: d } : d;
  const l = p.l ?? 0;
  const r = p.r ?? 0;
  const t = p.t ?? 0;
  const b = p.b ?? 0;
  return { x: box.x + l, y: box.y + t, w: box.w - l - r, h: box.h - t - b };
}
