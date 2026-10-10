import { z } from 'zod';
import { mix } from '../engine/color.ts';
import type { Box } from '../engine/scene.ts';
import type { ComposeContext, LayoutDef } from './types.ts';

const Step = z
  .object({
    label: z.string().max(30),
    changed: z.boolean().optional(),
    note: z.string().max(48).optional(),
  })
  .strict();

const Lane = z
  .object({
    label: z.string().max(20),
    steps: z.array(Step).min(2).max(6),
    metric: z.string().max(14).optional().describe('Outcome of the lane, e.g. "9 days"'),
  })
  .strict();

const schema = z
  .object({
    current: Lane.describe('The process today'),
    proposed: Lane.describe('The proposed process; mark steps that change with changed: true'),
    metricLabel: z
      .string()
      .max(36)
      .optional()
      .describe('What the lane metrics measure, e.g. "Order-to-cash time"'),
  })
  .strict();

function lane(
  ctx: ComposeContext,
  b: Box,
  l: z.infer<typeof Lane>,
  proposed: boolean,
  field: string,
  metricLabel?: string,
) {
  const { colors, theme } = ctx;
  const labelW = 1.6;
  const metricW = l.metric ? 1.7 : 0;
  ctx.text(
    l.label.toUpperCase(),
    { x: b.x, y: b.y, w: labelW - 0.15, h: 0.7 },
    {
      size: 'small',
      bold: true,
      color: proposed ? colors.accent : colors.muted,
      valign: 'middle',
      maxLines: 2,
      field: `${field}/label`,
    },
  );
  const n = l.steps.length;
  const gap = 0.32;
  const sx = b.x + labelW;
  const sw = (b.w - labelW - metricW - gap * (n - 1)) / n;
  const sh = 0.7;
  l.steps.forEach((s, i) => {
    const x = sx + i * (sw + gap);
    const changed = proposed && s.changed;
    ctx.rect(
      { x, y: b.y, w: sw, h: sh },
      {
        fill: changed ? colors.accent : proposed ? colors.accentSoft : colors.surface,
        radius: 0.06,
        role: 'step',
      },
    );
    ctx.text(
      s.label,
      { x: x + 0.1, y: b.y, w: sw - 0.2, h: sh },
      {
        size: theme.type.body - 1,
        bold: changed,
        color: changed ? colors.accentText : colors.ink,
        align: 'center',
        valign: 'middle',
        maxLines: 2,
        field: `${field}/steps/${i}/label`,
      },
    );
    if (i < n - 1)
      ctx.line(
        x + sw + 0.04,
        b.y + sh / 2,
        x + sw + gap - 0.04,
        b.y + sh / 2,
        { color: colors.muted, width: 1 },
        { arrowEnd: true },
      );
    if (s.note)
      ctx.text(
        s.note,
        { x, y: b.y + sh + 0.08, w: sw, h: 0.5 },
        {
          size: 'small',
          color: changed ? colors.ink : colors.muted,
          align: 'center',
          maxLines: 2,
          field: `${field}/steps/${i}/note`,
        },
      );
  });
  if (l.metric) {
    const mx = b.x + b.w - metricW + 0.2;
    ctx.text(
      l.metric,
      { x: mx, y: b.y - 0.05, w: metricW - 0.2, h: 0.55 },
      {
        font: 'heading',
        size: theme.type.title + 4,
        bold: true,
        color: proposed ? colors.accent : colors.ink,
        align: 'right',
        maxLines: 1,
        fixed: true,
        field: `${field}/metric`,
      },
    );
    if (metricLabel)
      ctx.text(
        metricLabel,
        { x: mx - 0.3, y: b.y + 0.5, w: metricW + 0.1, h: 0.3 },
        { size: 'small', color: colors.muted, align: 'right', maxLines: 2, fixed: true },
      );
  }
  void mix;
}

export const processCompare: LayoutDef<typeof schema> = {
  id: 'process-compare',
  name: 'Current vs proposed process',
  group: 'sequence',
  purpose:
    'Use for showing what changes in a process: today’s steps against the proposed ones, with changed steps highlighted.',
  useWhen: [
    'Operating-model or automation proposals',
    'Before/after of a customer journey',
    'Explaining where time or cost disappears',
  ],
  avoidWhen: [
    'A single process without a comparison — use process-steps',
    'Organisational change without steps — use key-points',
  ],
  variants: ['lanes'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Automating credit checks and invoicing cuts order-to-cash from 9 days to 3',
      content: {
        metricLabel: 'Order-to-cash time',
        current: {
          label: 'Today',
          metric: '9 days',
          steps: [
            { label: 'Order received' },
            { label: 'Manual credit check', note: '2–3 days' },
            { label: 'Ship' },
            { label: 'Invoice by email', note: '4 days' },
            { label: 'Payment' },
          ],
        },
        proposed: {
          label: 'Proposed',
          metric: '3 days',
          steps: [
            { label: 'Order received' },
            { label: 'Automated credit check', changed: true, note: 'minutes' },
            { label: 'Ship' },
            { label: 'e-Invoice on dispatch', changed: true, note: 'same day' },
            { label: 'Payment' },
          ],
        },
      },
      sources: ['finance-fy25'],
    },
  ],
  compose(ctx, c) {
    const b = ctx.body;
    const laneH = 1.35;
    const top = b.y + Math.max(0, (b.h - 2 * laneH - 0.9) / 2);
    lane(ctx, { x: b.x, y: top, w: b.w, h: laneH }, c.current, false, 'current', c.metricLabel);
    ctx.line(b.x, top + laneH + 0.35, b.x + b.w, top + laneH + 0.35, {
      color: ctx.colors.rule,
      width: 0.75,
      dash: 'dash',
    });
    lane(
      ctx,
      { x: b.x, y: top + laneH + 0.8, w: b.w, h: laneH },
      c.proposed,
      true,
      'proposed',
      c.metricLabel,
    );
  },
};
