import { z } from 'zod';
import { cols } from '../engine/format.ts';
import type { Box } from '../engine/scene.ts';
import { diag } from '../qa/codes.ts';
import type { ComposeContext, LayoutDef } from './types.ts';

const Component = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]*$/)
      .max(20)
      .describe('Short key used by links'),
    label: z.string().max(28),
    marker: z.number().int().min(1).max(9).optional().describe('Register number shown on the box'),
    highlight: z.boolean().optional().describe('The component the slide is about'),
  })
  .strict();

const schema = z
  .object({
    zones: z
      .array(
        z
          .object({ name: z.string().max(24), components: z.array(Component).min(1).max(4) })
          .strict(),
      )
      .min(2)
      .max(4)
      .describe('Columns left to right, e.g. channels → services → data'),
    links: z
      .array(
        z
          .object({
            from: z.string(),
            to: z.string(),
            marker: z.number().int().min(1).max(9).optional(),
            dashed: z
              .boolean()
              .optional()
              .describe('Response or data returned, as opposed to a request'),
          })
          .strict(),
      )
      .max(8)
      .default([]),
    register: z
      .array(
        z
          .object({
            marker: z.number().int().min(1).max(9),
            title: z.string().max(40),
            text: z.string().max(110),
          })
          .strict(),
      )
      .min(1)
      .max(6)
      .describe('Numbered findings, risks or controls, linked to the markers on the diagram'),
  })
  .strict();

type C = z.infer<typeof schema>;

function badge(ctx: ComposeContext, cx: number, cy: number, n: number) {
  const r = 0.15;
  ctx.ellipse(
    { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r },
    { fill: ctx.colors.accent, role: 'marker' },
  );
  ctx.text(
    String(n),
    { x: cx - r - 0.05, y: cy - r, w: 2 * r + 0.1, h: 2 * r },
    {
      size: ctx.theme.type.small - 1,
      bold: true,
      color: ctx.colors.accentText,
      align: 'center',
      valign: 'middle',
      maxLines: 1,
      fixed: true,
    },
  );
}

/** Point where the segment from a box centre towards (tx, ty) leaves the box. */
function edge(b: Box, tx: number, ty: number): [number, number] {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const k = Math.min(
    dx ? b.w / 2 / Math.abs(dx) : Infinity,
    dy ? b.h / 2 / Math.abs(dy) : Infinity,
  );
  return [cx + dx * k, cy + dy * k];
}

function diagram(ctx: ComposeContext, area: Box, c: C) {
  const { colors } = ctx;
  // zones as tall as the fullest one needs, not the whole body
  const most = Math.max(...c.zones.map((z) => z.components.length));
  const need = 0.55 + most * 0.72 + (most - 1) * 0.42 + 0.3;
  const zones = cols(
    { ...area, h: Math.min(area.h, Math.max(2.4, need)) },
    Array(c.zones.length).fill(1),
    0.5,
  );
  const boxes = new Map<string, Box>();
  c.zones.forEach((z, zi) => {
    const zb = zones[zi]!;
    ctx.rect(zb, { fill: colors.surface, radius: 0.06, role: 'zone' });
    ctx.text(
      z.name.toUpperCase(),
      { x: zb.x + 0.15, y: zb.y + 0.12, w: zb.w - 0.3, h: 0.3 },
      {
        size: 'small',
        bold: true,
        color: colors.muted,
        maxLines: 1,
        field: `zones/${zi}/name`,
      },
    );
    const top = zb.y + 0.55;
    const avail = zb.y + zb.h - 0.2 - top;
    const n = z.components.length;
    const h = Math.min(0.72, (avail - 0.25 * (n - 1)) / n);
    const gap = n > 1 ? (avail - h * n) / (n - 1) : 0;
    const y0 = n > 1 ? top : top + (avail - h) / 2;
    z.components.forEach((comp, ci) => {
      const b = { x: zb.x + 0.2, y: y0 + ci * (h + Math.min(gap, 0.5)), w: zb.w - 0.4, h };
      boxes.set(comp.id, b);
      ctx.rect(b, {
        fill: comp.highlight ? colors.accent : colors.background,
        stroke: { color: comp.highlight ? colors.accent : colors.rule, width: 1 },
        radius: 0.05,
        role: 'component',
      });
      ctx.text(
        comp.label,
        { x: b.x + 0.1, y: b.y, w: b.w - 0.2, h: b.h },
        {
          size: 'small',
          bold: true,
          color: comp.highlight ? colors.accentText : colors.ink,
          align: 'center',
          valign: 'middle',
          maxLines: 2,
          field: `zones/${zi}/components/${ci}/label`,
        },
      );
    });
  });
  c.links.forEach((l, i) => {
    const a = boxes.get(l.from);
    const b = boxes.get(l.to);
    if (!a || !b) {
      ctx.issue(
        diag('SC-SPEC-001', `link ${l.from} → ${l.to}: unknown component id`, {
          pointer: ctx.ptr(`links/${i}`),
        }),
      );
      return;
    }
    const [x1, y1] = edge(a, b.x + b.w / 2, b.y + b.h / 2);
    const [x2, y2] = edge(b, a.x + a.w / 2, a.y + a.h / 2);
    ctx.line(
      x1,
      y1,
      x2,
      y2,
      { color: colors.ink, width: 1, ...(l.dashed ? { dash: 'dash' as const } : {}) },
      { arrowEnd: true, role: 'link' },
    );
    if (l.marker) badge(ctx, (x1 + x2) / 2, (y1 + y2) / 2, l.marker);
  });
  c.zones.forEach((z) =>
    z.components.forEach((comp) => {
      const b = boxes.get(comp.id)!;
      if (comp.marker) badge(ctx, b.x + b.w - 0.02, b.y + 0.02, comp.marker);
    }),
  );
}

export const architecture: LayoutDef<typeof schema> = {
  id: 'architecture',
  name: 'Architecture with register',
  group: 'decide',
  purpose:
    'Use for showing where in a system a problem sits and what to do about it: components in zones, requests and responses, and a numbered register linked to markers on the diagram.',
  useWhen: [
    'Technology or data-flow findings tied to specific components',
    'Controls, risks or changes that each belong to a part of the system',
    'Explaining a target architecture with the decisions it needs',
  ],
  avoidWhen: [
    'A sequence of steps without components — use process-steps',
    'Reporting lines — use org-chart',
  ],
  variants: ['zones'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Two gaps in the order flow cause most failed orders; both have a known fix',
      content: {
        zones: [
          {
            name: 'Channels',
            components: [
              { id: 'web', label: 'Web shop' },
              { id: 'app', label: 'Mobile app' },
            ],
          },
          {
            name: 'Services',
            components: [
              { id: 'orders', label: 'Order service', highlight: true, marker: 1 },
              { id: 'pay', label: 'Payment gateway' },
            ],
          },
          {
            name: 'Records',
            components: [
              { id: 'erp', label: 'ERP', marker: 2 },
              { id: 'crm', label: 'CRM' },
            ],
          },
        ],
        links: [
          { from: 'web', to: 'orders' },
          { from: 'app', to: 'orders' },
          { from: 'orders', to: 'pay' },
          { from: 'orders', to: 'erp' },
          { from: 'erp', to: 'crm', dashed: true },
        ],
        register: [
          {
            marker: 1,
            title: 'No retry on payment timeouts',
            text: '2.1% of orders fail when the gateway is slow; add an idempotent retry with a 30-second window',
          },
          {
            marker: 2,
            title: 'Nightly ERP sync',
            text: 'Stock is up to 24 hours old; move to event-based updates for the 300 fastest-moving items',
          },
        ],
      },
      sources: ['ops-review'],
    },
  ],
  compose(ctx, c) {
    const [left, right] = cols(ctx.body, [1.7, 1], 0.4);
    diagram(ctx, left!, c);
    const { colors } = ctx;
    const n = c.register.length;
    const rowH = Math.min(1.15, right!.h / n);
    c.register.forEach((r, i) => {
      const y = right!.y + i * rowH;
      badge(ctx, right!.x + 0.15, y + 0.17, r.marker);
      ctx.text(
        r.title,
        { x: right!.x + 0.42, y, w: right!.w - 0.42, h: 0.34 },
        {
          size: 'body',
          bold: true,
          maxLines: 1,
          field: `register/${i}/title`,
        },
      );
      ctx.text(
        r.text,
        { x: right!.x + 0.42, y: y + 0.36, w: right!.w - 0.42, h: rowH - 0.42 },
        {
          size: 'small',
          color: colors.muted,
          field: `register/${i}/text`,
        },
      );
    });
  },
};
