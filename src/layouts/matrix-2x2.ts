import { z } from 'zod';
import { textWidthPt } from '../engine/fonts.ts';
import { cols } from '../engine/format.ts';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const Axis = z
  .object({
    label: z.string().max(40),
    low: z.string().max(16),
    high: z.string().max(16),
  })
  .strict();

const schema = z
  .object({
    xAxis: Axis,
    yAxis: Axis,
    quadrants: z
      .array(z.object({ name: z.string().max(36), note: z.string().max(110).optional() }).strict())
      .length(4)
      .describe(
        'Order: top-left, top-right, bottom-left, bottom-right. Top-right is treated as the target',
      ),
    items: z
      .array(
        z
          .object({
            label: z.string().max(24),
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            highlight: z.boolean().optional(),
          })
          .strict(),
      )
      .max(12)
      .optional()
      .describe('plot variant: items positioned 0–1 on each axis'),
    takeaway: z.string().max(140).optional().describe('Interpretation shown in a side panel'),
  })
  .strict();

export const matrix2x2: LayoutDef<typeof schema> = {
  id: 'matrix-2x2',
  name: '2×2 matrix',
  group: 'decide',
  purpose: 'Use for prioritising items on two dimensions, or naming four strategic positions.',
  useWhen: [
    'Impact vs effort prioritisation',
    'Segment attractiveness vs ability to win',
    'Competitive positioning',
  ],
  avoidWhen: [
    'One dimension only — use a sorted bar (chart-takeaway)',
    'More than ~12 items — use a table',
  ],
  variants: ['plot', 'quadrants'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Four initiatives deliver most of the value for modest effort',
      variant: 'plot',
      content: {
        xAxis: { label: 'Effort to deliver', low: 'Low', high: 'High' },
        yAxis: { label: 'Value at stake', low: 'Low', high: 'High' },
        quadrants: [
          { name: 'Big bets' },
          { name: 'Quick wins' },
          { name: 'Deprioritise' },
          { name: 'Fill-ins' },
        ],
        items: [
          { label: 'Self-serve onboarding', x: 0.78, y: 0.82, highlight: true },
          { label: 'Partner portal', x: 0.7, y: 0.66, highlight: true },
          { label: 'Usage-based pricing', x: 0.62, y: 0.9, highlight: true },
          { label: 'Churn alerts', x: 0.86, y: 0.58, highlight: true },
          { label: 'New data centre', x: 0.18, y: 0.78 },
          { label: 'Rebrand', x: 0.3, y: 0.22 },
          { label: 'Mobile app', x: 0.22, y: 0.52 },
        ],
        takeaway: 'Start with the four quick wins; fund one big bet only after Q2 results',
      },
    },
    {
      title: 'Mid-market is both attractive and winnable — the segment to lead with',
      variant: 'quadrants',
      content: {
        xAxis: { label: 'Our ability to win', low: 'Weak', high: 'Strong' },
        yAxis: { label: 'Segment attractiveness', low: 'Low', high: 'High' },
        quadrants: [
          {
            name: 'Build capability',
            note: 'Enterprise: large deals, but incumbents own the relationships',
          },
          { name: 'Lead here', note: 'Mid-market: fast growth, product fit proven in the UK' },
          { name: 'Avoid', note: 'Micro-business: low willingness to pay' },
          {
            name: 'Serve efficiently',
            note: 'Public sector: winnable via partners, slower cycles',
          },
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { colors, theme } = ctx;
    if (ctx.variant === 'plot' && !c.items?.length) {
      ctx.issue(diag('SC-SPEC-001', 'plot variant needs items', { pointer: ctx.ptr('items') }));
    }
    const [mainArea, side] = c.takeaway ? cols(ctx.body, [2.7, 1], 0.4) : [ctx.body, undefined];
    const area = mainArea!;
    const yLabW = 0.95;
    const mx = area.x + yLabW;
    const my = area.y + 0.36;
    const mw = Math.min(area.w - yLabW - 0.1, (area.h - 0.8) * 1.9);
    const mh = area.h - 0.36 - 0.5;
    const hw = mw / 2;
    const hh = mh / 2;
    // quadrants: TL, TR, BL, BR
    const qBoxes = [
      { x: mx, y: my, w: hw, h: hh },
      { x: mx + hw, y: my, w: hw, h: hh },
      { x: mx, y: my + hh, w: hw, h: hh },
      { x: mx + hw, y: my + hh, w: hw, h: hh },
    ];
    qBoxes.forEach((b, i) =>
      ctx.rect(b, {
        fill: i === 1 ? colors.accentSoft : colors.surface,
        stroke: { color: colors.background, width: 2 },
        role: 'quadrant',
      }),
    );
    c.quadrants.forEach((q, i) => {
      const b = qBoxes[i]!;
      const target = i === 1;
      ctx.text(
        q.name.toUpperCase(),
        { x: b.x + 0.15, y: b.y + 0.12, w: b.w - 0.3, h: 0.26 },
        {
          size: 'small',
          bold: true,
          color: target ? colors.accent : colors.muted,
          maxLines: 1,
          fixed: true,
          field: `quadrants/${i}/name`,
        },
      );
      if (ctx.variant === 'quadrants' && q.note) {
        ctx.text(
          q.note,
          { x: b.x + 0.15, y: b.y + 0.45, w: b.w - 0.3, h: b.h - 0.6 },
          { size: 'body', color: colors.ink, field: `quadrants/${i}/note` },
        );
      }
    });
    // axes
    ctx.line(mx, my + mh, mx, my - 0.05, { color: colors.ink, width: 1.25 }, { arrowEnd: true });
    ctx.line(
      mx,
      my + mh,
      mx + mw + 0.05,
      my + mh,
      { color: colors.ink, width: 1.25 },
      { arrowEnd: true },
    );
    ctx.text(
      `${c.yAxis.label}`,
      { x: area.x, y: area.y, w: yLabW + hw, h: 0.28 },
      { size: 'small', bold: true, color: colors.ink, maxLines: 1, field: 'yAxis/label' },
    );
    ctx.text(
      c.yAxis.high,
      { x: area.x, y: my, w: yLabW - 0.12, h: 0.26 },
      {
        size: 'small',
        color: colors.muted,
        align: 'right',
        maxLines: 1,
        fixed: true,
        field: 'yAxis/high',
      },
    );
    ctx.text(
      c.yAxis.low,
      { x: area.x, y: my + mh - 0.26, w: yLabW - 0.12, h: 0.26 },
      {
        size: 'small',
        color: colors.muted,
        align: 'right',
        maxLines: 1,
        fixed: true,
        field: 'yAxis/low',
      },
    );
    ctx.text(
      c.xAxis.low,
      { x: mx, y: my + mh + 0.08, w: 1.4, h: 0.26 },
      { size: 'small', color: colors.muted, maxLines: 1, fixed: true, field: 'xAxis/low' },
    );
    ctx.text(
      c.xAxis.high,
      { x: mx + mw - 1.4, y: my + mh + 0.08, w: 1.4, h: 0.26 },
      {
        size: 'small',
        color: colors.muted,
        align: 'right',
        maxLines: 1,
        fixed: true,
        field: 'xAxis/high',
      },
    );
    ctx.text(
      c.xAxis.label,
      { x: mx + hw - 2, y: my + mh + 0.08, w: 4, h: 0.26 },
      {
        size: 'small',
        bold: true,
        color: colors.ink,
        align: 'center',
        maxLines: 1,
        field: 'xAxis/label',
      },
    );

    if (ctx.variant === 'plot' && c.items) {
      const size = theme.type.small;
      // quadrant names are obstacles too, so item labels never sit on top of them
      const placed: { x: number; y: number; w: number; h: number }[] = c.quadrants.map((q, i) => ({
        x: qBoxes[i]!.x + 0.15,
        y: qBoxes[i]!.y + 0.12,
        w:
          (textWidthPt(ctx.fonts.body.measure, 'bold', theme.type.small, q.name.toUpperCase()) /
            72) *
          1.04,
        h: 0.26,
      }));
      const order = c.items.map((it, i) => ({ it, i })).sort((a, b) => b.it.y - a.it.y);
      for (const { it, i } of order) {
        const px = mx + 0.1 + it.x * (mw - 0.2);
        const py = my + 0.1 + (1 - it.y) * (mh - 0.2);
        const r = it.highlight ? 0.08 : 0.065;
        ctx.ellipse(
          { x: px - r, y: py - r, w: 2 * r, h: 2 * r },
          { fill: it.highlight ? colors.accent : colors.muted, role: 'item' },
        );
        const lw =
          (textWidthPt(ctx.fonts.body.measure, it.highlight ? 'bold' : 'regular', size, it.label) /
            72) *
            1.04 +
          0.02;
        const lh = 0.22;
        let lx = px + r + 0.06;
        if (lx + lw > mx + mw - 0.05) lx = px - r - 0.06 - lw;
        let ly = py - lh / 2;
        for (let tries = 0; tries < 6; tries++) {
          const hit = placed.find(
            (p) => lx < p.x + p.w && lx + lw > p.x && ly < p.y + p.h && ly + lh > p.y,
          );
          if (!hit) break;
          ly = hit.y + hit.h + 0.01;
        }
        placed.push({ x: lx, y: ly, w: lw, h: lh });
        ctx.text(
          it.label,
          { x: lx, y: ly, w: lw + 0.05, h: lh },
          {
            size,
            bold: !!it.highlight,
            color: it.highlight ? colors.ink : colors.muted,
            maxLines: 1,
            fixed: true,
            field: `items/${i}/label`,
          },
        );
      }
    }

    if (side && c.takeaway) {
      ctx.rect(side, { fill: colors.surface, role: 'panel' });
      ctx.rect(
        { x: side.x, y: side.y, w: 0.06, h: side.h },
        { fill: colors.accent, role: 'panel-accent' },
      );
      ctx.text(
        c.takeaway,
        { x: side.x + 0.3, y: side.y + 0.3, w: side.w - 0.55, h: side.h - 0.6 },
        { font: 'heading', size: 'heading', bold: true, field: 'takeaway' },
      );
    }
  },
};
