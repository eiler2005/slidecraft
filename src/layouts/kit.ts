/**
 * Shared drawing helpers for the frameworks and charts pack (v0.5): titled cards with bullet
 * lists, rating pills, a linear value axis and the side takeaway panel. Everything is drawn
 * with Scene IR primitives, so it renders the same in PPTX (editable shapes), PDF, PNG and HTML.
 */
import { z } from 'zod';
import { formatNumber, niceStep } from '../engine/charts.ts';
import { ensureContrast, mix } from '../engine/color.ts';
import { textWidthPt } from '../engine/fonts.ts';
import type { Box } from '../engine/scene.ts';
import type { ComposeContext } from './types.ts';

export const Rating = z.enum(['low', 'medium', 'high']);
export type Rating = z.infer<typeof Rating>;

export const Takeaway = z
  .string()
  .max(140)
  .optional()
  .describe('The "so what" shown in a side panel — one sentence');

/** A titled card: small-caps heading, optional rating pill, bullet list. */
export function card(
  ctx: ComposeContext,
  b: Box,
  o: {
    heading: string;
    items?: string[];
    field: string;
    /** Field of the heading when the author wrote it; omit for fixed labels (SWOT, PESTEL). */
    headingField?: string;
    tone?: 'plain' | 'accent';
    rating?: Rating;
    ratingField?: string;
    size?: 'body' | 'small' | number;
  },
): void {
  const { colors } = ctx;
  const accent = o.tone === 'accent';
  ctx.rect(b, { fill: accent ? colors.accentSoft : colors.surface, role: 'panel' });
  if (accent)
    ctx.rect({ x: b.x, y: b.y, w: b.w, h: 0.05 }, { fill: colors.accent, role: 'accent-rule' });
  const pad = Math.min(0.22, b.w * 0.08);
  const pillW = o.rating ? 0.8 : 0;
  ctx.text(
    o.heading.toUpperCase(),
    { x: b.x + pad, y: b.y + 0.14, w: b.w - 2 * pad - pillW - 0.08, h: 0.26 },
    {
      size: 'small',
      bold: true,
      color: accent ? ensureContrast(colors.accent, colors.accentSoft) : colors.muted,
      maxLines: 1,
      ...(o.headingField ? { field: o.headingField } : { fixed: true }),
    },
  );
  if (o.rating)
    pill(
      ctx,
      { x: b.x + b.w - pad - pillW, y: b.y + 0.13, w: pillW, h: 0.26 },
      o.rating,
      o.ratingField,
    );
  if (o.items?.length)
    ctx.text(
      ctx.paragraphs(o.items, { bullet: true, spaceBefore: 6 }),
      { x: b.x + pad, y: b.y + 0.48, w: b.w - 2 * pad, h: b.h - 0.48 - pad * 0.8 },
      { size: o.size ?? 'body', field: o.field },
    );
}

/** "HIGH" / "MEDIUM" / "LOW" pill; high is the accent (the force or factor that matters most). */
export function pill(ctx: ComposeContext, b: Box, r: Rating, field?: string): void {
  const { colors } = ctx;
  const fill = r === 'high' ? colors.accent : r === 'medium' ? colors.rule : colors.background;
  const ink = r === 'high' ? colors.accentText : r === 'medium' ? colors.ink : colors.muted;
  ctx.rect(b, {
    fill,
    radius: b.h / 2,
    ...(r === 'low' ? { stroke: { color: colors.rule, width: 0.75 } } : {}),
    role: 'rating',
  });
  ctx.text(r.toUpperCase(), b, {
    size: 'source',
    bold: true,
    color: ensureContrast(ink, fill),
    align: 'center',
    valign: 'middle',
    maxLines: 1,
    fixed: true,
    ...(field ? { field } : {}),
  });
}

/** Side panel with the interpretation of the exhibit (same look as matrix-2x2 and charts). */
export function takeawayPanel(ctx: ComposeContext, side: Box, text: string): void {
  const { colors } = ctx;
  ctx.rect(side, { fill: colors.surface, role: 'panel' });
  ctx.rect(
    { x: side.x, y: side.y, w: 0.06, h: side.h },
    { fill: colors.accent, role: 'panel-accent' },
  );
  const pad = Math.min(0.3, side.h * 0.12);
  ctx.text(
    text,
    { x: side.x + 0.3, y: side.y + pad, w: side.w - 0.55, h: side.h - 2 * pad },
    { font: 'heading', size: 'heading', bold: true, field: 'takeaway' },
  );
}

export interface Scale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
  /** Value → coordinate (inches) along the axis. */
  at(v: number): number;
}

/** Linear scale over [lo, hi] with round ticks, mapped onto [from, to] inches. */
export function linearScale(
  lo: number,
  hi: number,
  from: number,
  to: number,
  opts: { zero?: boolean; ticks?: number; min?: number; max?: number } = {},
): Scale {
  let a = opts.min ?? (opts.zero ? Math.min(0, lo) : lo);
  let b = opts.max ?? (opts.zero ? Math.max(0, hi) : hi);
  if (a === b) {
    a -= 1;
    b += 1;
  }
  const step = niceStep(b - a, opts.ticks ?? 5);
  const min = opts.min ?? Math.floor(a / step) * step;
  const max = opts.max ?? Math.ceil(b / step) * step;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step)
    ticks.push(Number(t.toPrecision(12)));
  return { min, max, step, ticks, at: (v) => from + ((v - min) / (max - min || 1)) * (to - from) };
}

/** Decimals that show a step cleanly (step 0.5 → 1 decimal). */
export function decimalsFor(step: number): number {
  return step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9));
}

/** Format with a unit; "€B" / "$M" put the symbol in front and the scale after ("€4.2B"). */
export function fmt(v: number, decimals: number, unit = '', language?: string): string {
  const m = /^([€$£¥])([A-Za-z]{1,3})$/.exec(unit);
  return m
    ? `${formatNumber(v, decimals, m[1], false, language)}${m[2]}`
    : formatNumber(v, decimals, unit, false, language);
}

/** Receding fills for the non-highlighted series: a ramp between rule and muted. */
export function recedingFills(ctx: ComposeContext, n: number): string[] {
  const { colors } = ctx;
  return Array.from({ length: n }, (_, i) =>
    mix(colors.rule, colors.muted, n <= 1 ? 0.4 : (i / (n - 1)) * 0.8),
  );
}

/** Width of a one-line label in inches. */
export function labelWidth(ctx: ComposeContext, text: string, size: number, bold = false): number {
  return (textWidthPt(ctx.fonts.body.measure, bold ? 'bold' : 'regular', size, text) / 72) * 1.04;
}

/** Tick labels and gridlines for a horizontal value axis below a plot. */
export function xAxis(
  ctx: ComposeContext,
  s: Scale,
  plot: Box,
  o: { unit?: string; decimals?: number; grid?: boolean } = {},
): void {
  const { colors } = ctx;
  const d = o.decimals ?? decimalsFor(s.step);
  for (const t of s.ticks) {
    const x = s.at(t);
    if (o.grid !== false)
      ctx.line(x, plot.y, x, plot.y + plot.h, { color: colors.rule, width: 0.5 }, { role: 'grid' });
    ctx.text(
      fmt(t, d, o.unit, ctx.language),
      { x: x - 0.6, y: plot.y + plot.h + 0.06, w: 1.2, h: 0.24 },
      { size: 'source', color: colors.muted, align: 'center', maxLines: 1, fixed: true },
    );
  }
}
