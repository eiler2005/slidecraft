/**
 * Icons from the bundled Tabler subset (`icons.gen.ts`, MIT) as native, editable paths:
 * a freeform in PowerPoint, a path in SVG/HTML/PDF, drawn in a theme colour.
 */
import { z } from 'zod';
import { ICONS } from './icons.gen.ts';
import type { Box, PathNode } from './scene.ts';
import { type PathSeg, parsePath, pathBounds, transformPath } from './svg-path.ts';

export const ICON_NAMES = Object.keys(ICONS).sort() as [string, ...string[]];

/** Contract type for `icon:` fields. */
export const Icon = z
  .enum(ICON_NAMES)
  .describe('Icon name from the bundled Tabler set (`slidecraft icons` lists them)');

const parsed = new Map<string, PathSeg[]>();

/** The icon drawn into a square box; stroke 2/24 of its size, as designed. */
export function iconNode(name: string, box: Box, color: string, role = 'icon'): PathNode {
  let segs = parsed.get(name);
  if (!segs) {
    const d = ICONS[name];
    if (!d) throw new Error(`Unknown icon "${name}"`);
    segs = parsePath(d);
    parsed.set(name, segs);
  }
  const size = Math.min(box.w, box.h);
  const s = size / 24;
  const dx = box.x + (box.w - size) / 2;
  const dy = box.y + (box.h - size) / 2;
  const segments = transformPath(segs, s, dx, dy);
  // a 2-unit stroke on the 24 grid, in points
  return {
    kind: 'path',
    box: pathBounds(segments),
    segments,
    stroke: { color, width: +(2 * s * 72).toFixed(2) },
    round: true,
    role,
  };
}
