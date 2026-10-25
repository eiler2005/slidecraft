import { z } from 'zod';
import { roundedRoute, routeOrthogonal } from '../engine/diagram-routing.ts';
import { cols } from '../engine/format.ts';
import {
  caption,
  DiagramId,
  DiagramLabel,
  diagramDef,
  label,
  panel,
  problem,
} from './diagram-kit.ts';

const sources = ['illustrative'];
const sequenceSchema = z
  .object({
    participants: z
      .array(z.object({ id: DiagramId, label: DiagramLabel }).strict())
      .min(2)
      .max(6),
    messages: z
      .array(
        z
          .object({
            from: DiagramId,
            to: DiagramId,
            label: z.string().min(1).max(48),
            kind: z.enum(['call', 'return']).default('call'),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();
export const sequence = diagramDef(
  'sequence',
  'Sequence diagram',
  sequenceSchema,
  [
    {
      title: 'Payment confirmation precedes order acceptance',
      sources,
      content: {
        participants: [
          { id: 'client', label: 'Customer' },
          { id: 'api', label: 'Order service' },
          { id: 'payment', label: 'Payment gateway' },
        ],
        messages: [
          { from: 'client', to: 'api', label: 'Place order' },
          { from: 'api', to: 'payment', label: 'Authorize payment' },
          { from: 'payment', to: 'api', label: 'Payment confirmed', kind: 'return' },
          { from: 'api', to: 'client', label: 'Order accepted', kind: 'return' },
        ],
      },
    },
  ],
  (ctx, c) => {
    const ids = c.participants.map((p) => p.id);
    if (
      new Set(ids).size !== ids.length ||
      c.messages.some((m) => !ids.includes(m.from) || !ids.includes(m.to))
    ) {
      problem(
        ctx,
        'Sequence participants must be unique and every message must have known endpoints',
        'messages',
      );
      return;
    }
    const b = ctx.body,
      pitch = b.w / c.participants.length,
      x = (id: string) => b.x + (ids.indexOf(id) + 0.5) * pitch;
    c.participants.forEach((p, i) => {
      const box = {
        x: x(p.id) - Math.min(1, pitch * 0.4),
        y: b.y,
        w: Math.min(2, pitch * 0.8),
        h: 0.6,
      };
      panel(ctx, box);
      label(
        ctx,
        p.label,
        { x: box.x + 0.08, y: box.y + 0.05, w: box.w - 0.16, h: 0.5 },
        `participants/${i}/label`,
        { bold: true, align: 'center' },
      );
      ctx.line(
        x(p.id),
        b.y + 0.65,
        x(p.id),
        b.y + b.h,
        { color: ctx.colors.rule, width: 0.8, dash: 'dash' },
        { role: 'sequence-lifeline' },
      );
    });
    const row = (b.h - 1) / c.messages.length;
    if (row < 0.34) {
      problem(ctx, 'Sequence needs fewer messages or a taller region', 'messages');
      return;
    }
    c.messages.forEach((m, i) => {
      const a = x(m.from),
        d = x(m.to),
        y = b.y + 1 + i * row;
      const stroke = {
        color: m.kind === 'return' ? ctx.colors.muted : ctx.colors.ink,
        width: 1,
        ...(m.kind === 'return' ? { dash: 'dash' as const } : {}),
      };
      if (m.from === m.to) {
        const dx = Math.min(0.5, pitch * 0.3);
        ctx.line(a, y, a + dx, y, stroke);
        ctx.line(a + dx, y, a + dx, y + row * 0.45, stroke);
        ctx.line(a + dx, y + row * 0.45, a, y + row * 0.45, stroke, { arrowEnd: true });
        label(
          ctx,
          m.label,
          { x: a + 0.08, y: y - 0.3, w: Math.min(pitch * 0.8, 2.5), h: 0.28 },
          `messages/${i}/label`,
          { size: 'small' },
        );
      } else {
        ctx.line(a, y, d, y, stroke, { arrowEnd: true, role: 'sequence-message' });
        label(
          ctx,
          m.label,
          { x: Math.min(a, d) + 0.08, y: y - 0.32, w: Math.abs(d - a) - 0.16, h: 0.28 },
          `messages/${i}/label`,
          { size: 'small', align: 'center', maxLines: 1 },
        );
      }
    });
  },
  'Use for ordered messages between participants, including returns and self-calls; unsupported fragments require a detail view.',
  'sequence',
);

const field = z
  .object({
    id: DiagramId,
    label: z.string().min(1).max(26),
    type: z.string().max(18).optional(),
    key: z.enum(['PK', 'FK', 'PK/FK']).optional(),
  })
  .strict();
const entity = z
  .object({
    id: DiagramId,
    label: DiagramLabel,
    fields: z.array(field).min(1).max(6),
    operations: z.array(z.string().max(38)).max(3).default([]),
  })
  .strict();
const endpoint = z.object({ entity: DiagramId, field: DiagramId.optional() }).strict();
const modelSchema = z
  .object({
    entities: z.array(entity).min(2).max(4),
    relationships: z
      .array(
        z
          .object({
            from: endpoint,
            to: endpoint,
            kind: z
              .enum([
                'one-one',
                'one-many',
                'many-many',
                'association',
                'inheritance',
                'composition',
                'aggregation',
              ])
              .default('one-many'),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();
const entities = [
  {
    id: 'customer',
    label: 'Customer',
    fields: [
      { id: 'id', label: 'customer_id', type: 'UUID', key: 'PK' as const },
      { id: 'name', label: 'name', type: 'TEXT' },
    ],
  },
  {
    id: 'order',
    label: 'Order',
    fields: [
      { id: 'id', label: 'order_id', type: 'UUID', key: 'PK' as const },
      { id: 'customer', label: 'customer_id', type: 'UUID', key: 'FK' as const },
    ],
  },
];
function model(id: string, name: string, physical = false, uml = false) {
  return diagramDef(
    id,
    name,
    modelSchema,
    [
      {
        title: uml
          ? 'Order and customer classes expose different operations'
          : 'Each order references one customer through its customer key',
        sources,
        content: {
          entities: uml
            ? entities.map((e) => ({
                ...e,
                operations: e.id === 'order' ? ['submit()', 'cancel()'] : ['updateProfile()'],
              }))
            : entities,
          relationships: [
            {
              from: { entity: 'customer', ...(physical ? { field: 'id' } : {}) },
              to: { entity: 'order', ...(physical ? { field: 'customer' } : {}) },
              kind: 'one-many',
            },
          ],
        },
      },
    ],
    (ctx, c) => {
      if (
        new Set(c.entities.map((e) => e.id)).size !== c.entities.length ||
        c.entities.some((e) => new Set(e.fields.map((f) => f.id)).size !== e.fields.length)
      ) {
        problem(ctx, 'Entity and field IDs must be unique within their scope', 'entities');
        return;
      }
      if (!uml && c.entities.some((e) => e.operations.length)) {
        problem(ctx, 'Operations belong in a UML class diagram', 'entities');
        return;
      }
      for (const r of c.relationships)
        for (const end of [r.from, r.to]) {
          const e = c.entities.find((v) => v.id === end.entity);
          if (
            !e ||
            (physical && !end.field) ||
            (end.field && !e.fields.some((f) => f.id === end.field))
          ) {
            problem(
              ctx,
              'Relationships must name known entities and, for physical schemas, exact fields',
              'relationships',
            );
            return;
          }
        }
      const b = ctx.body,
        regions = cols(
          b,
          c.entities.map(() => 1),
          0.75,
        ),
        boxes = new Map<string, typeof b>();
      const rowH = 0.42;
      c.entities.forEach((e, i) => {
        const a = regions[i]!,
          h =
            0.6 +
            e.fields.length * rowH +
            (uml && e.operations.length ? 0.2 + e.operations.length * rowH : 0);
        if (h > b.h) {
          problem(ctx, 'Entity compartments exceed the available height', 'entities');
          return;
        }
        boxes.set(e.id, { x: a.x, y: b.y + (b.h - h) / 2, w: a.w, h });
      });
      if (boxes.size !== c.entities.length) return;
      c.relationships.forEach((r, i) => {
        const a = boxes.get(r.from.entity)!,
          d = boxes.get(r.to.entity)!,
          forward = d.x > a.x;
        const py = (end: z.infer<typeof endpoint>, box: typeof b) =>
          end.field
            ? box.y +
              0.6 +
              (c.entities
                .find((e) => e.id === end.entity)!
                .fields.findIndex((f) => f.id === end.field) +
                0.5) *
                rowH
            : box.y + 0.3;
        const p: [number, number] = [forward ? a.x + a.w : a.x, py(r.from, a)],
          q: [number, number] = [forward ? d.x : d.x + d.w, py(r.to, d)];
        const sign = forward ? 1 : -1;
        try {
          const route = [
            p,
            ...routeOrthogonal(
              [p[0] + sign * 0.12, p[1]],
              [q[0] - sign * 0.12, q[1]],
              [...boxes.values()],
              b,
            ),
            q,
          ];
          ctx.path(roundedRoute(route), {
            stroke: { color: ctx.colors.muted, width: 1 },
            role: 'model-relationship',
            pointer: ctx.ptr(`relationships/${i}`),
          });
        } catch (e) {
          problem(ctx, (e as Error).message, `relationships/${i}`);
        }
        if (r.kind === 'inheritance')
          ctx.polygon([q, [q[0] - sign * 0.14, q[1] - 0.09], [q[0] - sign * 0.14, q[1] + 0.09]], {
            fill: ctx.colors.background,
            stroke: { color: ctx.colors.ink, width: 1 },
            role: 'inheritance-head',
          });
        else if (r.kind === 'composition' || r.kind === 'aggregation')
          ctx.polygon(
            [
              p,
              [p[0] + sign * 0.09, p[1] - 0.06],
              [p[0] + sign * 0.18, p[1]],
              [p[0] + sign * 0.09, p[1] + 0.06],
            ],
            {
              fill: r.kind === 'composition' ? ctx.colors.ink : ctx.colors.background,
              stroke: { color: ctx.colors.ink, width: 1 },
              role: 'ownership-head',
            },
          );
        else {
          caption(ctx, r.kind === 'many-many' ? 'N' : '1', {
            x: p[0] + (forward ? 0.05 : -0.3),
            y: p[1] - 0.35,
            w: 0.25,
            h: 0.25,
          });
          caption(ctx, r.kind === 'one-one' ? '1' : r.kind === 'association' ? '—' : 'N', {
            x: q[0] + (forward ? -0.3 : 0.05),
            y: q[1] - 0.35,
            w: 0.25,
            h: 0.25,
          });
        }
      });
      c.entities.forEach((e, i) => {
        const box = boxes.get(e.id)!;
        panel(ctx, box);
        ctx.rect(
          { x: box.x, y: box.y, w: box.w, h: 0.55 },
          { fill: ctx.colors.accentSoft, role: 'entity-header' },
        );
        label(
          ctx,
          e.label,
          { x: box.x + 0.12, y: box.y + 0.05, w: box.w - 0.24, h: 0.45 },
          `entities/${i}/label`,
          { bold: true },
        );
        e.fields.forEach((f, j) =>
          label(
            ctx,
            `${f.key ? `${f.key} · ` : ''}${f.label}${f.type ? ` : ${f.type}` : ''}`,
            { x: box.x + 0.12, y: box.y + 0.6 + j * rowH, w: box.w - 0.24, h: rowH },
            `entities/${i}/fields/${j}/label`,
            { size: 'small' },
          ),
        );
        if (uml && e.operations.length) {
          const y = box.y + 0.6 + e.fields.length * rowH + 0.1;
          ctx.line(box.x, y, box.x + box.w, y, { color: ctx.colors.rule, width: 0.8 });
          e.operations.forEach((op, j) =>
            label(
              ctx,
              op,
              { x: box.x + 0.12, y: y + 0.1 + j * rowH, w: box.w - 0.24, h: rowH },
              `entities/${i}/operations/${j}`,
              { size: 'small' },
            ),
          );
        }
      });
    },
    physical
      ? 'Use for physical tables and exact column-to-column foreign-key relationships.'
      : uml
        ? 'Use for classes with attributes, operations and typed inheritance or ownership relationships.'
        : 'Use for entities, attributes and explicit cardinality; physical foreign keys use database-schema.',
  );
}
export const erDiagram = model('er-diagram', 'Entity relationship model');
export const databaseSchema = model('database-schema', 'Physical database schema', true);
export const umlClass = model('uml-class', 'UML class model', false, true);
