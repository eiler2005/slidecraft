import { z } from 'zod';
import { mix, onColor } from '../engine/color.ts';
import { cols } from '../engine/format.ts';
import type { LayoutDef } from './types.ts';

const Result = z.enum(['pass', 'partial', 'fail', 'unknown']);

const schema = z
  .object({
    steps: z
      .array(
        z
          .object({
            check: z.string().max(40).describe('What was checked'),
            source: z.string().max(50).describe('Where the evidence comes from'),
            result: Result,
            finding: z.string().max(100).describe('What the evidence shows'),
          })
          .strict(),
      )
      .min(2)
      .max(5),
    conclusion: z.string().max(130).describe('The answer the chain supports'),
    exception: z.string().max(130).optional().describe('What would change the answer'),
    resultLabels: z
      .object({
        pass: z.string().max(14).optional(),
        partial: z.string().max(14).optional(),
        fail: z.string().max(14).optional(),
        unknown: z.string().max(14).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const evidenceChain: LayoutDef<typeof schema> = {
  id: 'evidence-chain',
  name: 'Evidence chain',
  group: 'decide',
  purpose:
    'Use for showing what an answer rests on: each check, its source and its result in order, ending in the conclusion and what would overturn it.',
  useWhen: [
    'Audit, compliance or due-diligence findings',
    'Answering "how do we know?" for a recommendation',
    'Acceptance decisions that depend on several tests',
  ],
  avoidWhen: [
    'Steps of a process — use process-steps',
    'A single number — use kpi-tiles or big-statement',
  ],
  variants: ['chain'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Four independent checks support releasing the new pricing to all regions',
      content: {
        steps: [
          {
            check: 'Conversion in pilot regions',
            source: 'A/B test, 6 weeks, 41k visits',
            result: 'pass',
            finding: 'Conversion held at 3.1% vs 3.0% control; revenue per visit up 7%',
          },
          {
            check: 'Churn of existing customers',
            source: 'Billing data, Q3',
            result: 'pass',
            finding: 'No change in monthly churn after the notice period',
          },
          {
            check: 'Sales team readiness',
            source: 'Training records',
            result: 'partial',
            finding: '80% certified; the rest finish by 15 November',
          },
          {
            check: 'Legal review in the EU',
            source: 'Counsel memo, Oct 2026',
            result: 'unknown',
            finding: 'Opinion expected next week for two markets',
          },
        ],
        conclusion:
          'Release in all regions on 1 December, with the two EU markets following the legal opinion',
        exception: 'A negative legal opinion would hold those two markets on current prices',
      },
      sources: ['pricing-pilot'],
    },
  ],
  compose(ctx, c) {
    const { body, colors, theme } = ctx;
    const words = {
      pass: 'Confirmed',
      partial: 'Partly',
      fail: 'Not met',
      unknown: 'Open',
      ...c.resultLabels,
    };
    const fill = {
      pass: colors.positive,
      partial: mix(colors.accent, colors.background, 0.55),
      fail: colors.negative,
      unknown: colors.surface,
    };
    const bandH = c.exception ? 1.25 : 0.95;
    const area = { ...body, h: Math.min(3.4, body.h - bandH - 0.3) };
    const n = c.steps.length;
    const cards = cols(area, Array(n).fill(1), 0.36);
    c.steps.forEach((s, i) => {
      const b = cards[i]!;
      ctx.rect(b, { fill: colors.surface, radius: 0.06, role: 'card' });
      ctx.text(
        String(i + 1).padStart(2, '0'),
        { x: b.x + 0.2, y: b.y + 0.18, w: 0.6, h: 0.32 },
        {
          size: 'small',
          bold: true,
          color: colors.accent,
          maxLines: 1,
          fixed: true,
        },
      );
      const pill = { x: b.x + b.w - 1.32, y: b.y + 0.16, w: 1.14, h: 0.32 };
      ctx.rect(pill, {
        fill: fill[s.result],
        radius: 0.16,
        ...(s.result === 'unknown'
          ? { stroke: { color: colors.muted, width: 0.75, dash: 'dash' as const } }
          : {}),
        role: 'result',
      });
      ctx.text(words[s.result], pill, {
        size: theme.type.small - 1,
        bold: true,
        color: onColor(fill[s.result]),
        align: 'center',
        valign: 'middle',
        maxLines: 1,
        fixed: true,
      });
      ctx.text(
        s.check,
        { x: b.x + 0.2, y: b.y + 0.62, w: b.w - 0.4, h: 0.6 },
        {
          size: 'body',
          bold: true,
          maxLines: 2,
          field: `steps/${i}/check`,
        },
      );
      ctx.text(
        s.finding,
        { x: b.x + 0.2, y: b.y + 1.28, w: b.w - 0.4, h: b.h - 1.28 - 0.62 },
        {
          size: 'small',
          field: `steps/${i}/finding`,
        },
      );
      ctx.line(b.x + 0.2, b.y + b.h - 0.56, b.x + b.w - 0.2, b.y + b.h - 0.56, {
        color: colors.rule,
        width: 0.5,
      });
      ctx.text(
        s.source,
        { x: b.x + 0.2, y: b.y + b.h - 0.5, w: b.w - 0.4, h: 0.4 },
        {
          size: 'small',
          italic: true,
          color: colors.muted,
          maxLines: 2,
          field: `steps/${i}/source`,
        },
      );
      if (i < n - 1) {
        const ax = b.x + b.w + 0.06;
        const ay = b.y + b.h / 2;
        ctx.polygon(
          [
            [ax, ay - 0.12],
            [ax + 0.22, ay],
            [ax, ay + 0.12],
          ],
          { fill: colors.muted, role: 'arrow' },
        );
      }
    });
    const by = area.y + area.h + 0.3;
    ctx.rect({ x: body.x, y: by, w: body.w, h: 0.8 }, { fill: colors.accent, role: 'conclusion' });
    ctx.text(
      [{ runs: [{ text: 'Therefore: ', bold: true }, { text: c.conclusion }] }],
      { x: body.x + 0.3, y: by, w: body.w - 0.6, h: 0.8 },
      {
        size: 'body',
        color: colors.accentText,
        valign: 'middle',
        maxLines: 2,
        field: 'conclusion',
      },
    );
    if (c.exception)
      ctx.text(
        [{ runs: [{ text: 'Unless: ', bold: true }, { text: c.exception }] }],
        { x: body.x, y: by + 0.88, w: body.w, h: 0.32 },
        {
          size: 'small',
          color: colors.muted,
          maxLines: 1,
          field: 'exception',
        },
      );
  },
};
