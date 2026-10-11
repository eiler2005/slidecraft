import { z } from 'zod';
import { ensureContrast } from '../engine/color.ts';
import { cols } from '../engine/format.ts';
import { decimalsFor, fmt, labelWidth, linearScale, recedingFills, takeawayPanel } from './kit.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    metric: z.string().max(48).describe('What moves, e.g. "NPV, €M"'),
    base: z.number().describe('Base-case value of the metric'),
    baseLabel: z.string().max(24).optional().describe('Defaults to "Base case"'),
    unit: z.string().max(6).optional(),
    decimals: z.number().int().min(0).max(2).optional(),
    lowLabel: z.string().max(20).optional().describe('Legend for the downside, e.g. "Pessimistic"'),
    highLabel: z.string().max(20).optional().describe('Legend for the upside, e.g. "Optimistic"'),
    drivers: z
      .array(
        z
          .object({
            label: z.string().max(36).describe('Driver and its range, e.g. "Price ±10%"'),
            low: z.number().describe('Metric when the driver is at its downside'),
            high: z.number().describe('Metric when the driver is at its upside'),
          })
          .strict(),
      )
      .min(2)
      .max(9)
      .describe('Sorted automatically, widest swing on top'),
    takeaway: z.string().max(140).optional().describe('Interpretation, side panel'),
  })
  .strict();

export const tornado: LayoutDef<typeof schema> = {
  id: 'tornado',
  name: 'Tornado (sensitivity)',
  group: 'numbers',
  purpose:
    'Use for showing which assumptions move a result most: each driver’s downside and upside around the base case, widest on top.',
  useWhen: [
    'Business case risk: which assumptions to test or hedge first',
    'Explaining the range around a forecast or valuation',
  ],
  avoidWhen: [
    'Scenarios rather than one driver at a time — use options-comparison or data-table',
    'Bridging from one value to another — use waterfall',
  ],
  variants: ['bars'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Price and volume decide the case; cost assumptions barely move it',
      content: {
        metric: 'NPV 2026–2035, €M',
        base: 48,
        unit: '',
        lowLabel: 'Downside',
        highLabel: 'Upside',
        drivers: [
          { label: 'Volume ±20%', low: 22, high: 71 },
          { label: 'Price ±10%', low: 29, high: 66 },
          { label: 'Launch 6 months late / early', low: 36, high: 55 },
          { label: 'Churn 8% / 4%', low: 39, high: 54 },
          { label: 'Opex ±10%', low: 43, high: 53 },
          { label: 'Capex ±15%', low: 45, high: 51 },
        ],
        takeaway: 'Lock in volume with two anchor customers before we commit the capex',
      },
      sources: ['fin-plan'],
    },
  ],
  compose(ctx, c) {
    const { colors, theme } = ctx;
    const [main, side] = c.takeaway ? cols(ctx.body, [2.6, 1], 0.4) : [ctx.body, undefined];
    const a = main!;
    const size = theme.type.small;
    const labW = Math.min(
      a.w * 0.36,
      Math.max(...c.drivers.map((d) => labelWidth(ctx, d.label, size))) + 0.2,
    );
    const top = a.y + 0.62;
    const plot = { x: a.x + labW + 0.55, y: top, w: a.w - labW - 1.1, h: a.y + a.h - top - 0.36 };
    const all = c.drivers.flatMap((d) => [d.low, d.high]).concat(c.base);
    const s = linearScale(Math.min(...all), Math.max(...all), plot.x, plot.x + plot.w, {
      ticks: 6,
    });
    const d = c.decimals ?? decimalsFor(s.step);
    const sorted = c.drivers
      .map((dr, i) => ({ dr, i }))
      .sort((p, q) => Math.abs(q.dr.high - q.dr.low) - Math.abs(p.dr.high - p.dr.low));
    const rowH = plot.h / sorted.length;
    const barH = Math.min(0.42, rowH * 0.62);
    const bx = s.at(c.base);
    const down = recedingFills(ctx, 1)[0]!;
    sorted.forEach(({ dr, i }, r) => {
      const y = plot.y + r * rowH + (rowH - barH) / 2;
      ctx.text(
        dr.label,
        { x: a.x, y: y, w: labW, h: barH },
        {
          size,
          color: colors.ink,
          align: 'right',
          valign: 'middle',
          maxLines: 1,
          field: `drivers/${i}/label`,
        },
      );
      for (const [v, isHigh] of [
        [dr.low, false],
        [dr.high, true],
      ] as const) {
        const x = s.at(v);
        const fill = isHigh ? colors.accent : down;
        ctx.rect(
          { x: Math.min(x, bx), y, w: Math.max(0.01, Math.abs(x - bx)), h: barH },
          { fill, role: isHigh ? 'upside' : 'downside' },
        );
        const right = x >= bx;
        ctx.text(
          fmt(v, d, c.unit),
          { x: right ? x + 0.05 : x - 0.85, y, w: 0.8, h: barH },
          {
            size: 'source',
            color: colors.muted,
            align: right ? 'left' : 'right',
            valign: 'middle',
            maxLines: 1,
            fixed: true,
          },
        );
      }
    });
    // base line and header
    ctx.line(
      bx,
      plot.y - 0.08,
      bx,
      plot.y + plot.h,
      { color: colors.ink, width: 1.25 },
      { role: 'base' },
    );
    ctx.text(
      `${c.baseLabel ?? 'Base case'} ${fmt(c.base, d, c.unit)}`,
      { x: bx - 1.5, y: plot.y - 0.34, w: 3, h: 0.24 },
      { size: 'source', bold: true, color: colors.ink, align: 'center', maxLines: 1, fixed: true },
    );
    ctx.text(
      c.metric,
      { x: a.x, y: a.y, w: a.w * 0.6, h: 0.26 },
      { size: 'small', bold: true, color: colors.ink, maxLines: 1, field: 'metric' },
    );
    // legend: downside / upside swatches, top right
    const legend: [string, string][] = [
      [c.lowLabel ?? 'Downside', down],
      [c.highLabel ?? 'Upside', colors.accent],
    ];
    let lx = a.x + a.w;
    for (const [label, fill] of [...legend].reverse()) {
      const w = labelWidth(ctx, label, theme.type.source) + 0.08;
      lx -= w;
      ctx.text(
        label,
        { x: lx, y: a.y, w, h: 0.26 },
        { size: 'source', color: colors.muted, maxLines: 1, fixed: true },
      );
      lx -= 0.2;
      ctx.rect({ x: lx, y: a.y + 0.07, w: 0.14, h: 0.12 }, { fill, role: 'legend' });
      lx -= 0.25;
    }
    for (const t of s.ticks)
      ctx.text(
        fmt(t, d, c.unit),
        { x: s.at(t) - 0.5, y: plot.y + plot.h + 0.06, w: 1, h: 0.24 },
        {
          size: 'source',
          color: ensureContrast(colors.muted, colors.background, 3),
          align: 'center',
          maxLines: 1,
          fixed: true,
        },
      );
    if (side && c.takeaway) takeawayPanel(ctx, side, c.takeaway);
  },
};
