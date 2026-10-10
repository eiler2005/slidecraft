import { z } from 'zod';
import { cols } from '../engine/format.ts';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    header: z
      .array(z.string().max(28))
      .min(2)
      .max(6)
      .describe('Column headings with units: "Revenue, €M"'),
    rows: z
      .array(z.array(z.string().max(80)))
      .min(2)
      .max(10)
      .describe('Data rows; every row has exactly one cell per header column'),
    highlightRow: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Index of the one data row the title is about'),
    highlightCol: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Index of the one column to emphasise, e.g. the recommended option'),
    align: z
      .array(z.enum(['left', 'center', 'right']))
      .max(6)
      .optional()
      .describe('Per-column alignment; right-align numeric columns'),
    colWeights: z
      .array(z.number().positive())
      .max(6)
      .optional()
      .describe('Relative column widths (default: first column 1.3, others 1)'),
    note: z
      .string()
      .max(160)
      .optional()
      .describe('Footnote under the table: definitions, exclusions, units'),
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

export const dataTable: LayoutDef<typeof schema> = {
  id: 'data-table',
  name: 'Data table',
  group: 'numbers',
  purpose:
    'Use for a compact table of exact values where the reader needs to look up or compare several attributes at once.',
  useWhen: [
    'Exact figures matter more than shape (financials, benchmarks, price lists)',
    'Several attributes per item, with one row or column carrying the message',
    'Backup or appendix pages that document the numbers behind a chart',
  ],
  avoidWhen: [
    'A trend or ranking that the eye should see — use chart-takeaway',
    'Scoring options against criteria for a decision — use options-comparison',
    'More than ten rows or six columns — summarise and move the rest to backup',
  ],
  variants: ['plain', 'with-takeaway'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Germany is the largest and least concentrated of the four target markets',
      variant: 'plain',
      content: {
        header: [
          'Market',
          'Target firms',
          'Avg. deal size, €K',
          'Top-vendor share',
          'Entry cost, €M',
        ],
        rows: [
          ['Germany', '41,000', '68', '12%', '6.0'],
          ['France', '28,000', '61', '19%', '5.2'],
          ['Netherlands', '9,500', '74', '24%', '3.1'],
          ['Nordics', '12,000', '82', '31%', '4.4'],
        ],
        highlightRow: 0,
        align: ['left', 'right', 'right', 'right', 'right'],
        colWeights: [1.5, 1, 1.2, 1.2, 1],
        note: 'Target firms: companies with 250–5,000 employees in regulated industries. Entry cost covers three years.',
      },
      sources: ['market-study'],
    },
    {
      title: 'Enterprise wins on margin and retention, while SMB lags on every measure',
      variant: 'with-takeaway',
      content: {
        header: ['Segment', 'Revenue, €M', 'Margin', 'Net retention'],
        rows: [
          ['Enterprise', '19.4', '31%', '118%'],
          ['Mid-market', '14.6', '27%', '112%'],
          ['SMB', '8.0', '11%', '94%'],
        ],
        highlightRow: 0,
        align: ['left', 'right', 'right', 'right'],
        note: 'Margin is contribution margin after support and success costs.',
        takeaway: {
          headline: 'SMB grows revenue but destroys value',
          points: [
            'Support cost per SMB account is 3× the enterprise level',
            'Net retention below 100% means growth depends on new logos',
          ],
        },
      },
      sources: ['finance-fy25'],
    },
  ],
  compose(ctx, c) {
    const { body, colors } = ctx;
    const withPanel = ctx.variant === 'with-takeaway';
    const ncol = c.header.length;

    if (withPanel && !c.takeaway) {
      ctx.issue(
        diag('SC-SPEC-001', 'with-takeaway variant needs a takeaway (headline and points)', {
          pointer: ctx.ptr('takeaway'),
        }),
      );
    }
    const badRow = c.rows.findIndex((r) => r.length !== ncol);
    if (badRow >= 0) {
      ctx.issue(
        diag(
          'SC-SPEC-001',
          `Row ${badRow} has ${c.rows[badRow]!.length} cells but the header has ${ncol} columns`,
          { pointer: ctx.ptr(`rows/${badRow}`) },
        ),
      );
      return;
    }
    if (c.colWeights && c.colWeights.length !== ncol) {
      ctx.issue(
        diag('SC-SPEC-001', `colWeights has ${c.colWeights.length} entries for ${ncol} columns`, {
          pointer: ctx.ptr('colWeights'),
        }),
      );
    }
    if (c.align && c.align.length !== ncol) {
      ctx.issue(
        diag('SC-SPEC-001', `align has ${c.align.length} entries for ${ncol} columns`, {
          pointer: ctx.ptr('align'),
        }),
      );
    }

    const [left, right] = withPanel ? cols(body, [2.1, 1], 0.4) : [body, undefined];
    const noteH = c.note ? 0.55 : 0;
    const tableBox = { ...left!, h: left!.h - noteH };
    const hlRow = c.highlightRow !== undefined && c.highlightRow < c.rows.length;
    const hlCol = c.highlightCol !== undefined && c.highlightCol < ncol;

    const tbl = ctx.table(
      {
        header: c.header,
        rows: c.rows,
        ...(c.colWeights?.length === ncol ? { colWeights: c.colWeights } : {}),
        ...(c.align?.length === ncol ? { align: c.align } : {}),
        ...(hlRow ? { highlightRow: c.highlightRow } : {}),
        ...(hlCol ? { highlightCol: c.highlightCol } : {}),
        field: 'rows',
      },
      tableBox,
    );

    if (c.note) {
      ctx.text(
        c.note,
        { x: left!.x, y: tbl.box.y + tbl.box.h + 0.15, w: left!.w, h: 0.45 },
        { role: 'table-note', size: 'small', color: colors.muted, maxLines: 2, field: 'note' },
      );
    }

    if (withPanel && right && c.takeaway) {
      ctx.rect(right, { fill: colors.surface, role: 'panel' });
      ctx.rect(
        { x: right.x, y: right.y, w: 0.06, h: right.h },
        { fill: colors.accent, role: 'panel-accent' },
      );
      const inner = { x: right.x + 0.3, y: right.y + 0.3, w: right.w - 0.55, h: right.h - 0.6 };
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
    }
  },
};
