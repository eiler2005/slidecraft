import { z } from 'zod';
import { ensureContrast } from '../engine/color.ts';
import type { LayoutDef } from './types.ts';

const Activity = z
  .object({
    name: z.string().max(28).describe('Activity, e.g. "Inbound logistics", "Customer success"'),
    points: z
      .array(z.string().max(80))
      .max(3)
      .default([])
      .describe('Where value is created or lost in this activity'),
  })
  .strict();

const schema = z
  .object({
    support: z
      .array(
        z
          .object({
            name: z.string().max(28),
            point: z.string().max(110).optional().describe('One line: what this function adds'),
          })
          .strict(),
      )
      .max(4)
      .default([])
      .describe('Support activities across the chain (infrastructure, people, technology…)'),
    primary: z
      .array(Activity)
      .min(3)
      .max(6)
      .describe('Primary activities in the order value flows to the customer'),
    highlight: z
      .array(z.number().int().min(0))
      .optional()
      .describe('Indices of primary activities where the insight sits'),
    margin: z
      .string()
      .max(14)
      .optional()
      .describe('Label of the margin arrow; defaults to "Margin" in the deck language'),
    takeaway: z.string().max(140).optional().describe('The so-what, in a band under the chain'),
  })
  .strict();

export const valueChain: LayoutDef<typeof schema> = {
  id: 'value-chain',
  name: 'Value chain',
  group: 'decide',
  purpose:
    "Use for showing where a business creates or loses value: Porter's primary activities in order, support activities across them, and the margin.",
  useWhen: [
    'Locating cost or value along the activities of a company or an industry',
    'Showing where a new capability (AI, partner, automation) plugs into the business',
  ],
  avoidWhen: [
    'A process with owners and timing — use process-steps or timeline',
    'Industry profitability — use five-forces',
  ],
  variants: ['porter'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Most of the margin is lost in fulfilment and service, not in production',
      content: {
        support: [
          { name: 'Technology', point: 'Planning on spreadsheets; no shared order data' },
          { name: 'People', point: 'Two-thirds of service staff are temporary' },
          { name: 'Procurement', point: 'Freight bought spot, lane by lane' },
        ],
        primary: [
          { name: 'Inbound', points: ['Supplier lead times 9 days'] },
          { name: 'Production', points: ['OEE 84%, at benchmark'] },
          { name: 'Fulfilment', points: ['12% of orders ship late', 'Express surcharges €3.1M'] },
          { name: 'Sales', points: ['Win rate stable at 31%'] },
          { name: 'Service', points: ['Returns cost 4.2% of revenue'] },
        ],
        highlight: [2, 4],
        takeaway: 'Fix fulfilment and returns first: €5M of margin sits in two activities',
      },
      sources: ['ops-review'],
    },
  ],
  compose(ctx, c) {
    const { colors, theme } = ctx;
    const a = ctx.body;
    const takeH = c.takeaway ? 0.62 : 0;
    const H = a.h - (takeH ? takeH + 0.2 : 0);
    const mw = 0.95; // margin arrowhead
    const L = { x: a.x, y: a.y, w: a.w - mw, h: H };
    const hl = new Set(c.highlight ?? []);

    // margin arrow: the whole chain points to it
    ctx.polygon(
      [
        [L.x + L.w, a.y],
        [a.x + a.w, a.y + H / 2],
        [L.x + L.w, a.y + H],
      ],
      { fill: colors.accentSoft, role: 'margin' },
    );
    ctx.text(
      (c.margin ?? ctx.t('margin')).toUpperCase(),
      { x: L.x + L.w + 0.04, y: a.y + H / 2 - 0.15, w: mw - 0.12, h: 0.3 },
      {
        size: 'small',
        bold: true,
        // the label sits on the tinted arrow: darken the accent until it reads (4.5:1)
        color: ensureContrast(colors.accent, colors.accentSoft),
        maxLines: 1,
        fixed: true,
        ...(c.margin ? { field: 'margin' } : {}),
      },
    );

    // support activities: bands across the chain
    const rowH = 0.46;
    const gap = 0.06;
    const labelW = Math.min(2.3, L.w * 0.24);
    c.support.forEach((s, i) => {
      const y = a.y + i * (rowH + gap);
      ctx.rect({ x: L.x, y, w: L.w, h: rowH }, { fill: colors.surface, role: 'band' });
      ctx.text(
        s.name.toUpperCase(),
        { x: L.x + 0.18, y, w: labelW - 0.2, h: rowH },
        {
          size: 'small',
          bold: true,
          color: colors.muted,
          valign: 'middle',
          maxLines: 1,
          field: `support/${i}/name`,
        },
      );
      if (s.point)
        ctx.text(
          s.point,
          { x: L.x + labelW, y, w: L.w - labelW - 0.2, h: rowH },
          { size: 'small', valign: 'middle', maxLines: 1, field: `support/${i}/point` },
        );
    });

    // primary activities: chevrons in order, evidence underneath
    const top = a.y + c.support.length * (rowH + gap) + (c.support.length ? 0.16 : 0);
    const n = c.primary.length;
    const notch = 0.22;
    const cg = 0.05;
    const cw = (L.w - notch - cg * (n - 1)) / n;
    const ch = 0.62;
    c.primary.forEach((p, i) => {
      const x0 = L.x + i * (cw + cg);
      const x1 = x0 + cw;
      const on = hl.has(i);
      ctx.polygon(
        i === 0
          ? [
              [x0, top],
              [x1, top],
              [x1 + notch, top + ch / 2],
              [x1, top + ch],
              [x0, top + ch],
            ]
          : [
              [x0, top],
              [x1, top],
              [x1 + notch, top + ch / 2],
              [x1, top + ch],
              [x0, top + ch],
              [x0 + notch, top + ch / 2],
            ],
        { fill: on ? colors.accent : colors.surface, role: 'chevron' },
      );
      const tx = x0 + (i === 0 ? 0.16 : notch + 0.08);
      ctx.text(
        p.name,
        { x: tx, y: top, w: x1 - tx + notch * 0.3, h: ch },
        {
          font: 'heading',
          size: theme.type.small + 1,
          bold: true,
          color: on ? colors.accentText : colors.ink,
          valign: 'middle',
          maxLines: 2,
          field: `primary/${i}/name`,
        },
      );
      if (p.points.length) {
        const by = top + ch + 0.18;
        if (on)
          ctx.line(x0 + 0.04, by - 0.06, x0 + 0.5, by - 0.06, { color: colors.accent, width: 2 });
        ctx.text(
          ctx.paragraphs(p.points, { bullet: p.points.length > 1, spaceBefore: 4 }),
          { x: x0 + 0.04, y: by, w: cw - 0.06, h: a.y + H - by },
          { size: 'small', field: `primary/${i}/points` },
        );
      }
    });

    if (c.takeaway) {
      const y = a.y + a.h - takeH;
      ctx.rect({ x: a.x, y, w: a.w, h: takeH }, { fill: colors.accentSoft, role: 'takeaway' });
      ctx.rect({ x: a.x, y, w: 0.06, h: takeH }, { fill: colors.accent, role: 'panel-accent' });
      ctx.text(
        c.takeaway,
        { x: a.x + 0.3, y, w: a.w - 0.5, h: takeH },
        {
          role: 'takeaway',
          font: 'heading',
          size: 'body',
          bold: true,
          valign: 'middle',
          maxLines: 2,
          field: 'takeaway',
        },
      );
    }
  },
};
