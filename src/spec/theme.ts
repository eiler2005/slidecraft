import { z } from 'zod';

export const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a #RRGGBB hex color')
  .describe('Hex color, #RRGGBB');

/** Fonts we can measure exactly. Each stands in for a system font written into PPTX. */
export const MeasureFont = z.enum(['liberation-sans', 'liberation-serif', 'gelasio']);
export type MeasureFont = z.infer<typeof MeasureFont>;

export const FontSpec = z
  .object({
    family: z.string().describe('Font family written into PPTX/HTML, e.g. "Arial"'),
    measure: MeasureFont.describe('Bundled metric-compatible font used for measuring and PDF/PNG'),
  })
  .strict();
export type FontSpec = z.infer<typeof FontSpec>;

export const DecorKind = z.enum(['none', 'rule', 'wave', 'glow', 'geo', 'gradient', 'paper']);

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
      })
      .strict(),
  })
  .strict();

export type ThemeInput = z.input<typeof Theme>;
export type Theme = z.infer<typeof Theme>;
