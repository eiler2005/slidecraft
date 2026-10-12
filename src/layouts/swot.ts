import { z } from 'zod';
import { cols } from '../engine/format.ts';
import { card, takeawayPanel } from './kit.ts';
import type { LayoutDef } from './types.ts';

const Items = (what: string) =>
  z
    .array(z.string().max(90))
    .min(1)
    .max(4)
    .describe(`${what} — one specific, evidenced point each`);

const schema = z
  .object({
    strengths: Items('Internal, helpful'),
    weaknesses: Items('Internal, harmful'),
    opportunities: Items('External, helpful'),
    threats: Items('External, harmful'),
    takeaway: z
      .string()
      .max(140)
      .optional()
      .describe('with-implications variant: what the four boxes mean for the decision'),
    implications: z
      .array(z.string().max(110))
      .min(2)
      .max(4)
      .optional()
      .describe(
        'with-implications variant: the moves that follow (use S to seize O, fix W before T…)',
      ),
  })
  .strict();

export const swot: LayoutDef<typeof schema> = {
  id: 'swot',
  name: 'SWOT',
  group: 'decide',
  purpose:
    'Use for an internal (strengths, weaknesses) and external (opportunities, threats) view of a position — with the implications that follow.',
  useWhen: [
    'Assessing a business, product or market entry before choosing a strategy',
    'A one-page diagnostic that the recommendation then builds on',
  ],
  avoidWhen: [
    'A list without a so-what — add implications or use key-points',
    'Comparing options — use options-comparison',
  ],
  variants: ['grid', 'with-implications'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Northwind wins on service and data, but must fix cost before low-cost rivals scale',
      variant: 'grid',
      content: {
        strengths: [
          'Highest on-time delivery in the region (97%)',
          'Proprietary demand data across 4,000 stores',
          'Loyal mid-market base: 92% renewal',
        ],
        weaknesses: [
          'Cost per order 18% above the best rival',
          'No self-serve ordering for small customers',
        ],
        opportunities: [
          'Mid-market shift to same-day delivery',
          'Retailers outsourcing last-mile operations',
          'Data products for suppliers',
        ],
        threats: [
          'Two low-cost entrants backed by €300M',
          'Fuel and wage inflation of 6–8% a year',
        ],
      },
      sources: ['ops-review'],
    },
    {
      title:
        'Our data and service lead let us take the same-day market — if we close the cost gap first',
      variant: 'with-implications',
      content: {
        strengths: ['Best on-time delivery (97%)', 'Demand data across 4,000 stores'],
        weaknesses: ['Cost per order 18% above best rival', 'No self-serve for small customers'],
        opportunities: ['Mid-market shift to same-day', 'Retailers outsourcing last mile'],
        threats: ['Low-cost entrants backed by €300M', 'Fuel and wage inflation 6–8% a year'],
        implications: [
          'Launch same-day for mid-market in 2027 using our demand data',
          'Cut cost per order 15% through route density before entrants scale',
          'Build self-serve ordering to defend the small-customer base',
        ],
      },
      sources: ['ops-review'],
    },
  ],
  compose(ctx, c) {
    const { colors } = ctx;
    const withImp = ctx.variant === 'with-implications' && (c.implications?.length || c.takeaway);
    const [main, side] = withImp ? cols(ctx.body, [2.25, 1], 0.35) : [ctx.body, undefined];
    const area = main!;
    // column heads: helpful vs harmful (rows are internal vs external by convention)
    const labH = 0.3;
    const gx = area.x;
    const gy = area.y + labH;
    const gap = 0.14;
    const cw = (area.w - gap) / 2;
    const ch = (area.h - labH - gap) / 2;
    ['Helpful', 'Harmful'].forEach((h, i) =>
      ctx.text(
        h.toUpperCase(),
        { x: gx + i * (cw + gap), y: area.y, w: cw, h: labH - 0.06 },
        {
          size: 'source',
          bold: true,
          color: colors.muted,
          align: 'center',
          maxLines: 1,
          fixed: true,
        },
      ),
    );
    const quads: [string, string[], string][] = [
      ['Strengths', c.strengths, 'strengths'],
      ['Weaknesses', c.weaknesses, 'weaknesses'],
      ['Opportunities', c.opportunities, 'opportunities'],
      ['Threats', c.threats, 'threats'],
    ];
    quads.forEach(([heading, items, field], i) =>
      card(
        ctx,
        { x: gx + (i % 2) * (cw + gap), y: gy + Math.floor(i / 2) * (ch + gap), w: cw, h: ch },
        { heading, items, field, tone: i === 0 || i === 2 ? 'accent' : 'plain' },
      ),
    );
    if (side) {
      if (c.implications?.length) {
        ctx.rect(side, { fill: colors.surface, role: 'panel' });
        ctx.rect(
          { x: side.x, y: side.y, w: 0.06, h: side.h },
          { fill: colors.accent, role: 'panel-accent' },
        );
        ctx.text(
          ctx.t('soWhat').toUpperCase(),
          { x: side.x + 0.3, y: side.y + 0.24, w: side.w - 0.5, h: 0.28 },
          { size: 'small', bold: true, color: colors.accent, maxLines: 1, fixed: true },
        );
        ctx.text(
          ctx.paragraphs(c.implications, { bullet: true, spaceBefore: 10 }),
          { x: side.x + 0.3, y: side.y + 0.62, w: side.w - 0.55, h: side.h - 0.9 },
          { size: 'body', field: 'implications' },
        );
      } else if (c.takeaway) takeawayPanel(ctx, side, c.takeaway);
    }
  },
};
