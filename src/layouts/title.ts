import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { diag } from '../qa/codes.ts';
import { COVER_ART, drawCoverArt, pickCoverArt } from './cover-art.ts';
import { creditLine, focusPoint, ImageCredit, ImageFocus, ImageQuery } from './image-credit.ts';
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
    art: z
      .enum(['auto', ...COVER_ART])
      .optional()
      .describe(
        'Cover: topic motif on a right-hand panel, drawn as editable shapes in the theme accent. auto picks it from the title (network: AI, data, tech · growth: money, markets · flow: process, plans · orbit: customers, people · layers: architecture, risk · grid: products, operations)',
      ),
    image: z
      .string()
      .optional()
      .describe(
        'Cover: picture for the right-hand panel (path relative to the deck); wins over art',
      ),
    imagePrompt: z
      .string()
      .max(400)
      .optional()
      .describe(
        'Cover: what the panel picture should show; `slidecraft images` generates it. Until then the art motif is drawn',
      ),
    imageQuery: ImageQuery.optional(),
    imageCredit: ImageCredit.optional(),
    imageFocus: ImageFocus.optional(),
    alt: z
      .string()
      .max(140)
      .optional()
      .describe('Alt text of the cover picture; without it the picture is decorative'),
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
    {
      title: 'An AI platform can cut claims handling time by 40% within a year',
      content: {
        kicker: 'Steering committee',
        subtitle: 'Where AI changes the claims process, what it costs and how we start',
        presenter: 'Operations team',
        date: 'October 2026',
        art: 'auto',
      },
    },
  ],
  compose(ctx, c) {
    const { page, colors, theme } = ctx;
    const left = 0.9;
    // cover visual: a right-hand panel with the deck's picture or topic motif
    const visual = ctx.variant !== 'closing' && (c.art || c.image || c.imagePrompt || c.imageQuery);
    const panelX = Math.round(page.w * 0.7 * 100) / 100;
    const width =
      ctx.variant === 'closing'
        ? page.w - 2 * left
        : Math.min(8.8, page.w * 0.66, visual ? panelX - left - 0.4 : Infinity);
    if (ctx.variant !== 'closing' && !visual)
      ctx.issue(
        diag('SC-COVER-001', 'The cover has no visual — it was not chosen from options', {
          pointer: ctx.ptr('art'),
          hint: 'Run `slidecraft covers <deck>`, compare the 2–3 options and `--choose` one.',
        }),
      );
    if (visual) {
      const panel = { x: panelX, y: 0, w: page.w - panelX, h: page.h };
      const file = c.image && (isAbsolute(c.image) ? c.image : resolve(ctx.baseDir, c.image));
      if (file && existsSync(file)) {
        const img = ctx.image(panel, c.image, c.alt ?? '', {
          fit: 'cover',
          field: 'image',
          ...(focusPoint(c.imageFocus) ? { focus: focusPoint(c.imageFocus)! } : {}),
        });
        if (!c.alt) img.decorative = true;
        if (c.imageCredit) {
          // the photo credit sits on the picture, bottom left, on a dark band
          const h = 0.3;
          const band = { x: panel.x, y: panel.y + panel.h - h, w: panel.w, h };
          ctx.rect(band, { fill: '#000000', fillOpacity: 0.65, role: 'photo-credit' });
          ctx.text(
            creditLine(c.imageCredit, ctx.t('photo')),
            { x: band.x + 0.12, y: band.y, w: band.w - 0.24, h },
            {
              role: 'photo-credit',
              size: 'source',
              color: '#FFFFFF',
              valign: 'middle',
              maxLines: 1,
              fixed: true,
              field: 'imageCredit',
            },
          );
        }
      } else {
        if (c.image || c.imagePrompt || c.imageQuery)
          ctx.issue(
            diag(
              'SC-IMG-002',
              c.image
                ? `Cover image not found: ${c.image}; drawing the art motif instead`
                : c.imageQuery
                  ? 'Cover photo not fetched yet (slidecraft images --stock); drawing the art motif instead'
                  : 'Cover image not generated yet (slidecraft images); drawing the art motif instead',
              {
                pointer: ctx.ptr(c.image ? 'image' : c.imageQuery ? 'imageQuery' : 'imagePrompt'),
                severity: c.image ? 'warning' : 'info',
              },
            ),
          );
        const art =
          c.art && c.art !== 'auto'
            ? c.art
            : pickCoverArt([ctx.slide.title, c.kicker, c.subtitle].filter(Boolean).join(' '));
        drawCoverArt(ctx, panel, art, ctx.slide.title);
      }
    }
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
