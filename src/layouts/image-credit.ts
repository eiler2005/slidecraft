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

const FOCUS = {
  left: { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  right: { x: 1, y: 0.5 },
  top: { x: 0.5, y: 0 },
  bottom: { x: 0.5, y: 1 },
} as const;

export const ImageFocus = z
  .union([
    z.enum(['left', 'center', 'right', 'top', 'bottom']),
    z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict(),
  ])
  .describe(
    'Which part of the picture stays in view when it is cropped to the slot: left, center, right, top, bottom, or { x, y } from 0 to 1 (default center)',
  );
export type ImageFocus = z.infer<typeof ImageFocus>;

/** The focus as a point from 0 to 1 on each axis; undefined for the centre (the default crop). */
export function focusPoint(f: ImageFocus | undefined): { x: number; y: number } | undefined {
  if (f === undefined || f === 'center') return undefined;
  return typeof f === 'string' ? FOCUS[f] : f;
}

/** "Photo: Jane Doe / Openverse · Flickr, CC BY 2.0" */
export function creditLine(c: ImageCredit, photoLabel: string): string {
  return `${photoLabel}: ${c.author} / ${c.provider}, ${c.license}`;
}
