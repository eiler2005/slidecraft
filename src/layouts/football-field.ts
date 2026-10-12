import { z } from 'zod';
import { ensureContrast } from '../engine/color.ts';
import { cols } from '../engine/format.ts';
import {
  decimalsFor,
  fmt,
  labelWidth,
  linearScale,
  recedingFills,
  takeawayPanel,
  xAxis,
} from './kit.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    metric: z.string().max(48).describe('What the ranges show, e.g. "Equity value, €M"'),
    unit: z.string().max(6).optional(),
    decimals: z.number().int().min(0).max(2).optional(),
    ranges: z
      .array(
        z
          .object({
            label: z.string().max(30).describe('Method, e.g. "DCF (WACC 8–10%)"'),
            note: z.string().max(40).optional().describe('Basis, e.g. "12 peers, 2027 EBITDA"'),
            low: z.number(),
            high: z.number(),
            highlight: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    marker: z
      .object({ value: z.number(), label: z.string().max(28) })
      .strict()
      .optional()
      .describe('A reference line, e.g. the offer price or our bid'),
    takeaway: z.string().max(140).optional().describe('Interpretation, side panel'),
  })
  .strict();

export const footballField: LayoutDef<typeof schema> = {
  id: 'football-field',
  name: 'Football field (ranges)',
  group: 'numbers',
  purpose:
    'Use for comparing value ranges from several methods on one axis — valuation, price corridors or estimates — against a reference such as the offer.',
  useWhen: [
    'Valuation summary for M&A or fundraising',
    'Price or cost estimates from several sources',
    'Market sizing triangulated top-down and bottom-up',
  ],
  avoidWhen: [
    'Point values, not ranges — use chart-takeaway (bar)',
    'Ranges around one driver at a time — use tornado',
  ],
  variants: ['ranges'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Every method supports a bid of up to €410M; the asking price sits above all but one',
      content: {
        metric: 'Equity value, €M',
        ranges: [
          { label: '52-week trading range', low: 300, high: 380 },
          { label: 'Trading comparables', note: '12 peers, 6.5–8.0x EBITDA', low: 320, high: 410 },
          { label: 'Precedent transactions', note: '9 deals since 2021', low: 360, high: 470 },
          {
            label: 'DCF',
            note: 'WACC 8–10%, growth 1.5–2.5%',
            low: 340,
            high: 430,
            highlight: true,
          },
          { label: 'LBO', note: 'IRR 20–25%', low: 290, high: 360 },
        ],
        marker: { value: 450, label: 'Asking price €450M' },
        takeaway: 'Open at €380M and walk away above €410M',
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
      Math.max(
        ...c.ranges.map((r) =>
          Math.max(
            labelWidth(ctx, r.label, size, true),
            r.note ? labelWidth(ctx, r.note, theme.type.source) : 0,
          ),
        ),
      ) + 0.2,
    );
    const top = a.y + 0.62;
    const plot = { x: a.x + labW + 0.2, y: top, w: a.w - labW - 0.5, h: a.y + a.h - top - 0.36 };
    const all = c.ranges.flatMap((r) => [r.low, r.high]).concat(c.marker ? [c.marker.value] : []);
    const span = Math.max(...all) - Math.min(...all);
    const s = linearScale(
      Math.min(...all) - span * 0.1,
      Math.max(...all) + span * 0.1,
      plot.x,
      plot.x + plot.w,
      {
        ticks: 6,
      },
    );
    const d = c.decimals ?? decimalsFor(s.step);
    xAxis(ctx, s, plot, { ...(c.unit ? { unit: c.unit } : {}) });
    const rowH = plot.h / c.ranges.length;
    const barH = Math.min(0.4, rowH * 0.55);
    c.ranges.forEach((r, i) => {
      const y = plot.y + i * rowH + (rowH - barH) / 2;
      const hasNote = !!r.note;
      ctx.text(
        r.label,
        { x: a.x, y: hasNote ? y - 0.08 : y, w: labW, h: hasNote ? 0.28 : barH },
        {
          size,
          bold: !!r.highlight,
          color: colors.ink,
          align: 'right',
          valign: hasNote ? 'top' : 'middle',
          maxLines: 1,
          field: `ranges/${i}/label`,
        },
      );
      if (r.note)
        ctx.text(
          r.note,
          { x: a.x, y: y + 0.2, w: labW, h: 0.24 },
          {
            size: 'source',
            color: colors.muted,
            align: 'right',
            maxLines: 1,
            field: `ranges/${i}/note`,
          },
        );
      const x1 = s.at(Math.min(r.low, r.high));
      const x2 = s.at(Math.max(r.low, r.high));
      const fill = r.highlight ? colors.accent : recedingFills(ctx, 1)[0]!;
      ctx.rect({ x: x1, y, w: Math.max(0.02, x2 - x1), h: barH }, { fill, role: 'range' });
      for (const [v, x, right] of [
        [Math.min(r.low, r.high), x1, false],
        [Math.max(r.low, r.high), x2, true],
      ] as const)
        ctx.text(
          fmt(v, d, c.unit, ctx.language),
          { x: right ? x + 0.05 : x - 0.85, y, w: 0.8, h: barH },
          {
            size: 'source',
            color: colors.ink,
            align: right ? 'left' : 'right',
            valign: 'middle',
            maxLines: 1,
            fixed: true,
          },
        );
    });
    ctx.text(
      c.metric,
      { x: a.x, y: a.y, w: a.w * 0.55, h: 0.26 },
      { size: 'small', bold: true, color: colors.ink, maxLines: 1, field: 'metric' },
    );
    if (c.marker) {
      const mx = s.at(c.marker.value);
      const ink = ensureContrast(colors.negative, colors.background);
      ctx.line(
        mx,
        plot.y - 0.1,
        mx,
        plot.y + plot.h,
        { color: ink, width: 1.5, dash: 'dash' },
        { role: 'marker' },
      );
      const w = labelWidth(ctx, c.marker.label, theme.type.source, true) + 0.1;
      const lx = Math.min(Math.max(mx - w / 2, plot.x), a.x + a.w - w);
      ctx.text(
        c.marker.label,
        { x: lx, y: plot.y - 0.36, w, h: 0.24 },
        {
          size: 'source',
          bold: true,
          color: ink,
          align: 'center',
          maxLines: 1,
          field: 'marker/label',
        },
      );
    }
    if (side && c.takeaway) takeawayPanel(ctx, side, c.takeaway);
  },
};
