import { z } from 'zod';
import { cols, columns } from '../engine/format.ts';
import { card, Rating, takeawayPanel } from './kit.ts';
import type { LayoutDef } from './types.ts';

const FACTORS = {
  political: 'Political',
  economic: 'Economic',
  social: 'Social',
  technological: 'Technological',
  environmental: 'Environmental',
  legal: 'Legal',
} as const;

const schema = z
  .object({
    factors: z
      .array(
        z
          .object({
            factor: z.enum(
              Object.keys(FACTORS) as [keyof typeof FACTORS, ...(keyof typeof FACTORS)[]],
            ),
            impact: Rating.optional().describe('How much this factor moves the business case'),
            points: z
              .array(z.string().max(90))
              .min(1)
              .max(3)
              .describe('Trend and its effect on us'),
          })
          .strict(),
      )
      .min(3)
      .max(6)
      .describe('In PESTEL order; leave out factors that do not matter'),
    takeaway: z.string().max(140).optional().describe('What the macro picture means, side panel'),
  })
  .strict();

export const pestel: LayoutDef<typeof schema> = {
  id: 'pestel',
  name: 'PESTEL',
  group: 'decide',
  purpose:
    'Use for the macro trends — political, economic, social, technological, environmental, legal — that shape a market, each with its impact.',
  useWhen: [
    'Context for a market entry or long-term strategy',
    'Scanning regulation and technology shifts before a plan',
  ],
  avoidWhen: [
    'Industry structure and competitors — use five-forces',
    'Trends without an effect on the decision — cut them or use key-points',
  ],
  variants: ['grid'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Regulation and labour costs move the German case most; technology works for us',
      content: {
        factors: [
          {
            factor: 'political',
            impact: 'medium',
            points: [
              'Federal push to shift freight to rail by 2030',
              'Toll extended to 3.5 t vans',
            ],
          },
          {
            factor: 'economic',
            impact: 'high',
            points: ['Driver wages up 6% a year', 'E-commerce volume growing 8% a year'],
          },
          {
            factor: 'social',
            impact: 'low',
            points: ['Shippers expect same-day as standard', 'Ageing driver workforce'],
          },
          {
            factor: 'technological',
            impact: 'medium',
            points: ['Real-time load matching is mature', 'Telematics standard in new trucks'],
          },
          {
            factor: 'environmental',
            impact: 'medium',
            points: ['CO₂ reporting for shippers from 2027', 'Empty running is a visible waste'],
          },
          {
            factor: 'legal',
            impact: 'high',
            points: ['Mobility Package limits cabotage', 'Platform worker rules under review'],
          },
        ],
      },
      sources: ['market-est'],
    },
  ],
  compose(ctx, c) {
    const [main, side] = c.takeaway ? cols(ctx.body, [2.5, 1], 0.35) : [ctx.body, undefined];
    const a = main!;
    const n = c.factors.length;
    const perRow = n <= 3 ? n : n === 4 ? 2 : 3;
    const nRows = Math.ceil(n / perRow);
    const gap = 0.16;
    const rh = (a.h - gap * (nRows - 1)) / nRows;
    c.factors.forEach((f, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, n - row * perRow);
      const boxes = columns({ x: a.x, y: a.y + row * (rh + gap), w: a.w, h: rh }, inRow, gap);
      const b = boxes[i - row * perRow]!;
      card(ctx, b, {
        heading: FACTORS[f.factor],
        items: f.points,
        field: `factors/${i}/points`,
        ...(f.impact ? { rating: f.impact, ratingField: `factors/${i}/impact` } : {}),
        tone: f.impact === 'high' ? 'accent' : 'plain',
      });
    });
    if (side && c.takeaway) takeawayPanel(ctx, side, c.takeaway);
  },
};
