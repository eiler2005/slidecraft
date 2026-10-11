import { z } from 'zod';
import { createContext } from '../engine/context.ts';
import { diag } from '../qa/codes.ts';
import { getLayout } from './index.ts';
import type { LayoutDef } from './types.ts';

const region = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().positive().max(1),
    h: z.number().positive().max(1),
  })
  .strict()
  .refine(
    (b) => b.x + b.w <= 1.000001 && b.y + b.h <= 1.000001,
    'Component region must stay inside the slide body',
  );
const schema = z
  .object({
    components: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9-]*$/),
            layout: z.string(),
            variant: z.string().optional(),
            box: region.describe('Fractions of the available body, not page coordinates'),
            content: z.record(z.string(), z.unknown()),
          })
          .strict(),
      )
      .min(1)
      .max(12)
      .superRefine((items, ctx) => {
        const ids = new Set<string>();
        items.forEach((item, i) => {
          if (ids.has(item.id))
            ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Duplicate component id' });
          ids.add(item.id);
          items.slice(0, i).forEach((other) => {
            const a = item.box,
              b = other.box;
            if (
              Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-6 &&
              Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-6
            )
              ctx.addIssue({
                code: 'custom',
                path: [i, 'box'],
                message: `Overlaps component ${other.id}`,
              });
          });
        });
      }),
  })
  .strict();

/** Reuse actual layout contracts. No second component implementation or nested frame. */
export function isComposable(layout: LayoutDef): boolean {
  return (
    layout.frame === 'standard' &&
    layout.master === 'content' &&
    !['composition', 'freeform'].includes(layout.id)
  );
}

export const composition: LayoutDef<typeof schema> = {
  id: 'composition',
  name: 'Component composition',
  group: 'message',
  purpose:
    'Assemble several existing native exhibits in explicit body regions, keeping one shared frame and theme.',
  useWhen: ['One message needs two complementary exhibits from the existing library'],
  avoidWhen: [
    'Independent messages that belong on separate slides',
    'Dense layouts squeezed into unreadable regions',
  ],
  variants: ['regions'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Capabilities and execution jointly support the rollout',
      content: {
        components: [
          {
            id: 'capabilities',
            layout: 'key-points',
            variant: 'cards',
            box: { x: 0, y: 0, w: 0.48, h: 1 },
            content: {
              points: [
                { heading: 'Shared data', body: 'One agreed source.' },
                { heading: 'Clear roles', body: 'Named decision owners.' },
              ],
            },
          },
          {
            id: 'execution',
            layout: 'key-points',
            variant: 'columns',
            box: { x: 0.52, y: 0, w: 0.48, h: 1 },
            content: {
              points: [
                { heading: 'Test first', body: 'Validate the critical path.' },
                { heading: 'Scale next', body: 'Expand after review.' },
              ],
            },
          },
        ],
      },
    },
  ],
  compose(ctx, c) {
    c.components.forEach((part, i) => {
      const pointer = ctx.ptr(`components/${i}`);
      const def = getLayout(part.layout);
      if (!def || !isComposable(def)) {
        ctx.issue(
          diag('SC-SPEC-002', `Layout ${part.layout} is not a composable native body exhibit`, {
            pointer: `${pointer}/layout`,
          }),
        );
        return;
      }
      const variant = part.variant ?? def.variants[0];
      if (!def.variants.includes(variant)) {
        ctx.issue(
          diag('SC-SPEC-002', `Unknown ${def.id} variant ${variant}`, {
            pointer: `${pointer}/variant`,
          }),
        );
        return;
      }
      const parsed = def.schema.safeParse(part.content);
      if (!parsed.success) {
        for (const issue of parsed.error.issues)
          ctx.issue(
            diag('SC-SPEC-001', issue.message, {
              pointer: `${pointer}/content/${issue.path.join('/')}`,
            }),
          );
        return;
      }
      const b = part.box,
        parent = ctx.body;
      const body = {
        x: parent.x + b.x * parent.w,
        y: parent.y + b.y * parent.h,
        w: b.w * parent.w,
        h: b.h * parent.h,
      };
      const child = createContext({
        theme: ctx.theme,
        format: ctx.format,
        fonts: ctx.fonts,
        slideId: ctx.slideId,
        slideIndex: ctx.slideIndex,
        slide: ctx.slide,
        baseDir: ctx.baseDir,
        variant,
        body,
        pointerPrefix: `${pointer}/content`,
      });
      def.compose(child, parsed.data);
      child.nodes.forEach((node) => ctx.add(node));
      child.diagnostics.forEach((d) => ctx.issue(d));
      for (const node of child.nodes) {
        const n =
          node.kind === 'line'
            ? {
                x: Math.min(node.x1, node.x2),
                y: Math.min(node.y1, node.y2),
                w: Math.abs(node.x2 - node.x1),
                h: Math.abs(node.y2 - node.y1),
              }
            : node.box;
        if (
          n.x < body.x - 0.01 ||
          n.y < body.y - 0.01 ||
          n.x + n.w > body.x + body.w + 0.01 ||
          n.y + n.h > body.y + body.h + 0.01
        )
          ctx.issue(
            diag(
              'SC-SPEC-001',
              `Component ${part.id} exceeds its region; enlarge the region or choose a simpler exhibit`,
              { pointer: `${pointer}/box` },
            ),
          );
      }
    });
  },
};
