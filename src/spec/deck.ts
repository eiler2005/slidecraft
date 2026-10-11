import { z } from 'zod';
import { LAYOUTS } from '../layouts/index.ts';

export const SlideId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'kebab-case id, e.g. "exec-summary" or "s04-market"')
  .describe('Stable slide id; reviews and fixes target slides by id');

export const Source = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z
      .string()
      .max(140)
      .describe('Short citation shown on slides, e.g. "Company financials FY2025"'),
    publisher: z.string().max(80).optional(),
    date: z.string().max(32).optional(),
    url: z.string().url().optional(),
    note: z.string().max(200).optional(),
    illustrative: z.boolean().default(false).describe('Mark sample / illustrative data honestly'),
  })
  .strict();
export type Source = z.infer<typeof Source>;

/** Fields every slide accepts, whatever its layout. */
export const CommonSlide = z.object({
  id: SlideId,
  title: z
    .string()
    .min(3)
    .max(140)
    .describe('Action title: one full-sentence claim, ideally 8–14 words; the body proves it'),
  lead: z.string().max(160).optional().describe('Optional one-line lead under the title'),
  tracker: z.string().max(40).optional().describe('Section label shown above the title'),
  sources: z.array(z.string()).optional().describe('Ids from the deck `sources:` list'),
  source: z.string().max(180).optional().describe('Free-text source line, if not in the registry'),
  notes: z.string().max(3000).optional().describe('Speaker notes'),
  status: z.enum(['ghost', 'draft', 'final']).optional(),
  ghost: z
    .object({
      exhibit: z.string().max(200).describe('One-line sketch of the intended exhibit'),
      data: z.string().max(200).optional().describe('Data needed and whether we have it'),
      confidence: z.enum(['solid', 'likely', 'speculative']).default('likely'),
    })
    .strict()
    .optional()
    .describe('Ghost-deck planning fields; rendered as a sketch until content is filled'),
});

function slideSchemaFor(def: (typeof LAYOUTS)[number]) {
  return CommonSlide.extend({
    layout: z.literal(def.id),
    variant: z.enum(def.variants).optional(),
    ...def.schema.shape,
  })
    .strict()
    .describe(`${def.name} — ${def.purpose}`);
}

const slideSchemas = LAYOUTS.map(slideSchemaFor);

export const Slide = z.discriminatedUnion(
  'layout',
  slideSchemas as unknown as [z.ZodObject, z.ZodObject, ...z.ZodObject[]],
);
export type Slide = z.infer<typeof CommonSlide> & { layout: string; variant?: string } & Record<
    string,
    unknown
  >;

/** Ghost slides only need the common fields: content is written after the title chain is approved. */
export const GhostSlide = CommonSlide.extend({
  layout: z.enum(LAYOUTS.map((l) => l.id) as [string, ...string[]]),
  variant: z.string().optional(),
}).passthrough();

export const Include = z
  .object({ include: z.string().describe('Path to a YAML list of slides, relative to deck.yaml') })
  .strict();

export const Deck = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().max(140),
    subtitle: z.string().max(200).optional(),
    author: z.string().max(80).optional(),
    organization: z.string().max(80).optional(),
    date: z.string().max(32).optional(),
    language: z.string().default('en').describe('BCP-47 language tag of the content'),
    storyline: z.string().optional().describe('Storyline id from the library'),
    theme: z.string().default('consulting-classic'),
    format: z
      .enum(['wide-16x9', 'a4-landscape'])
      .default('wide-16x9')
      .describe('Page size: PowerPoint widescreen, or A4 landscape for printed / reading decks'),
    status: z.enum(['ghost', 'draft', 'review', 'final']).default('draft'),
    footer: z
      .string()
      .max(80)
      .optional()
      .describe('Footer text, e.g. "Confidential — for discussion"'),
    sources: z.array(Source).default([]),
    output: z
      .object({
        formats: z
          .array(z.enum(['pptx', 'pdf', 'png', 'html', 'onepager', 'docx']))
          .default(['pptx', 'pdf', 'png']),
        engines: z
          .object({
            pptx: z.enum(['auto', 'pptxgenjs', 'artifact-tool']).default('auto'),
            pdf: z.enum(['auto', 'native', 'html', 'pptx-convert']).default('auto'),
          })
          .strict()
          .default({ pptx: 'auto', pdf: 'auto' }),
      })
      .strict()
      .optional(),
    slides: z.array(z.unknown()).min(1),
  })
  .strict();

export type DeckDoc = z.infer<typeof Deck>;
export type DeckInput = z.input<typeof Deck>;

/** JSON Schema for the deck document with concrete slide shapes (for editors and agents). */
export function deckJsonSchema(): unknown {
  const full = Deck.extend({ slides: z.array(z.union([Slide, Include])).min(1) });
  return z.toJSONSchema(full, { target: 'draft-2020-12', unrepresentable: 'any' });
}

export function slideJsonSchemaFor(layoutId: string): unknown {
  const def = LAYOUTS.find((l) => l.id === layoutId);
  if (!def) return undefined;
  return z.toJSONSchema(slideSchemaFor(def), { target: 'draft-2020-12', unrepresentable: 'any' });
}
