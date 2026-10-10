import { z } from 'zod';
import { mix } from '../engine/color.ts';
import { cols } from '../engine/format.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    stages: z
      .array(
        z
          .object({
            label: z.string().max(30),
            value: z
              .string()
              .max(12)
              .optional()
              .describe('funnel: the volume at this stage, e.g. "12,400"'),
            note: z.string().max(80).optional(),
          })
          .strict(),
      )
      .min(3)
      .max(6)
      .describe('funnel: widest first. pyramid: top (smallest) first'),
    conversions: z
      .array(z.string().max(8))
      .optional()
      .describe('funnel: conversion between consecutive stages, e.g. "34%"'),
    highlight: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Stage to emphasise (e.g. the biggest drop)'),
    takeaway: z.string().max(140).optional(),
  })
  .strict();

export const funnel: LayoutDef<typeof schema> = {
  id: 'funnel',
  name: 'Funnel / pyramid',
  group: 'numbers',
  purpose:
    'Use for a conversion funnel (where volume is lost) or a pyramid (levels that build on each other).',
  useWhen: [
    'Sales or marketing funnels and drop-off',
    'Customer journey conversion',
    'Hierarchies of needs, capabilities or priorities (pyramid)',
  ],
  avoidWhen: [
    'Stages are not a narrowing sequence — use chart-takeaway (bar)',
    'Exact values matter most — use data-table',
  ],
  variants: ['funnel', 'pyramid'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title:
        'Most trials are lost before activation — fixing onboarding is worth more than more traffic',
      variant: 'funnel',
      content: {
        stages: [
          { label: 'Website visitors', value: '48,000' },
          { label: 'Trial sign-ups', value: '3,100' },
          {
            label: 'Activated trials',
            value: '820',
            note: 'Only a quarter of trials reach first value',
          },
          { label: 'Paying customers', value: '310' },
        ],
        conversions: ['6.5%', '26%', '38%'],
        highlight: 2,
        takeaway:
          'Doubling activation adds as many customers as doubling sign-ups — at a fraction of the cost',
      },
      sources: ['finance-fy25'],
    },
    {
      title: 'Data foundations come before AI: each level only works on the one beneath it',
      variant: 'pyramid',
      content: {
        stages: [
          { label: 'AI-assisted decisions', note: 'Forecasts and recommendations in the workflow' },
          { label: 'Analytics and BI', note: 'Trusted dashboards, one definition per metric' },
          { label: 'Integrated data', note: 'One customer and product record across systems' },
          { label: 'Data quality and governance', note: 'Owners, rules and monitoring' },
        ],
        highlight: 3,
      },
    },
  ],
  compose(ctx, c) {
    const { colors, theme } = ctx;
    const [shapeArea, side] = c.takeaway ? cols(ctx.body, [2.4, 1], 0.4) : [ctx.body, undefined];
    const area = shapeArea!;
    const n = c.stages.length;
    const pyramid = ctx.variant === 'pyramid';
    const figW = Math.min(area.w * 0.58, 6.4);
    const fx = area.x;
    const gap = 0.08;
    const bandH = (area.h - gap * (n - 1)) / n;
    const tint = (i: number) =>
      c.highlight === i
        ? colors.accent
        : mix(colors.accent, colors.background, 0.45 + 0.4 * (i / Math.max(1, n - 1)));
    c.stages.forEach((s, i) => {
      const y = area.y + i * (bandH + gap);
      let topW: number;
      let botW: number;
      if (pyramid) {
        topW = (figW * i) / n;
        botW = (figW * (i + 1)) / n;
      } else {
        topW = figW * (1 - (0.62 * i) / n);
        botW = figW * (1 - (0.62 * (i + 1)) / n);
      }
      const cx = fx + figW / 2;
      const pts: [number, number][] = [
        [cx - topW / 2, y],
        [cx + topW / 2, y],
        [cx + botW / 2, y + bandH],
        [cx - botW / 2, y + bandH],
      ];
      ctx.polygon(pts, { fill: tint(i), role: 'band' });
      const hl = c.highlight === i;
      const ink = hl || i < n / 2 ? colors.accentText : colors.ink;
      if (!pyramid && s.value) {
        ctx.text(
          s.value,
          { x: cx - botW / 2 + 0.1, y, w: botW - 0.2, h: bandH },
          {
            font: 'heading',
            size: theme.type.heading + 2,
            bold: true,
            color: hl ? colors.accentText : ink,
            align: 'center',
            valign: 'middle',
            maxLines: 1,
            fixed: true,
            field: `stages/${i}/value`,
          },
        );
      }
      const lx = fx + figW + 0.35;
      const lw = area.x + area.w - lx;
      ctx.line(cx + Math.max(topW, botW) / 2 + 0.05, y + bandH / 2, lx - 0.08, y + bandH / 2, {
        color: colors.rule,
        width: 0.75,
      });
      const lines = [`**${s.label}**`, ...(s.note ? [s.note] : [])];
      const ps = ctx.paragraphs(lines);
      if (ps[1]) ps[1].runs.forEach((r) => (r.color = colors.muted));
      if (hl) ps[0]!.runs.forEach((r) => (r.color = colors.accent));
      ctx.text(
        ps,
        { x: lx, y: y + 0.02, w: lw - (c.conversions ? 0.9 : 0), h: bandH - 0.04 },
        { size: theme.type.body - 1, valign: 'middle', field: `stages/${i}/label` },
      );
      if (!pyramid && c.conversions && i < n - 1 && c.conversions[i]) {
        ctx.text(
          `↓ ${c.conversions[i]}`,
          { x: area.x + area.w - 0.85, y: y + bandH - 0.12, w: 0.85, h: 0.3 },
          {
            size: 'small',
            bold: true,
            color: colors.muted,
            align: 'right',
            maxLines: 1,
            fixed: true,
            field: `conversions/${i}`,
          },
        );
      }
    });
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
