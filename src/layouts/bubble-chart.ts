import { z } from 'zod';
import { ensureContrast, mix } from '../engine/color.ts';
import { cols } from '../engine/format.ts';
import type { Box } from '../engine/scene.ts';
import { diag } from '../qa/codes.ts';
import { beeswarm } from './advanced-charts.ts';
import { decimalsFor, fmt, labelWidth, linearScale, takeawayPanel, xAxis } from './kit.ts';
import type { LayoutDef } from './types.ts';

const Axis = z
  .object({
    label: z.string().max(48),
    unit: z.string().max(6).optional().describe('e.g. "%", "€", "x"'),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .strict();

const schema = z
  .object({
    xAxis: Axis,
    yAxis: Axis,
    sizeLabel: z
      .string()
      .max(40)
      .optional()
      .describe('bubble and portfolio: what the bubble area shows, e.g. "Revenue, €M"'),
    items: z
      .array(
        z
          .object({
            label: z.string().max(24),
            x: z.number(),
            y: z.number(),
            size: z
              .number()
              .positive()
              .optional()
              .describe('Bubble area; required for bubble and portfolio'),
            highlight: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(15),
    split: z
      .object({
        x: z.number().describe('Vertical divider, in x units (e.g. relative share 1.0)'),
        y: z.number().describe('Horizontal divider, in y units (e.g. market growth 10%)'),
        names: z
          .array(z.string().max(20))
          .length(4)
          .optional()
          .describe('Quadrant names: top-left, top-right, bottom-left, bottom-right'),
      })
      .strict()
      .optional()
      .describe('portfolio variant: quadrant dividers, e.g. a growth-share matrix'),
    takeaway: z.string().max(140).optional().describe('Interpretation, side panel'),
  })
  .strict();

export const bubbleChart: LayoutDef<typeof schema> = {
  id: 'bubble-chart',
  name: 'Bubble and scatter chart',
  group: 'numbers',
  purpose:
    'Use for items positioned on two measured dimensions — with bubble size for a third, or quadrant dividers for a portfolio (growth-share) view.',
  useWhen: [
    'Portfolio of business units or products: growth vs share, size = revenue',
    'Correlation between two metrics across markets, stores or customers',
    'Competitor positioning on real numbers',
  ],
  avoidWhen: [
    'Positions are judgements, not numbers — use matrix-2x2',
    'One dimension only — use chart-takeaway (bar)',
  ],
  variants: ['bubble', 'scatter', 'portfolio', 'beeswarm'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Germany and Poland combine the fastest growth with the largest profit pools',
      variant: 'bubble',
      content: {
        xAxis: { label: 'Market growth 2025–2030, % a year', unit: '%' },
        yAxis: { label: 'EBIT margin of top three players', unit: '%' },
        sizeLabel: 'Bubble = market size, €B',
        items: [
          { label: 'Germany', x: 7.8, y: 10.5, size: 14, highlight: true },
          { label: 'Poland', x: 9.4, y: 9.2, size: 6.1, highlight: true },
          { label: 'Netherlands', x: 5.1, y: 8.4, size: 4.2 },
          { label: 'France', x: 3.2, y: 6.1, size: 11 },
          { label: 'Italy', x: 2.4, y: 5.2, size: 7.5 },
          { label: 'Czechia', x: 6.6, y: 6.8, size: 1.8 },
        ],
        takeaway: 'Enter Germany first and Poland second; France is large but low-margin',
      },
      sources: ['market-est'],
    },
    {
      title: 'Stores with longer opening hours sell more per square metre — up to 70 hours a week',
      variant: 'scatter',
      content: {
        xAxis: { label: 'Opening hours per week', min: 40, max: 90 },
        yAxis: { label: 'Sales per m², €k', unit: '' },
        items: [
          { label: 'Leeds', x: 48, y: 3.1 },
          { label: 'York', x: 52, y: 3.4 },
          { label: 'Bristol', x: 58, y: 4.0 },
          { label: 'Bath', x: 61, y: 4.1 },
          { label: 'Cardiff', x: 66, y: 4.6, highlight: true },
          { label: 'Leicester', x: 70, y: 4.9, highlight: true },
          { label: 'Glasgow', x: 76, y: 4.8 },
          { label: 'Manchester', x: 84, y: 4.9 },
        ],
      },
      sources: ['ops-review'],
    },
    {
      title: 'Two units fund the portfolio; Analytics is the one question mark worth backing',
      variant: 'portfolio',
      content: {
        xAxis: { label: 'Relative market share (vs largest rival)', unit: 'x', min: 0, max: 2.5 },
        yAxis: { label: 'Market growth, % a year', unit: '%', min: 0, max: 20 },
        sizeLabel: 'Bubble = revenue, €M',
        split: { x: 1, y: 10, names: ['Question marks', 'Stars', 'Dogs', 'Cash cows'] },
        items: [
          { label: 'Payments', x: 1.8, y: 6, size: 420 },
          { label: 'Payroll', x: 1.4, y: 4, size: 260 },
          { label: 'Analytics', x: 0.6, y: 16, size: 90, highlight: true },
          { label: 'Lending', x: 1.3, y: 13, size: 150 },
          { label: 'Insurance', x: 0.4, y: 5, size: 60 },
        ],
        takeaway: 'Back Analytics to reach share parity by 2028; harvest Insurance',
      },
      sources: ['fin-plan'],
    },
    {
      title: 'Most observations cluster around the typical response time',
      variant: 'beeswarm',
      sources: ['illustrative'],
      content: {
        xAxis: { label: 'Response time', unit: 'ms' },
        yAxis: { label: 'Packing offset, not a second measure' },
        items: [
          { label: 'A', x: 18, y: 0 },
          { label: 'B', x: 20, y: 0 },
          { label: 'C', x: 20, y: 0 },
          { label: 'D', x: 21, y: 0 },
          { label: 'E', x: 34, y: 0, highlight: true },
        ],
      },
    },
  ],
  compose(ctx, c) {
    if (ctx.variant === 'beeswarm') {
      beeswarm(ctx, ctx.body, c);
      return;
    }
    const { colors, theme } = ctx;
    const sized = ctx.variant !== 'scatter';
    if (sized && c.items.some((it) => it.size === undefined))
      ctx.issue(
        diag('SC-SPEC-001', `${ctx.variant} variant needs a size on every item`, {
          pointer: ctx.ptr('items'),
        }),
      );
    if (ctx.variant === 'portfolio' && !c.split)
      ctx.issue(
        diag('SC-SPEC-001', 'portfolio variant needs split', { pointer: ctx.ptr('split') }),
      );
    const [main, side] = c.takeaway ? cols(ctx.body, [2.6, 1], 0.4) : [ctx.body, undefined];
    const a = main!;
    const yLabW = 0.62;
    const plot = { x: a.x + yLabW, y: a.y + 0.36, w: a.w - yLabW - 0.1, h: a.h - 0.36 - 0.62 };
    const xs = c.items.map((i) => i.x);
    const ys = c.items.map((i) => i.y);
    const pad = (v: number[]) => (Math.max(...v) - Math.min(...v)) * 0.12 || 1;
    const sx = linearScale(
      Math.min(...xs) - pad(xs),
      Math.max(...xs) + pad(xs),
      plot.x,
      plot.x + plot.w,
      {
        ...(c.xAxis.min !== undefined ? { min: c.xAxis.min } : {}),
        ...(c.xAxis.max !== undefined ? { max: c.xAxis.max } : {}),
      },
    );
    const sy = linearScale(
      Math.min(...ys) - pad(ys),
      Math.max(...ys) + pad(ys),
      plot.y + plot.h,
      plot.y,
      {
        ...(c.yAxis.min !== undefined ? { min: c.yAxis.min } : {}),
        ...(c.yAxis.max !== undefined ? { max: c.yAxis.max } : {}),
      },
    );
    // y gridlines and labels
    const yd = decimalsFor(sy.step);
    for (const t of sy.ticks) {
      const y = sy.at(t);
      ctx.line(plot.x, y, plot.x + plot.w, y, { color: colors.rule, width: 0.5 }, { role: 'grid' });
      ctx.text(
        fmt(t, yd, c.yAxis.unit, ctx.language),
        { x: a.x, y: y - 0.12, w: yLabW - 0.1, h: 0.24 },
        { size: 'source', color: colors.muted, align: 'right', maxLines: 1, fixed: true },
      );
    }
    xAxis(ctx, sx, plot, { ...(c.xAxis.unit ? { unit: c.xAxis.unit } : {}), grid: false });
    ctx.line(plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h, {
      color: colors.ink,
      width: 1,
    });
    ctx.text(
      c.yAxis.label,
      { x: a.x, y: a.y, w: a.w * 0.7, h: 0.28 },
      { size: 'small', bold: true, color: colors.ink, maxLines: 1, field: 'yAxis/label' },
    );
    ctx.text(
      c.xAxis.label,
      { x: plot.x, y: plot.y + plot.h + 0.32, w: plot.w, h: 0.28 },
      {
        size: 'small',
        bold: true,
        color: colors.ink,
        align: 'center',
        maxLines: 1,
        field: 'xAxis/label',
      },
    );
    if (c.sizeLabel && sized)
      ctx.text(
        c.sizeLabel,
        { x: a.x + a.w * 0.55, y: a.y, w: a.w * 0.45 - 0.1, h: 0.28 },
        { size: 'source', color: colors.muted, align: 'right', maxLines: 1, field: 'sizeLabel' },
      );
    // portfolio dividers and quadrant names
    if (c.split) {
      const vx = sx.at(c.split.x);
      const hy = sy.at(c.split.y);
      const dash = { color: colors.muted, width: 1, dash: 'dash' as const };
      ctx.line(vx, plot.y, vx, plot.y + plot.h, dash, { role: 'divider' });
      ctx.line(plot.x, hy, plot.x + plot.w, hy, dash, { role: 'divider' });
      c.split.names?.forEach((n, i) => {
        const right = i % 2 === 1;
        const top = i < 2;
        ctx.text(
          n.toUpperCase(),
          {
            x: right ? plot.x + plot.w - 2.1 : plot.x + 0.08,
            y: top ? plot.y + 0.06 : plot.y + plot.h - 0.3,
            w: 2,
            h: 0.24,
          },
          {
            size: 'source',
            bold: true,
            color: colors.muted,
            align: right ? 'right' : 'left',
            maxLines: 1,
            fixed: true,
            field: `split/names/${i}`,
          },
        );
      });
    }
    // bubbles: area ∝ size; the largest is ~11% of the plot height across
    const maxSize = Math.max(...c.items.map((i) => i.size ?? 1));
    const rMax = Math.min(plot.h, plot.w) * 0.11;
    const size = theme.type.small;
    const grey = mix(colors.rule, colors.muted, 0.45);
    const dots = c.items.map((it) => ({
      x: sx.at(it.x),
      y: sy.at(it.y),
      r: sized ? Math.max(0.06, rMax * Math.sqrt((it.size ?? 0) / maxSize)) : 0.075,
    }));
    // big bubbles first so small ones stay visible on top
    const order = c.items
      .map((it, i) => ({ it, i }))
      .sort((p, q) => (q.it.size ?? 0) - (p.it.size ?? 0));
    for (const { it, i } of order) {
      const { x, y, r } = dots[i]!;
      ctx.ellipse(
        { x: x - r, y: y - r, w: 2 * r, h: 2 * r },
        {
          fill: it.highlight ? colors.accent : grey,
          ...(sized ? { fillOpacity: 0.85 } : {}),
          stroke: { color: colors.background, width: 1 },
          role: 'item',
        },
      );
    }
    // labels: right, left, above or below the bubble — the first spot clear of bubbles and labels
    const placed: Box[] = [];
    const hits = (b: Box) =>
      b.x < plot.x - 0.02 ||
      b.x + b.w > plot.x + plot.w + 0.3 ||
      b.y < plot.y - 0.3 ||
      b.y + b.h > plot.y + plot.h ||
      placed.some(
        (p) => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y,
      ) ||
      dots.some((d) => {
        const cx = Math.max(b.x, Math.min(d.x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(d.y, b.y + b.h));
        return (cx - d.x) ** 2 + (cy - d.y) ** 2 < (d.r + 0.01) ** 2;
      });
    for (const { it, i } of order) {
      const { x, y, r } = dots[i]!;
      const w = labelWidth(ctx, it.label, size, !!it.highlight) + 0.06;
      const h = 0.24;
      const spots: [Box, 'left' | 'right' | 'center'][] = [
        [{ x: x + r + 0.04, y: y - h / 2, w, h }, 'left'],
        [{ x: x - r - 0.04 - w, y: y - h / 2, w, h }, 'right'],
        [{ x: x - w / 2, y: y - r - h - 0.02, w, h }, 'center'],
        [{ x: x - w / 2, y: y + r + 0.02, w, h }, 'center'],
      ];
      const [box, align] = spots.find(([b]) => !hits(b)) ?? spots[0]!;
      placed.push(box);
      ctx.text(it.label, box, {
        size,
        bold: !!it.highlight,
        color: it.highlight ? ensureContrast(colors.accent, colors.background) : colors.ink,
        align,
        maxLines: 1,
        fixed: true,
        field: `items/${i}/label`,
      });
    }
    if (side && c.takeaway) takeawayPanel(ctx, side, c.takeaway);
  },
};
