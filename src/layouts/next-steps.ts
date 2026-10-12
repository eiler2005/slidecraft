import { z } from 'zod';
import { cols, rows } from '../engine/format.ts';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    decision: z
      .string()
      .max(160)
      .optional()
      .describe(
        'The ask, one sentence that starts with a verb: "Approve a €6M phase-1 budget and the partner shortlist". Required for the decision variant',
      ),
    steps: z
      .array(
        z
          .object({
            action: z
              .string()
              .max(110)
              .describe('A concrete action that starts with a verb and has a visible result'),
            owner: z.string().max(30).describe('One accountable person or role, never a team'),
            due: z.string().max(20).describe('A date or milestone: "21 Nov", "Week 48", "Q1 2027"'),
          })
          .strict(),
      )
      .min(1)
      .max(7)
      .describe('The next steps in the order they happen'),
  })
  .strict();

export const nextSteps: LayoutDef<typeof schema> = {
  id: 'next-steps',
  name: 'Next steps',
  group: 'close',
  purpose:
    'Use for the closing slide that turns the recommendation into owned, dated actions, with or without the decision requested.',
  useWhen: [
    'Last content slide before the appendix',
    'Steering committee wrap-up that assigns owners and dates',
    'A decision slide that pairs the ask with the first steps after approval',
  ],
  avoidWhen: [
    'A plan with phases and durations — use timeline or process-steps',
    'Introducing the people involved — use team-cards',
    'Restating the whole argument — use exec-summary',
  ],
  variants: ['actions', 'decision'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Six actions in the next 30 days put the German launch on track',
      variant: 'actions',
      content: {
        steps: [
          {
            action: 'Confirm the phase-1 budget with the board and release the first tranche',
            owner: 'P. Nair',
            due: '14 Nov',
          },
          {
            action: 'Sign letters of intent with the three shortlisted partners',
            owner: 'M. Lindgren',
            due: '28 Nov',
          },
          {
            action: 'Register the German entity and open the operating accounts',
            owner: 'P. Nair',
            due: '5 Dec',
          },
          {
            action: 'Localize the product and complete the data-residency review',
            owner: 'E. Rossi',
            due: '19 Dec',
          },
          {
            action: 'Hire the country lead and two partner managers in Munich',
            owner: 'A. Keller',
            due: 'Q1 2027',
          },
          {
            action: 'Run the first quarterly gate review against the exit criteria',
            owner: 'T. Weber',
            due: 'Mar 2027',
          },
        ],
      },
    },
    {
      title: 'We ask for approval today so the first partner contracts close by year-end',
      variant: 'decision',
      content: {
        decision: 'Approve a €6M phase-1 budget and the partner shortlist',
        steps: [
          {
            action: 'Release the first budget tranche and appoint the program director',
            owner: 'P. Nair',
            due: '14 Nov',
          },
          {
            action: 'Sign letters of intent with the three shortlisted partners',
            owner: 'M. Lindgren',
            due: '28 Nov',
          },
          {
            action: 'Register the German entity and open the operating accounts',
            owner: 'P. Nair',
            due: '5 Dec',
          },
          {
            action: 'Hold the first quarterly gate review against the exit criteria',
            owner: 'T. Weber',
            due: 'Mar 2027',
          },
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors, theme } = ctx;
    const steps = c.steps;

    if (ctx.variant === 'decision') {
      let right = body;
      if (!c.decision) {
        ctx.issue(
          diag('SC-SPEC-001', 'decision variant needs the decision (the ask)', {
            pointer: ctx.ptr('decision'),
          }),
        );
      } else {
        const [panel, rest] = cols(body, [0.38, 0.62], 0.5);
        right = rest!;
        ctx.rect(panel!, { fill: colors.accent, role: 'decision-panel' });
        const inner = {
          x: panel!.x + 0.4,
          y: panel!.y + 0.4,
          w: panel!.w - 0.8,
          h: panel!.h - 0.8,
        };
        ctx.text(
          ctx.t('decision').toUpperCase(),
          { x: inner.x, y: inner.y, w: inner.w, h: 0.3 },
          {
            role: 'label',
            size: 'small',
            bold: true,
            color: colors.accentText,
            fixed: true,
            maxLines: 1,
          },
        );
        ctx.line(inner.x, inner.y + 0.42, inner.x + 0.5, inner.y + 0.42, {
          color: colors.accentText,
          width: 1.5,
        });
        ctx.text(
          c.decision,
          { x: inner.x, y: inner.y + 0.7, w: inner.w, h: inner.h - 0.7 },
          {
            role: 'decision',
            font: 'heading',
            sizes: [theme.type.title - 2, theme.type.title - 4, theme.type.heading + 1],
            bold: true,
            color: colors.accentText,
            lineHeight: 1.18,
            field: 'decision',
          },
        );
      }

      const n = steps.length;
      const rowH = Math.min(1.0, right.h / n);
      const y0 = right.y + (n * rowH < right.h ? 0 : 0);
      steps.forEach((s, i) => {
        const y = y0 + i * rowH;
        ctx.line(right.x, y, right.x + right.w, y, {
          color: i === 0 ? colors.ink : colors.rule,
          width: i === 0 ? 1 : 0.5,
        });
        ctx.text(
          String(i + 1),
          { x: right.x, y, w: 0.55, h: rowH },
          {
            role: 'number',
            font: 'heading',
            size: theme.type.title,
            bold: true,
            color: colors.accent,
            valign: 'middle',
            fixed: true,
            maxLines: 1,
          },
        );
        const textX = right.x + 0.65;
        const textW = right.w - 0.65;
        const metaH = 0.24;
        const action = ctx.text(
          s.action,
          { x: textX, y: y + 0.08, w: textW, h: rowH - 0.16 - metaH },
          {
            role: 'action',
            size: 'body',
            bold: true,
            color: colors.ink,
            maxLines: 2,
            field: `steps/${i}/action`,
          },
        );
        const used = Math.min(action.contentHeight, action.box.h) + 0.04 + metaH;
        const top = y + (rowH - used) / 2;
        action.box = { ...action.box, y: top, h: Math.min(action.contentHeight, action.box.h) };
        ctx.text(
          `${s.owner} · ${s.due}`,
          { x: textX, y: top + action.box.h + 0.04, w: textW, h: metaH },
          {
            role: 'meta',
            size: 'small',
            color: colors.muted,
            maxLines: 1,
            fixed: true,
            field: `steps/${i}/owner`,
          },
        );
      });
      ctx.line(right.x, y0 + n * rowH, right.x + right.w, y0 + n * rowH, {
        color: colors.rule,
        width: 0.5,
      });
      return;
    }

    let area = body;
    if (c.decision) {
      const [main, band] = rows(body, [5.2, 1], 0.22);
      area = main!;
      ctx.rect(band!, { fill: colors.accent, role: 'ask-band' });
      ctx.text(
        `**Decision requested:** ${c.decision}`,
        { x: band!.x + 0.25, y: band!.y, w: band!.w - 0.5, h: band!.h },
        {
          role: 'ask',
          size: 'body',
          color: colors.accentText,
          valign: 'middle',
          maxLines: 2,
          field: 'decision',
        },
      );
    }
    ctx.table(
      {
        header: ['Next step', 'Owner', 'Due'],
        rows: steps.map((s) => [s.action, s.owner, s.due]),
        colWeights: [5, 1.6, 1.2],
        firstColBold: false,
        size: theme.type.body,
        field: 'steps',
      },
      area,
    );
  },
};
