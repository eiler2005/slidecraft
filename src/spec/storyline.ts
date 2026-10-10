import { z } from 'zod';

export const Slot = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    purpose: z.string().max(200).describe('What this slide must make the reader believe'),
    layouts: z.array(z.string()).min(1).describe('Preferred layouts, best first'),
    required: z.boolean().default(true),
    repeat: z
      .object({ min: z.number().int().min(0), max: z.number().int().min(1) })
      .strict()
      .optional(),
    guidance: z
      .string()
      .max(600)
      .optional()
      .describe('How to write it: title pattern, evidence, pitfalls'),
    inputs: z.array(z.string()).default([]).describe('What the author needs to fill it'),
  })
  .strict();

export const Storyline = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string(),
    summary: z.string().max(240).describe('One sentence: the story shape and when to use it'),
    bestFor: z.array(z.string()).min(1).describe('Task words matched against the brief'),
    audiences: z.array(z.string()).default([]),
    themes: z.array(z.string()).min(1).describe('Recommended themes, best first'),
    ordered: z.boolean().default(true).describe('Slots follow a fixed order'),
    arc: z
      .string()
      .max(200)
      .describe('The narrative arc, e.g. "Situation → Complication → Resolution → Ask"'),
    length: z.object({ min: z.number().int(), max: z.number().int() }).strict(),
    tone: z.array(z.string()).default([]),
    principles: z
      .array(z.string())
      .default([])
      .describe('Writing rules specific to this storyline'),
    sections: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]+$/),
            name: z.string(),
            slots: z.array(Slot).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type Storyline = z.infer<typeof Storyline>;
