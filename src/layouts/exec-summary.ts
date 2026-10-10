import { z } from 'zod';
import { cols, rows } from '../engine/format.ts';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    situation: z
      .string()
      .max(260)
      .optional()
      .describe('SCR variant: what the audience already accepts'),
    complication: z
      .string()
      .max(260)
      .optional()
      .describe('SCR variant: what changed / why act now'),
    resolution: z
      .string()
      .max(300)
      .optional()
      .describe('SCR variant: the answer — your recommendation'),
    messages: z
      .array(
        z
          .object({
            headline: z.string().max(110).describe('One claim, a full sentence'),
            detail: z
              .string()
              .max(220)
              .optional()
              .describe('Evidence or implication in one sentence'),
          })
          .strict(),
      )
      .min(2)
      .max(5)
      .optional()
      .describe('key-messages variant: the 2–5 supporting points of the pyramid'),
    ask: z
      .string()
      .max(150)
      .optional()
      .describe('The decision or action requested, shown in an accent band'),
  })
  .strict();

export const execSummary: LayoutDef<typeof schema> = {
  id: 'exec-summary',
  name: 'Executive summary',
  group: 'message',
  purpose:
    'Use for the answer-first summary: the whole argument on one page, readable without the rest of the deck.',
  useWhen: [
    'Slide 2 of most decks',
    'Pre-read summaries for boards and steering committees',
    'Closing synthesis of a research readout',
  ],
  avoidWhen: [
    'A single data point — use kpi-tiles or big-statement',
    'More than five messages — split the deck into sections',
  ],
  variants: ['scr', 'key-messages'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Entering Germany now captures a €40M window before two rivals scale',
      variant: 'scr',
      content: {
        situation:
          'Our UK mid-market business grew 18% a year since 2022 and now funds itself; the product is proven in a regulated market.',
        complication:
          'Two well-funded competitors are preparing German launches in 2027, and switching costs make early share sticky.',
        resolution:
          'Enter Germany in 2027 through a partner-led model, scaling direct sales only after 40 reference clients.',
        ask: 'Approve a €6M phase-1 budget and the partner shortlist at this meeting',
      },
      sources: ['board-pack'],
    },
    {
      title: 'Three facts make the case for a partner-led entry',
      variant: 'key-messages',
      content: {
        messages: [
          {
            headline: 'The German mid-market is 3× our UK base and under-served',
            detail: '41,000 firms in our segment; the top vendor holds under 12% share.',
          },
          {
            headline: 'Partners cut time-to-first-revenue from 18 to 7 months',
            detail: 'Benchmarks from four comparable SaaS entries, 2019–2025.',
          },
          {
            headline: 'Phase 1 is self-limiting: €6M at risk, exit gates every quarter',
            detail: 'Stop if fewer than 15 signed clients by Q4 2027.',
          },
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors, theme } = ctx;
    let area = body;
    if (c.ask) {
      const [main, band] = rows(body, [5.2, 1], 0.22);
      area = main!;
      ctx.rect(band!, { fill: colors.accent, role: 'ask-band' });
      ctx.text(
        `**Decision requested:** ${c.ask}`,
        { x: band!.x + 0.25, y: band!.y, w: band!.w - 0.5, h: band!.h },
        {
          role: 'ask',
          size: 'body',
          color: colors.accentText,
          valign: 'middle',
          maxLines: 2,
          field: 'ask',
        },
      );
    }

    if (ctx.variant === 'scr') {
      const parts = [
        ['Situation', c.situation, 'situation'],
        ['Complication', c.complication, 'complication'],
        ['Resolution', c.resolution, 'resolution'],
      ] as const;
      const missing = parts.filter((p) => !p[1]).map((p) => p[2]);
      if (missing.length) {
        ctx.issue(
          diag(
            'SC-SPEC-001',
            `scr variant needs situation, complication and resolution (missing: ${missing.join(', ')})`,
            { pointer: ctx.ptr(missing[0]) },
          ),
        );
      }
      const bands = rows(area, [1, 1, 1.15], 0.0);
      parts.forEach(([label, text, field], i) => {
        const b = bands[i]!;
        const [lab, txt] = cols(b, [1.6, 8], 0.3);
        if (i > 0) ctx.line(b.x, b.y, b.x + b.w, b.y, { color: colors.rule, width: 0.75 });
        const isAnswer = field === 'resolution';
        ctx.text(
          label.toUpperCase(),
          { x: lab!.x, y: lab!.y + 0.16, w: lab!.w, h: 0.3 },
          {
            role: 'label',
            size: 'small',
            bold: true,
            color: isAnswer ? colors.accent : colors.muted,
            fixed: true,
            maxLines: 1,
          },
        );
        ctx.text(
          text ?? '',
          { x: txt!.x, y: txt!.y + 0.12, w: txt!.w, h: txt!.h - 0.2 },
          {
            role: isAnswer ? 'answer' : 'body',
            size: isAnswer ? theme.type.body + 1 : 'body',
            bold: isAnswer,
            color: colors.ink,
            field,
          },
        );
      });
      return;
    }

    const msgs = c.messages ?? [];
    if (!msgs.length) {
      ctx.issue(
        diag('SC-SPEC-001', 'key-messages variant needs 2–5 messages', {
          pointer: ctx.ptr('messages'),
        }),
      );
      return;
    }
    const bands = rows(
      area,
      msgs.map(() => 1),
      0.0,
    );
    msgs.forEach((m, i) => {
      const b = bands[i]!;
      if (i > 0) ctx.line(b.x, b.y, b.x + b.w, b.y, { color: colors.rule, width: 0.75 });
      const num = { x: b.x, y: b.y + 0.14, w: 0.5, h: 0.5 };
      ctx.text(String(i + 1), num, {
        role: 'number',
        font: 'heading',
        size: theme.type.title,
        bold: true,
        color: colors.accent,
        fixed: true,
        maxLines: 1,
      });
      const [head, det] = cols(
        { x: b.x + 0.7, y: b.y + 0.12, w: b.w - 0.7, h: b.h - 0.2 },
        [1, 1.15],
        0.4,
      );
      ctx.text(m.headline, head!, {
        role: 'headline',
        size: 'heading',
        bold: true,
        field: `messages/${i}/headline`,
      });
      if (m.detail)
        ctx.text(m.detail, det!, {
          role: 'detail',
          size: 'body',
          color: colors.muted,
          field: `messages/${i}/detail`,
        });
    });
  },
};
