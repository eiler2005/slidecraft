import { z } from 'zod';
import { mix } from '../engine/color.ts';
import { rows } from '../engine/format.ts';
import type { Box } from '../engine/scene.ts';
import { diag } from '../qa/codes.ts';
import type { ComposeContext, LayoutDef } from './types.ts';

const Status = z
  .enum(['confirmed', 'rejected', 'open'])
  .describe('Hypothesis status after analysis');

const Leaf = z
  .object({
    label: z.string().max(70),
    value: z
      .string()
      .max(12)
      .optional()
      .describe('driver variant: the number this node contributes'),
    status: Status.optional(),
  })
  .strict();

const schema = z
  .object({
    root: z
      .object({
        label: z.string().max(90).describe('The question (issue) or the top metric (driver)'),
        value: z.string().max(12).optional(),
      })
      .strict(),
    branches: z
      .array(
        z
          .object({
            label: z.string().max(60),
            value: z.string().max(12).optional(),
            status: Status.optional(),
            leaves: z.array(Leaf).min(1).max(4),
          })
          .strict(),
      )
      .min(2)
      .max(4)
      .describe('MECE sub-questions or drivers; at most 10 leaves in total'),
    takeaway: z.string().max(140).optional(),
  })
  .strict();

const STATUS_LABEL = { confirmed: 'Confirmed', rejected: 'Rejected', open: 'Open' } as const;

function statusDot(
  ctx: ComposeContext,
  x: number,
  y: number,
  s: 'confirmed' | 'rejected' | 'open',
) {
  const c = ctx.colors;
  const r = 0.07;
  const box = { x: x - r, y: y - r, w: 2 * r, h: 2 * r };
  if (s === 'confirmed') ctx.ellipse(box, { fill: c.positive, role: 'status' });
  else if (s === 'rejected')
    ctx.ellipse(box, { fill: mix(c.muted, c.background, 0.35), role: 'status' });
  else
    ctx.ellipse(box, {
      fill: c.background,
      stroke: { color: c.accent, width: 1.25 },
      role: 'status',
    });
}

export const issueTree: LayoutDef<typeof schema> = {
  id: 'issue-tree',
  name: 'Issue / driver tree',
  group: 'decide',
  purpose:
    'Use for breaking a question into MECE sub-questions (issue tree) or a metric into its drivers (driver tree).',
  useWhen: [
    'Structuring a problem before the analysis (hypothesis tree)',
    'Showing which hypotheses the analysis confirmed or rejected',
    'Explaining how a top-line metric decomposes into drivers',
  ],
  avoidWhen: [
    'A sequence of steps — use process-steps',
    'More than ~10 leaves — split into two slides',
  ],
  variants: ['issue', 'driver'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Margin fell because of mix and price, not cost — two of six hypotheses hold',
      variant: 'issue',
      content: {
        root: { label: 'Why did operating margin fall 4 points in FY2025?' },
        branches: [
          {
            label: 'Revenue mix shifted',
            status: 'confirmed',
            leaves: [
              { label: 'More low-margin SMB deals', status: 'confirmed' },
              { label: 'Fewer services attached', status: 'open' },
            ],
          },
          {
            label: 'Prices eroded',
            status: 'confirmed',
            leaves: [
              { label: 'Discounting above policy', status: 'confirmed' },
              { label: 'Competitor price cuts', status: 'rejected' },
            ],
          },
          {
            label: 'Costs rose',
            status: 'rejected',
            leaves: [
              { label: 'Cloud costs per user', status: 'rejected' },
              { label: 'Support headcount', status: 'rejected' },
            ],
          },
        ],
        takeaway:
          'Fix discount governance and deal mix first; cost programmes would not move margin',
      },
      sources: ['finance-fy25'],
    },
    {
      title: 'Revenue per store is driven by traffic, conversion and basket — conversion lags most',
      variant: 'driver',
      content: {
        root: { label: 'Revenue per store, weekly', value: '€84k' },
        branches: [
          {
            label: 'Traffic',
            value: '6,100',
            leaves: [
              { label: 'Walk-ins', value: '4,800' },
              { label: 'Click & collect', value: '1,300' },
            ],
          },
          {
            label: 'Conversion',
            value: '21%',
            status: 'open',
            leaves: [
              { label: 'Staffed hours', value: '62%' },
              { label: 'Stock availability', value: '91%' },
            ],
          },
          {
            label: 'Basket size',
            value: '€65',
            leaves: [
              { label: 'Items per basket', value: '3.1' },
              { label: 'Price per item', value: '€21' },
            ],
          },
        ],
      },
      sources: ['finance-fy25'],
    },
  ],
  compose(ctx, c) {
    const { colors, theme } = ctx;
    const nLeaves = c.branches.reduce((a, b) => a + b.leaves.length, 0);
    if (nLeaves > 10)
      ctx.issue(
        diag('SC-SPEC-001', `${nLeaves} leaves — keep issue trees to 10 or fewer`, {
          pointer: ctx.ptr('branches'),
        }),
      );
    let area = ctx.body;
    if (c.takeaway) {
      const [main, band] = rows(ctx.body, [6, 0.75], 0.2);
      area = main!;
      ctx.rect(band!, { fill: colors.surface, role: 'takeaway-band' });
      ctx.rect(
        { x: band!.x, y: band!.y, w: 0.06, h: band!.h },
        { fill: colors.accent, role: 'takeaway-accent' },
      );
      ctx.text(
        c.takeaway,
        { x: band!.x + 0.25, y: band!.y, w: band!.w - 0.5, h: band!.h },
        { size: 'body', bold: true, valign: 'middle', maxLines: 2, field: 'takeaway' },
      );
    }
    const driver = ctx.variant === 'driver';
    const rootW = 2.7;
    const brW = 3.1;
    const gap = 0.55;
    const rootX = area.x;
    const brX = rootX + rootW + gap;
    const leafX = brX + brW + gap;
    const leafW = area.x + area.w - leafX - (driver ? 0 : 0.3);
    const unit = area.h / nLeaves;
    const leafH = Math.min(0.62, unit * 0.82);

    const node = (
      b: Box,
      label: string,
      value: string | undefined,
      opts: { strong?: boolean; field: string; fill?: string },
    ) => {
      ctx.rect(b, {
        fill: opts.fill ?? colors.surface,
        stroke: opts.strong ? undefined : { color: colors.rule, width: 0.75 },
        radius: 0.06,
        role: 'node',
      });
      const inner = { x: b.x + 0.14, y: b.y + 0.04, w: b.w - 0.28, h: b.h - 0.08 };
      const ink = opts.fill === colors.accent ? colors.accentText : colors.ink;
      if (value && b.h >= 0.9) {
        // tall node (the root): value on top, label below at full width
        ctx.text(
          value,
          { x: inner.x, y: inner.y + 0.04, w: inner.w, h: 0.36 },
          {
            font: 'heading',
            size: theme.type.body + 3,
            bold: true,
            color: opts.fill === colors.accent ? colors.accentText : colors.accent,
            maxLines: 1,
            fixed: true,
            field: `${opts.field}/value`,
          },
        );
        ctx.text(
          label,
          { x: inner.x, y: inner.y + 0.42, w: inner.w, h: inner.h - 0.42 },
          {
            size: theme.type.body - 1,
            bold: !!opts.strong,
            color: ink,
            field: `${opts.field}/label`,
          },
        );
      } else if (value) {
        const vw = 0.8;
        ctx.text(
          label,
          { ...inner, w: inner.w - vw - 0.08 },
          {
            size: theme.type.body - 1,
            bold: !!opts.strong,
            color: ink,
            valign: 'middle',
            maxLines: 3,
            lineHeight: 1.08,
            field: `${opts.field}/label`,
          },
        );
        ctx.text(
          value,
          { x: inner.x + inner.w - vw, y: inner.y, w: vw, h: inner.h },
          {
            font: 'heading',
            size: theme.type.body + 1,
            bold: true,
            color: opts.fill === colors.accent ? colors.accentText : colors.accent,
            align: 'right',
            valign: 'middle',
            maxLines: 1,
            fixed: true,
            field: `${opts.field}/value`,
          },
        );
      } else {
        ctx.text(label, inner, {
          size: theme.type.body - 1,
          bold: !!opts.strong,
          color: ink,
          valign: 'middle',
          maxLines: 3,
          field: `${opts.field}/label`,
        });
      }
    };

    // root
    const rootH = Math.min(area.h, Math.max(1.0, leafH * 2));
    const rootBox = { x: rootX, y: area.y + area.h / 2 - rootH / 2, w: rootW, h: rootH };
    node(rootBox, c.root.label, c.root.value, { strong: true, field: 'root', fill: colors.accent });
    const rootMid = rootBox.y + rootH / 2;
    const spineX = rootX + rootW + gap / 2;
    ctx.line(rootX + rootW, rootMid, spineX, rootMid, { color: colors.muted, width: 1 });

    let cursor = area.y;
    const brMids: number[] = [];
    c.branches.forEach((br, bi) => {
      const span = unit * br.leaves.length;
      const brH = Math.min(span * 0.85, Math.max(leafH, 0.62));
      const brBox = { x: brX, y: cursor + span / 2 - brH / 2, w: brW, h: brH };
      const mid = brBox.y + brH / 2;
      brMids.push(mid);
      ctx.line(spineX, mid, brX, mid, { color: colors.muted, width: 1 });
      node(brBox, br.label, br.value, { strong: true, field: `branches/${bi}` });
      if (br.status) statusDot(ctx, brX + brW - 0.12, brBox.y + 0.12, br.status);
      const lspine = brX + brW + gap / 2;
      ctx.line(brX + brW, mid, lspine, mid, { color: colors.rule, width: 0.75 });
      const lmids: number[] = [];
      br.leaves.forEach((lf, li) => {
        const ly = cursor + unit * li + (unit - leafH) / 2;
        const lb = { x: leafX, y: ly, w: leafW, h: leafH };
        lmids.push(ly + leafH / 2);
        ctx.line(lspine, ly + leafH / 2, leafX, ly + leafH / 2, {
          color: colors.rule,
          width: 0.75,
        });
        const dim = lf.status === 'rejected';
        node(lb, lf.label, lf.value, {
          field: `branches/${bi}/leaves/${li}`,
          ...(dim ? { fill: mix(colors.surface, colors.background, 0.5) } : {}),
        });
        if (lf.status) statusDot(ctx, leafX + leafW + 0.17, ly + leafH / 2, lf.status);
      });
      if (lmids.length > 1)
        ctx.line(lspine, Math.min(...lmids, mid), lspine, Math.max(...lmids, mid), {
          color: colors.rule,
          width: 0.75,
        });
      cursor += span;
    });
    ctx.line(spineX, Math.min(...brMids, rootMid), spineX, Math.max(...brMids, rootMid), {
      color: colors.muted,
      width: 1,
    });

    // legend for statuses
    const used = new Set(
      [
        ...c.branches.map((b) => b.status),
        ...c.branches.flatMap((b) => b.leaves.map((l) => l.status)),
      ].filter((s): s is 'confirmed' | 'rejected' | 'open' => !!s),
    );
    if (used.size) {
      let lx = rootX;
      const ly = area.y + area.h - 0.2;
      for (const s of ['confirmed', 'rejected', 'open'] as const) {
        if (!used.has(s)) continue;
        statusDot(ctx, lx + 0.07, ly, s);
        ctx.text(
          STATUS_LABEL[s],
          { x: lx + 0.2, y: ly - 0.12, w: 0.95, h: 0.24 },
          { size: 'small', color: colors.muted, maxLines: 1, fixed: true },
        );
        lx += 1.15;
      }
    }
  },
};
