import { z } from 'zod';
import type { Box } from '../engine/scene.ts';
import { card, Rating, takeawayPanel } from './kit.ts';
import type { LayoutDef } from './types.ts';

const Force = z
  .object({
    rating: Rating.describe('Strength of the force: high means it squeezes profit'),
    points: z.array(z.string().max(70)).min(1).max(3).describe('The evidence behind the rating'),
  })
  .strict();

const schema = z
  .object({
    entrants: Force.describe('Threat of new entrants'),
    suppliers: Force.describe('Bargaining power of suppliers'),
    rivalry: Force.describe('Rivalry among existing competitors (the centre)'),
    buyers: Force.describe('Bargaining power of buyers'),
    substitutes: Force.describe('Threat of substitutes'),
    takeaway: z
      .string()
      .max(140)
      .optional()
      .describe('Verdict on industry attractiveness, shown in the bottom-right corner'),
  })
  .strict();

const NAMES = {
  entrants: 'New entrants',
  suppliers: 'Supplier power',
  rivalry: 'Competitive rivalry',
  buyers: 'Buyer power',
  substitutes: 'Substitutes',
} as const;

export const fiveForces: LayoutDef<typeof schema> = {
  id: 'five-forces',
  name: 'Five forces',
  group: 'decide',
  purpose:
    'Use for judging how attractive an industry is: the five competitive forces, each rated and evidenced, with the verdict.',
  useWhen: [
    'Market entry or investment: is the profit pool worth fighting for?',
    'Explaining why margins are falling or protected',
  ],
  avoidWhen: [
    'Comparing named competitors — use options-comparison or bubble-chart',
    'Macro trends rather than industry structure — use pestel',
  ],
  variants: ['diagram'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'German regional freight is attractive: buyers are fragmented and entry is hard',
      content: {
        entrants: {
          rating: 'low',
          points: ['Dense carrier network takes 3–4 years to build', 'Licensing per Land'],
        },
        suppliers: {
          rating: 'medium',
          points: ['Driver shortage lifts wages 6% a year', 'Trucks and fuel are commodities'],
        },
        rivalry: {
          rating: 'medium',
          points: [
            'Top five hold 31% share; long tail of small fleets',
            'Price wars only on long-haul lanes',
          ],
        },
        buyers: {
          rating: 'low',
          points: ['40,000 small shippers, none above 1% of volume', 'Switching costs: IT links'],
        },
        substitutes: {
          rating: 'high',
          points: ['Rail freight subsidised on main corridors', 'Parcel networks move up to 70 kg'],
        },
        takeaway:
          'Enter now: margins hold at 9–11% while rail is a threat only on the main corridors',
      },
      sources: ['market-est'],
    },
  ],
  compose(ctx, c) {
    const { colors } = ctx;
    const a = ctx.body;
    const gx = 0.5;
    const gy = 0.32;
    const cw = (a.w - 2 * gx) / 3;
    const ch = (a.h - 2 * gy) / 3;
    const cell = (col: number, row: number): Box => ({
      x: a.x + col * (cw + gx),
      y: a.y + row * (ch + gy),
      w: cw,
      h: ch,
    });
    const centre = cell(1, 1);
    const pos: [keyof typeof NAMES, Box][] = [
      ['entrants', cell(1, 0)],
      ['suppliers', cell(0, 1)],
      ['buyers', cell(2, 1)],
      ['substitutes', cell(1, 2)],
    ];
    // arrows from each force into the centre
    const stroke = { color: colors.muted, width: 1.5 };
    const cx = centre.x + centre.w / 2;
    const cy = centre.y + centre.h / 2;
    ctx.line(cx, centre.y - gy + 0.04, cx, centre.y - 0.04, stroke, { arrowEnd: true });
    ctx.line(cx, centre.y + centre.h + gy - 0.04, cx, centre.y + centre.h + 0.04, stroke, {
      arrowEnd: true,
    });
    ctx.line(centre.x - gx + 0.04, cy, centre.x - 0.04, cy, stroke, { arrowEnd: true });
    ctx.line(centre.x + centre.w + gx - 0.04, cy, centre.x + centre.w + 0.04, cy, stroke, {
      arrowEnd: true,
    });
    for (const [k, b] of pos)
      card(ctx, b, {
        heading: NAMES[k],
        items: c[k].points,
        field: `${k}/points`,
        rating: c[k].rating,
        ratingField: `${k}/rating`,
        size: 'small',
      });
    card(ctx, centre, {
      heading: NAMES.rivalry,
      items: c.rivalry.points,
      field: 'rivalry/points',
      rating: c.rivalry.rating,
      ratingField: 'rivalry/rating',
      tone: 'accent',
      size: 'small',
    });
    // corners: the rating legend top-left, the verdict bottom-right
    ctx.text(
      'Rating = strength of the force; high squeezes profit',
      { x: a.x, y: a.y, w: cw - 0.4, h: 0.5 },
      { size: 'source', color: colors.muted, maxLines: 2, fixed: true },
    );
    if (c.takeaway) takeawayPanel(ctx, cell(2, 2), c.takeaway);
  },
};
