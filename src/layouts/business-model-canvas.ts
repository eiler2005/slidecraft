import { z } from 'zod';
import type { Box } from '../engine/scene.ts';
import { card } from './kit.ts';
import type { LayoutDef } from './types.ts';

const Tall = (what: string) => z.array(z.string().max(60)).min(1).max(5).describe(what);
const Half = (what: string) => z.array(z.string().max(50)).min(1).max(3).describe(what);

const schema = z
  .object({
    partners: Tall('Key partners: who we rely on'),
    activities: Half('Key activities: what we must do well'),
    resources: Half('Key resources: what we must own'),
    value: Tall('Value propositions: why customers choose us (highlighted)'),
    relationships: Half('Customer relationships: how we win and keep customers'),
    channels: Half('Channels: how we reach and deliver'),
    segments: Tall('Customer segments: for whom'),
    costs: z.array(z.string().max(70)).min(1).max(3).describe('Cost structure: biggest costs'),
    revenue: z.array(z.string().max(70)).min(1).max(3).describe('Revenue streams: how we earn'),
  })
  .strict();

export const businessModelCanvas: LayoutDef<typeof schema> = {
  id: 'business-model-canvas',
  name: 'Business model canvas',
  group: 'decide',
  purpose:
    'Use for the whole business model on one page: segments, value proposition, channels, relationships, revenue, resources, activities, partners and costs.',
  useWhen: [
    'A new business, product line or venture explained end to end',
    'Comparing today’s model with a target model (one canvas per slide)',
  ],
  avoidWhen: [
    'Only the economics matter — use waterfall or data-table',
    'Only the customer value matters — use key-points',
  ],
  variants: ['canvas'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Fabrikam earns a take rate on capacity that carriers already drive',
      content: {
        partners: ['Regional carriers', 'Telematics providers', 'Payment provider'],
        activities: ['Real-time matching', 'Carrier onboarding'],
        resources: ['Live capacity data', 'Pricing engine'],
        value: [
          'Same-day part loads at up to 40% below full-load price',
          'Booking in under a minute',
          'Carriers earn on empty space',
        ],
        relationships: ['Self-serve with account managers for top 100'],
        channels: ['Web app and API', 'Carrier mobile app'],
        segments: ['Small shippers under 50 loads a month', 'Regional carriers with 5–200 trucks'],
        costs: ['Engineering and data (45%)', 'Sales and onboarding (30%)'],
        revenue: ['21% take rate per load', 'Premium tracking subscription'],
      },
      sources: ['fab-metrics'],
    },
  ],
  compose(ctx, c) {
    const b = ctx.body;
    const gap = 0.1;
    const cw = (b.w - 4 * gap) / 5;
    const topH = (b.h - gap) * 0.7;
    const botH = b.h - gap - topH;
    const halfH = (topH - gap) / 2;
    const col = (i: number) => b.x + i * (cw + gap);
    const at = (i: number, top: number, h: number): Box => ({ x: col(i), y: top, w: cw, h });
    const y = b.y;
    const blocks: [string, string[], string, Box, boolean?][] = [
      ['Key partners', c.partners, 'partners', at(0, y, topH)],
      ['Key activities', c.activities, 'activities', at(1, y, halfH)],
      ['Key resources', c.resources, 'resources', at(1, y + halfH + gap, halfH)],
      ['Value propositions', c.value, 'value', at(2, y, topH), true],
      ['Relationships', c.relationships, 'relationships', at(3, y, halfH)],
      ['Channels', c.channels, 'channels', at(3, y + halfH + gap, halfH)],
      ['Customer segments', c.segments, 'segments', at(4, y, topH)],
      [
        'Cost structure',
        c.costs,
        'costs',
        { x: b.x, y: y + topH + gap, w: (b.w - gap) / 2, h: botH },
      ],
      [
        'Revenue streams',
        c.revenue,
        'revenue',
        { x: b.x + (b.w + gap) / 2, y: y + topH + gap, w: (b.w - gap) / 2, h: botH },
      ],
    ];
    for (const [heading, items, field, box, accent] of blocks)
      card(ctx, box, { heading, items, field, size: 'small', tone: accent ? 'accent' : 'plain' });
  },
};
