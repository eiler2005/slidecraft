import { z } from 'zod';
import { cols } from '../engine/format.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    body: z
      .array(z.string().max(260))
      .min(1)
      .max(4)
      .describe('1–4 short paragraphs (or bullets) that tell the story next to the image'),
    bullets: z
      .boolean()
      .default(false)
      .describe('Set true to show the body strings as bullets instead of paragraphs'),
    image: z
      .string()
      .optional()
      .describe('Image path relative to the deck file; leave empty to show a placeholder'),
    caption: z
      .string()
      .max(120)
      .optional()
      .describe('Small line under the image: what it shows and where it was taken'),
    alt: z.string().max(140).describe('Alt text for the image: what it shows, for screen readers'),
  })
  .strict();

export const textImage: LayoutDef<typeof schema> = {
  id: 'text-image',
  name: 'Text and image',
  group: 'message',
  purpose:
    'Use for a story beat that needs a photo or illustration next to a few short paragraphs, such as a customer case or a site visit.',
  useWhen: [
    'Storytelling decks where one image carries the emotion and the text carries the point',
    'A product, place or person that the audience should see while they read',
  ],
  avoidWhen: [
    'The image is a chart or table — use chart-takeaway or data-table',
    'More than four short paragraphs — use key-points or split the slide',
  ],
  variants: ['image-right', 'image-left'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Contoso turned a two-day month-end close into a morning routine',
      variant: 'image-right',
      content: {
        body: [
          'Tailspin Logistics reconciled forty bank accounts by hand every month, and errors surfaced only after the books closed.',
          'After connecting its banks to Contoso, the finance team reviews exceptions instead of re-keying data.',
          'The close now ends before noon on the first working day, and auditors receive the same files without extra requests.',
        ],
        alt: 'Finance team reviewing a dashboard at Tailspin Logistics',
        caption: 'Tailspin Logistics finance team, Rotterdam, September 2026',
      },
    },
    {
      title: 'Fabrikam designs every store around how people actually shop',
      variant: 'image-left',
      content: {
        body: [
          'Wide aisles and short sight lines keep the store calm during peak hours.',
          'Fresh products sit at the entrance, so customers see quality first.',
          'Self-service tills handle most baskets, and staff move to the shop floor to help.',
        ],
        bullets: true,
        alt: 'Interior of a Fabrikam flagship store with wide aisles',
        caption: 'Fabrikam flagship store, Hamburg',
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors, theme } = ctx;
    const imageFirst = ctx.variant === 'image-left';
    const gap = 0.6;
    const weights = imageFirst ? [45, 55] : [55, 45];
    const [a, b] = cols(body, weights, gap);
    const imgCol = imageFirst ? a! : b!;
    const textCol = imageFirst ? b! : a!;

    const capH = c.caption ? 0.5 : 0;
    ctx.image({ ...imgCol, h: imgCol.h - capH }, c.image, c.alt, {
      fit: 'cover',
      field: 'image',
      label: 'Image placeholder',
    });
    if (c.caption) {
      ctx.text(
        c.caption,
        { x: imgCol.x, y: imgCol.y + imgCol.h - capH + 0.1, w: imgCol.w, h: capH - 0.1 },
        {
          role: 'caption',
          size: 'small',
          color: colors.muted,
          maxLines: 2,
          field: 'caption',
        },
      );
    }

    ctx.text(
      ctx.paragraphs(c.body, { bullet: c.bullets, spaceBefore: 10 }),
      { ...textCol, h: imgCol.h - capH },
      {
        role: 'body',
        size: theme.type.body + 2,
        color: colors.ink,
        valign: 'middle',
        field: 'body',
      },
    );
  },
};
