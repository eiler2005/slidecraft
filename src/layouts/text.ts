import { z } from 'zod';
import { cols } from '../engine/format.ts';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const Column = z
  .object({
    heading: z.string().max(50).optional(),
    items: z.array(z.string().max(220)).min(1).max(6),
  })
  .strict();

const schema = z
  .object({
    items: z
      .array(z.string().max(240))
      .min(1)
      .max(8)
      .optional()
      .describe('bullets / paragraphs variants'),
    left: Column.optional().describe('two-column variant'),
    right: Column.optional().describe('two-column variant'),
  })
  .strict();

export const text: LayoutDef<typeof schema> = {
  id: 'text',
  name: 'Text',
  group: 'message',
  purpose:
    'Use for plain text when no exhibit fits — bullets, short paragraphs or two columns. Also where imported slides land.',
  useWhen: [
    'Definitions, principles or context that really are text',
    'Imported slides before they are redesigned',
    'Two short lists side by side (e.g. in / out of scope)',
  ],
  avoidWhen: [
    'Parallel points with headings — use key-points',
    'Anything with numbers — use a chart, kpi-tiles or a table',
  ],
  variants: ['bullets', 'paragraphs', 'two-column'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Three principles keep the pilot small, measurable and reversible',
      variant: 'bullets',
      content: {
        items: [
          'Scope is two regions and fifteen clients; anything else waits for Gate 1',
          'Every week reports the same four metrics against the same baseline',
          'Exit clauses with both partners let us stop within one quarter',
        ],
      },
    },
    {
      title: 'Scope is explicit: what the pilot covers and what it does not',
      variant: 'two-column',
      content: {
        left: {
          heading: 'In scope',
          items: [
            'Mid-market clients in Bavaria and Hesse',
            'Partner-led sales and onboarding',
            'German UI and Frankfurt hosting',
          ],
        },
        right: {
          heading: 'Out of scope',
          items: ['Enterprise accounts', 'Direct sales hires', 'Custom integrations'],
        },
      },
    },
    {
      title: 'The pilot is designed to answer one question before any larger commitment',
      variant: 'paragraphs',
      content: {
        items: [
          'Can partners bring us fifteen paying mid-market clients in two quarters at an acquisition cost we can sustain?',
          'If yes, phase 2 adds partners and regions; if not, we stop with €6M spent and a clear lesson about the market.',
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors, theme } = ctx;
    if (ctx.variant === 'two-column') {
      if (!c.left || !c.right) {
        ctx.issue(
          diag('SC-SPEC-001', 'two-column variant needs left and right', {
            pointer: ctx.ptr(c.left ? 'right' : 'left'),
          }),
        );
        return;
      }
      const [l, r] = cols(body, [1, 1], 0.6);
      for (const [col, box, field] of [
        [c.left, l!, 'left'],
        [c.right, r!, 'right'],
      ] as const) {
        let y = box.y;
        if (col.heading) {
          ctx.rect({ x: box.x, y, w: 0.5, h: 0.05 }, { fill: colors.accent, role: 'accent-rule' });
          ctx.text(
            col.heading,
            { x: box.x, y: y + 0.15, w: box.w, h: 0.4 },
            {
              font: 'heading',
              size: 'heading',
              bold: true,
              maxLines: 1,
              field: `${field}/heading`,
            },
          );
          y += 0.7;
        }
        ctx.text(
          ctx.paragraphs(col.items, { bullet: true, spaceBefore: 8 }),
          { x: box.x, y, w: box.w, h: box.y + box.h - y },
          { size: 'body', field: `${field}/items` },
        );
      }
      return;
    }
    if (!c.items?.length) {
      ctx.issue(
        diag('SC-SPEC-001', `${ctx.variant} variant needs items`, { pointer: ctx.ptr('items') }),
      );
      return;
    }
    const bullets = ctx.variant === 'bullets';
    const w = Math.min(body.w, 10.5);
    ctx.text(
      ctx.paragraphs(c.items, { bullet: bullets, spaceBefore: bullets ? 10 : 14 }),
      { x: body.x, y: body.y, w, h: body.h },
      { size: bullets ? 'body' : theme.type.body + 2, field: 'items' },
    );
  },
};
