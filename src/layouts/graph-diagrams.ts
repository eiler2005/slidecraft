import { z } from 'zod';
import { cols } from '../engine/format.ts';
import {
  caption,
  DiagramId,
  DiagramLabel,
  diagramDef,
  drawGraph,
  Graph,
  GraphEdge,
  graphBoxes,
  label,
  problem,
} from './diagram-kit.ts';

const sources = ['illustrative'];
const deltaSchema = z
  .object({
    before: Graph,
    after: Graph,
    beforeLabel: z.string().max(30).default('Before'),
    afterLabel: z.string().max(30).default('After'),
  })
  .strict();
export function topologyChanges(
  before: z.infer<typeof Graph>,
  after: z.infer<typeof Graph>,
): string[] {
  const changes: string[] = [];
  for (const a of before.nodes) {
    const b = after.nodes.find((n) => n.id === a.id);
    if (!b) {
      changes.push(`REMOVED · ${a.label}`);
      continue;
    }
    if (a.label !== b.label || a.detail !== b.detail || a.shape !== b.shape)
      changes.push(`CHANGED · ${a.label} → ${b.label}`);
    if (a.column !== b.column || a.row !== b.row) changes.push(`MOVED · ${b.label}`);
  }
  for (const b of after.nodes)
    if (!before.nodes.some((a) => a.id === b.id)) changes.push(`ADDED · ${b.label}`);
  for (const a of before.edges) {
    const b = after.edges.find((e) => e.id === a.id);
    if (!b) changes.push(`REMOVED · ${a.id}`);
    else if (a.from !== b.from || a.to !== b.to)
      changes.push(`REWIRED · ${a.id}: ${b.from} → ${b.to}`);
    else if (a.label !== b.label || a.dashed !== b.dashed) changes.push(`CHANGED · ${a.id}`);
  }
  for (const b of after.edges)
    if (!before.edges.some((a) => a.id === b.id)) changes.push(`ADDED · ${b.id}`);
  return changes;
}
export const architectureDelta = diagramDef(
  'architecture-delta',
  'Architecture delta',
  deltaSchema,
  [
    {
      title: 'A durable queue separates order acceptance from fulfilment',
      sources,
      content: {
        before: {
          nodes: [
            { id: 'web', label: 'Storefront', column: 0, row: 0 },
            { id: 'api', label: 'Order API', column: 1, row: 0 },
            { id: 'worker', label: 'Worker', column: 1, row: 1 },
          ],
          edges: [
            { id: 'call', from: 'web', to: 'api' },
            { id: 'dispatch', from: 'api', to: 'worker' },
          ],
        },
        after: {
          nodes: [
            { id: 'web', label: 'Storefront', column: 0, row: 0 },
            { id: 'api', label: 'Order API', column: 1, row: 0 },
            { id: 'worker', label: 'Worker', column: 1, row: 1 },
            { id: 'queue', label: 'Queue', column: 0, row: 1, highlight: true },
          ],
          edges: [
            { id: 'call', from: 'web', to: 'api' },
            { id: 'dispatch', from: 'api', to: 'queue' },
            { id: 'consume', from: 'queue', to: 'worker' },
          ],
        },
      },
    },
  ],
  (ctx, c) => {
    if ([...c.before.edges, ...c.after.edges].some((e) => !e.id)) {
      problem(ctx, 'Architecture delta requires stable IDs on every relationship', 'before/edges');
      return;
    }
    if (new Set([...c.before.nodes, ...c.after.nodes].map((n) => n.id)).size > 8) {
      problem(ctx, 'Compare at most eight unique components; split by subsystem', 'after/nodes');
      return;
    }
    const changes = topologyChanges(c.before, c.after);
    if (changes.length > 8) {
      problem(ctx, 'More than eight changes require a detail slide', 'after');
      return;
    }
    const b = ctx.body,
      ledgerH = 0.35 + Math.ceil(Math.max(1, changes.length) / 3) * 0.36;
    const regions = cols({ ...b, y: b.y + 0.45, h: b.h - ledgerH - 0.65 }, [1, 1], 0.5);
    const all = [...c.before.nodes, ...c.after.nodes];
    const maxCol = Math.max(...all.map((n) => n.column)),
      maxRow = Math.max(...all.map((n) => n.row));
    [c.before, c.after].forEach((graph, i) => {
      const area = regions[i]!;
      label(
        ctx,
        i === 0 ? c.beforeLabel : c.afterLabel,
        { x: area.x, y: b.y, w: area.w, h: 0.35 },
        i === 0 ? 'beforeLabel' : 'afterLabel',
        { bold: true },
      );
      // Both snapshots use the union grid, so additions never move retained nodes.
      const grid = [
        ...graph.nodes,
        { id: '__grid-extent__', label: '', column: maxCol, row: maxRow },
      ];
      let boxes: ReturnType<typeof graphBoxes>;
      try {
        boxes = graphBoxes(area, grid);
      } catch (e) {
        problem(ctx, (e as Error).message);
        return;
      }
      boxes.delete('__grid-extent__');
      const other = i === 0 ? c.after : c.before;
      drawGraph(
        ctx,
        area,
        {
          ...graph,
          nodes: graph.nodes.map((n) => ({
            ...n,
            highlight: n.highlight || !other.nodes.some((v) => v.id === n.id),
          })),
        },
        i === 0 ? 'before' : 'after',
        boxes,
      );
    });
    const w = b.w / 3;
    (changes.length ? changes : ['No structural changes']).forEach((text, i) =>
      caption(ctx, text, {
        x: b.x + (i % 3) * w,
        y: b.y + b.h - ledgerH + Math.floor(i / 3) * 0.36,
        w: w - 0.16,
        h: 0.34,
      }),
    );
  },
  'Use for two synchronized system topologies with stable identities and a computed change ledger.',
);

const laneSchema = z
  .object({
    lanes: z
      .array(z.object({ id: DiagramId, label: DiagramLabel.max(28) }).strict())
      .min(2)
      .max(4),
    steps: z
      .array(
        z
          .object({
            id: DiagramId,
            label: DiagramLabel,
            lane: DiagramId,
            stage: z.number().int().min(0).max(4),
            highlight: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(10),
    edges: z.array(GraphEdge).max(12),
  })
  .strict();
export const swimlane = diagramDef(
  'swimlane',
  'Cross-functional swimlane',
  laneSchema,
  [
    {
      title: 'Operations takes ownership after the sales handoff',
      sources,
      content: {
        lanes: [
          { id: 'sales', label: 'Sales' },
          { id: 'ops', label: 'Operations' },
          { id: 'finance', label: 'Finance' },
        ],
        steps: [
          { id: 'request', label: 'Confirm scope', lane: 'sales', stage: 0 },
          { id: 'deliver', label: 'Deliver service', lane: 'ops', stage: 1, highlight: true },
          { id: 'bill', label: 'Issue invoice', lane: 'finance', stage: 2 },
        ],
        edges: [
          { from: 'request', to: 'deliver' },
          { from: 'deliver', to: 'bill' },
        ],
      },
    },
  ],
  (ctx, c) => {
    if (
      new Set(c.lanes.map((v) => v.id)).size !== c.lanes.length ||
      c.steps.some((n) => !c.lanes.some((v) => v.id === n.lane))
    ) {
      problem(ctx, 'Every step needs one unique known lane', 'steps');
      return;
    }
    const b = ctx.body,
      left = Math.min(1.5, b.w * 0.17),
      h = b.h / c.lanes.length;
    c.lanes.forEach((lane, i) => {
      ctx.rect(
        { x: b.x, y: b.y + i * h, w: b.w, h: h - 0.04 },
        { fill: i % 2 ? ctx.colors.surface : ctx.colors.background, role: 'swimlane-band' },
      );
      label(
        ctx,
        lane.label,
        { x: b.x + 0.1, y: b.y + i * h, w: left - 0.2, h },
        `lanes/${i}/label`,
        { bold: true },
      );
    });
    drawGraph(
      ctx,
      { x: b.x + left, y: b.y, w: b.w - left, h: b.h },
      {
        nodes: c.steps.map((n) => ({
          id: n.id,
          label: n.label,
          column: n.stage,
          row: c.lanes.findIndex((v) => v.id === n.lane),
          highlight: n.highlight,
        })),
        edges: c.edges,
      },
      'flow',
    );
  },
  'Use for a process whose steps cross named owners through explicit handoffs.',
  'sequence',
);

export const dependencyGraph = diagramDef(
  'dependency-graph',
  'Dependency graph',
  Graph,
  [
    {
      title: 'The application and reporting both depend on the shared data service',
      sources,
      content: {
        nodes: [
          { id: 'app', label: 'Application', column: 0, row: 0 },
          { id: 'report', label: 'Reporting', column: 0, row: 1 },
          { id: 'data', label: 'Data service', column: 1, row: 0, highlight: true },
          { id: 'store', label: 'Database', column: 2, row: 0 },
        ],
        edges: [
          { from: 'app', to: 'data' },
          { from: 'report', to: 'data' },
          { from: 'data', to: 'store' },
        ],
      },
    },
  ],
  (ctx, c) => drawGraph(ctx, ctx.body, c),
  'Use for directed dependencies with shared parents and explicitly represented cycles.',
);

export const flowchart = diagramDef(
  'flowchart',
  'Decision flowchart',
  Graph,
  [
    {
      title: 'An explicit approval decision separates standard and exceptional orders',
      sources,
      content: {
        nodes: [
          { id: 'start', label: 'Receive order', column: 0, row: 0, shape: 'terminal' },
          { id: 'check', label: 'Approved?', column: 1, row: 0, shape: 'decision' },
          { id: 'ship', label: 'Ship order', column: 2, row: 0 },
          { id: 'review', label: 'Manual review', column: 1, row: 1 },
        ],
        edges: [
          { from: 'start', to: 'check' },
          { from: 'check', to: 'ship', label: 'Yes' },
          { from: 'check', to: 'review', label: 'No' },
        ],
      },
    },
  ],
  (ctx, c) => {
    for (const node of c.nodes)
      if (node.shape === 'decision') {
        const choices = c.edges.filter((e) => e.from === node.id);
        if (
          choices.length < 2 ||
          choices.some((e) => !e.label) ||
          new Set(choices.map((e) => e.label)).size !== choices.length
        ) {
          problem(ctx, 'Decisions require at least two distinctly labelled branches', 'edges');
          return;
        }
      }
    drawGraph(ctx, ctx.body, c);
  },
  'Use for decision logic with labelled branches, merges and bounded return paths.',
  'sequence',
);

const stateSchema = Graph.extend({
  initial: DiagramId,
  terminal: z.array(DiagramId).min(1).max(4),
}).strict();
export const stateMachine = diagramDef(
  'state-machine',
  'State machine',
  stateSchema,
  [
    {
      title: 'An order ends only after fulfilment or explicit cancellation',
      sources,
      content: {
        initial: 'new',
        terminal: ['done', 'cancelled'],
        nodes: [
          { id: 'new', label: 'New', column: 0, row: 0 },
          { id: 'processing', label: 'Processing', column: 1, row: 0 },
          { id: 'done', label: 'Completed', column: 2, row: 0 },
          { id: 'cancelled', label: 'Cancelled', column: 1, row: 1 },
        ],
        edges: [
          { from: 'new', to: 'processing', label: 'Accept' },
          { from: 'processing', to: 'done', label: 'Fulfil' },
          { from: 'processing', to: 'cancelled', label: 'Cancel' },
        ],
      },
    },
  ],
  (ctx, c) => {
    if (
      !c.nodes.some((n) => n.id === c.initial) ||
      c.terminal.some((id) => !c.nodes.some((n) => n.id === id)) ||
      c.edges.some((e) => c.terminal.includes(e.from))
    ) {
      problem(
        ctx,
        'Initial and terminal IDs must exist; terminals cannot have outgoing transitions',
        'terminal',
      );
      return;
    }
    const reached = new Set([c.initial]);
    for (let i = 0; i < c.nodes.length; i++)
      for (const e of c.edges) if (reached.has(e.from)) reached.add(e.to);
    if (c.nodes.some((n) => !reached.has(n.id))) {
      problem(ctx, 'Every state must be reachable from the initial state', 'nodes');
      return;
    }
    drawGraph(ctx, ctx.body, {
      nodes: c.nodes.map((n) => ({
        ...n,
        shape: c.terminal.includes(n.id) ? 'terminal' : 'state',
        highlight: n.id === c.initial,
      })),
      edges: c.edges,
    });
  },
  'Use for one subject progressing through named states, guarded transitions and terminal outcomes.',
  'sequence',
);
