import { z } from 'zod';
import { mix } from '../engine/color.ts';
import { cols } from '../engine/format.ts';
import type { Box } from '../engine/scene.ts';
import {
  caption,
  DiagramId,
  DiagramLabel,
  diagramDef,
  dot,
  GraphEdge,
  label,
  panel,
  problem,
} from './diagram-kit.ts';

const sources = ['illustrative'];
const nestedSchema = z
  .object({
    items: z
      .array(
        z.object({ id: DiagramId, label: DiagramLabel, parent: DiagramId.optional() }).strict(),
      )
      .min(2)
      .max(10),
  })
  .strict();
export const nested = diagramDef(
  'nested',
  'Nested containment',
  nestedSchema,
  [
    {
      title: 'The service boundary contains the application and its data domain',
      sources,
      content: {
        items: [
          { id: 'service', label: 'Service boundary' },
          { id: 'app', label: 'Application', parent: 'service' },
          { id: 'data', label: 'Data domain', parent: 'service' },
          { id: 'orders', label: 'Orders', parent: 'data' },
          { id: 'customers', label: 'Customers', parent: 'data' },
        ],
      },
    },
  ],
  (ctx, c) => {
    const ids = new Set(c.items.map((v) => v.id));
    if (ids.size !== c.items.length || c.items.some((v) => v.parent && !ids.has(v.parent))) {
      problem(ctx, 'Containment IDs must be unique with known parents', 'items');
      return;
    }
    for (const item of c.items) {
      let p: typeof item | undefined = item;
      const seen = new Set<string>();
      while (p) {
        if (seen.has(p.id)) {
          problem(ctx, 'Containment cannot contain cycles', 'items');
          return;
        }
        seen.add(p.id);
        if (seen.size > 3) {
          problem(ctx, 'Containment supports three levels; split deeper structures', 'items');
          return;
        }
        p = c.items.find((v) => v.id === p!.parent);
      }
    }
    const draw = (items: typeof c.items, area: Box, depth: number) => {
      const boxes = cols(
        area,
        items.map(() => 1),
        0.2,
      );
      items.forEach((item, i) => {
        const b = boxes[i]!;
        ctx.rect(b, {
          fill: depth % 2 ? ctx.colors.background : ctx.colors.surface,
          stroke: { color: ctx.colors.rule, width: 1 },
          radius: 0.06,
          role: 'containment-boundary',
        });
        label(
          ctx,
          item.label,
          { x: b.x + 0.16, y: b.y + 0.08, w: b.w - 0.32, h: 0.5 },
          `items/${c.items.indexOf(item)}/label`,
          { bold: true },
        );
        const children = c.items.filter((v) => v.parent === item.id);
        if (children.length) {
          if (b.h < 1.2 || b.w < 1.4) {
            problem(ctx, 'Containment needs a larger region or fewer branches', 'items');
            return;
          }
          draw(children, { x: b.x + 0.18, y: b.y + 0.75, w: b.w - 0.36, h: b.h - 0.95 }, depth + 1);
        }
      });
    };
    draw(
      c.items.filter((v) => !v.parent),
      ctx.body,
      0,
    );
  },
  'Use for qualitative scope and containment through up to three nested levels.',
);

const vennSchema = z
  .object({
    sets: z.array(z.string().min(1).max(36)).min(2).max(3),
    intersection: z.string().min(1).max(36),
  })
  .strict();
export const venn = diagramDef(
  'venn',
  'Qualitative set overlap',
  vennSchema,
  [
    {
      title: 'The opportunity combines customer need and delivery capability',
      sources,
      content: {
        sets: ['Customer need', 'Delivery capability'],
        intersection: 'Viable opportunity',
      },
    },
  ],
  (ctx, c) => {
    const b = ctx.body,
      r = Math.min(b.h * (c.sets.length === 3 ? 0.26 : 0.33), b.w * 0.18),
      cx = b.x + b.w / 2,
      cy = b.y + b.h / 2;
    const centers =
      c.sets.length === 2
        ? [
            [cx - r * 0.55, cy],
            [cx + r * 0.55, cy],
          ]
        : [
            [cx - r * 0.55, cy - r * 0.3],
            [cx + r * 0.55, cy - r * 0.3],
            [cx, cy + r * 0.55],
          ];
    centers.forEach(([x, y], i) =>
      ctx.ellipse(
        { x: x! - r, y: y! - r, w: 2 * r, h: 2 * r },
        {
          fill: i === 0 ? ctx.colors.accent : ctx.colors.ink,
          fillOpacity: 0.09,
          stroke: { color: i === 0 ? ctx.colors.accent : ctx.colors.muted, width: 1 },
          role: 'qualitative-set',
        },
      ),
    );
    c.sets.forEach((name, i) => {
      const [x, y] = centers[i]!;
      label(
        ctx,
        name,
        {
          x: x! + (i < 2 ? (i === 0 ? -1 : 1) * r * 0.2 : 0) - 0.95,
          y: i === 2 ? y! + r + 0.03 : y! - r - 0.45,
          w: 1.9,
          h: 0.4,
        },
        `sets/${i}`,
        { bold: true, align: 'center' },
      );
    });
    label(ctx, c.intersection, { x: cx - 0.72, y: cy - 0.35, w: 1.44, h: 0.7 }, 'intersection', {
      align: 'center',
      size: 'small',
    });
  },
  'Use for qualitative overlap between sets; circle and overlap areas do not encode quantities.',
);

const wardleySchema = z
  .object({
    nodes: z
      .array(
        z
          .object({
            id: DiagramId,
            label: z.string().min(1).max(30),
            evolution: z.number().min(0).max(1),
            visibility: z.number().min(0).max(1),
            moveTo: z.number().min(0).max(1).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    edges: z.array(GraphEdge).max(10),
  })
  .strict();
export const wardley = diagramDef(
  'wardley-map',
  'Wardley map',
  wardleySchema,
  [
    {
      title: 'Commodity infrastructure supports the differentiated customer experience',
      sources,
      content: {
        nodes: [
          { id: 'experience', label: 'Experience', evolution: 0.25, visibility: 0.85 },
          { id: 'service', label: 'Service logic', evolution: 0.5, visibility: 0.55, moveTo: 0.7 },
          { id: 'compute', label: 'Compute', evolution: 0.85, visibility: 0.2 },
        ],
        edges: [
          { from: 'experience', to: 'service' },
          { from: 'service', to: 'compute' },
        ],
      },
    },
  ],
  (ctx, c) => {
    if (
      new Set(c.nodes.map((v) => v.id)).size !== c.nodes.length ||
      c.edges.some(
        (e) => !c.nodes.some((v) => v.id === e.from) || !c.nodes.some((v) => v.id === e.to),
      )
    ) {
      problem(ctx, 'Wardley dependencies require unique nodes and known endpoints', 'edges');
      return;
    }
    const b = ctx.body,
      a = { x: b.x + 1.1, y: b.y + 0.45, w: b.w - 2.1, h: b.h - 1.1 },
      point = (id: string) => {
        const n = c.nodes.find((v) => v.id === id)!;
        return [a.x + n.evolution * a.w, a.y + (1 - n.visibility) * a.h] as const;
      };
    ['Genesis', 'Custom', 'Product', 'Commodity'].forEach((name, i) => {
      ctx.rect(
        { x: a.x + (i * a.w) / 4, y: a.y, w: a.w / 4, h: a.h },
        {
          fill: i % 2 ? ctx.colors.surface : ctx.colors.background,
          role: 'evolution-band',
          textContainer: false,
        },
      );
      caption(ctx, name, { x: a.x + (i * a.w) / 4, y: a.y + a.h + 0.2, w: a.w / 4, h: 0.3 });
    });
    c.edges.forEach((e) => {
      const p = point(e.from),
        q = point(e.to);
      ctx.line(
        p[0],
        p[1],
        q[0],
        q[1],
        { color: ctx.colors.muted, width: 1 },
        { role: 'value-chain-dependency' },
      );
    });
    c.nodes.forEach((n, i) => {
      const [x, y] = point(n.id);
      dot(ctx, x, y, 0.06, n.moveTo !== undefined);
      label(ctx, n.label, { x: x - 0.8, y: y - 0.43, w: 1.6, h: 0.36 }, `nodes/${i}/label`, {
        size: 'small',
        align: 'center',
      });
      if (n.moveTo !== undefined)
        ctx.line(
          x,
          y,
          a.x + n.moveTo * a.w,
          y,
          { color: ctx.colors.accent, width: 1.2, dash: 'dash' },
          { arrowEnd: true, role: 'evolution-movement' },
        );
    });
    caption(ctx, 'Visible', { x: b.x, y: a.y, w: 1, h: 0.3 });
    caption(ctx, 'Foundation', { x: b.x, y: a.y + a.h - 0.3, w: 1, h: 0.3 });
  },
  'Use for a value chain positioned by visibility and evolution, with dependencies and explicit movement.',
);

const storySchema = z
  .object({
    releases: z.array(z.string().min(1).max(24)).min(2).max(4),
    activities: z
      .array(
        z
          .object({
            label: z.string().min(1).max(28),
            slices: z.array(z.string().min(1).max(65)).min(2).max(4),
          })
          .strict(),
      )
      .min(3)
      .max(6),
    cutAfter: z.number().int().min(0).optional(),
  })
  .strict();
export const storyMap = diagramDef(
  'story-map',
  'User story map',
  storySchema,
  [
    {
      title: 'The first release covers the complete customer backbone at a smaller scope',
      sources,
      content: {
        releases: ['Release 1', 'Release 2'],
        activities: [
          { label: 'Discover', slices: ['Search catalogue', 'Saved preferences'] },
          { label: 'Choose', slices: ['Compare options', 'Recommendations'] },
          { label: 'Buy', slices: ['Basic checkout', 'Multiple payment methods'] },
          { label: 'Use', slices: ['Order tracking', 'Service history'] },
        ],
        cutAfter: 0,
      },
    },
  ],
  (ctx, c) => {
    if (
      c.activities.some((v) => v.slices.length !== c.releases.length) ||
      (c.cutAfter !== undefined && c.cutAfter >= c.releases.length)
    ) {
      problem(
        ctx,
        'Every activity needs one explicit slice per release and a valid cut line',
        'activities',
      );
      return;
    }
    const b = ctx.body,
      left = 1.3,
      w = (b.w - left) / c.activities.length,
      h = (b.h - 0.7) / c.releases.length;
    c.activities.forEach((a, i) =>
      label(
        ctx,
        a.label,
        { x: b.x + left + i * w, y: b.y, w: w - 0.1, h: 0.55 },
        `activities/${i}/label`,
        { bold: true, align: 'center' },
      ),
    );
    c.releases.forEach((r, ri) => {
      const y = b.y + 0.7 + ri * h;
      label(ctx, r, { x: b.x, y, w: left - 0.15, h: h - 0.2 }, `releases/${ri}`, {
        bold: true,
        size: 'small',
      });
      c.activities.forEach((a, ci) => {
        const box = { x: b.x + left + ci * w, y, w: w - 0.12, h: h - 0.24 };
        panel(ctx, box, ri === 0);
        label(
          ctx,
          a.slices[ri]!,
          { x: box.x + 0.12, y: box.y + 0.08, w: box.w - 0.24, h: box.h - 0.16 },
          `activities/${ci}/slices/${ri}`,
        );
      });
      if (c.cutAfter === ri)
        ctx.line(
          b.x,
          y + h - 0.1,
          b.x + b.w,
          y + h - 0.1,
          { color: ctx.colors.accent, width: 1.5, dash: 'dash' },
          { role: 'release-cut' },
        );
    });
  },
  'Use for a narrative activity backbone crossed by explicit release slices and a scope cut line.',
  'sequence',
);

const access = z.enum(['none', 'read', 'write', 'admin']);
const securitySchema = z
  .object({
    roles: z.array(z.string().min(1).max(28)).min(2).max(6),
    resources: z.array(z.string().min(1).max(28)).min(2).max(6),
    permissions: z.array(z.array(access).min(2).max(6)).min(2).max(6),
  })
  .strict();
export const securityMatrix = diagramDef(
  'security-matrix',
  'Access permissions matrix',
  securitySchema,
  [
    {
      title: 'Operational access is limited to the resources each role needs',
      sources,
      content: {
        roles: ['Analyst', 'Operator', 'Administrator'],
        resources: ['Reports', 'Pipeline', 'Identity'],
        permissions: [
          ['read', 'none', 'none'],
          ['read', 'write', 'none'],
          ['admin', 'admin', 'admin'],
        ],
      },
    },
  ],
  (ctx, c) => {
    if (
      c.permissions.length !== c.roles.length ||
      c.permissions.some((v) => v.length !== c.resources.length) ||
      new Set(c.roles).size !== c.roles.length ||
      new Set(c.resources).size !== c.resources.length
    ) {
      problem(ctx, 'Permissions must match unique role and resource axes', 'permissions');
      return;
    }
    const table = ctx.table(
      {
        header: ['Role', ...c.resources],
        rows: c.roles.map((name, i) => [name, ...c.permissions[i]!]),
        field: 'permissions',
      },
      ctx.body,
    );
    table.cells.slice(1).forEach((row) =>
      row.slice(1).forEach((cell) => {
        const t = cell.text.paragraphs.flatMap((p) => p.runs.map((r) => r.text)).join('');
        if (t !== 'none')
          cell.fill = mix(ctx.colors.background, ctx.colors.accent, t === 'admin' ? 0.12 : 0.05);
      }),
    );
  },
  'Use for explicit per-role resource permissions; access rights are distinct from RACI responsibility.',
);

const part = z
  .object({
    id: DiagramId,
    label: z.string().min(1).max(24),
    x: z.number().min(0).max(10),
    y: z.number().min(0).max(10),
    width: z.number().positive().max(10),
    depth: z.number().positive().max(10),
    height: z.number().positive().max(5),
    level: z.number().int().min(0).max(5).default(0),
  })
  .strict();
const spatialSchema = z.object({ parts: z.array(part).min(2).max(6) }).strict();
function spatial(id: string, name: string, exploded: boolean) {
  return diagramDef(
    id,
    name,
    spatialSchema,
    [
      {
        title: exploded
          ? 'Separate layers make the product assembly easier to inspect'
          : 'The plan preserves the relative positions of the service areas',
        sources,
        content: {
          parts: exploded
            ? [
                {
                  id: 'base',
                  label: 'Foundation',
                  x: 0,
                  y: 0,
                  width: 4,
                  depth: 3,
                  height: 0.3,
                  level: 0,
                },
                {
                  id: 'service',
                  label: 'Service layer',
                  x: 0,
                  y: 0,
                  width: 4,
                  depth: 3,
                  height: 0.3,
                  level: 1,
                },
                {
                  id: 'experience',
                  label: 'Experience',
                  x: 0,
                  y: 0,
                  width: 4,
                  depth: 3,
                  height: 0.3,
                  level: 2,
                },
              ]
            : [
                { id: 'work', label: 'Workspace', x: 0, y: 0, width: 4, depth: 3, height: 1 },
                { id: 'support', label: 'Support', x: 4.3, y: 0, width: 2, depth: 3, height: 1 },
                { id: 'entry', label: 'Entry', x: 0, y: 3.3, width: 2, depth: 1.5, height: 0.5 },
              ],
        },
      },
    ],
    (ctx, c) => {
      if (new Set(c.parts.map((p) => p.id)).size !== c.parts.length) {
        problem(ctx, 'Spatial part IDs must be unique', 'parts');
        return;
      }
      if (
        !exploded &&
        c.parts.some((p, i) =>
          c.parts
            .slice(0, i)
            .some(
              (q) =>
                Math.min(p.x + p.width, q.x + q.width) > Math.max(p.x, q.x) &&
                Math.min(p.y + p.depth, q.y + q.depth) > Math.max(p.y, q.y),
            ),
        )
      ) {
        problem(ctx, 'Plan footprints overlap; correct the spatial data', 'parts');
        return;
      }
      const project = (x: number, y: number, z: number): [number, number] => [
        x - y,
        (x + y) / 2 - z,
      ];
      const shapes = c.parts.map((p, i) => {
        const z = exploded
          ? p.level * (Math.max(...c.parts.map((v) => (v.width + v.depth) / 2 + v.height)) + 0.6)
          : 0;
        const top = [
          [p.x, p.y],
          [p.x + p.width, p.y],
          [p.x + p.width, p.y + p.depth],
          [p.x, p.y + p.depth],
        ].map(([x, y]) => project(x!, y!, z + p.height));
        const base = [
          [p.x, p.y],
          [p.x + p.width, p.y],
          [p.x + p.width, p.y + p.depth],
          [p.x, p.y + p.depth],
        ].map(([x, y]) => project(x!, y!, z));
        return { p, i, top, base };
      });
      const points = shapes.flatMap((v) => [...v.top, ...v.base]),
        minX = Math.min(...points.map((p) => p[0])),
        maxX = Math.max(...points.map((p) => p[0])),
        minY = Math.min(...points.map((p) => p[1])),
        maxY = Math.max(...points.map((p) => p[1])),
        b = ctx.body,
        k = Math.min((b.w - 1) / (maxX - minX), (b.h - 0.4) / (maxY - minY));
      const fit = ([x, y]: [number, number]): [number, number] => [
        b.x + (b.w - (maxX - minX) * k) / 2 + (x - minX) * k,
        b.y + 0.2 + (y - minY) * k,
      ];
      shapes
        .sort((a, d) => (exploded ? a.p.level - d.p.level : a.p.x + a.p.y - d.p.x - d.p.y))
        .forEach(({ p, i, top, base }) => {
          const fill = i === 0 ? ctx.colors.accentSoft : ctx.colors.surface;
          ctx.polygon([top[1]!, top[2]!, base[2]!, base[1]!].map(fit), {
            fill: mix(fill, ctx.colors.ink, 0.08),
            stroke: { color: ctx.colors.rule, width: 0.7 },
          });
          ctx.polygon([top[2]!, top[3]!, base[3]!, base[2]!].map(fit), {
            fill: mix(fill, ctx.colors.ink, 0.04),
            stroke: { color: ctx.colors.rule, width: 0.7 },
          });
          ctx.polygon(top.map(fit), {
            fill,
            stroke: { color: i === 0 ? ctx.colors.accent : ctx.colors.rule, width: 0.9 },
            role: 'axonometric-top',
          });
          const pts = top.map(fit),
            cx = pts.reduce((s, v) => s + v[0], 0) / 4,
            cy = pts.reduce((s, v) => s + v[1], 0) / 4;
          label(ctx, p.label, { x: cx - 0.95, y: cy - 0.18, w: 1.9, h: 0.36 }, `parts/${i}/label`, {
            size: 'small',
            align: 'center',
            bold: true,
          });
        });
    },
    exploded
      ? 'Use for parts pulled apart along one projection axis; levels determine the assembly separation.'
      : 'Use for non-overlapping spatial footprints on one shared dimetric plan, preserving relative positions.',
  );
}
export const explodedAxonometric = spatial('exploded-axonometric', 'Exploded axonometric', true);
export const axonometricPlan = spatial('axonometric-plan', 'Axonometric plan', false);
