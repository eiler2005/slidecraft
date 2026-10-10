import { z } from 'zod';

export const Usage = z.enum([
  'edit-together',
  'send-pdf',
  'present-live',
  'web-link',
  'automation',
  'codex',
]);
export type Usage = z.infer<typeof Usage>;

export const Brief = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    goal: z
      .string()
      .min(10)
      .max(400)
      .describe('What must be true after the audience sees this deck'),
    ask: z.string().max(240).optional().describe('The decision or action requested'),
    audience: z
      .object({
        who: z.string().max(160),
        knows: z.string().max(300).optional().describe('What they already accept'),
        cares: z.string().max(300).optional().describe('What they worry about / are measured on'),
      })
      .strict(),
    task: z
      .string()
      .max(60)
      .optional()
      .describe(
        'Kind of deck in plain words, e.g. "strategy recommendation", "board update", "keynote story"',
      ),
    context: z.string().max(4000).optional(),
    materials: z
      .array(z.string())
      .default([])
      .describe('Paths to source files, relative to brief.yaml'),
    length: z
      .object({
        slides: z.number().int().min(1).max(80).optional(),
        minutes: z.number().int().optional(),
      })
      .strict()
      .optional(),
    language: z.string().default('en'),
    tone: z.array(z.string()).default([]),
    brand: z
      .object({
        theme: z.string().optional(),
        footer: z.string().max(80).optional(),
        logo: z.string().optional(),
      })
      .strict()
      .optional(),
    usage: z
      .array(Usage)
      .default(['edit-together'])
      .describe('What will happen with the deck — drives engine recommendations'),
    output: z
      .object({
        formats: z.array(z.enum(['pptx', 'pdf', 'png', 'html'])).optional(),
        engines: z
          .object({
            pptx: z.enum(['auto', 'pptxgenjs', 'artifact-tool']).optional(),
            pdf: z.enum(['auto', 'native', 'html', 'pptx-convert']).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    choice: z
      .object({ storyline: z.string(), theme: z.string(), option: z.string().optional() })
      .strict()
      .optional()
      .describe('Filled at checkpoint 2 (pick)'),
  })
  .strict();

export type Brief = z.infer<typeof Brief>;
