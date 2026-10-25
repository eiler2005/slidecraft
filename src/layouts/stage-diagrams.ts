import { z } from 'zod';
import type { Box } from '../engine/scene.ts';
import {
  caption,
  DiagramId,
  DiagramLabel,
  diagramDef,
  dot,
  label,
  panel,
  problem,
} from './diagram-kit.ts';
import type { ComposeContext } from './types.ts';

const sources = ['illustrative'];

const loopSchema = z
  .object({
    steps: z
      .array(
        z.object({ label: DiagramLabel.max(28), detail: z.string().max(60).optional() }).strict(),
      )
      .min(3)
      .max(6),
    hub: z.string().max(60).optional(),
    evidence: z
      .string()
      .min(1)
      .max(100)
      .describe('Evidence or explicit hypothesis for reinforcement'),
  })
  .strict();
export const loop = diagramDef(
  'loop',
  'Loop and flywheel',
  loopSchema,
  [
    {
      title: 'Customer learning improves the service and encourages repeat use',
      sources,
      content: {
        steps: [
          { label: 'Use service' },
          { label: 'Share feedback' },
          { label: 'Improve product' },
          { label: 'Return' },
        ],
        hub: 'Shared learning',
        evidence: 'Illustrative hypothesis',
      },
    },
  ],
  (ctx, c) => {
    const b = ctx.body,
      cx = b.x + b.w / 2,
      cy = b.y + (b.h - 0.4) / 2,
      rx = b.w * 0.34,
      ry = (b.h - 1.1) * 0.37;
    const points = c.steps.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / c.steps.length;
      return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
    });
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length]!;
      const dx = q.x - p.x,
        dy = q.y - p.y;
      const stop = Math.min(
        Math.abs(dx) > 1e-9 ? 0.88 / Math.abs(dx) : Infinity,
        Math.abs(dy) > 1e-9 ? 0.38 / Math.abs(dy) : Infinity,
      );
      // Lines are cycle relationships, not the orthogonal graph-port grammar.
      ctx.line(
        p.x + dx * stop,
        p.y + dy * stop,
        q.x - dx * stop,
        q.y - dy * stop,
        { color: ctx.colors.muted, width: 1.3 },
        { arrowEnd: true, role: 'cycle-link' },
      );
    });
    c.steps.forEach((step, i) => {
      const p = points[i]!,
        box = { x: p.x - 0.85, y: p.y - 0.35, w: 1.7, h: 0.7 };
      panel(ctx, box, i === 0);
      label(
        ctx,
        step.label,
        { x: box.x + 0.1, y: box.y + 0.06, w: box.w - 0.2, h: box.h - 0.12 },
        `steps/${i}/label`,
        { bold: true, align: 'center' },
      );
    });
    if (c.hub)
      label(ctx, c.hub, { x: cx - 1.1, y: cy - 0.3, w: 2.2, h: 0.6 }, 'hub', {
        bold: true,
        align: 'center',
        color: ctx.colors.accent,
      });
    caption(ctx, c.evidence, { x: b.x, y: b.y + b.h - 0.3, w: b.w, h: 0.3 }, 'evidence');
  },
  'Use for a closed reinforcing cycle, with an optional accumulated result and explicit evidence.',
  'sequence',
);

const layersSchema = z
  .object({
    layers: z
      .array(
        z
          .object({
            label: DiagramLabel,
            detail: z.string().max(100),
            highlight: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(5),
    direction: z.string().max(70).optional(),
  })
  .strict();
export const layerStack = diagramDef(
  'layer-stack',
  'Layer stack',
  layersSchema,
  [
    {
      title: 'Shared controls support every layer of the service',
      sources,
      content: {
        layers: [
          { label: 'Experience', detail: 'Customer channels and service interactions' },
          { label: 'Services', detail: 'Business capabilities and orchestration', highlight: true },
          { label: 'Data', detail: 'Trusted records and governed access' },
          { label: 'Platform', detail: 'Identity, observability and infrastructure' },
        ],
        direction: 'Higher layers depend on the foundation',
      },
    },
  ],
  (ctx, c) => {
    const b = ctx.body,
      gap = 0.14,
      h = (b.h - (c.direction ? 0.45 : 0) - gap * (c.layers.length - 1)) / c.layers.length;
    c.layers.forEach((item, i) => {
      const row = { x: b.x, y: b.y + i * (h + gap), w: b.w, h };
      panel(ctx, row, item.highlight);
      label(
        ctx,
        item.label,
        { x: row.x + 0.2, y: row.y + 0.08, w: row.w * 0.3 - 0.3, h: h - 0.16 },
        `layers/${i}/label`,
        { bold: true },
      );
      label(
        ctx,
        item.detail,
        { x: row.x + row.w * 0.3, y: row.y + 0.08, w: row.w * 0.7 - 0.2, h: h - 0.16 },
        `layers/${i}/detail`,
      );
    });
    if (c.direction)
      caption(ctx, c.direction, { x: b.x, y: b.y + b.h - 0.32, w: b.w, h: 0.32 }, 'direction');
  },
  'Use for ordered abstraction or control layers; band thickness carries no quantitative meaning.',
);

const kanbanSchema = z
  .object({
    columns: z
      .array(
        z
          .object({
            id: DiagramId,
            label: DiagramLabel,
            limit: z.number().int().positive().max(20).optional(),
            items: z
              .array(
                z
                  .object({ id: DiagramId, label: DiagramLabel, blocked: z.boolean().optional() })
                  .strict(),
              )
              .max(4),
          })
          .strict(),
      )
      .min(2)
      .max(5),
  })
  .strict();
export const kanban = diagramDef(
  'kanban',
  'Kanban snapshot',
  kanbanSchema,
  [
    {
      title: 'Blocked review work constrains the next delivery batch',
      sources,
      content: {
        columns: [
          { id: 'todo', label: 'Ready', items: [{ id: 'docs', label: 'Update guide' }] },
          {
            id: 'doing',
            label: 'In progress',
            limit: 2,
            items: [
              { id: 'api', label: 'API contract' },
              { id: 'tests', label: 'Integration tests' },
            ],
          },
          {
            id: 'review',
            label: 'Review',
            limit: 2,
            items: [{ id: 'security', label: 'Security review', blocked: true }],
          },
          { id: 'done', label: 'Done', items: [{ id: 'scope', label: 'Agreed scope' }] },
        ],
      },
    },
  ],
  (ctx, c) => {
    const items = c.columns.flatMap((col) => col.items),
      ids = items.map((v) => v.id);
    if (
      new Set(ids).size !== ids.length ||
      new Set(c.columns.map((v) => v.id)).size !== c.columns.length
    ) {
      problem(ctx, 'Board column and item IDs must be unique', 'columns');
      return;
    }
    const b = ctx.body,
      gap = 0.2,
      w = (b.w - gap * (c.columns.length - 1)) / c.columns.length;
    c.columns.forEach((col, i) => {
      const x = b.x + i * (w + gap);
      ctx.rect({ x, y: b.y, w, h: b.h }, { fill: ctx.colors.surface, role: 'kanban-column' });
      label(
        ctx,
        col.label,
        { x: x + 0.12, y: b.y + 0.08, w: w - 0.24, h: 0.45 },
        `columns/${i}/label`,
        { bold: true },
      );
      caption(
        ctx,
        `${col.items.length}${col.limit ? ` / WIP ${col.limit}` : ''}${col.limit && col.items.length > col.limit ? ' · over limit' : ''}`,
        { x: x + 0.12, y: b.y + 0.55, w: w - 0.24, h: 0.3 },
      );
      const h = Math.min(0.75, (b.h - 1.15) / Math.max(1, col.items.length) - 0.12);
      col.items.forEach((item, j) => {
        const box = { x: x + 0.12, y: b.y + 1 + j * (h + 0.12), w: w - 0.24, h };
        panel(ctx, box, item.blocked);
        label(
          ctx,
          `${item.blocked ? 'Blocked · ' : ''}${item.label}`,
          { x: box.x + 0.1, y: box.y + 0.06, w: box.w - 0.2, h: h - 0.12 },
          `columns/${i}/items/${j}/label`,
        );
      });
    });
  },
  'Use for a static work-in-progress census by state, with visible limits and blocked items.',
  'sequence',
);

function stageGrid(ctx: ComposeContext, b: Box, stages: string[], left = 1.45) {
  const w = (b.w - left) / stages.length;
  stages.forEach((s, i) =>
    label(ctx, s, { x: b.x + left + i * w, y: b.y, w: w - 0.08, h: 0.5 }, `stages/${i}`, {
      bold: true,
      align: 'center',
    }),
  );
  return { left, w, x: (i: number) => b.x + left + i * w };
}

const sentiment = z.enum(['low', 'medium-low', 'neutral', 'medium-high', 'high']);
const journeySchema = z
  .object({
    persona: z.string().max(40),
    evidence: z.string().min(1).max(100),
    stages: z
      .array(
        z
          .object({
            label: z.string().max(24),
            action: z.string().max(45),
            touchpoint: z.string().max(30),
            sentiment,
            pain: z.string().max(40).optional(),
          })
          .strict(),
      )
      .min(3)
      .max(6),
  })
  .strict();
export const userJourney = diagramDef(
  'user-journey',
  'User journey',
  journeySchema,
  [
    {
      title: 'Billing friction interrupts an otherwise smooth customer journey',
      sources,
      content: {
        persona: 'New subscriber',
        evidence: 'Illustrative research hypothesis',
        stages: [
          {
            label: 'Discover',
            action: 'Compare plans',
            touchpoint: 'Website',
            sentiment: 'medium-high',
          },
          { label: 'Sign up', action: 'Create account', touchpoint: 'App', sentiment: 'high' },
          {
            label: 'First bill',
            action: 'Resolve mismatch',
            touchpoint: 'Support',
            sentiment: 'low',
            pain: 'Unexpected charge',
          },
          { label: 'Continue', action: 'Resume use', touchpoint: 'App', sentiment: 'neutral' },
        ],
      },
    },
  ],
  (ctx, c) => {
    const b = ctx.body,
      g = stageGrid(
        ctx,
        b,
        c.stages.map((v) => v.label),
      ),
      top = b.y + 0.7,
      band = Math.min(1.6, b.h * 0.33);
    const levels = ['low', 'medium-low', 'neutral', 'medium-high', 'high'];
    const ys = c.stages.map((s) => top + band * (1 - levels.indexOf(s.sentiment) / 4));
    const min = Math.min(...c.stages.map((s) => levels.indexOf(s.sentiment)));
    [0, 2, 4].forEach((level) => {
      const y = top + band * (1 - level / 4);
      ctx.line(b.x + g.left, y, b.x + b.w, y, { color: ctx.colors.rule, width: 0.6 });
      caption(ctx, levels[level]!, { x: b.x, y: y - 0.15, w: g.left - 0.15, h: 0.3 });
    });
    c.stages.forEach((_s, i) => {
      const x = g.x(i) + g.w / 2;
      if (i)
        ctx.line(
          g.x(i - 1) + g.w / 2,
          ys[i - 1]!,
          x,
          ys[i]!,
          { color: ctx.colors.muted, width: 1.2 },
          { role: 'sentiment-curve' },
        );
    });
    c.stages.forEach((s, i) => {
      const x = g.x(i),
        focal = levels.indexOf(s.sentiment) === min;
      dot(ctx, x + g.w / 2, ys[i]!, 0.06, focal);
      label(
        ctx,
        s.action,
        { x, y: top + band + 0.35, w: g.w - 0.1, h: 0.65 },
        `stages/${i}/action`,
        { align: 'center' },
      );
      caption(
        ctx,
        s.touchpoint,
        { x, y: top + band + 1.05, w: g.w - 0.1, h: 0.4 },
        `stages/${i}/touchpoint`,
      );
      if (s.pain)
        label(ctx, s.pain, { x, y: top + band + 1.5, w: g.w - 0.1, h: 0.5 }, `stages/${i}/pain`, {
          size: 'small',
          color: ctx.colors.accent,
        });
    });
    caption(
      ctx,
      `${c.persona} · ${c.evidence}`,
      { x: b.x, y: b.y + b.h - 0.3, w: b.w, h: 0.3 },
      'evidence',
    );
  },
  'Use for one persona across experience stages, with sourced ordinal sentiment and explicit pain points.',
  'sequence',
);

const blueprintSchema = z
  .object({
    stages: z.array(z.string().min(1).max(24)).min(3).max(6),
    layers: z
      .array(
        z
          .object({
            kind: z.enum(['evidence', 'customer', 'frontstage', 'backstage', 'support']),
            label: z.string().min(1).max(24),
            actions: z.array(z.string().min(1).max(45)).min(3).max(6),
          })
          .strict(),
      )
      .min(3)
      .max(5),
    focal: z
      .object({ layer: z.string(), stage: z.number().int().min(0) })
      .strict()
      .optional(),
  })
  .strict();
export const serviceBlueprint = diagramDef(
  'service-blueprint',
  'Service blueprint',
  blueprintSchema,
  [
    {
      title: 'A hidden billing job causes the visible retry experience',
      sources,
      content: {
        stages: ['Sign up', 'Use', 'Upgrade', 'First bill'],
        layers: [
          {
            kind: 'customer',
            label: 'Customer',
            actions: ['Create account', 'Use product', 'Choose plan', 'Read bill'],
          },
          {
            kind: 'frontstage',
            label: 'Frontstage',
            actions: ['Welcome', 'Usage view', 'Checkout', 'Receipt'],
          },
          {
            kind: 'backstage',
            label: 'Backstage',
            actions: ['CRM write', 'Meter usage', 'Payment check', 'Billing job'],
          },
          {
            kind: 'support',
            label: 'Support',
            actions: ['Email', 'Analytics', 'Card processor', 'Ledger'],
          },
        ],
        focal: { layer: 'backstage', stage: 3 },
      },
    },
  ],
  (ctx, c) => {
    const order = ['evidence', 'customer', 'frontstage', 'backstage', 'support'],
      kinds = c.layers.map((v) => v.kind);
    if (
      !['customer', 'frontstage', 'backstage'].every((v) =>
        kinds.includes(v as (typeof kinds)[number]),
      ) ||
      new Set(kinds).size !== kinds.length ||
      c.layers.some((l) => l.actions.length !== c.stages.length) ||
      kinds.some((k, i) => i > 0 && order.indexOf(k) < order.indexOf(kinds[i - 1]!))
    ) {
      problem(
        ctx,
        'Blueprint needs ordered customer/frontstage/backstage rows and one explicit action or N/A per stage',
        'layers',
      );
      return;
    }
    if (
      c.focal &&
      (!kinds.includes(c.focal.layer as (typeof kinds)[number]) || c.focal.stage >= c.stages.length)
    ) {
      problem(ctx, 'Unknown focal blueprint cell', 'focal');
      return;
    }
    const b = ctx.body,
      g = stageGrid(ctx, b, c.stages),
      h = (b.h - 0.65) / c.layers.length;
    c.layers.forEach((row, ri) => {
      const y = b.y + 0.65 + ri * h,
        hidden = order.indexOf(row.kind) >= 3;
      label(ctx, row.label, { x: b.x, y, w: g.left - 0.18, h: h - 0.08 }, `layers/${ri}/label`, {
        bold: true,
        size: 'small',
      });
      if (row.kind === 'backstage')
        ctx.line(
          b.x,
          y - 0.06,
          b.x + b.w,
          y - 0.06,
          { color: ctx.colors.ink, width: 1.5 },
          { role: 'line-of-visibility' },
        );
      row.actions.forEach((text, ci) => {
        const focal = c.focal?.layer === row.kind && c.focal.stage === ci,
          box = { x: g.x(ci), y, w: g.w - 0.1, h: h - 0.14 };
        ctx.rect(box, {
          fill: focal ? ctx.colors.accentSoft : hidden ? ctx.colors.surface : ctx.colors.background,
          stroke: { color: focal ? ctx.colors.accent : ctx.colors.rule, width: focal ? 1.4 : 0.7 },
          radius: 0.04,
          role: `blueprint-${row.kind}`,
        });
        label(
          ctx,
          text,
          { x: box.x + 0.1, y: box.y + 0.06, w: box.w - 0.2, h: box.h - 0.12 },
          `layers/${ri}/actions/${ci}`,
          { align: 'center', bold: focal },
        );
      });
    });
  },
  'Use for customer, frontstage and backstage actions on one shared stage grid with a line of visibility.',
  'sequence',
);
