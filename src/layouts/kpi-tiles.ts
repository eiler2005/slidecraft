import { z } from 'zod';
import { columns } from '../engine/format.ts';
import type { Box } from '../engine/scene.ts';
import type { ComposeContext, LayoutDef } from './types.ts';

const Tile = z
  .object({
    value: z.string().min(1).max(8).describe('The number itself, units attached: "€42M", "18%"'),
    label: z.string().max(50).describe('What the number measures, with period: "Revenue, FY2025"'),
    delta: z
      .string()
      .max(16)
      .optional()
      .describe('Change versus a reference, sign included: "+12% YoY"'),
    trend: z
      .enum(['up', 'down', 'flat'])
      .optional()
      .describe('Direction of the delta; colors it and picks the glyph (default: flat)'),
    note: z.string().max(100).optional().describe('One line of context: definition or driver'),
  })
  .strict();

const schema = z
  .object({
    tiles: z.array(Tile).min(2).max(4).describe('The 2–4 headline numbers, most important first'),
    highlight: z
      .number()
      .int()
      .min(0)
      .max(3)
      .optional()
      .describe('Index of the one tile the title is about; it gets the accent color'),
  })
  .strict();

type TileT = z.infer<typeof Tile>;

/** Largest value size (pt) that keeps the longest value inside one column; ladder steps down from it. */
function valueSizes(longest: number, width: number, max: number): number[] {
  // heading faces average roughly 0.58 em per glyph in bold
  const fit = Math.floor((width * 72) / (Math.max(longest, 3) * 0.6) / 2) * 2;
  const start = Math.max(32, Math.min(max, fit));
  const out: number[] = [];
  for (let s = start; s >= 28; s -= 2) out.push(s);
  return out;
}

/** Trend glyph (drawn as a shape, so it renders identically everywhere) + delta text. */
function delta(
  ctx: ComposeContext,
  t: TileT,
  at: { x: number; y: number; w: number },
  field: string,
): void {
  if (!t.delta) return;
  const { colors } = ctx;
  const trend = t.trend ?? 'flat';
  const color =
    trend === 'up' ? colors.positive : trend === 'down' ? colors.negative : colors.muted;
  const g = 0.15;
  const cy = at.y + 0.16;
  if (trend === 'up') {
    ctx.polygon(
      [
        [at.x, cy + g / 2],
        [at.x + g, cy + g / 2],
        [at.x + g / 2, cy - g / 2],
      ],
      { fill: color, role: 'trend' },
    );
  } else if (trend === 'down') {
    ctx.polygon(
      [
        [at.x, cy - g / 2],
        [at.x + g, cy - g / 2],
        [at.x + g / 2, cy + g / 2],
      ],
      { fill: color, role: 'trend' },
    );
  } else {
    ctx.rect({ x: at.x, y: cy - 0.015, w: g, h: 0.03 }, { fill: color, role: 'trend' });
  }
  ctx.text(
    t.delta,
    { x: at.x + g + 0.1, y: at.y, w: at.w - g - 0.1, h: 0.32 },
    {
      role: 'delta',
      size: 'body',
      bold: true,
      color,
      valign: 'middle',
      maxLines: 1,
      fixed: true,
      field,
    },
  );
}

export const kpiTiles: LayoutDef<typeof schema> = {
  id: 'kpi-tiles',
  name: 'KPI tiles',
  group: 'numbers',
  purpose:
    'Use for 2–4 headline numbers that prove the title at a glance, each with its label, change and context.',
  useWhen: [
    'A status or results slide where the numbers are the message',
    'Opening a section with its three or four defining metrics',
    'Before/after or target-vs-actual headline figures',
  ],
  avoidWhen: [
    'More than four numbers or any time series — use chart-takeaway or data-table',
    'A single number that is the whole slide — use big-statement',
    'Numbers that need a bridge between them — use waterfall',
  ],
  variants: ['tiles', 'strip'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'FY2025 revenue reached €42M, up 18%, with margin at a three-year high',
      variant: 'tiles',
      content: {
        tiles: [
          {
            value: '€42M',
            label: 'Revenue, FY2025',
            delta: '+18% YoY',
            trend: 'up',
            note: 'Mid-market and enterprise contributed 80% of growth',
          },
          {
            value: '23%',
            label: 'EBITDA margin',
            delta: '+3.1 pts',
            trend: 'up',
            note: 'Gross margin gains outweighed higher R&D spend',
          },
          {
            value: '112%',
            label: 'Net revenue retention',
            delta: '+4 pts',
            trend: 'up',
            note: 'Expansion of existing accounts, trailing 12 months',
          },
          {
            value: '€3.4M',
            label: 'Public sector revenue',
            delta: '−9% YoY',
            trend: 'down',
            note: 'Two framework contracts expired; renewal due in Q2',
          },
        ],
        highlight: 0,
      },
      sources: ['finance-fy25'],
    },
    {
      title: 'The UK business funds itself: 18% growth, €9.6M free cash flow and 1,840 customers',
      variant: 'strip',
      content: {
        tiles: [
          {
            value: '€42M',
            label: 'Revenue, FY2025',
            delta: '+18% YoY',
            trend: 'up',
            note: 'Third year of 15%+ growth',
          },
          {
            value: '€9.6M',
            label: 'Free cash flow',
            delta: '+€2.1M',
            trend: 'up',
            note: 'Self-funding since Q2 2024',
          },
          {
            value: '1,840',
            label: 'Active customers',
            delta: '+212 net',
            trend: 'up',
            note: 'Churn stable at 5% a year; expansion led by mid-market',
          },
        ],
        highlight: 1,
      },
      sources: ['finance-fy25'],
    },
  ],
  compose(ctx, c) {
    const { body, colors } = ctx;
    const n = c.tiles.length;
    const hl = c.highlight !== undefined && c.highlight < n ? c.highlight : -1;
    const strip = ctx.variant === 'strip';
    const parts = columns(body, n, strip ? 0 : 0.3);
    const longest = Math.max(...c.tiles.map((t) => t.value.length));
    const top = body.y + 0.1;
    const h = strip ? Math.min(body.h - 0.1, 3.5) : Math.min(body.h - 0.1, 3.8);

    if (strip) {
      ctx.line(body.x, top, body.x + body.w, top, { color: colors.ink, width: 1.5 });
      ctx.line(body.x, top + h, body.x + body.w, top + h, { color: colors.rule, width: 0.75 });
    }

    // Content column of each tile.
    const slots: Box[] = parts.map((p, i) => {
      if (!strip) return { x: p.x + 0.3, y: top, w: p.w - 0.6, h };
      const padL = i === 0 ? 0 : 0.35;
      const padR = i === n - 1 ? 0 : 0.3;
      return { x: p.x + padL, y: top, w: p.w - padL - padR, h };
    });
    const valueY = top + (strip ? 0.3 : 0.3);
    const labelY = valueY + 1.2;

    // Labels first: the delta row sits under the tallest label so rows stay aligned.
    const labelH = Math.max(
      ...c.tiles.map((t, i) => {
        const node = ctx.text(
          t.label,
          { x: slots[i]!.x, y: labelY, w: slots[i]!.w, h: 0.78 },
          { role: 'kpi-label', size: 'body', bold: true, maxLines: 3, field: `tiles/${i}/label` },
        );
        return Math.min(node.box.h, node.contentHeight);
      }),
    );
    const deltaY = labelY + labelH + 0.15;

    parts.forEach((p, i) => {
      const t = c.tiles[i]!;
      const col = slots[i]!;
      if (strip) {
        if (i > 0)
          ctx.line(p.x, top + 0.35, p.x, top + h - 0.35, { color: colors.rule, width: 0.75 });
      } else {
        ctx.rect({ x: p.x, y: top, w: p.w, h }, { fill: colors.surface, role: 'card' });
        if (i === hl)
          ctx.rect(
            { x: p.x, y: top, w: p.w, h: 0.07 },
            { fill: colors.accent, role: 'card-accent' },
          );
      }
      ctx.text(
        t.value,
        { x: col.x, y: valueY, w: col.w, h: 1.1 },
        {
          role: 'kpi-value',
          font: 'heading',
          sizes: valueSizes(longest, col.w, strip ? 60 : 54),
          bold: true,
          color: i === hl ? colors.accent : colors.ink,
          valign: 'bottom',
          maxLines: 1,
          field: `tiles/${i}/value`,
        },
      );
      delta(ctx, t, { x: col.x, y: deltaY, w: col.w }, `tiles/${i}/delta`);
      if (t.note) {
        const noteY = top + h - 0.9;
        if (!strip) {
          ctx.line(col.x, noteY, col.x + col.w, noteY, { color: colors.rule, width: 0.75 });
        }
        ctx.text(
          t.note,
          { x: col.x, y: noteY + 0.1, w: col.w, h: 0.7 },
          {
            role: 'kpi-note',
            size: 'small',
            color: colors.muted,
            maxLines: 3,
            field: `tiles/${i}/note`,
          },
        );
      }
    });
  },
};
