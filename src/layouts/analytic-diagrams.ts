import { z } from 'zod';
import { formatNumber as numberText } from '../engine/charts.ts';
import { mix } from '../engine/color.ts';
import { extent, ribbon, squarify } from '../engine/diagram-geometry.ts';
import {
  caption,
  DiagramId,
  DiagramLabel,
  diagramDef,
  label,
  panel,
  problem,
  readable,
  valueFill,
} from './diagram-kit.ts';

const sources = ['illustrative'];
const formatNumber = (value: number, language: string, decimals = 0) =>
  numberText(value, decimals, '', false, language);
const heatSchema = z
  .object({
    rows: z
      .array(z.string().min(1).max(28))
      .min(2)
      .max(6)
      .describe('Row categories in reading order'),
    columns: z
      .array(z.string().min(1).max(24))
      .min(2)
      .max(6)
      .describe('Column categories; retain chronological order'),
    values: z
      .array(z.array(z.number().nullable()).min(2).max(6))
      .min(2)
      .max(6)
      .describe('Row-major observations; null means missing, never zero'),
    unit: z.string().max(12).default(''),
    decimals: z.number().int().min(0).max(2).default(0),
    scale: z.enum(['sequential', 'diverging']).default('sequential'),
    domain: z
      .tuple([z.number(), z.number()])
      .optional()
      .describe('Shared explicit minimum and maximum'),
    focal: z
      .object({ row: z.number().int().min(0), column: z.number().int().min(0) })
      .strict()
      .optional(),
  })
  .strict();

export const heatmap = diagramDef(
  'heatmap',
  'Numeric heatmap',
  heatSchema,
  [
    {
      title: 'Support delays concentrate in billing and the renewal stage',
      sources,
      content: {
        rows: ['Onboarding', 'Billing', 'Renewal'],
        columns: ['Email', 'Chat', 'Phone', 'Self-service'],
        values: [
          [12, 8, 10, 3],
          [28, 15, 24, 8],
          [34, 22, 18, null],
        ],
        unit: 'min',
        focal: { row: 2, column: 0 },
      },
    },
  ],
  (ctx, c) => {
    if (
      c.values.length !== c.rows.length ||
      c.values.some((row) => row.length !== c.columns.length)
    ) {
      problem(ctx, 'Heatmap dimensions must match row and column labels', 'values');
      return;
    }
    if (new Set(c.rows).size !== c.rows.length || new Set(c.columns).size !== c.columns.length) {
      problem(ctx, 'Heatmap category labels must be unique', 'rows');
      return;
    }
    const values = c.values.flat().filter((v): v is number => v !== null);
    if (!values.length) {
      problem(ctx, 'Heatmap needs at least one observed value', 'values');
      return;
    }
    if (c.scale === 'sequential' && values.some((v) => v < 0)) {
      problem(ctx, 'Signed values require a diverging scale', 'scale');
      return;
    }
    const maxAbs = Math.max(...values.map(Math.abs)) || 1;
    const domain =
      c.domain ??
      (c.scale === 'diverging' ? ([-maxAbs, maxAbs] as [number, number]) : extent(values, true));
    if (
      domain[1] <= domain[0] ||
      values.some((v) => v < domain[0] || v > domain[1]) ||
      (c.scale === 'diverging' && !(domain[0] < 0 && domain[1] > 0))
    ) {
      problem(ctx, 'Scale must contain all values and a meaningful zero for signed data', 'domain');
      return;
    }
    if (c.focal && (c.focal.row >= c.rows.length || c.focal.column >= c.columns.length)) {
      problem(ctx, 'Focal cell is outside the matrix', 'focal');
      return;
    }
    const b = ctx.body,
      left = Math.min(2, b.w * 0.23),
      top = 0.6,
      bottom = 0.48;
    const w = (b.w - left) / c.columns.length,
      h = (b.h - top - bottom) / c.rows.length;
    c.columns.forEach((name, i) =>
      label(ctx, name, { x: b.x + left + i * w, y: b.y, w, h: top - 0.1 }, `columns/${i}`, {
        bold: true,
        align: 'center',
      }),
    );
    c.rows.forEach((name, i) =>
      label(ctx, name, { x: b.x, y: b.y + top + i * h, w: left - 0.18, h }, `rows/${i}`, {
        bold: true,
      }),
    );
    c.values.forEach((row, ri) =>
      row.forEach((v, ci) => {
        const focal = c.focal?.row === ri && c.focal.column === ci;
        let fill = ctx.colors.surface;
        if (v !== null)
          fill =
            c.scale === 'diverging'
              ? mix(
                  ctx.colors.background,
                  v < 0 ? ctx.colors.negative : ctx.colors.positive,
                  0.12 + (0.5 * Math.abs(v)) / (v < 0 ? -domain[0] : domain[1]),
                )
              : valueFill(ctx, (v - domain[0]) / (domain[1] - domain[0]));
        const cell = { x: b.x + left + ci * w, y: b.y + top + ri * h, w, h };
        ctx.rect(cell, {
          fill,
          stroke: {
            color: focal ? ctx.colors.accent : ctx.colors.background,
            width: focal ? 2 : 2.5,
          },
          role: 'heatmap-cell',
        });
        label(
          ctx,
          v === null
            ? 'N/A'
            : `${formatNumber(v, ctx.language, c.decimals)}${c.unit ? ` ${c.unit}` : ''}`,
          { x: cell.x + 0.08, y: cell.y + 0.06, w: w - 0.16, h: h - 0.12 },
          `values/${ri}/${ci}`,
          { align: 'center', bold: focal, color: readable(ctx, fill) },
        );
      }),
    );
    caption(
      ctx,
      `${c.scale} · ${formatNumber(domain[0], ctx.language, c.decimals)} … ${formatNumber(domain[1], ctx.language, c.decimals)} ${c.unit} · N/A = missing`,
      { x: b.x + left, y: b.y + b.h - bottom + 0.1, w: b.w - left, h: 0.28 },
      'domain',
    );
  },
  'Use for a numeric row-by-column pattern on one explicit scale; missing observations remain distinct from zero.',
  'numbers',
);

const treeSchema = z
  .object({
    items: z
      .array(
        z.object({ id: DiagramId, label: DiagramLabel, value: z.number().nonnegative() }).strict(),
      )
      .min(2)
      .max(8),
    unit: z.string().max(12).default(''),
    focal: DiagramId.optional(),
  })
  .strict();
export const treemap = diagramDef(
  'treemap',
  'Treemap',
  treeSchema,
  [
    {
      title: 'The platform and support account for most operating spend',
      sources,
      content: {
        items: [
          { id: 'platform', label: 'Platform', value: 42 },
          { id: 'support', label: 'Support', value: 26 },
          { id: 'sales', label: 'Sales', value: 18 },
          { id: 'admin', label: 'Admin', value: 14 },
        ],
        unit: '$M',
        focal: 'platform',
      },
    },
  ],
  (ctx, c) => {
    const b = ctx.body,
      area = { ...b, h: b.h - 0.85 };
    let boxes: ReturnType<typeof squarify>;
    try {
      boxes = squarify(c.items, area);
    } catch (e) {
      problem(ctx, (e as Error).message, 'items');
      return;
    }
    if (c.focal && !c.items.some((v) => v.id === c.focal)) {
      problem(ctx, 'Unknown focal item', 'focal');
      return;
    }
    const total = c.items.reduce((s, v) => s + v.value, 0);
    c.items.forEach((item, i) => {
      const box = boxes.get(item.id),
        focal = item.id === c.focal,
        fill = focal
          ? ctx.colors.accentSoft
          : mix(ctx.colors.background, ctx.colors.ink, 0.05 + 0.025 * i);
      if (box) {
        ctx.rect(box, {
          fill,
          stroke: {
            color: focal ? ctx.colors.accent : ctx.colors.background,
            width: focal ? 1.5 : 2,
          },
          role: 'treemap-cell',
          encoding: { dimension: 'area', value: item.value, scale: (area.w * area.h) / total },
        });
        if (box.w >= 1.25 && box.h >= 0.72) {
          label(
            ctx,
            item.label,
            { x: box.x + 0.14, y: box.y + 0.08, w: box.w - 0.28, h: Math.min(0.55, box.h * 0.5) },
            `items/${i}/label`,
            { bold: true, color: readable(ctx, fill) },
          );
          label(
            ctx,
            `${formatNumber(item.value, ctx.language)} ${c.unit} · ${formatNumber((item.value / total) * 100, ctx.language, 1)}%`,
            { x: box.x + 0.14, y: box.y + box.h - 0.38, w: box.w - 0.28, h: 0.28 },
            `items/${i}/value`,
            { size: 'small', color: readable(ctx, fill) },
          );
        }
      }
      const colsN = Math.min(4, c.items.length),
        rows = Math.ceil(c.items.length / colsN),
        w = b.w / colsN;
      caption(
        ctx,
        `${item.label}: ${formatNumber(item.value, ctx.language)} ${c.unit}`,
        {
          x: b.x + (i % colsN) * w,
          y: b.y + b.h - 0.7 + (Math.floor(i / colsN) * 0.7) / rows,
          w: w - 0.16,
          h: 0.7 / rows,
        },
        undefined,
      );
    });
  },
  'Use for comparing parts of one positive total by area, with deterministic squarified geometry.',
  'numbers',
);

const fishSchema = z
  .object({
    effect: z.string().min(1).max(48),
    categories: z
      .array(
        z
          .object({
            label: z.string().min(1).max(24),
            causes: z
              .array(
                z
                  .object({
                    label: z.string().min(1).max(28),
                    status: z.enum(['hypothesis', 'supported', 'confirmed']).default('hypothesis'),
                  })
                  .strict(),
              )
              .min(1)
              .max(3),
          })
          .strict(),
      )
      .min(2)
      .max(5),
  })
  .strict();
export const fishbone = diagramDef(
  'fishbone',
  'Fishbone cause analysis',
  fishSchema,
  [
    {
      title: 'Handoff and data gaps explain the onboarding delays',
      sources,
      content: {
        effect: 'Slow onboarding',
        categories: [
          { label: 'People', causes: [{ label: 'Unclear owner', status: 'supported' }] },
          { label: 'Process', causes: [{ label: 'Repeated approval', status: 'confirmed' }] },
          { label: 'Data', causes: [{ label: 'Missing records', status: 'hypothesis' }] },
          { label: 'Systems', causes: [{ label: 'Manual transfer', status: 'supported' }] },
        ],
      },
    },
  ],
  (ctx, c) => {
    const b = ctx.body,
      cy = b.y + b.h / 2,
      headW = Math.min(2, b.w * 0.2),
      headX = b.x + b.w - headW;
    ctx.line(
      b.x + 0.2,
      cy,
      headX,
      cy,
      { color: ctx.colors.ink, width: 1.25 },
      { arrowEnd: true, role: 'fishbone-spine' },
    );
    const span = headX - b.x - 1.6,
      topN = Math.ceil(c.categories.length / 2);
    c.categories.forEach((cat, i) => {
      const top = i % 2 === 0,
        k = Math.floor(i / 2),
        sign = top ? -1 : 1;
      const ax = b.x + 1.4 + (topN === 1 ? 0 : (k * span) / (topN - 0.45)),
        bx = ax - 0.65,
        by = cy + sign * (b.h / 2 - 0.7);
      const confirmed = cat.causes.some((v) => v.status === 'confirmed');
      ctx.line(
        ax,
        cy,
        bx,
        by,
        { color: confirmed ? ctx.colors.accent : ctx.colors.muted, width: confirmed ? 1.4 : 0.9 },
        { role: 'fishbone-bone' },
      );
      label(
        ctx,
        cat.label,
        { x: bx - 0.55, y: top ? by - 0.5 : by + 0.08, w: 1.5, h: 0.4 },
        `categories/${i}/label`,
        { bold: true, color: confirmed ? ctx.colors.accent : ctx.colors.ink },
      );
      cat.causes.forEach((cause, j) => {
        const f = (j + 1) / (cat.causes.length + 1),
          x = ax + (bx - ax) * f,
          y = cy + (by - cy) * f;
        ctx.line(x - 0.3, y, x, y, { color: ctx.colors.rule, width: 0.8 });
        label(
          ctx,
          `${cause.status === 'confirmed' ? 'C' : cause.status === 'supported' ? 'S' : 'H'} · ${cause.label}`,
          { x: x - 1.45, y: y - 0.2, w: 1.1, h: 0.4 },
          `categories/${i}/causes/${j}/label`,
          { size: 'small', align: 'right' },
        );
      });
    });
    panel(ctx, { x: headX, y: cy - 0.48, w: headW, h: 0.96 }, true);
    label(ctx, c.effect, { x: headX + 0.12, y: cy - 0.38, w: headW - 0.24, h: 0.76 }, 'effect', {
      bold: true,
      align: 'center',
    });
    const statuses = 'H = hypothesis · S = supported · C = confirmed';
    caption(ctx, `Evidence: ${statuses} · confirmed categories are accented`, {
      x: b.x,
      y: b.y + b.h - 0.25,
      w: b.w,
      h: 0.25,
    });
  },
  'Use for investigating grouped causes of one observed effect, with explicit evidence status.',
);

const sankeySchema = z
  .object({
    stages: z.tuple([z.string().max(28), z.string().max(28), z.string().max(28)]),
    nodes: z
      .array(
        z
          .object({
            id: DiagramId,
            label: z.string().max(28),
            stage: z.number().int().min(0).max(2),
          })
          .strict(),
      )
      .min(3)
      .max(8),
    flows: z
      .array(
        z
          .object({
            from: DiagramId,
            to: DiagramId,
            value: z.number().nonnegative(),
            highlight: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(12),
    unit: z.string().max(12).default(''),
  })
  .strict();
export const sankey = diagramDef(
  'sankey',
  'Sankey flow quantities',
  sankeySchema,
  [
    {
      title: 'Most service effort reaches delivery through the platform team',
      sources,
      content: {
        stages: ['Demand', 'Team', 'Outcome'],
        nodes: [
          { id: 'demand', label: 'Service effort', stage: 0 },
          { id: 'platform', label: 'Platform', stage: 1 },
          { id: 'support', label: 'Support', stage: 1 },
          { id: 'delivery', label: 'Delivered', stage: 2 },
          { id: 'rework', label: 'Rework', stage: 2 },
        ],
        flows: [
          { from: 'demand', to: 'platform', value: 70 },
          { from: 'demand', to: 'support', value: 30 },
          { from: 'platform', to: 'delivery', value: 60, highlight: true },
          { from: 'platform', to: 'rework', value: 10 },
          { from: 'support', to: 'delivery', value: 20 },
          { from: 'support', to: 'rework', value: 10 },
        ],
        unit: 'days',
      },
    },
  ],
  (ctx, c) => {
    const ids = new Map(c.nodes.map((n) => [n.id, n]));
    if (ids.size !== c.nodes.length) {
      problem(ctx, 'Sankey node IDs must be unique', 'nodes');
      return;
    }
    if ([0, 1, 2].some((s) => !c.nodes.some((n) => n.stage === s))) {
      problem(ctx, 'Sankey requires three nonempty stages', 'nodes');
      return;
    }
    const incoming = new Map<string, number>(),
      outgoing = new Map<string, number>();
    for (const [i, f] of c.flows.entries()) {
      const from = ids.get(f.from),
        to = ids.get(f.to);
      if (!from || !to || to.stage !== from.stage + 1) {
        problem(ctx, 'Flows must connect known nodes in consecutive stages', `flows/${i}`);
        return;
      }
      incoming.set(f.to, (incoming.get(f.to) ?? 0) + f.value);
      outgoing.set(f.from, (outgoing.get(f.from) ?? 0) + f.value);
    }
    const total = c.nodes
      .filter((n) => n.stage === 0)
      .reduce((s, n) => s + (outgoing.get(n.id) ?? 0), 0);
    if (!Number.isFinite(total) || total <= 0) {
      problem(ctx, 'Sankey requires a positive finite total', 'flows');
      return;
    }
    const quantities = new Map(
      c.nodes.map((n) => [
        n.id,
        n.stage === 2 ? (incoming.get(n.id) ?? 0) : (outgoing.get(n.id) ?? 0),
      ]),
    );
    if (
      c.nodes.some(
        (n) =>
          (quantities.get(n.id) ?? 0) <= 0 ||
          (n.stage === 1 &&
            Math.abs((incoming.get(n.id) ?? 0) - (outgoing.get(n.id) ?? 0)) > total * 1e-9),
      )
    ) {
      problem(
        ctx,
        'Every node must carry a positive quantity and intermediate flows must balance',
        'flows',
      );
      return;
    }
    const b = ctx.body,
      maxCount = Math.max(...[0, 1, 2].map((s) => c.nodes.filter((n) => n.stage === s).length)),
      gap = 0.62;
    const k = (b.h - 0.65 - gap * (maxCount - 1)) / total;
    if (!Number.isFinite(k) || k <= 0 || c.flows.some((f) => f.value > 0 && f.value * k < 0.025)) {
      problem(ctx, 'Tiny flows are unreadable; explicitly aggregate or split the Sankey', 'flows');
      return;
    }
    const boxes = new Map<string, { x: number; y: number; h: number; w: number }>();
    const xs = [b.x + 1.6, b.x + b.w / 2, b.x + b.w - 1.7];
    [0, 1, 2].forEach((stage) => {
      const list = c.nodes.filter((n) => n.stage === stage),
        stackH = total * k + (list.length - 1) * gap;
      let y = b.y + 0.5 + (b.h - 0.5 - stackH) / 2;
      caption(
        ctx,
        c.stages[stage]!,
        { x: xs[stage]! - 1.2, y: b.y, w: 2.5, h: 0.32 },
        `stages/${stage}`,
      );
      for (const n of list) {
        const h = quantities.get(n.id)! * k;
        boxes.set(n.id, { x: xs[stage]!, y, w: 0.12, h });
        y += h + gap;
      }
    });
    const srcOffset = new Map<string, number>(),
      dstOffset = new Map<string, number>();
    for (const [i, f] of c.flows.entries()) {
      if (!f.value) continue;
      const a = boxes.get(f.from)!,
        d = boxes.get(f.to)!,
        so = srcOffset.get(f.from) ?? 0,
        doff = dstOffset.get(f.to) ?? 0;
      ctx.path(ribbon(a.x + a.w, a.y + so, d.x, d.y + doff, f.value * k), {
        fill: f.highlight ? ctx.colors.accent : ctx.colors.muted,
        fillOpacity: f.highlight ? 0.3 : 0.16,
        role: 'sankey-ribbon',
        encoding: { dimension: 'ribbon', value: f.value, scale: k },
        pointer: ctx.ptr(`flows/${i}/value`),
      });
      srcOffset.set(f.from, so + f.value * k);
      dstOffset.set(f.to, doff + f.value * k);
    }
    c.nodes.forEach((n, i) => {
      const box = boxes.get(n.id)!;
      ctx.rect(box, {
        fill: ctx.colors.ink,
        role: 'sankey-node',
        encoding: { dimension: 'height', value: quantities.get(n.id)!, scale: k },
      });
      const text = `${n.label}\n${formatNumber(quantities.get(n.id)!, ctx.language)} ${c.unit}`;
      const lb =
        n.stage === 0
          ? { x: box.x - 1.55, y: box.y + box.h / 2 - 0.35, w: 1.4, h: 0.7 }
          : n.stage === 2
            ? { x: box.x + 0.25, y: box.y + box.h / 2 - 0.35, w: 1.4, h: 0.7 }
            : { x: box.x - 1.2, y: box.y - 0.52, w: 2.5, h: 0.46 };
      label(ctx, text, lb, `nodes/${i}/label`, {
        size: 'small',
        maxLines: 3,
        align: n.stage === 0 ? 'right' : n.stage === 2 ? 'left' : 'center',
      });
    });
  },
  'Use for a conserved quantity that splits and merges across three stages on one shared scale.',
  'numbers',
);
