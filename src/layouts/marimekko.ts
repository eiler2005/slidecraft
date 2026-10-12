import { z } from 'zod';
import { ensureContrast, onColor } from '../engine/color.ts';
import { cols } from '../engine/format.ts';
import { diag } from '../qa/codes.ts';
import { fmt, labelWidth, recedingFills, takeawayPanel } from './kit.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    unit: z.string().max(6).optional().describe('Unit of the column totals, e.g. "€B"'),
    totalLabel: z
      .string()
      .max(40)
      .optional()
      .describe('What column width shows, e.g. "Market size, €B"'),
    series: z
      .array(z.string().max(20))
      .min(2)
      .max(6)
      .describe('Players or sub-segments stacked in every column; put "Others" last'),
    columns: z
      .array(
        z
          .object({
            label: z.string().max(18),
            total: z.number().positive().describe('Column width: segment size'),
            shares: z
              .array(z.number().min(0))
              .describe('One value per series (shares or amounts — normalised to 100%)'),
          })
          .strict(),
      )
      .min(2)
      .max(7),
    highlight: z.number().int().min(0).optional().describe('Series index to show in the accent'),
    decimals: z.number().int().min(0).max(2).optional(),
    takeaway: z.string().max(140).optional().describe('Interpretation, side panel'),
  })
  .strict();

export const marimekko: LayoutDef<typeof schema> = {
  id: 'marimekko',
  name: 'Marimekko',
  group: 'numbers',
  purpose:
    'Use for market structure in one picture: segment size as column width and each player’s share as the stack within it.',
  useWhen: [
    'Where we are strong and where the big segments are',
    'Share by segment for us vs competitors',
    'Profit pools by region and player',
  ],
  avoidWhen: [
    'Segments are about the same size — use a stacked column (chart-takeaway)',
    'More than seven segments or six players — group the long tail',
  ],
  variants: ['shares'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'We lead in the two smallest segments; mid-market is the large pool we barely touch',
      content: {
        unit: '€B',
        totalLabel: 'Column width = segment size, €B',
        series: ['Northwind', 'Contoso', 'Fabrikam', 'Others'],
        highlight: 0,
        columns: [
          { label: 'Enterprise', total: 4.2, shares: [8, 41, 22, 29] },
          { label: 'Mid-market', total: 6.8, shares: [6, 18, 21, 55] },
          { label: 'Small business', total: 2.1, shares: [34, 12, 9, 45] },
          { label: 'Public sector', total: 1.4, shares: [38, 25, 4, 33] },
        ],
        decimals: 1,
        takeaway: 'Mid-market is half the market; a 10-point gain there doubles our revenue',
      },
      sources: ['market-est'],
    },
  ],
  compose(ctx, c) {
    const { colors, theme } = ctx;
    c.columns.forEach((col, i) => {
      if (col.shares.length !== c.series.length)
        ctx.issue(
          diag(
            'SC-SPEC-001',
            `column "${col.label}" has ${col.shares.length} shares for ${c.series.length} series`,
            {
              pointer: ctx.ptr(`columns/${i}/shares`),
            },
          ),
        );
    });
    const [main, side] = c.takeaway ? cols(ctx.body, [2.6, 1], 0.4) : [ctx.body, undefined];
    const a = main!;
    const size = theme.type.small;
    const legendW = Math.min(
      2,
      Math.max(...c.series.map((s, i) => labelWidth(ctx, s, size, i === c.highlight))) + 0.2,
    );
    const plot = { x: a.x, y: a.y + 0.34, w: a.w - legendW, h: a.h - 0.34 - 0.8 };
    const sum = c.columns.reduce((t, col) => t + col.total, 0);
    const gap = 0.04;
    const usable = plot.w - gap * (c.columns.length - 1);
    // series colours: highlight in the accent, others from the receding palette / tints
    // one accent for the highlighted series; the others recede on a grey ramp
    const others = recedingFills(ctx, c.series.length - (c.highlight !== undefined ? 1 : 0));
    const colorOf = (s: number) =>
      s === c.highlight
        ? colors.accent
        : others[s - (c.highlight !== undefined && s > c.highlight ? 1 : 0)]!;
    const d = c.decimals ?? 0;
    let x = plot.x;
    const lastMid: number[] = [];
    c.columns.forEach((col, ci) => {
      const w = (col.total / sum) * usable;
      const total = col.shares.reduce((t, v) => t + v, 0) || 1;
      let y = plot.y;
      col.shares.forEach((v, si) => {
        const h = (v / total) * plot.h;
        const fill = colorOf(si);
        ctx.rect(
          { x, y, w, h },
          { fill, stroke: { color: colors.background, width: 1 }, role: 'segment' },
        );
        const pct = `${Math.round((v / total) * 100)}%`;
        if (h >= 0.22 && labelWidth(ctx, pct, theme.type.source) + 0.1 < w)
          ctx.text(
            pct,
            { x, y, w, h },
            {
              size: 'source',
              bold: si === c.highlight,
              color: ensureContrast(onColor(fill), fill),
              align: 'center',
              valign: 'middle',
              maxLines: 1,
              fixed: true,
            },
          );
        if (ci === c.columns.length - 1) lastMid[si] = y + h / 2;
        y += h;
      });
      ctx.text(
        col.label,
        { x: x - gap / 2, y: plot.y + plot.h + 0.06, w: w + gap, h: 0.44 },
        {
          size: 'small',
          bold: true,
          color: colors.ink,
          align: 'center',
          maxLines: 2,
          lineHeight: 1.05,
          field: `columns/${ci}/label`,
        },
      );
      ctx.text(
        fmt(col.total, d, c.unit, ctx.language),
        { x, y: plot.y + plot.h + 0.5, w, h: 0.24 },
        { size: 'source', color: colors.muted, align: 'center', maxLines: 1, fixed: true },
      );
      x += w + gap;
    });
    // direct labels next to the last column instead of a legend
    let prev = -1;
    c.series.forEach((s, si) => {
      const y = Math.max(lastMid[si] ?? plot.y, prev + 0.25);
      prev = y;
      ctx.text(
        s,
        { x: plot.x + plot.w + 0.12, y: y - 0.12, w: legendW - 0.12, h: 0.24 },
        {
          size,
          bold: si === c.highlight,
          color: si === c.highlight ? ensureContrast(colors.accent, colors.background) : colors.ink,
          maxLines: 1,
          fixed: true,
          field: `series/${si}`,
        },
      );
    });
    if (c.totalLabel)
      ctx.text(
        c.totalLabel,
        { x: a.x, y: a.y, w: plot.w, h: 0.26 },
        { size: 'source', color: colors.muted, maxLines: 1, field: 'totalLabel' },
      );
    if (side && c.takeaway) takeawayPanel(ctx, side, c.takeaway);
  },
};
