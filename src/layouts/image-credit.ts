import { z } from 'zod';

/** Who made a stock photo and under which licence; written by `slidecraft images --stock`. */
export const ImageCredit = z
  .object({
    author: z.string().max(120),
    provider: z
      .string()
      .max(60)
      .describe('Where it came from, e.g. "Openverse · Flickr", "Pexels"'),
    license: z.string().max(60).describe('e.g. "CC BY 2.0", "Pexels License"'),
    licenseUrl: z.string().max(300).optional(),
    source: z.string().max(400).describe('Page of the photo at the provider'),
    title: z.string().max(200).optional(),
  })
  .strict()
  .describe('Photo credit; shown with the slide sources, in the notes and in the manifest');
export type ImageCredit = z.infer<typeof ImageCredit>;

export const ImageQuery = z
  .string()
  .max(120)
  .describe(
    'Stock photo search, e.g. "engineer with laptop in a warehouse"; `slidecraft images --stock` fills `image`',
  );

/** "Photo: Jane Doe / Openverse · Flickr, CC BY 2.0" */
export function creditLine(c: ImageCredit, photoLabel: string): string {
  return `${photoLabel}: ${c.author} / ${c.provider}, ${c.license}`;
}
