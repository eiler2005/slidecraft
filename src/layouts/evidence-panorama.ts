import { z } from 'zod';
import { contrast } from '../engine/color.ts';
import { cols, columns, rows } from '../engine/format.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    metric: z
      .object({
        value: z.string().min(1).max(12),
        label: z.string().min(1).max(70),
        context: z.string().max(120),
        implication: z.string().max(120),
      })
      .strict(),
    cards: z
      .array(
        z
          .object({
            label: z.string().min(1).max(70),
            title: z.string().min(1).max(90),
            body: z.string().min(1).max(240),
          })
          .strict(),
      )
      .length(4),
  })
  .strict();

/** One common observation, four distinct explanations—not a quantitative ranking. */
export const evidencePanorama: LayoutDef<typeof schema> = {
  id: 'evidence-panorama',
  name: 'Evidence panorama',
  group: 'numbers',
  purpose:
    'Connect one sourced headline metric to four parallel models, implications or use cases; equal cards express categories, not relative magnitude.',
  useWhen: [
    'One observation motivates four different strategic responses',
    'Compare four models with a common context and a shared bottom-line conclusion',
  ],
  avoidWhen: [
    'The title claims a ranking or market share: use a chart',
    'Alternatives must be scored against identical criteria: use options-comparison',
  ],
  variants: ['metric-and-cards'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Strong adoption supports four distinct service models, not one universal offer',
      content: {
        metric: {
          value: '72%',
          label: 'of surveyed teams',
          context: 'use at least one shared service',
          implication: 'Adoption alone does not determine the operating model',
        },
        cards: [
          {
            label: 'SELF-SERVICE',
            title: 'Routine requests',
            body: 'A guided catalogue makes repeatable work accessible.',
          },
          {
            label: 'SPECIALIST SUPPORT',
            title: 'Complex decisions',
            body: 'Expert teams handle ambiguity and exceptions.',
          },
          {
            label: 'SHARED PLATFORM',
            title: 'Common capabilities',
            body: 'Reusable infrastructure supports several service lines.',
          },
          {
            label: 'PARTNERSHIPS',
            title: 'External capabilities',
            body: 'Partners provide skills that are needed selectively.',
          },
        ],
      },
      sources: ['illustrative-survey'],
    },
  ],
  compose(ctx, c) {
    const { colors, body } = ctx;
    const [stat, grid] = cols(body, [1, 3.15], 0.32) as [typeof body, typeof body];
    ctx.rect(stat, { fill: colors.ink, radius: 0.09, role: 'stat-panel' });
    const inner = { x: stat.x + 0.24, y: stat.y + 0.25, w: stat.w - 0.48, h: stat.h - 0.5 };
    ctx.text(
      c.metric.value,
      { ...inner, h: 0.86 },
      {
        size: 48,
        bold: true,
        color: colors.background,
        align: 'center',
        maxLines: 1,
        field: 'metric/value',
      },
    );
    ctx.text(
      c.metric.label,
      { ...inner, y: inner.y + 1.03, h: 0.6 },
      {
        size: 15,
        bold: true,
        color: contrast(colors.chart[2]!, colors.ink) >= 4.5 ? colors.chart[2] : colors.background,
        align: 'center',
        maxLines: 2,
        field: 'metric/label',
      },
    );
    const contextY = inner.y + 1.83;
    ctx.text(
      c.metric.context,
      { ...inner, y: contextY, h: Math.max(0.7, stat.h - 3.1) },
      { size: 14, color: colors.background, align: 'center', maxLines: 4, field: 'metric/context' },
    );
    const rule = stat.y + stat.h - 1.12;
    ctx.line(inner.x, rule, inner.x + inner.w, rule, { color: colors.muted, width: 0.65 });
    ctx.text(
      c.metric.implication,
      { ...inner, y: rule + 0.15, h: 0.8 },
      {
        size: 13,
        bold: true,
        color: colors.background,
        align: 'center',
        maxLines: 4,
        field: 'metric/implication',
      },
    );
    const bands = rows(grid, [1, 1], 0.23);
    c.cards.forEach((card, i) => {
      const box = columns(bands[Math.floor(i / 2)]!, 2, 0.27)[i % 2]!;
      const accent = colors.chart[i % colors.chart.length]!;
      ctx.rect(box, {
        fill: colors.surface,
        stroke: { color: colors.rule, width: 0.6 },
        radius: 0.09,
        role: 'comparison-card',
      });
      ctx.rect({ ...box, w: 0.085 }, { fill: accent, radius: 0.0425, role: 'card-accent' });
      const text = { x: box.x + 0.32, y: box.y + 0.21, w: box.w - 0.56, h: 0.35 };
      ctx.text(card.label, text, {
        size: 10,
        bold: true,
        color: contrast(accent, colors.surface) >= 4.5 ? accent : colors.ink,
        maxLines: 2,
        field: `cards/${i}/label`,
      });
      ctx.text(
        card.title,
        { ...text, y: box.y + 0.62, h: 0.44 },
        { size: 17, bold: true, maxLines: 2, field: `cards/${i}/title` },
      );
      ctx.text(
        card.body,
        { ...text, y: box.y + 1.07, h: box.h - 1.22 },
        { size: 13, color: colors.muted, maxLines: 4, field: `cards/${i}/body` },
      );
    });
  },
};
