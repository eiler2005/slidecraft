import { z } from 'zod';

/**
 * A page format file, e.g. written by `theme import` from a brand template: the slide size
 * and the margins that put SlideCraft's title band where the template has its title.
 */
export const FormatFile = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    name: z.string().max(60).optional(),
    w: z.number().min(4).max(30).describe('Page width, inches'),
    h: z.number().min(3).max(30).describe('Page height, inches'),
    margin: z
      .object({
        l: z.number().min(0.2),
        r: z.number().min(0.2),
        t: z.number().min(0.2),
        b: z.number().min(0.2),
      })
      .strict(),
    source: z.string().optional(),
  })
  .strict();
export type FormatFile = z.infer<typeof FormatFile>;
