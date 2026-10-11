import { z } from 'zod';

export const HexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a #RRGGBB hex color')
  .describe('Hex color, #RRGGBB');
