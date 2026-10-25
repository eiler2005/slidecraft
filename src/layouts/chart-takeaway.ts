import { z } from 'zod';
import { cols } from '../engine/format.ts';
import { diag } from '../qa/codes.ts';
import { advancedChart } from './advanced-charts.ts';
import { pairedComparison } from './paired-comparison.ts';
import type { LayoutDef } from './types.ts';

export const ChartData = z
  .object({
    label: z
      .string()
      .max(90)
      .optional()
      .describe('What is measured, with unit and period: "Revenue by segment, €M, FY2025"'),
    categories: z.array(z.string().max(28)).min(2).max(12),
    series: z
      .array(z.object({ name: z.string().max(30), values: z.array(z.number()) }).strict())
      .min(1)
      .max(4),
    unit: z.string().max(4).optional().describe('Unit glyph on labels: "%", "€", "$", "M"'),
    decimals: z.number().int().min(0).max(2).optional(),
    lineUnit: z
      .string()
      .max(4)
      .optional()
      .describe('Combo: unit of the line series (the second), e.g. "%" next to bars in €M'),
    lineDecimals: z.number().int().min(0).max(2).optional(),
    highlight: z
      .array(z.union([z.string(), z.number().int()]))
      .optional()
      .describe('Categories (names or indices) to color as the insight; the rest recede'),
  })
  .strict();

const schema = z
  .object({
    chart: ChartData,
    takeaway: z
      .object({
        headline: z.string().max(90).describe('The so-what in one sentence'),
        points: z.array(z.string().max(150)).max(3).default([]),
      })
      .strict(),
  })
  .strict();

export const chartTakeaway: LayoutDef<typeof schema> = {
  id: 'chart-takeaway',
  name: 'Chart with takeaway',
  group: 'numbers',
  purpose: 'Use for one chart that proves the title, with the interpretation in a side panel.',
  useWhen: [
    'Comparing items (bar), a trend over time (column or line), or composition (stacked)',
    'A volume and a rate over the same periods — bars plus a line on its own scale (combo)',
    'Any slide whose title carries a number from the data',
  ],
  avoidWhen: [
    'A bridge from one total to another — use waterfall',
    'Fewer than three data points — use kpi-tiles',
  ],
  variants: [
    'bar',
    'column',
    'stacked',
    'line',
    'combo',
    'dumbbell',
    'slopegraph',
    'bump',
    'ridgeline',
    'streamgraph',
  ],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Enterprise and mid-market hold 78% of profit on 41% of revenue',
      variant: 'bar',
      content: {
        chart: {
          label: 'Operating profit by segment, €M, FY2025',
          categories: ['Enterprise', 'Mid-market', 'SMB', 'Public sector', 'Partners'],
          series: [{ name: 'Profit', values: [42, 31, 9, 7, 4] }],
          highlight: ['Enterprise', 'Mid-market'],
        },
        takeaway: {
          headline: 'Two segments carry the business',
          points: [
            'SMB revenue is large but margin is thin after support costs',
            'Growth investment should follow profit, not revenue',
          ],
        },
      },
      sources: ['finance-fy25'],
    },
    {
      title: 'Monthly active teams doubled in nine months after the redesign',
      variant: 'line',
      content: {
        chart: {
          label: 'Monthly active teams, thousands',
          categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
          series: [
            {
              name: 'Active teams',
              values: [10.2, 10.9, 11.8, 13.1, 14.0, 15.6, 17.2, 18.9, 20.6],
            },
          ],
          decimals: 1,
        },
        takeaway: {
          headline: 'Growth compounds at ~9% a month',
          points: ['Retention, not acquisition, drives the curve'],
        },
      },
    },
    {
      title: 'Subscription revenue overtook services in 2025 and now drives growth',
      variant: 'stacked',
      content: {
        chart: {
          label: 'Revenue by stream, €M',
          categories: ['2022', '2023', '2024', '2025'],
          series: [
            { name: 'Subscription', values: [8, 12, 17, 24] },
            { name: 'Services', values: [14, 15, 16, 17] },
          ],
        },
        takeaway: {
          headline: 'Recurring revenue is now 59% of the total',
          points: ['Services stay flat by design', 'Subscription grew 44% a year'],
        },
      },
      sources: ['finance-fy25'],
    },
    {
      title: 'Average deal size rose 30% since we introduced annual plans',
      variant: 'column',
      content: {
        chart: {
          label: 'Average deal size, €k',
          categories: ['Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2'],
          series: [{ name: 'Deal size', values: [20, 21, 22, 24, 25, 26] }],
          highlight: [5],
        },
        takeaway: {
          headline: 'Annual plans lift deal size',
          points: ['Launched at the start of Q4'],
        },
      },
      sources: ['finance-fy25'],
    },
    {
      title: 'Orders kept growing while the return rate fell below 5% this year',
      variant: 'combo',
      content: {
        chart: {
          label: 'Orders, thousands, and return rate, %',
          categories: ['Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26'],
          series: [
            { name: 'Orders', values: [182, 196, 214, 251, 238, 262] },
            { name: 'Return rate', values: [7.8, 7.1, 6.4, 6.0, 5.2, 4.6] },
          ],
          lineUnit: '%',
          lineDecimals: 1,
        },
        takeaway: {
          headline: 'Better sizing data cut returns',
          points: ['Returns fell every quarter since the size guide launched'],
        },
      },
      sources: ['finance-fy25'],
    },
    ...(['bump', 'ridgeline', 'streamgraph'] as const).map((variant) => ({
      title:
        variant === 'bump'
          ? 'Product adoption ranks change after the launch'
          : variant === 'ridgeline'
            ? 'Response-time distributions differ across the two service groups'
            : 'The service mix shifts across the observed periods',
      variant,
      sources: ['illustrative'],
      content: {
        chart: {
          categories: variant === 'ridgeline' ? ['10', '20', '30', '40'] : ['Q1', 'Q2', 'Q3', 'Q4'],
          series:
            variant === 'bump'
              ? [
                  { name: 'Core', values: [1, 2, 1, 1] },
                  { name: 'New', values: [2, 1, 2, 2] },
                ]
              : [
                  { name: 'Core', values: [5, 12, 18, 8] },
                  { name: 'New', values: [2, 6, 14, 16] },
                ],
        },
        takeaway: {
          headline: 'The pattern guides the next investigation',
          points: ['Illustrative observations use the same definition.'],
        },
      },
    })),
    ...(['dumbbell', 'slopegraph'] as const).map((variant) => ({
      title: 'Response times fall across every service after the redesign',
      variant,
      sources: ['illustrative'],
      content: {
        chart: {
          categories: ['Billing', 'Orders', 'Accounts', 'Returns'],
          series: [
            { name: 'Before', values: [42, 35, 28, 20] },
            { name: 'After', values: [24, 22, 18, 15] },
          ],
          unit: 'm',
          highlight: ['Billing'],
        },
        takeaway: {
          headline: 'Billing improves the most',
          points: ['Both periods use the same definition and scale.'],
        },
      },
    })),
  ],
  compose(ctx, c) {
    const { body, colors } = ctx;
    const [left, right] = cols(body, [2.1, 1], 0.4);
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
    const n = c.chart.categories.length;
    const bad = c.chart.series.find((s) => s.values.length !== n);
    if (bad) {
      ctx.issue(
        diag(
          'SC-SPEC-001',
          `Series "${bad.name}" has ${bad.values.length} values for ${n} categories`,
          { pointer: ctx.ptr('chart/series') },
        ),
      );
      return;
    }
    if (ctx.variant === 'combo' && c.chart.series.length !== 2) {
      ctx.issue(
        diag('SC-SPEC-001', 'combo needs exactly two series: bars first, then the line', {
          pointer: ctx.ptr('chart/series'),
        }),
      );
      return;
    }
    const hl = (c.chart.highlight ?? [])
      .map((h) => (typeof h === 'number' ? h : c.chart.categories.indexOf(h)))
      .filter((i) => i >= 0 && i < n);
    const type =
      (
        {
          bar: 'bar',
          column: 'column',
          stacked: 'stacked-column',
          line: 'line',
          combo: 'combo',
        } as const
      )[ctx.variant as 'bar'] ?? 'column';
    if (ctx.variant === 'dumbbell' || ctx.variant === 'slopegraph')
      pairedComparison(ctx, chartBox, c.chart, ctx.variant);
    else if (['bump', 'ridgeline', 'streamgraph'].includes(ctx.variant))
      advancedChart(ctx, chartBox, c.chart, ctx.variant);
    else
      ctx.chart(
        {
          type,
          categories: c.chart.categories,
          series: c.chart.series,
          ...(hl.length ? { highlight: hl } : {}),
          ...(c.chart.unit ? { unit: c.chart.unit } : {}),
          ...(c.chart.decimals !== undefined ? { decimals: c.chart.decimals } : {}),
          ...(c.chart.lineUnit ? { lineUnit: c.chart.lineUnit } : {}),
          ...(c.chart.lineDecimals !== undefined ? { lineDecimals: c.chart.lineDecimals } : {}),
          field: 'chart',
        },
        chartBox,
      );

    const panel = right!;
    ctx.rect(panel, { fill: colors.surface, role: 'panel' });
    ctx.rect(
      { x: panel.x, y: panel.y, w: 0.06, h: panel.h },
      { fill: colors.accent, role: 'panel-accent' },
    );
    const inner = { x: panel.x + 0.3, y: panel.y + 0.3, w: panel.w - 0.55, h: panel.h - 0.6 };
    const head = ctx.text(
      c.takeaway.headline,
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
    if (c.takeaway.points.length) {
      ctx.text(
        ctx.paragraphs(c.takeaway.points, { bullet: true, spaceBefore: 8 }),
        { x: inner.x, y: inner.y + used, w: inner.w, h: inner.h - used },
        { role: 'body', size: 'body', color: colors.ink, field: 'takeaway/points' },
      );
    }
  },
};
