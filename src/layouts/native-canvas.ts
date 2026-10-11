import { z } from 'zod';
import type { Box } from '../engine/scene.ts';
import type { LayoutDef } from './types.ts';

/**
 * A deliberately small, PowerPoint-native drawing vocabulary. Unlike `freeform`,
 * it never passes HTML to Chrome: every entry becomes a separately editable PPTX object.
 * Coordinates are percentages of the standard slide body, not the full page.
 */
const position = z.number().min(0).max(100);
const size = z.number().positive().max(100);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const rect = z
  .object({
    kind: z.literal('rect'),
    x: position,
    y: position,
    w: size,
    h: size,
    fill: color,
    opacity: z.number().min(0).max(1).optional(),
    stroke: color.optional(),
    strokeWidth: z.number().positive().max(12).optional(),
    radius: z.number().min(0).max(50).optional(),
  })
  .strict();
const ellipse = rect
  .extend({ kind: z.literal('ellipse') })
  .omit({ radius: true })
  .strict();
const text = z
  .object({
    kind: z.literal('text'),
    x: position,
    y: position,
    w: size,
    h: size,
    text: z.string().min(1).max(800),
    font: z.enum(['heading', 'body']).default('body'),
    size: z.number().min(6).max(100),
    color: color.optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    valign: z.enum(['top', 'middle', 'bottom']).optional(),
    lineHeight: z.number().min(0.8).max(2).optional(),
    maxLines: z.number().int().min(1).max(20).optional(),
  })
  .strict();
const line = z
  .object({
    kind: z.literal('line'),
    x1: position,
    y1: position,
    x2: position,
    y2: position,
    color,
    width: z.number().positive().max(12).default(1),
    arrowEnd: z.boolean().optional(),
  })
  .strict();
const schema = z
  .object({
    elements: z
      .array(z.discriminatedUnion('kind', [rect, ellipse, text, line]))
      .min(1)
      .max(120),
  })
  .strict();
type Element = z.infer<typeof schema>['elements'][number];

function box(ctx: Parameters<LayoutDef<typeof schema>['compose']>[0], e: Element): Box {
  if (!('w' in e) || !('h' in e)) throw new Error(`${e.kind} does not have a box`);
  return {
    x: ctx.body.x + (e.x / 100) * ctx.body.w,
    y: ctx.body.y + (e.y / 100) * ctx.body.h,
    w: (e.w / 100) * ctx.body.w,
    h: (e.h / 100) * ctx.body.h,
  };
}

export const nativeCanvas: LayoutDef<typeof schema> = {
  id: 'native-canvas',
  name: 'Native canvas',
  group: 'message',
  purpose:
    'Use for bespoke compositions that must remain editable in PowerPoint: every rectangle, line and text block is a native PPTX object.',
  useWhen: [
    'A standard layout does not fit the message',
    'The recipient will edit the PowerPoint',
    'A bespoke visual needs a native PPTX representation',
  ],
  avoidWhen: [
    'A standard exhibit already communicates the point',
    'A browser-only visual needs arbitrary CSS',
  ],
  variants: ['body'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'The service reduces onboarding time without changing the approval standard',
      content: {
        elements: [
          { kind: 'rect', x: 0, y: 0, w: 47, h: 75, fill: '#F1F5FA', radius: 5 },
          {
            kind: 'text',
            x: 4,
            y: 12,
            w: 39,
            h: 16,
            text: '14 days',
            font: 'heading',
            size: 38,
            bold: true,
            color: '#182238',
          },
          {
            kind: 'text',
            x: 4,
            y: 32,
            w: 39,
            h: 20,
            text: 'manual onboarding before automation',
            size: 18,
            color: '#53657C',
          },
          {
            kind: 'line',
            x1: 50,
            y1: 38,
            x2: 57,
            y2: 38,
            color: '#1F5EFF',
            width: 2,
            arrowEnd: true,
          },
          { kind: 'rect', x: 60, y: 0, w: 40, h: 75, fill: '#E1F5F2', radius: 5 },
          {
            kind: 'text',
            x: 64,
            y: 12,
            w: 32,
            h: 16,
            text: '1 day',
            font: 'heading',
            size: 38,
            bold: true,
            color: '#008F83',
          },
        ],
      },
      sources: ['ops-review'],
    },
  ],
  compose(ctx, c) {
    for (const [index, e] of c.elements.entries()) {
      if (e.kind === 'rect') {
        ctx.rect(box(ctx, e), {
          fill: e.fill,
          fillOpacity: e.opacity,
          radius: e.radius ? (e.radius / 100) * Math.min(ctx.body.w, ctx.body.h) : undefined,
          stroke: e.stroke ? { color: e.stroke, width: e.strokeWidth ?? 1 } : undefined,
          role: 'native-canvas-rect',
        });
      } else if (e.kind === 'ellipse') {
        ctx.ellipse(box(ctx, e), {
          fill: e.fill,
          fillOpacity: e.opacity,
          stroke: e.stroke ? { color: e.stroke, width: e.strokeWidth ?? 1 } : undefined,
          role: 'native-canvas-ellipse',
        });
      } else if (e.kind === 'text') {
        ctx.text(e.text, box(ctx, e), {
          font: e.font,
          size: e.size,
          color: e.color ?? ctx.colors.ink,
          bold: e.bold,
          italic: e.italic,
          align: e.align,
          valign: e.valign,
          lineHeight: e.lineHeight,
          maxLines: e.maxLines,
          field: `elements/${index}/text`,
          role: 'native-canvas-text',
        });
      } else {
        ctx.line(
          ctx.body.x + (e.x1 / 100) * ctx.body.w,
          ctx.body.y + (e.y1 / 100) * ctx.body.h,
          ctx.body.x + (e.x2 / 100) * ctx.body.w,
          ctx.body.y + (e.y2 / 100) * ctx.body.h,
          { color: e.color, width: e.width },
          { arrowEnd: e.arrowEnd, role: 'native-canvas-line' },
        );
      }
    }
  },
};
