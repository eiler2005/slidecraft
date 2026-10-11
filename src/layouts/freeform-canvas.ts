import { freeform } from './freeform.ts';
import type { LayoutDef } from './types.ts';

/**
 * A custom canvas uses shared chrome by default. Explicit frame:none is reserved
 * for compositions that own their complete page, including titles and numbering.
 */
export const freeformCanvas: LayoutDef = {
  ...freeform,
  id: 'freeform-canvas',
  name: 'Freeform canvas',
  purpose:
    'Use for custom HTML with shared title, source and page chrome by default. Explicit frame:none is reserved for a verified full-page composition that owns all chrome.',
  master: 'canvas',
  frame: 'none',
};
