import { formatNumber } from '../engine/charts.ts';
import { extent, scale, spreadLabels } from '../engine/diagram-geometry.ts';
import type { Box } from '../engine/scene.ts';
import { caption, dot, label, problem } from './diagram-kit.ts';
import type { ComposeContext } from './types.ts';

interface PairedData {
  categories: string[];
  series: { name: string; values: number[] }[];
  unit?: string;
  decimals?: number;
  highlight?: (string | number)[];
}

/** Editable marks and labels; deliberately not represented as an Office line chart. */
export function pairedComparison(ctx: ComposeContext, b: Box, c: PairedData, variant: string) {
  if (c.series.length !== 2 || c.categories.length > 8) {
    problem(
      ctx,
      'Paired comparisons require exactly two series and at most eight categories',
      'chart/series',
    );
    return;
  }
  const [before, after] = c.series as [PairedData['series'][number], PairedData['series'][number]];
  const values = [...before.values, ...after.values];
  const fmt = (v: number) => formatNumber(v, c.decimals ?? 0, c.unit ?? '', false, ctx.language);
  const focal = (i: number) => (c.highlight ?? []).some((v) => v === i || v === c.categories[i]);
  const color = (i: number) => (focal(i) ? ctx.colors.accent : ctx.colors.muted);
  const domain = extent(values);
  if (variant === 'dumbbell') {
    const x = scale(domain, b.x + Math.min(2, b.w * 0.3), b.x + b.w - 0.6),
      row = (b.h - 0.6) / c.categories.length;
    caption(
      ctx,
      `${before.name}: ○    ${after.name}: ●`,
      { x: b.x, y: b.y, w: b.w, h: 0.35 },
      'chart/series',
    );
    c.categories.forEach((name, i) => {
      const y = b.y + 0.6 + (i + 0.5) * row,
        a = x(before.values[i]!),
        d = x(after.values[i]!);
      label(
        ctx,
        name,
        { x: b.x, y: y - 0.22, w: Math.min(1.8, b.w * 0.27), h: 0.44 },
        `chart/categories/${i}`,
        { bold: focal(i) },
      );
      ctx.line(
        a,
        y,
        d,
        y,
        { color: color(i), width: focal(i) ? 2 : 1.2 },
        { role: 'data-comparison' },
      );
      dot(ctx, a, y, 0.065, focal(i), true);
      dot(ctx, d, y, 0.055, focal(i));
      caption(
        ctx,
        fmt(before.values[i]!),
        { x: a - 0.4, y: y - 0.36, w: 0.8, h: 0.22 },
        `chart/series/0/values/${i}`,
      );
      caption(
        ctx,
        fmt(after.values[i]!),
        { x: d - 0.4, y: y + 0.1, w: 0.8, h: 0.22 },
        `chart/series/1/values/${i}`,
      );
    });
  } else {
    const x0 = b.x + b.w * 0.32,
      x1 = b.x + b.w * 0.68,
      top = b.y + 0.65,
      bottom = b.y + b.h - 0.35;
    const y = scale(domain, bottom, top);
    let left: number[], right: number[];
    try {
      left = spreadLabels(before.values.map(y), top, bottom, 0.42);
      right = spreadLabels(after.values.map(y), top, bottom, 0.42);
    } catch (e) {
      problem(ctx, (e as Error).message, 'chart/categories');
      return;
    }
    caption(ctx, before.name, { x: x0 - 0.7, y: b.y, w: 1.4, h: 0.35 }, 'chart/series/0/name');
    caption(ctx, after.name, { x: x1 - 0.7, y: b.y, w: 1.4, h: 0.35 }, 'chart/series/1/name');
    ctx.line(x0, top, x0, bottom, { color: ctx.colors.rule, width: 0.8 });
    ctx.line(x1, top, x1, bottom, { color: ctx.colors.rule, width: 0.8 });
    c.categories.forEach((name, i) => {
      const a = y(before.values[i]!),
        d = y(after.values[i]!);
      ctx.line(
        x0,
        a,
        x1,
        d,
        { color: color(i), width: focal(i) ? 2 : 1 },
        { role: 'data-comparison' },
      );
      dot(ctx, x0, a, 0.045, focal(i));
      dot(ctx, x1, d, 0.045, focal(i));
      if (Math.abs(left[i]! - a) > 0.02)
        ctx.line(x0 - 0.1, left[i]!, x0, a, { color: ctx.colors.rule, width: 0.7 });
      if (Math.abs(right[i]! - d) > 0.02)
        ctx.line(x1, d, x1 + 0.1, right[i]!, { color: ctx.colors.rule, width: 0.7 });
      label(
        ctx,
        `${name}  ${fmt(before.values[i]!)}`,
        { x: b.x, y: left[i]! - 0.2, w: x0 - b.x - 0.14, h: 0.4 },
        `chart/categories/${i}`,
        { size: 'small', align: 'right', bold: focal(i) },
      );
      label(
        ctx,
        `${fmt(after.values[i]!)}  ${name}`,
        { x: x1 + 0.14, y: right[i]! - 0.2, w: b.x + b.w - x1 - 0.14, h: 0.4 },
        `chart/series/1/values/${i}`,
        { size: 'small', bold: focal(i) },
      );
    });
  }
}
