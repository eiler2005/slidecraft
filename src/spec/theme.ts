import { z } from 'zod';

export const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a #RRGGBB hex color')
  .describe('Hex color, #RRGGBB');

/** Fonts we can measure exactly. Each stands in for a system font written into PPTX. */
/**
 * Font used for measuring and vector output: a bundled metric-compatible font
 * (`liberation-sans` ↔ Arial, `liberation-serif` ↔ Times New Roman, `gelasio` ↔ Georgia)
 * or the id of a brand font the theme provides with `files`.
 */
export const MeasureFont = z.string().regex(/^[a-z0-9-]+$/);
export type MeasureFont = string;

export const FontSpec = z
  .object({
    family: z.string().describe('Font family written into PPTX/HTML, e.g. "Arial"'),
    measure: MeasureFont.describe('Bundled metric-compatible font used for measuring and PDF/PNG'),
    files: z
      .object({
        regular: z.string(),
        bold: z.string().optional(),
        italic: z.string().optional(),
        boldItalic: z.string().optional(),
      })
      .strict()
      .optional()
      .describe(
        'Brand font files (TTF/OTF), relative to the theme file; registers `measure` as a new measure font',
      ),
  })
  .strict();
export type FontSpec = z.infer<typeof FontSpec>;

export const DecorKind = z.enum(['none', 'rule', 'wave', 'glow', 'geo', 'gradient', 'paper']);

const ArtItem = z
  .object({
    image: z.string().describe('PNG/JPEG relative to the theme file'),
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive(),
  })
  .strict();

export const Theme = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string(),
    description: z.string().describe('One sentence: the look and what it is best for'),
    bestFor: z.array(z.string()).min(1).describe('Storyline ids or task words this theme suits'),
    mood: z.array(z.string()).default([]),
    dark: z.boolean().default(false),
    prefers: z.enum(['pptx', 'html']).default('pptx').describe('Engine that shows this theme best'),
    colors: z
      .object({
        background: HexColor,
        surface: HexColor.describe('Cards, panels, table header fill'),
        ink: HexColor.describe('Primary text'),
        muted: HexColor.describe('Secondary text, labels, axis'),
        accent: HexColor.describe('The one highlight color'),
        accentText: HexColor.describe('Text placed on accent fills'),
        accentSoft: HexColor.describe('Tinted accent for backgrounds and bands'),
        rule: HexColor.describe('Hairlines, borders, gridlines'),
        positive: HexColor,
        negative: HexColor,
        titleInk: HexColor.optional().describe('Action title color; defaults to ink'),
      })
      .strict(),
    chart: z
      .array(HexColor)
      .min(4)
      .max(10)
      .describe('Series palette; index 0 is the highlight series, the rest recede'),
    fonts: z
      .object({
        heading: FontSpec,
        body: FontSpec,
        cyrillic: z
          .object({ heading: FontSpec.optional(), body: FontSpec.optional() })
          .strict()
          .optional()
          .describe('Override when deck text contains Cyrillic and the default lacks glyphs'),
      })
      .strict(),
    type: z
      .object({
        cover: z.number().min(24).max(72),
        title: z.number().min(16).max(36).describe('Action title size, pt'),
        subtitle: z.number().min(11).max(24),
        heading: z.number().min(11).max(24),
        body: z.number().min(10).max(22),
        minBody: z.number().min(9).max(18).describe('Smallest size copy-fitting may use'),
        small: z.number().min(8).max(14),
        source: z.number().min(7).max(11),
        lineHeight: z.number().min(1).max(1.6).describe('Exact line spacing as multiple of size'),
        titleWeight: z.enum(['regular', 'bold']).default('bold'),
      })
      .strict(),
    decor: z
      .object({
        kind: DecorKind,
        colors: z.array(HexColor).default([]),
        intensity: z.number().min(0).max(1).default(0.6),
        onContent: z.boolean().default(false).describe('Also draw decor on content slides'),
      })
      .strict(),
    chrome: z
      .object({
        titleRule: z.boolean().default(false).describe('Hairline under action titles'),
        accentBar: z.boolean().default(false).describe('Short accent bar above titles'),
        pageNumbers: z.boolean().default(true),
        footer: z.string().optional().describe('Default footer text; decks can override'),
        tracker: z.boolean().default(true).describe('Small section label top-left'),
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
          })
          .strict()
          .optional()
          .describe(
            'Background art from a brand template, drawn under everything on SlideCraft masters',
          ),
      })
      .strict(),
    source: z
      .string()
      .optional()
      .describe('Where the theme came from, e.g. "imported from brand.potx"'),
    officeTheme: z
      .string()
      .optional()
      .describe(
        'Brand Office theme part (theme1.xml), relative to the theme file; written into PPTX output so the Design tab and colour pickers show the brand',
      ),
  })
  .strict();

export type ThemeInput = z.input<typeof Theme>;
export type Theme = z.infer<typeof Theme>;
