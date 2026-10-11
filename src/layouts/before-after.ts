import { z } from 'zod';
import type { Box } from '../engine/scene.ts';
import type { ComposeContext, LayoutDef } from './types.ts';

const Side = z
  .object({
    label: z.string().max(24).optional(),
    items: z.array(z.string().max(110)).min(2).max(5),
    metric: z
      .object({ value: z.string().max(10), label: z.string().max(40) })
      .strict()
      .optional()
      .describe('One number that sums up the side, e.g. 9 days / order-to-cash'),
  })
  .strict();

const schema = z
  .object({
    before: Side.describe('Today / the problem'),
    after: Side.describe('Tomorrow / the outcome'),
  })
  .strict();

function panel(
  ctx: ComposeContext,
  b: Box,
  s: z.infer<typeof Side>,
  after: boolean,
  field: string,
) {
  const { colors, theme } = ctx;
  ctx.rect(b, { fill: after ? colors.accentSoft : colors.surface, role: 'panel' });
  if (after)
    ctx.rect({ x: b.x, y: b.y, w: b.w, h: 0.06 }, { fill: colors.accent, role: 'accent-rule' });
  const pad = 0.3;
  ctx.text(
    (s.label ?? (after ? 'After' : 'Before')).toUpperCase(),
    { x: b.x + pad, y: b.y + 0.24, w: b.w - 2 * pad, h: 0.3 },
    {
      size: 'small',
      bold: true,
      color: after ? colors.accent : colors.muted,
      maxLines: 1,
      field: `${field}/label`,
    },
  );
  let bottom = b.y + b.h - pad;
  if (s.metric) {
    bottom -= 1.0;
    ctx.line(b.x + pad, bottom, b.x + b.w - pad, bottom, { color: colors.rule, width: 0.75 });
    ctx.text(
      s.metric.value,
      { x: b.x + pad, y: bottom + 0.12, w: 2.2, h: 0.7 },
      {
        font: 'heading',
        size: theme.type.title + 10,
        bold: true,
        color: after ? colors.accent : colors.ink,
        maxLines: 1,
        fixed: true,
        field: `${field}/metric/value`,
      },
    );
    ctx.text(
      s.metric.label,
      { x: b.x + pad + 2.3, y: bottom + 0.12, w: b.w - 2 * pad - 2.3, h: 0.7 },
      {
        size: 'small',
        color: colors.muted,
        valign: 'middle',
        maxLines: 2,
        field: `${field}/metric/label`,
      },
    );
  }
  ctx.text(
    ctx.paragraphs(s.items, { bullet: true, spaceBefore: 10 }),
    { x: b.x + pad, y: b.y + 0.7, w: b.w - 2 * pad, h: bottom - (b.y + 0.7) - 0.15 },
    { size: 'body', field: `${field}/items` },
  );
}

export const beforeAfter: LayoutDef<typeof schema> = {
  id: 'before-after',
  name: 'Before and after',
  group: 'message',
  purpose:
    'Use for a change told as two states — how things are today and how they will be — with one number on each side.',
  useWhen: [
    'The value of a change in plain words',
    'Customer or employee experience before and after',
    'Closing a case study: what changed',
  ],
  avoidWhen: [
    'The change is a sequence of steps — use process-compare',
    'More than two states — use timeline or options-comparison',
  ],
  variants: ['panels'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Self-service onboarding turns a two-week paper chase into a same-day start',
      content: {
        before: {
          label: 'Today',
          items: [
            'Customers email documents; staff re-key them into three systems',
            'Credit checks wait in a shared inbox for two to three days',
            'One in five applications stalls on a missing signature',
          ],
          metric: { value: '14 days', label: 'Median days to first order' },
        },
        after: {
          label: 'With self-service',
          items: [
            'Customers upload once; data flows to CRM, ERP and billing',
            'Automated checks clear 80% of applications in minutes',
            'E-signature and reminders close the remaining gaps',
          ],
          metric: { value: '1 day', label: 'Target median, standard cases' },
        },
      },
      sources: ['ops-review'],
    },
  ],
  compose(ctx, c) {
    const b = ctx.body;
    const arrowW = 0.7;
    const w = (b.w - arrowW) / 2;
    panel(ctx, { x: b.x, y: b.y, w, h: b.h }, c.before, false, 'before');
    const ax = b.x + w + 0.16;
    const ay = b.y + b.h / 2;
    ctx.polygon(
      [
        [ax, ay - 0.32],
        [ax + arrowW - 0.32, ay],
        [ax, ay + 0.32],
      ],
      { fill: ctx.colors.accent, role: 'arrow' },
    );
    panel(ctx, { x: b.x + w + arrowW, y: b.y, w, h: b.h }, c.after, true, 'after');
  },
};
