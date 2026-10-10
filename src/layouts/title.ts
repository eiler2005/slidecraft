import { z } from 'zod';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    kicker: z
      .string()
      .max(48)
      .optional()
      .describe('Small label above the title, e.g. "Board meeting · Q3 review"'),
    subtitle: z.string().max(170).optional().describe('One sentence framing the decision or story'),
    presenter: z.string().max(70).optional(),
    date: z.string().max(32).optional(),
    contact: z
      .array(z.string().max(70))
      .max(3)
      .optional()
      .describe('Closing variant: contact lines'),
  })
  .strict();

export const title: LayoutDef<typeof schema> = {
  id: 'title',
  name: 'Title',
  group: 'frame',
  purpose: 'Use for the cover that frames the deck, or a closing slide with the ask and contacts.',
  useWhen: ['First slide of every deck', 'Closing slide with thanks, contacts or a final ask'],
  avoidWhen: ['Section breaks inside the deck — use agenda (section-divider)'],
  variants: ['cover', 'closing'],
  frame: 'none',
  master: 'cover',
  schema,
  examples: [
    {
      title: 'Entering the German mid-market can add €40M revenue by 2028',
      content: {
        kicker: 'Board discussion document',
        subtitle: 'Recommendation and phased plan for a decision at the 14 November board meeting',
        presenter: 'Strategy team',
        date: 'October 2026',
      },
    },
    {
      title: 'Decision needed today: approve phase 1 budget of €6M',
      variant: 'closing',
      content: {
        subtitle: 'Questions and discussion',
        contact: ['strategy@northwind.example', '+44 20 0000 0000'],
      },
    },
  ],
  compose(ctx, c) {
    const { page, colors, theme } = ctx;
    const left = 0.9;
    const width = ctx.variant === 'closing' ? page.w - 2 * left : Math.min(8.8, page.w * 0.66);
    const titleColor = colors.titleInk ?? colors.ink;

    if (ctx.variant === 'closing') {
      const t = ctx.text(
        ctx.slide.title,
        { x: left, y: 2.3, w: width, h: 1.7 },
        {
          role: 'title',
          font: 'heading',
          size: Math.round(theme.type.cover * 0.8),
          bold: theme.type.titleWeight === 'bold',
          color: titleColor,
          align: 'center',
          valign: 'bottom',
          maxLines: 3,
          field: 'title',
        },
      );
      let y = t.box.y + t.box.h + 0.3;
      if (c.subtitle) {
        ctx.text(
          c.subtitle,
          { x: left, y, w: width, h: 0.6 },
          {
            role: 'subtitle',
            size: 'subtitle',
            color: colors.muted,
            align: 'center',
            field: 'subtitle',
          },
        );
        y += 0.75;
      }
      if (c.contact?.length) {
        ctx.line(page.w / 2 - 0.6, y, page.w / 2 + 0.6, y, { color: colors.accent, width: 1.5 });
        ctx.text(
          c.contact,
          { x: left, y: y + 0.15, w: width, h: 1.0 },
          { role: 'contact', size: 'body', color: colors.ink, align: 'center', field: 'contact' },
        );
      }
      return;
    }

    let y = 1.75;
    if (c.kicker) {
      ctx.text(
        c.kicker.toUpperCase(),
        { x: left, y, w: width, h: 0.3 },
        {
          role: 'kicker',
          size: 'small',
          bold: true,
          color: colors.accent,
          fixed: true,
          maxLines: 1,
          field: 'kicker',
        },
      );
      y += 0.45;
    }
    const t = ctx.text(
      ctx.slide.title,
      { x: left, y, w: width, h: 2.35 },
      {
        role: 'title',
        font: 'heading',
        size: 'cover',
        bold: theme.type.titleWeight === 'bold',
        color: titleColor,
        maxLines: 3,
        lineHeight: 1.08,
        field: 'title',
      },
    );
    y = t.box.y + Math.min(t.box.h, t.contentHeight) + 0.3;
    if (c.subtitle) {
      ctx.text(
        c.subtitle,
        { x: left, y, w: width, h: 0.9 },
        { role: 'subtitle', size: 'subtitle', color: colors.muted, maxLines: 3, field: 'subtitle' },
      );
    }
    const meta = [c.presenter, c.date].filter(Boolean).join('   ·   ');
    if (meta) {
      ctx.line(left, page.h - 1.25, left + 0.9, page.h - 1.25, { color: colors.accent, width: 2 });
      ctx.text(
        meta,
        { x: left, y: page.h - 1.12, w: width, h: 0.3 },
        {
          role: 'meta',
          size: 'small',
          color: colors.muted,
          maxLines: 1,
          fixed: true,
          field: 'presenter',
        },
      );
    }
  },
};
