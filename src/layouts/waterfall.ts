import { z } from 'zod';
import { cols } from '../engine/format.ts';
import { diag } from '../qa/codes.ts';
import type { ComposeContext, LayoutDef } from './types.ts';

const Step = z
  .object({
    label: z.string().max(24).describe('Short category name: "Price", "FY24", "Cost inflation"'),
    value: z
      .number()
      .describe('Delta for a driver (negative = decrease); the absolute level when total is true'),
    total: z
      .boolean()
      .optional()
      .describe('True for start, subtotal and end bars: they stand on the baseline'),
  })
  .strict();

const schema = z
  .object({
    chart: z
      .object({
        label: z
          .string()
          .max(90)
          .optional()
          .describe('What is bridged, with unit and period: "EBITDA bridge FY24 to FY25, €M"'),
        steps: z
          .array(Step)
          .min(3)
          .max(12)
          .describe('Start total, drivers, then end total; the drivers must sum to the end total'),
        unit: z.string().max(4).optional().describe('Unit glyph on labels: "%", "€", "$", "M"'),
        decimals: z.number().int().min(0).max(2).optional(),
      })
      .strict(),
    takeaway: z
      .object({
        headline: z.string().max(90).describe('The so-what in one sentence'),
        points: z.array(z.string().max(150)).max(3).default([]),
      })
      .strict()
      .optional()
      .describe('Required for the with-takeaway variant: the interpretation in a side panel'),
  })
  .strict();

/** Side panel shared by the takeaway variant (same pattern as chart-takeaway). */
function panel(
  ctx: ComposeContext,
  box: { x: number; y: number; w: number; h: number },
  takeaway: { headline: string; points: string[] },
): void {
  const { colors } = ctx;
  ctx.rect(box, { fill: colors.surface, role: 'panel' });
  ctx.rect(
    { x: box.x, y: box.y, w: 0.06, h: box.h },
    { fill: colors.accent, role: 'panel-accent' },
  );
  const inner = { x: box.x + 0.3, y: box.y + 0.3, w: box.w - 0.55, h: box.h - 0.6 };
  const head = ctx.text(
    takeaway.headline,
    { ...inner, h: 1.1 },
    {
      role: 'takeaway',
      font: 'heading',
      size: 'heading',
      bold: true,
      color: colors.ink,
      maxLines: 3,
      field: 'takeaway/headline',
    },
  );
  const used = Math.min(head.box.h, head.contentHeight) + 0.25;
  if (takeaway.points.length) {
    ctx.text(
      ctx.paragraphs(takeaway.points, { bullet: true, spaceBefore: 8 }),
      { x: inner.x, y: inner.y + used, w: inner.w, h: inner.h - used },
      { role: 'body', size: 'body', color: colors.ink, field: 'takeaway/points' },
    );
  }
}

export const waterfall: LayoutDef<typeof schema> = {
  id: 'waterfall',
  name: 'Waterfall',
  group: 'numbers',
  purpose:
    'Use for a bridge that explains how a starting total becomes an ending total through positive and negative drivers.',
  useWhen: [
    'Profit, revenue or cash bridges between two periods or scenarios',
    'Showing which drivers add and which erode a total',
    'A title that says "X grew/fell by N because of A, B and C"',
  ],
  avoidWhen: [
    'Comparing independent categories — use chart-takeaway (bar)',
    'More than 12 steps — group small drivers into "Other"',
    'Only start and end values matter — use kpi-tiles',
  ],
  variants: ['full', 'with-takeaway'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'EBITDA grew €9M in FY25 as price and volume outran cost inflation',
      variant: 'full',
      content: {
        chart: {
          label: 'EBITDA bridge FY24 to FY25, €M',
          steps: [
            { label: 'EBITDA FY24', value: 38, total: true },
            { label: 'Price', value: 11 },
            { label: 'Volume', value: 8 },
            { label: 'Mix', value: -3 },
            { label: 'Cost inflation', value: -9 },
            { label: 'Efficiency', value: 2 },
            { label: 'EBITDA FY25', value: 47, total: true },
          ],
          decimals: 0,
        },
      },
      sources: ['finance-fy25'],
    },
    {
      title: 'Free cash flow turned negative as working capital absorbed €14M',
      variant: 'with-takeaway',
      content: {
        chart: {
          label: 'Free cash flow bridge FY25, €M',
          steps: [
            { label: 'EBITDA', value: 12, total: true },
            { label: 'Working capital', value: -14 },
            { label: 'Capex', value: -6 },
            { label: 'Tax and interest', value: -4 },
            { label: 'Disposals', value: 3 },
            { label: 'Free cash flow', value: -9, total: true },
          ],
          decimals: 0,
        },
        takeaway: {
          headline: 'Receivables, not trading, drive the cash gap',
          points: [
            'Payment terms for enterprise clients stretched from 45 to 72 days',
            'Without the working-capital swing, free cash flow would be +€5M',
          ],
        },
      },
      sources: ['finance-fy25'],
    },
  ],
  compose(ctx, c) {
    const { body, colors } = ctx;
    const withPanel = ctx.variant === 'with-takeaway';
    if (withPanel && !c.takeaway) {
      ctx.issue(
        diag('SC-SPEC-001', 'with-takeaway variant needs a takeaway (headline and points)', {
          pointer: ctx.ptr('takeaway'),
        }),
      );
    }

    const [left, right] = withPanel ? cols(body, [2.1, 1], 0.4) : [body, undefined];
    let chartBox = left!;
    if (c.chart.label) {
      ctx.text(
        c.chart.label,
        { x: left!.x, y: left!.y, w: left!.w, h: 0.3 },
        {
          role: 'chart-title',
          size: 'small',
          bold: true,
          color: colors.muted,
          maxLines: 1,
          fixed: true,
          field: 'chart/label',
        },
      );
      chartBox = { ...left!, y: left!.y + 0.42, h: left!.h - 0.42 };
    }

    const steps = c.chart.steps;
    const tol = 10 ** -(c.chart.decimals ?? 0) / 2;
    let run = 0;
    steps.forEach((s, i) => {
      if (s.total) {
        if (i > 0 && Math.abs(run - s.value) > tol) {
          ctx.issue(
            diag(
              'SC-SPEC-001',
              `Total "${s.label}" is ${s.value} but the steps before it sum to ${+run.toFixed(4)}`,
              { pointer: ctx.ptr(`chart/steps/${i}/value`), severity: 'warning' },
            ),
          );
        }
        run = s.value;
      } else {
        run += s.value;
      }
    });

    ctx.chart(
      {
        type: 'waterfall',
        categories: steps.map((s) => s.label),
        series: [{ name: c.chart.label ?? 'Bridge', values: steps.map((s) => s.value) }],
        highlight: steps.flatMap((s, i) => (s.total ? [i] : [])),
        ...(c.chart.unit ? { unit: c.chart.unit } : {}),
        ...(c.chart.decimals !== undefined ? { decimals: c.chart.decimals } : {}),
        field: 'chart',
      },
      chartBox,
    );

    if (withPanel && right && c.takeaway) panel(ctx, right, c.takeaway);
  },
};
