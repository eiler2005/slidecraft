import { z } from 'zod';
import { HexColor } from './color.ts';

const ArtItem = z
  .object({
    image: z.string().describe('PNG/JPEG relative to the theme file'),
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive(),
  })
  .strict();

const ArtShape = z
  .object({
    kind: z.enum(['rect', 'ellipse', 'line']),
    x: z.number(),
    y: z.number(),
    w: z.number().min(0),
    h: z.number().min(0),
    fill: HexColor.optional(),
    stroke: z
      .object({ color: HexColor, width: z.number().min(0) })
      .strict()
      .optional(),
    radius: z.number().min(0).optional(),
  })
  .strict();

export const ThemeChrome = z
  .object({
    titleRule: z.boolean().default(false).describe('Hairline under action titles'),
    accentBar: z.boolean().default(false).describe('Short accent bar above titles'),
    pageNumbers: z.boolean().default(true),
    footer: z.string().optional().describe('Default footer text; decks can override'),
    tracker: z.boolean().default(true).describe('Small section label top-left'),
    canvasFrame: z
      .enum(['none', 'standard'])
      .optional()
      .describe(
        'Opt canvas layouts into the shared theme frame; standard preserves title, sources and numbering',
      ),
    sideRail: z
      .object({
        width: z.number().positive().max(0.5).default(0.12),
        radius: z.number().nonnegative().max(0.25).default(0.06),
        color: HexColor.optional(),
      })
      .strict()
      .optional()
      .describe('Editable full-height accent rail, inches'),
    markerWithTracker: z
      .boolean()
      .optional()
      .describe('Keep the accent marker beside the section label'),
    pageBadge: z
      .object({
        fill: HexColor.optional(),
        color: HexColor.optional(),
        minDigits: z.number().int().min(1).max(4).default(2),
      })
      .strict()
      .optional()
      .describe('Header page number in an editable rounded badge instead of the footer field'),
    sources: z
      .object({
        visible: z.boolean().default(true),
        prefix: z.string().max(32).default('Source:'),
        color: HexColor.optional(),
        size: z.number().min(7).max(14).optional(),
      })
      .strict()
      .optional()
      .describe('Shared source-line styling; citation text and links remain slide data'),
    takeaway: z
      .object({
        fill: HexColor.optional(),
        color: HexColor.optional(),
        accent: HexColor.optional(),
        height: z.number().min(0.35).max(1.5).default(0.65),
        radius: z.number().min(0).max(0.3).default(0.06),
      })
      .strict()
      .optional()
      .describe('Shared editable takeaway band; its text is the slide bottomLine field'),
    logo: z
      .string()
      .optional()
      .describe(
        'PNG/JPEG logo, relative to the theme file; top-right on content slides, bottom-right on covers',
      ),
    art: z
      .object({
        size: z
          .object({ w: z.number().positive(), h: z.number().positive() })
          .strict()
          .describe('Slide size the positions refer to (inches); scaled to the deck format'),
        cover: z.array(ArtItem).default([]),
        content: z.array(ArtItem).default([]),
        shapes: z
          .object({
            cover: z.array(ArtShape).default([]),
            content: z.array(ArtShape).default([]),
          })
          .strict()
          .optional()
          .describe('Vector decoration from the template masters, drawn under the pictures'),
      })
      .strict()
      .optional()
      .describe(
        'Background art from a brand template, drawn under everything on SlideCraft masters',
      ),
  })
  .strict();

export type ThemeChrome = z.infer<typeof ThemeChrome>;
