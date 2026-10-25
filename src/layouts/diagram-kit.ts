/** Theme-aware drawing vocabulary; no backend-specific drawing or deck exceptions. */
import { z } from 'zod';
import { ensureContrast, mix } from '../engine/color.ts';
import type { Point } from '../engine/diagram-geometry.ts';
import { roundedRoute, routeOrthogonal } from '../engine/diagram-routing.ts';
import type { Box } from '../engine/scene.ts';
import { diag } from '../qa/codes.ts';
import type { ComposeContext, LayoutDef, TextOpts } from './types.ts';

export const DiagramId = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .max(32);
export const DiagramLabel = z.string().min(1).max(48).describe('Short human-readable name');
export const GraphNode = z
  .object({
    id: DiagramId,
    label: DiagramLabel.max(28),
    detail: z.string().max(60).optional(),
    column: z.number().int().min(0).max(3),
    row: z.number().int().min(0).max(5),
    highlight: z.boolean().optional(),
    shape: z.enum(['process', 'decision', 'terminal', 'state', 'external']).optional(),
  })
  .strict();
export const GraphEdge = z
  .object({
    id: DiagramId.optional(),
    from: DiagramId,
    to: DiagramId,
    label: z.string().max(24).optional(),
    dashed: z.boolean().optional(),
  })
  .strict();
export const Graph = z
  .object({ nodes: z.array(GraphNode).min(2).max(12), edges: z.array(GraphEdge).max(16) })
  .strict();
export type GraphData = z.infer<typeof Graph>;

export function problem(ctx: ComposeContext, message: string, field = '') {
  ctx.issue(diag('SC-DIAGRAM-001', message, { pointer: ctx.ptr(field) }));
}

export function label(
  ctx: ComposeContext,
  text: string,
  box: Box,
  field?: string,
  opts: TextOpts = {},
) {
  return ctx.text(text, box, {
    size: 'body',
    valign: 'middle',
    maxLines: 2,
    ...(field ? { field } : {}),
    ...opts,
  });
}

export function caption(ctx: ComposeContext, text: string, box: Box, field?: string) {
  return label(ctx, text, box, field, { size: 'small', color: ctx.colors.muted });
}

export function panel(ctx: ComposeContext, box: Box, focal = false, role = 'diagram-node') {
  return ctx.rect(box, {
    fill: focal ? ctx.colors.accentSoft : ctx.colors.surface,
    stroke: { color: focal ? ctx.colors.accent : ctx.colors.rule, width: focal ? 1.25 : 0.75 },
    radius: 0.05,
    role,
  });
}

export function dot(
  ctx: ComposeContext,
  x: number,
  y: number,
  r = 0.06,
  focal = false,
  open = false,
) {
  return ctx.ellipse(
    { x: x - r, y: y - r, w: r * 2, h: r * 2 },
    {
      fill: open ? ctx.colors.background : focal ? ctx.colors.accent : ctx.colors.muted,
      stroke: { color: focal ? ctx.colors.accent : ctx.colors.muted, width: 1.2 },
      role: 'data-point',
    },
  );
}

export function valueFill(ctx: ComposeContext, t: number) {
  return mix(ctx.colors.background, ctx.colors.ink, 0.06 + Math.max(0, Math.min(1, t)) * 0.65);
}
export function readable(ctx: ComposeContext, fill: string) {
  return ensureContrast(ctx.colors.ink, fill, 5);
}

export function graphBoxes(area: Box, nodes: GraphData['nodes']): Map<string, Box> {
  const columns = Math.max(...nodes.map((n) => n.column)) + 1,
    rows = Math.max(...nodes.map((n) => n.row)) + 1;
  const pitchX = area.w / columns,
    pitchY = area.h / rows;
  const w = Math.min(2.4, pitchX - 0.65),
    h = Math.min(0.9, pitchY - 0.4);
  if (w < 0.75 || h < 0.45)
    throw new Error(
      'Graph exceeds readable node capacity; enlarge the region or split the diagram',
    );
  return new Map(
    nodes.map((n) => [
      n.id,
      {
        x: area.x + n.column * pitchX + (pitchX - w) / 2,
        y: area.y + n.row * pitchY + (pitchY - h) / 2,
        w,
        h,
      },
    ]),
  );
}

export function drawGraph(
  ctx: ComposeContext,
  area: Box,
  graph: GraphData,
  prefix = 'graph',
  supplied?: Map<string, Box>,
) {
  if (new Set(graph.nodes.map((n) => n.id)).size !== graph.nodes.length) {
    problem(ctx, 'Graph node IDs must be unique', prefix);
    return;
  }
  if (new Set(graph.nodes.map((n) => `${n.column}:${n.row}`)).size !== graph.nodes.length) {
    problem(ctx, 'Two nodes share a grid position', prefix);
    return;
  }
  if (
    graph.edges.some(
      (e) => !graph.nodes.some((n) => n.id === e.from) || !graph.nodes.some((n) => n.id === e.to),
    )
  ) {
    problem(ctx, 'A connection names an unknown endpoint', prefix);
    return;
  }
  if (
    new Set(graph.edges.filter((e) => e.id).map((e) => e.id)).size !==
    graph.edges.filter((e) => e.id).length
  ) {
    problem(ctx, 'Edge IDs must be unique', prefix);
    return;
  }
  let boxes: Map<string, Box>;
  try {
    boxes = supplied ?? graphBoxes(area, graph.nodes);
  } catch (e) {
    problem(ctx, (e as Error).message, prefix);
    return;
  }
  const identity = (id: string) => ctx.ptr(`${prefix}/${id}`);
  const ports = new Map<string, { edge: number; end: 'from' | 'to'; side: string }[]>();
  const sides = graph.edges.map((e, i) => {
    const a = boxes.get(e.from)!,
      b = boxes.get(e.to)!;
    const horizontal = Math.abs(a.x - b.x) > 0.01;
    const forward = horizontal ? b.x > a.x : b.y > a.y;
    const pair = horizontal
      ? forward
        ? ['right', 'left']
        : ['left', 'right']
      : forward
        ? ['bottom', 'top']
        : ['top', 'bottom'];
    (['from', 'to'] as const).forEach((end, k) => {
      const key = `${e[end]}:${pair[k]}`;
      ports.set(key, [...(ports.get(key) ?? []), { edge: i, end, side: pair[k]! }]);
    });
    return pair;
  });
  const port = (
    id: string,
    side: string,
    i: number,
    end: 'from' | 'to',
  ): { p: Point; outer: Point } => {
    const b = boxes.get(id)!,
      list = ports.get(`${id}:${side}`)!;
    const slot = list.findIndex((p) => p.edge === i && p.end === end),
      f = (slot + 1) / (list.length + 1),
      d = 0.12;
    if (side === 'left') return { p: [b.x, b.y + b.h * f], outer: [b.x - d, b.y + b.h * f] };
    if (side === 'right')
      return { p: [b.x + b.w, b.y + b.h * f], outer: [b.x + b.w + d, b.y + b.h * f] };
    if (side === 'top') return { p: [b.x + b.w * f, b.y], outer: [b.x + b.w * f, b.y - d] };
    return { p: [b.x + b.w * f, b.y + b.h], outer: [b.x + b.w * f, b.y + b.h + d] };
  };
  graph.edges.forEach((e, i) => {
    const a = port(e.from, sides[i]![0]!, i, 'from'),
      b = port(e.to, sides[i]![1]!, i, 'to');
    try {
      const route: Point[] = [
        a.p,
        ...routeOrthogonal(a.outer, b.outer, [...boxes.values()], area),
        b.p,
      ];
      ctx.path(roundedRoute(route), {
        stroke: {
          color: ctx.colors.muted,
          width: 1,
          ...(e.dashed ? { dash: 'dash' as const } : {}),
        },
        round: true,
        role: 'diagram-edge',
        pointer: ctx.ptr(`${prefix}/edges/${i}`),
        diagram: {
          kind: 'edge',
          id: identity(e.id ?? `edge-${i}`),
          from: identity(e.from),
          to: identity(e.to),
          route,
        },
      });
      const end = route.at(-1)!,
        before = route.at(-2)!,
        angle = Math.atan2(end[1] - before[1], end[0] - before[0]),
        s = 0.075;
      ctx.polygon(
        [
          end,
          [
            end[0] - s * Math.cos(angle) + s * 0.48 * Math.sin(angle),
            end[1] - s * Math.sin(angle) - s * 0.48 * Math.cos(angle),
          ],
          [
            end[0] - s * Math.cos(angle) - s * 0.48 * Math.sin(angle),
            end[1] - s * Math.sin(angle) + s * 0.48 * Math.cos(angle),
          ],
        ],
        { fill: ctx.colors.muted, role: 'diagram-arrow' },
      );
      if (e.label) {
        const segments = route
          .slice(1)
          .map((p, k) => ({
            a: route[k]!,
            b: p,
            len: Math.hypot(p[0] - route[k]![0], p[1] - route[k]![1]),
          }))
          .sort((x, y) => y.len - x.len);
        const seg = segments[0]!,
          mx = (seg.a[0] + seg.b[0]) / 2,
          my = (seg.a[1] + seg.b[1]) / 2;
        const horizontal = Math.abs(seg.a[1] - seg.b[1]) < 0.001;
        const w = Math.min(1.4, Math.max(0.65, e.label.length * 0.075));
        const lb = {
          x: horizontal ? mx - w / 2 : mx + 0.12,
          y: horizontal ? my - 0.32 : my - 0.13,
          w,
          h: 0.26,
        };
        if (
          [...boxes.values()].some(
            (n) => lb.x < n.x + n.w && lb.x + lb.w > n.x && lb.y < n.y + n.h && lb.y + lb.h > n.y,
          )
        )
          problem(
            ctx,
            'Edge label has no clear space; shorten it or split the graph',
            `${prefix}/edges/${i}/label`,
          );
        else {
          ctx.rect(lb, { fill: ctx.colors.background, role: 'diagram-label-mask' });
          label(ctx, e.label, lb, `${prefix}/edges/${i}/label`, {
            size: 'small',
            align: 'center',
            maxLines: 1,
          });
        }
      }
    } catch (err) {
      problem(ctx, (err as Error).message, `${prefix}/edges/${i}`);
    }
  });
  graph.nodes.forEach((n, i) => {
    const b = boxes.get(n.id)!;
    const node =
      n.shape === 'decision'
        ? ctx.polygon(
            [
              [b.x + b.w / 2, b.y],
              [b.x + b.w, b.y + b.h / 2],
              [b.x + b.w / 2, b.y + b.h],
              [b.x, b.y + b.h / 2],
            ],
            {
              fill: ctx.colors.surface,
              stroke: { color: ctx.colors.rule, width: 1 },
              role: 'diagram-decision',
            },
          )
        : panel(ctx, b, n.highlight);
    if (node.kind === 'rect' && (n.shape === 'terminal' || n.shape === 'state'))
      node.radius = n.shape === 'terminal' ? b.h / 2 : 0.13;
    node.diagram = { kind: 'node', id: identity(n.id) };
    const inset = n.shape === 'decision' ? b.w * 0.22 : 0.12;
    label(
      ctx,
      n.label,
      { x: b.x + inset, y: b.y + 0.07, w: b.w - 2 * inset, h: n.detail ? b.h * 0.48 : b.h - 0.14 },
      `${prefix}/nodes/${i}/label`,
      { bold: true, align: 'center' },
    );
    if (n.detail)
      caption(
        ctx,
        n.detail,
        { x: b.x + 0.12, y: b.y + b.h * 0.55, w: b.w - 0.24, h: b.h * 0.35 },
        `${prefix}/nodes/${i}/detail`,
      );
  });
}

/** Common contract metadata only; each layout still owns its schema and semantics. */
export function diagramDef<S extends z.ZodObject>(
  id: string,
  name: string,
  schema: S,
  examples: LayoutDef<S>['examples'],
  compose: LayoutDef<S>['compose'],
  purpose: string,
  group: LayoutDef['group'] = 'decide',
): LayoutDef<S> {
  return {
    id,
    name,
    group,
    tags: ['diagram'],
    purpose,
    useWhen: [purpose],
    avoidWhen: ['A simpler existing chart or table answers the question'],
    variants: ['diagram'],
    frame: 'standard',
    master: 'content',
    schema,
    examples,
    compose,
  };
}
