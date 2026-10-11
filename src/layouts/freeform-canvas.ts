import { freeform } from './freeform.ts';
import type { LayoutDef } from './types.ts';

/**
 * A full-canvas counterpart to freeform. Use when the HTML owns the title and
 * reference chrome itself; it prevents a second SlideCraft title/footer frame.
 */
export const freeformCanvas: LayoutDef = {
  ...freeform,
  id: 'freeform-canvas',
  name: 'Freeform canvas',
  purpose:
    'Use for an imported or reference-matched HTML composition that owns the entire slide canvas and must remain editable in PowerPoint.',
  master: 'canvas',
  frame: 'none',
};
