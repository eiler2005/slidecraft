import { z } from 'zod';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    sections: z
      .array(
        z
          .object({
            title: z.string().max(60).describe('Section name, a noun phrase: "Market opportunity"'),
            summary: z
              .string()
              .max(110)
              .optional()
              .describe('One line on what the audience will learn or decide in this section'),
          })
          .strict(),
      )
      .min(2)
      .max(7)
      .describe('The sections of the deck, in order'),
    current: z
      .number()
      .int()
      .min(0)
      .max(6)
      .optional()
      .describe(
        '0-based index of the active section. Required for section-divider; on the agenda it highlights a section when the agenda is repeated as a progress marker',
      ),
  })
  .strict();

const pad2 = (n: number) => String(n).padStart(2, '0');

export const agenda: LayoutDef<typeof schema> = {
  id: 'agenda',
  name: 'Agenda and section divider',
  group: 'frame',
  purpose:
    'Use for the agenda at the start of a deck, or a section divider that shows where the audience is in the story.',
  useWhen: [
    'Opening agenda for a deck longer than ten slides',
    'Section break that resets attention and shows progress through the sections',
    'Repeated agenda with the active section highlighted',
  ],
  avoidWhen: [
    'A cover or closing slide — use title',
    'A single big sentence that carries the message — use big-statement',
    'A sequence with durations or owners — use process-steps or timeline',
  ],
  variants: ['agenda', 'section-divider'],
  frame: 'none',
  master: 'divider',
  schema,
  examples: [
    {
      title: 'Agenda',
      variant: 'agenda',
      content: {
        sections: [
          {
            title: 'Market opportunity',
            summary: 'Why the German mid-market is large, under-served and open until 2027',
          },
          {
            title: 'Entry options',
            summary: 'Direct, partner-led and acquisition routes compared on risk and speed',
          },
          {
            title: 'Recommended plan',
            summary: 'A partner-led launch with quarterly exit gates',
          },
          {
            title: 'Financials and risks',
            summary: 'Investment, payback and what could go wrong',
          },
          { title: 'Decision and next steps', summary: 'What we ask the board to approve today' },
        ],
      },
    },
    {
      title: 'Entry options',
      variant: 'section-divider',
      content: {
        current: 1,
        sections: [
          { title: 'Market opportunity', summary: 'Large, under-served, open until 2027' },
          {
            title: 'Entry options',
            summary: 'Direct, partner-led and acquisition routes compared on risk and speed',
          },
          { title: 'Recommended plan' },
          { title: 'Financials and risks' },
          { title: 'Decision and next steps' },
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { page, colors, theme } = ctx;
    const left = 0.9;
    const n = c.sections.length;
    const titleColor = colors.titleInk ?? colors.ink;
    const bold = theme.type.titleWeight === 'bold';

    if (ctx.variant === 'section-divider') {
      const cur = c.current;
      if (cur === undefined || cur >= n) {
        ctx.issue(
          diag(
            'SC-SPEC-001',
            cur === undefined
              ? 'section-divider variant needs current (0-based index of the active section)'
              : `current (${cur}) is outside the ${n} sections`,
            { pointer: ctx.ptr('current') },
          ),
        );
      }
      const active = cur !== undefined && cur < n ? cur : -1;

      // Left: large number and section name, vertically centred as a group.
      const leftW = (page.w - 2 * left) * 0.57;
      const numberH = Math.max(1.0, ((theme.type.cover + 16) * 1.05) / 72);
      const gap = 0.25;
      const summary = active >= 0 ? c.sections[active]?.summary : undefined;
      const titleNode = ctx.text(
        ctx.slide.title,
        { x: left, y: 0, w: leftW, h: 3.0 },
        {
          role: 'title',
          font: 'heading',
          sizes: [
            theme.type.cover,
            theme.type.cover - 4,
            theme.type.cover - 8,
            theme.type.cover - 12,
            theme.type.cover - 16,
          ],
          bold,
          color: titleColor,
          lineHeight: 1.08,
          maxLines: 4,
          field: 'title',
        },
      );
      const titleH = Math.min(titleNode.contentHeight, 3.0);
      const summaryH = summary ? 0.9 : 0;
      const summaryGap = summary ? 0.3 : 0;
      const groupH = numberH + gap + titleH + summaryGap + summaryH;
      const top = Math.max(0.9, (page.h - groupH) / 2 - 0.1);
      titleNode.box = { ...titleNode.box, y: top + numberH + gap, h: titleH };
      ctx.text(
        pad2(active + 1),
        { x: left, y: top, w: leftW, h: numberH },
        {
          role: 'number',
          font: 'heading',
          size: theme.type.cover + 16,
          bold: true,
          color: colors.accent,
          fixed: true,
          maxLines: 1,
          lineHeight: 1.0,
          valign: 'top',
        },
      );
      if (summary) {
        ctx.text(
          summary,
          { x: left, y: top + numberH + gap + titleH + summaryGap, w: leftW - 0.4, h: summaryH },
          {
            role: 'subtitle',
            size: 'subtitle',
            color: colors.muted,
            maxLines: 3,
            field: `sections/${active}/summary`,
          },
        );
      }

      // Right: compact list of every section, the active one marked in accent.
      const listX = left + leftW + 0.9;
      const listW = page.w - left - listX;
      const listTop = 1.25;
      const listH = page.h - 1.25 - 1.35;
      const rowH = Math.min(0.78, listH / n);
      const total = rowH * n;
      const y0 = listTop + (listH - total) / 2;
      ctx.line(
        listX - 0.45,
        y0,
        listX - 0.45,
        y0 + total,
        { color: colors.rule, width: 0.75 },
        { role: 'divider-rule' },
      );
      c.sections.forEach((s, i) => {
        const y = y0 + i * rowH;
        const isCur = i === active;
        if (i > 0) ctx.line(listX, y, listX + listW, y, { color: colors.rule, width: 0.5 });
        if (isCur) {
          ctx.rect(
            { x: listX - 0.49, y: y + 0.12, w: 0.08, h: rowH - 0.24 },
            { fill: colors.accent, role: 'marker' },
          );
        }
        ctx.text(
          pad2(i + 1),
          { x: listX, y, w: 0.5, h: rowH },
          {
            role: 'number',
            size: 'body',
            bold: true,
            color: isCur ? colors.accent : colors.muted,
            valign: 'middle',
            fixed: true,
            maxLines: 1,
          },
        );
        ctx.text(
          s.title,
          { x: listX + 0.55, y, w: listW - 0.55, h: rowH },
          {
            role: 'section',
            size: 'body',
            bold: isCur,
            color: isCur ? colors.accent : colors.muted,
            valign: 'middle',
            maxLines: 2,
            field: `sections/${i}/title`,
          },
        );
      });
      return;
    }

    // agenda: heading, then a numbered list of sections with hairlines between rows.
    const width = page.w - 2 * left;
    ctx.rect({ x: left, y: 0.62, w: 0.55, h: 0.05 }, { fill: colors.accent, role: 'accent-bar' });
    ctx.text(
      ctx.slide.title,
      { x: left, y: 0.8, w: width, h: 0.75 },
      {
        role: 'title',
        font: 'heading',
        size: theme.type.title + 8,
        bold,
        color: titleColor,
        maxLines: 1,
        field: 'title',
      },
    );
    const listTop = 1.95;
    const listH = page.h - listTop - 1.15;
    const hasSummary = c.sections.some((s) => s.summary);
    const rowH = Math.min(hasSummary ? 0.92 : 0.7, listH / n);
    const y0 = listTop;
    const numW = 1.15;
    const active = c.current !== undefined && c.current < n ? c.current : -1;
    c.sections.forEach((s, i) => {
      const y = y0 + i * rowH;
      const isCur = i === active;
      const dim = active >= 0 && !isCur;
      ctx.line(left, y, left + width, y, {
        color: i === 0 ? colors.ink : colors.rule,
        width: i === 0 ? 1 : 0.5,
      });
      if (isCur) {
        ctx.rect(
          { x: left, y: y + 0.01, w: 0.07, h: rowH - 0.02 },
          { fill: colors.accent, role: 'marker' },
        );
      }
      ctx.text(
        pad2(i + 1),
        { x: left + 0.25, y, w: numW - 0.25, h: rowH },
        {
          role: 'number',
          font: 'heading',
          size: theme.type.title + 4,
          bold: true,
          color: dim ? colors.muted : colors.accent,
          valign: 'middle',
          fixed: true,
          maxLines: 1,
        },
      );
      const textBox = { x: left + numW + 0.2, y, w: width - numW - 0.2, h: rowH };
      if (s.summary) {
        const titleH = 0.34;
        const sumH = 0.3;
        const blockTop = y + (rowH - titleH - sumH - 0.04) / 2;
        ctx.text(
          s.title,
          { ...textBox, y: blockTop, h: titleH },
          {
            role: 'section',
            size: 'heading',
            bold: true,
            color: dim ? colors.muted : isCur ? colors.accent : colors.ink,
            valign: 'bottom',
            maxLines: 1,
            field: `sections/${i}/title`,
          },
        );
        ctx.text(
          s.summary,
          { ...textBox, y: blockTop + titleH + 0.04, h: sumH },
          {
            role: 'summary',
            size: 'body',
            color: colors.muted,
            maxLines: 1,
            field: `sections/${i}/summary`,
          },
        );
      } else {
        ctx.text(s.title, textBox, {
          role: 'section',
          size: 'heading',
          bold: true,
          color: dim ? colors.muted : isCur ? colors.accent : colors.ink,
          valign: 'middle',
          maxLines: 1,
          field: `sections/${i}/title`,
        });
      }
    });
    const yEnd = y0 + n * rowH;
    ctx.line(left, yEnd, left + width, yEnd, { color: colors.rule, width: 0.5 });
  },
};
