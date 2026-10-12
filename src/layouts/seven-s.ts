import { z } from 'zod';
import type { LabelKey } from '../engine/i18n.ts';
import type { Box } from '../engine/scene.ts';
import type { LayoutDef } from './types.ts';

const Status = z.enum(['aligned', 'partial', 'gap']);

const Element = z
  .object({
    status: Status.describe('aligned, partial or gap — how well it supports the change'),
    points: z.array(z.string().max(70)).min(1).max(2).describe('Evidence for the status'),
  })
  .strict();

const schema = z
  .object({
    strategy: Element,
    structure: Element,
    systems: Element,
    sharedValues: Element.describe('The centre: what the organisation believes and rewards'),
    style: Element,
    staff: Element,
    skills: Element,
    takeaway: z
      .string()
      .max(120)
      .optional()
      .describe('Where to act first, shown under the diagram'),
  })
  .strict();

type Key = 'strategy' | 'structure' | 'systems' | 'sharedValues' | 'style' | 'staff' | 'skills';

export const sevenS: LayoutDef<typeof schema> = {
  id: 'seven-s',
  name: 'McKinsey 7S',
  group: 'decide',
  purpose:
    'Use for checking whether an organisation is set up for a change: the seven elements, each rated aligned, partial or gap, with the evidence.',
  useWhen: [
    'Before a transformation, merger or new operating model: what must change besides strategy?',
    'Explaining why a strategy is not landing',
  ],
  avoidWhen: [
    'Market or competitive factors — use swot, pestel or five-forces',
    'A sequence of change steps — use process-steps or timeline',
  ],
  variants: ['diagram'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Strategy and systems are ready for AI; skills and incentives are not',
      content: {
        strategy: { status: 'aligned', points: ['AI in the top three priorities for 2027'] },
        structure: { status: 'partial', points: ['AI team sits in IT, far from the business'] },
        systems: { status: 'aligned', points: ['Data platform and model access in place'] },
        sharedValues: { status: 'partial', points: ['Pilots celebrated; production use is not'] },
        style: { status: 'partial', points: ['Leaders sponsor, but rarely use the tools'] },
        staff: { status: 'gap', points: ['No engineers placed with the business teams'] },
        skills: { status: 'gap', points: ['Few people can scope and evaluate an AI use case'] },
        takeaway: 'Act on staff and skills first: embed engineers with the business owners',
      },
      sources: ['org-review'],
    },
  ],
  compose(ctx, c) {
    const { colors } = ctx;
    const takeH = c.takeaway ? 0.5 : 0;
    const a = { ...ctx.body, h: ctx.body.h - (takeH ? takeH + 0.15 : 0) };
    const cw = Math.min(3.3, a.w / 3.6);
    const ch = Math.min(1.32, a.h / 3.3);
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    const rx = (a.w - cw) / 2;
    const ry = (a.h - ch) / 2;
    // hard elements on top, soft at the bottom, shared values in the centre
    const at = (dx: number, dy: number): Box => ({
      x: cx + dx * rx - cw / 2,
      y: cy + dy * ry - ch / 2,
      w: cw,
      h: ch,
    });
    const slots: [Key, Box][] = [
      ['strategy', at(-0.55, -1)],
      ['structure', at(0.55, -1)],
      ['systems', at(1, 0)],
      ['style', at(0.55, 1)],
      ['staff', at(-0.55, 1)],
      ['skills', at(-1, 0)],
    ];
    const centre = at(0, 0);
    const mid = (b: Box) => [b.x + b.w / 2, b.y + b.h / 2] as const;
    // links behind the cards: the ring and the spokes
    const stroke = { color: colors.rule, width: 1.25 };
    slots.forEach(([, b], i) => {
      const [x1, y1] = mid(b);
      const [x2, y2] = mid(slots[(i + 1) % slots.length]![1]);
      const [x3, y3] = mid(centre);
      ctx.line(x1, y1, x2, y2, stroke, { role: 'link' });
      ctx.line(x1, y1, x3, y3, stroke, { role: 'link' });
    });
    const tone = {
      aligned: { fill: colors.background, ink: colors.muted, stroke: colors.rule },
      partial: { fill: colors.rule, ink: colors.ink, stroke: colors.rule },
      gap: { fill: colors.accent, ink: colors.accentText, stroke: colors.accent },
    } as const;
    const draw = (k: Key, b: Box, centreCard: boolean) => {
      const e = c[k];
      ctx.rect(b, {
        fill: centreCard ? colors.accentSoft : colors.surface,
        stroke: { color: e.status === 'gap' ? colors.accent : colors.rule, width: 1 },
        role: 'panel',
      });
      const pad = 0.16;
      const pillW = 1.05;
      ctx.text(
        ctx.t(k as LabelKey).toUpperCase(),
        { x: b.x + pad, y: b.y + 0.12, w: b.w - 2 * pad - pillW - 0.06, h: 0.26 },
        { size: 'small', bold: true, color: colors.ink, maxLines: 1, fixed: true },
      );
      const t = tone[e.status];
      const pill = { x: b.x + b.w - pad - pillW, y: b.y + 0.12, w: pillW, h: 0.24 };
      ctx.rect(pill, {
        fill: t.fill,
        radius: pill.h / 2,
        stroke: { color: t.stroke, width: 0.75 },
        role: 'rating',
      });
      ctx.text(ctx.t(e.status).toUpperCase(), pill, {
        size: 'source',
        bold: true,
        color: t.ink,
        align: 'center',
        valign: 'middle',
        maxLines: 1,
        fixed: true,
        field: `${k}/status`,
      });
      ctx.text(
        ctx.paragraphs(e.points, { bullet: e.points.length > 1, spaceBefore: 3 }),
        { x: b.x + pad, y: b.y + 0.46, w: b.w - 2 * pad, h: b.h - 0.46 - 0.08 },
        { size: 'small', field: `${k}/points` },
      );
    };
    for (const [k, b] of slots) draw(k, b, false);
    draw('sharedValues', centre, true);
    if (c.takeaway) {
      const y = ctx.body.y + ctx.body.h - takeH;
      ctx.text(
        c.takeaway,
        { x: ctx.body.x, y, w: ctx.body.w, h: takeH },
        {
          role: 'takeaway',
          font: 'heading',
          size: 'body',
          bold: true,
          color: colors.ink,
          align: 'center',
          valign: 'middle',
          maxLines: 1,
          field: 'takeaway',
        },
      );
    }
  },
};
