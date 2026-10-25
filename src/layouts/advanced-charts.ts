import { z } from 'zod';
import { formatNumber } from '../engine/charts.ts';
import { extent, scale } from '../engine/diagram-geometry.ts';
import type { Box } from '../engine/scene.ts';
import { caption, DiagramLabel, diagramDef, dot, label, problem } from './diagram-kit.ts';
import type { ComposeContext } from './types.ts';

const sources = ['illustrative'];
const radarSchema = z
  .object({
    axes: z.array(z.string().min(1).max(24)).min(3).max(5),
    maximum: z.number().positive(),
    unit: z.string().max(12).default(''),
    series: z
      .array(
        z
          .object({ name: DiagramLabel, values: z.array(z.number().nonnegative()).min(3).max(5) })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();
export const radar = diagramDef(
  'radar',
  'Radar comparison',
  radarSchema,
  [
    {
      title: 'The target model improves coverage across every assessed capability',
      sources,
      content: {
        axes: ['Data', 'People', 'Process', 'Systems', 'Controls'],
        maximum: 5,
        series: [
          { name: 'Today', values: [2, 3, 2, 3, 2] },
          { name: 'Target', values: [4, 4, 4, 4, 5] },
        ],
      },
    },
  ],
  (ctx, c) => {
    if (
      c.series.some((s) => s.values.length !== c.axes.length || s.values.some((v) => v > c.maximum))
    ) {
      problem(ctx, 'Radar series must match axes and remain within the common maximum', 'series');
      return;
    }
    const b = ctx.body,
      cx = b.x + b.w / 2,
      cy = b.y + (b.h - 0.5) / 2,
      r = Math.min(b.h * 0.34, b.w * 0.3);
    const point = (i: number, v: number): [number, number] => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / c.axes.length;
      return [cx + (Math.cos(a) * r * v) / c.maximum, cy + (Math.sin(a) * r * v) / c.maximum];
    };
    [0.25, 0.5, 0.75, 1].forEach((f) =>
      ctx.polygon(
        c.axes.map((_, i) => point(i, c.maximum * f)),
        { stroke: { color: ctx.colors.rule, width: 0.6 }, role: 'radar-grid' },
      ),
    );
    c.axes.forEach((a, i) => {
      const p = point(i, c.maximum);
      ctx.line(cx, cy, p[0], p[1], { color: ctx.colors.rule, width: 0.6 });
      const q = point(i, c.maximum * 1.19);
      label(ctx, a, { x: q[0] - 0.9, y: q[1] - 0.2, w: 1.8, h: 0.4 }, `axes/${i}`, {
        size: 'small',
        align: 'center',
      });
    });
    c.series.forEach((s, i) => {
      const color =
        i === c.series.length - 1
          ? ctx.colors.accent
          : (ctx.colors.chart[i + 1] ?? ctx.colors.muted);
      ctx.polygon(
        s.values.map((v, j) => point(j, v)),
        {
          fill: color,
          fillOpacity: 0.1,
          stroke: { color, width: i === c.series.length - 1 ? 1.6 : 1 },
          role: 'radar-series',
        },
      );
      caption(
        ctx,
        `${s.name}: ${s.values.join(' / ')} ${c.unit}`,
        {
          x: b.x + (i * b.w) / c.series.length,
          y: b.y + b.h - 0.32,
          w: b.w / c.series.length - 0.12,
          h: 0.32,
        },
        `series/${i}/name`,
      );
    });
  },
  'Use for a small number of entities assessed on the same bounded quantitative criteria.',
  'numbers',
);

const polarSchema = z
  .object({
    items: z
      .array(
        z.object({ label: z.string().min(1).max(24), value: z.number().nonnegative() }).strict(),
      )
      .min(4)
      .max(8),
    unit: z.string().max(12).default(''),
    maximum: z.number().positive().optional(),
  })
  .strict();
export const polar = diagramDef(
  'polar',
  'Polar radial lollipop',
  polarSchema,
  [
    {
      title: 'Demand peaks in the afternoon within the daily cycle',
      sources,
      content: {
        items: [
          { label: 'Morning', value: 30 },
          { label: 'Midday', value: 55 },
          { label: 'Afternoon', value: 80 },
          { label: 'Evening', value: 45 },
        ],
        unit: 'requests',
      },
    },
  ],
  (ctx, c) => {
    const maximum = c.maximum ?? Math.max(...c.items.map((v) => v.value));
    if (maximum <= 0 || c.items.some((v) => v.value > maximum)) {
      problem(ctx, 'Polar scale must have a positive maximum containing every value', 'maximum');
      return;
    }
    const b = ctx.body,
      cx = b.x + b.w / 2,
      cy = b.y + b.h / 2,
      r = Math.min(b.w * 0.32, b.h * 0.33);
    [0.5, 1].forEach((f) =>
      ctx.ellipse(
        { x: cx - r * f, y: cy - r * f, w: 2 * r * f, h: 2 * r * f },
        { stroke: { color: ctx.colors.rule, width: 0.65 }, role: 'polar-grid' },
      ),
    );
    c.items.forEach((v, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / c.items.length,
        rr = (r * v.value) / maximum,
        x = cx + Math.cos(a) * rr,
        y = cy + Math.sin(a) * rr;
      ctx.line(cx, cy, x, y, { color: ctx.colors.muted, width: 1.2 }, { role: 'polar-value' });
      dot(ctx, x, y, 0.06, v.value === maximum);
      label(
        ctx,
        `${v.label}\n${v.value} ${c.unit}`,
        {
          x: cx + Math.cos(a) * (r + 0.5) - 0.85,
          y: cy + Math.sin(a) * (r + 0.4) - 0.25,
          w: 1.7,
          h: 0.5,
        },
        `items/${i}/label`,
        { size: 'small', align: 'center' },
      );
    });
  },
  'Use for one nonnegative quantitative series over ordered cyclic categories; radius is linear.',
  'numbers',
);

interface SeriesData {
  categories: string[];
  series: { name: string; values: number[] }[];
  unit?: string;
  decimals?: number;
}
export function advancedChart(ctx: ComposeContext, b: Box, c: SeriesData, variant: string) {
  const vals = c.series.flatMap((s) => s.values),
    plot = { x: b.x + 0.9, y: b.y + 0.45, w: b.w - 1.4, h: b.h - 1 };
  if (variant !== 'bump' && vals.some((v) => v < 0)) {
    problem(ctx, 'Distribution and streamgraph values must be nonnegative', 'chart/series');
    return;
  }
  const x = (i: number) => plot.x + (i * plot.w) / (c.categories.length - 1);
  const col = (i: number) =>
    i === 0 ? ctx.colors.accent : (ctx.colors.chart[i + 1] ?? ctx.colors.muted);
  if (variant === 'bump') {
    if (vals.some((v) => !Number.isInteger(v) || v < 1)) {
      problem(ctx, 'Bump charts require positive integer ranks', 'chart/series');
      return;
    }
    const max = Math.max(2, ...vals),
      y = scale([1, max], plot.y, plot.y + plot.h);
    const ranks = max <= 8 ? Array.from({ length: max }, (_, i) => i + 1) : [1, max];
    for (const rank of ranks)
      caption(ctx, `${rank}`, { x: b.x, y: y(rank) - 0.14, w: 0.65, h: 0.28 }, undefined);
    c.series.forEach((s, i) => {
      for (let j = 1; j < s.values.length; j++)
        ctx.line(
          x(j - 1),
          y(s.values[j - 1]!),
          x(j),
          y(s.values[j]!),
          { color: col(i), width: i === 0 ? 2 : 1.2 },
          { role: 'rank-series' },
        );
      s.values.forEach((v, j) => dot(ctx, x(j), y(v), 0.045, i === 0));
      caption(
        ctx,
        s.name,
        { x: plot.x + plot.w + 0.08, y: y(s.values.at(-1)!) - 0.14, w: 0.8, h: 0.28 },
        `chart/series/${i}/name`,
      );
    });
  } else if (variant === 'ridgeline') {
    const bins = c.categories.map(Number);
    if (bins.some((v, i) => !Number.isFinite(v) || (i > 0 && v <= bins[i - 1]!))) {
      problem(
        ctx,
        'Ridgeline categories must be increasing numeric bin centres; values are observed bin counts',
        'chart/categories',
      );
      return;
    }
    const max = Math.max(...vals);
    if (max <= 0) {
      problem(ctx, 'Ridgeline needs positive observed counts', 'chart/series');
      return;
    }
    const sx = scale(extent(bins), plot.x, plot.x + plot.w),
      h = plot.h / c.series.length;
    caption(
      ctx,
      `Observed bin counts · shared height scale 0–${max}`,
      { x: plot.x, y: b.y, w: plot.w, h: 0.3 },
      undefined,
    );
    c.series.forEach((s, i) => {
      const baseline = plot.y + (i + 1) * h,
        points = s.values.map((v, j): [number, number] => [
          sx(bins[j]!),
          baseline - (v / max) * h * 0.78,
        ]);
      ctx.polygon([[plot.x, baseline], ...points, [plot.x + plot.w, baseline]], {
        fill: col(i),
        fillOpacity: 0.12,
        stroke: { color: col(i), width: 1 },
        role: 'observed-distribution',
      });
      caption(
        ctx,
        s.name,
        { x: b.x, y: baseline - h * 0.6, w: 0.8, h: 0.35 },
        `chart/series/${i}/name`,
      );
    });
  } else {
    const totals = c.categories.map((_, j) => c.series.reduce((s, v) => s + v.values[j]!, 0)),
      max = Math.max(...totals);
    if (max <= 0) {
      problem(ctx, 'Streamgraph requires a positive total', 'chart/series');
      return;
    }
    const y = (v: number) => plot.y + plot.h / 2 - (v / max) * plot.h;
    let lower = totals.map((v) => -v / 2);
    c.series.forEach((s, i) => {
      const upper = lower.map((v, j) => v + s.values[j]!);
      ctx.polygon(
        [
          ...lower.map((v, j): [number, number] => [x(j), y(v)]),
          ...upper.map((v, j): [number, number] => [x(j), y(v)]).reverse(),
        ],
        { fill: col(i), fillOpacity: 0.65, role: 'streamgraph-band' },
      );
      lower = upper;
      const legendX = b.x + (i * b.w) / c.series.length;
      ctx.rect(
        { x: legendX, y: b.y + 0.07, w: 0.15, h: 0.12 },
        { fill: col(i), fillOpacity: 0.65, role: 'series-key' },
      );
      caption(
        ctx,
        s.name,
        { x: legendX + 0.22, y: b.y, w: b.w / c.series.length - 0.22, h: 0.3 },
        `chart/series/${i}/name`,
      );
    });
  }
  c.categories.forEach((name, i) =>
    caption(
      ctx,
      name,
      { x: x(i) - 0.35, y: b.y + b.h - 0.35, w: 0.7, h: 0.3 },
      `chart/categories/${i}`,
    ),
  );
}

export function beeswarm(
  ctx: ComposeContext,
  b: Box,
  c: {
    xAxis: { label: string; min?: number; max?: number; unit?: string };
    items: { label: string; x: number; highlight?: boolean }[];
  },
) {
  const domain = extent(c.items.map((v) => v.x));
  if (c.xAxis.min !== undefined) domain[0] = c.xAxis.min;
  if (c.xAxis.max !== undefined) domain[1] = c.xAxis.max;
  if (domain[1] <= domain[0] || c.items.some((v) => v.x < domain[0] || v.x > domain[1])) {
    problem(ctx, 'Beeswarm domain must contain every observation', 'xAxis');
    return;
  }
  const sx = scale(domain, b.x + 0.4, b.x + b.w - 0.4),
    cy = b.y + b.h * 0.4,
    r = 0.07,
    placed: { x: number; y: number }[] = [];
  const positions = c.items.map((item) => {
    const x = sx(item.x),
      candidates = [0];
    for (const p of placed) {
      const dx = Math.abs(x - p.x);
      if (dx < 2 * r) {
        const dy = Math.sqrt(4 * r * r - dx * dx) + 0.004;
        candidates.push(p.y + dy, p.y - dy);
      }
    }
    candidates.sort((a, d) => Math.abs(a) - Math.abs(d) || a - d);
    const y = candidates.find((y) =>
      placed.every((p) => Math.hypot(x - p.x, y - p.y) >= 2 * r - 1e-6),
    );
    if (y === undefined || Math.abs(y) > b.h * 0.28) return null;
    const p = { x, y };
    placed.push(p);
    return p;
  });
  if (positions.some((v) => v === null)) {
    problem(ctx, 'Observations need more packing space; enlarge or split the swarm', 'items');
    return;
  }
  ctx.line(b.x + 0.4, cy, b.x + b.w - 0.4, cy, { color: ctx.colors.rule, width: 0.75 });
  c.items.forEach((item, i) => {
    const p = positions[i]!;
    dot(ctx, p.x, cy + p.y, r, item.highlight);
    caption(
      ctx,
      `${item.label}: ${formatNumber(item.x, 1, c.xAxis.unit ?? '', false, ctx.language)}`,
      {
        x: b.x + ((i % 3) * b.w) / 3,
        y: b.y + b.h * 0.7 + Math.floor(i / 3) * 0.28,
        w: b.w / 3 - 0.15,
        h: 0.27,
      },
      `items/${i}/label`,
    );
  });
  label(ctx, c.xAxis.label, { x: b.x, y: b.y, w: b.w, h: 0.35 }, 'xAxis/label', { bold: true });
}
