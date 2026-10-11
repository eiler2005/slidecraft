import { z } from 'zod';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    support: z
      .string()
      .max(200)
      .optional()
      .describe('statement variant: one sentence that backs the statement, shown below it'),
    quote: z
      .string()
      .max(240)
      .optional()
      .describe('quote variant (required): the words, without quotation marks'),
    attribution: z.string().max(60).optional().describe('quote variant: who said it'),
    role: z.string().max(60).optional().describe('quote variant: their role and organisation'),
    number: z
      .string()
      .max(10)
      .optional()
      .describe('hero-number variant (required): the one number, e.g. "62%", "€40M", "3×"'),
    label: z
      .string()
      .max(90)
      .optional()
      .describe('hero-number variant (required): what the number measures, with unit and period'),
    context: z
      .string()
      .max(180)
      .optional()
      .describe('hero-number variant: why it matters or how it compares'),
  })
  .strict();

export const bigStatement: LayoutDef<typeof schema> = {
  id: 'big-statement',
  name: 'Big statement',
  group: 'message',
  purpose:
    'Use for the one thing the audience must remember: a single bold statement, a customer quote or one hero number, with room to breathe.',
  useWhen: [
    'A turning point in the story that deserves a full slide',
    'A customer or expert quote that proves the argument',
    'One number so large it needs no chart',
  ],
  avoidWhen: [
    'Several numbers side by side — use kpi-tiles',
    'A claim that needs supporting evidence on the same page — use key-points or chart-takeaway',
  ],
  variants: ['statement', 'quote', 'hero-number'],
  frame: 'none',
  master: 'divider',
  schema,
  examples: [
    {
      title: 'The next decade of retail banking will be won on trust, not on price',
      variant: 'statement',
      content: {
        support:
          'Northwind customers who trust their bank hold twice as many products and switch half as often.',
      },
    },
    {
      title: 'What customers told us',
      variant: 'quote',
      content: {
        quote:
          'Before Contoso we spent two days a month reconciling accounts by hand. Now the close is finished before lunch on the first working day.',
        attribution: 'Maria Keller',
        role: 'Head of Finance, Tailspin Logistics',
      },
    },
    {
      title: 'Every pilot site recovered its investment within a single year',
      variant: 'hero-number',
      content: {
        number: '9 months',
        label: 'Average payback period across the twelve Fabrikam pilot sites',
        context: 'The slowest site paid back in 14 months; the fastest in five.',
      },
      sources: ['fabrikam-pilot'],
    },
  ],
  compose(ctx, c) {
    const { page, colors, theme, format } = ctx;
    const left = 1.0;
    const width = page.w - left - 1.2;
    const titleInk = colors.titleInk ?? colors.ink;
    const bold = theme.type.titleWeight === 'bold';
    const cover = theme.type.cover;

    /** Move a laid-out text node to a new top edge and shrink its box to the content. */
    const settle = (node: { box: { y: number; h: number }; contentHeight: number }, y: number) => {
      node.box.y = y;
      node.box.h = node.contentHeight + 0.02;
    };

    if (ctx.variant === 'quote') {
      if (!c.quote) {
        ctx.issue(
          diag('SC-SPEC-001', 'quote variant needs a quote', { pointer: ctx.ptr('quote') }),
        );
        return;
      }
      ctx.text(
        ctx.slide.title.toUpperCase(),
        { x: left, y: format.tracker.y, w: width, h: 0.5 },
        {
          role: 'tracker',
          size: 'small',
          bold: true,
          color: colors.accent,
          fixed: true,
          maxLines: 2,
          field: 'title',
        },
      );
      const glyph = ctx.text(
        '“',
        { x: left - 0.04, y: 0, w: 1.6, h: 1.85 },
        {
          role: 'quote-mark',
          font: 'heading',
          size: 130,
          bold: true,
          color: colors.accent,
          fixed: true,
          maxLines: 1,
          lineHeight: 1.0,
        },
      );
      const q = ctx.text(
        c.quote,
        { x: left, y: 0, w: width, h: 4 },
        {
          role: 'quote',
          font: 'heading',
          sizes: [cover - 4, cover - 6, cover - 8, cover - 10, cover - 12, cover - 14],
          color: titleInk,
          maxLines: 6,
          lineHeight: 1.2,
          field: 'quote',
        },
      );
      const hasWho = !!(c.attribution || c.role);
      const who = c.attribution
        ? ctx.text(
            c.attribution,
            { x: left, y: 0, w: width, h: 0.4 },
            {
              role: 'attribution',
              size: theme.type.subtitle,
              bold: true,
              color: colors.ink,
              maxLines: 1,
              fixed: true,
              field: 'attribution',
            },
          )
        : undefined;
      const rl = c.role
        ? ctx.text(
            c.role,
            { x: left, y: 0, w: width, h: 0.35 },
            {
              role: 'role',
              size: 'body',
              color: colors.muted,
              maxLines: 1,
              fixed: true,
              field: 'role',
            },
          )
        : undefined;
      // Vertical rhythm: mark overlaps the first line slightly, attribution follows a short rule.
      const markH = 0.8;
      const gapQ = 0.45;
      const whoH = hasWho ? gapQ + 0.06 + 0.3 + (who ? 0.38 : 0) + (rl ? 0.34 : 0) : 0;
      const total = markH + q.contentHeight + whoH;
      let y = Math.max(1.3, (page.h - total) / 2 - 0.1);
      settle(glyph, y - 0.28);
      y += markH;
      settle(q, y);
      y += q.contentHeight;
      if (hasWho) {
        y += gapQ;
        ctx.line(left, y, left + 0.7, y, { color: colors.accent, width: 3 });
        y += 0.36;
        if (who) {
          settle(who, y);
          y += 0.38;
        }
        if (rl) settle(rl, y);
      }
      return;
    }

    if (ctx.variant === 'hero-number') {
      if (!c.number || !c.label) {
        ctx.issue(
          diag(
            'SC-SPEC-001',
            `hero-number variant needs number and label (missing: ${[!c.number && 'number', !c.label && 'label'].filter(Boolean).join(', ')})`,
            { pointer: ctx.ptr(c.number ? 'label' : 'number') },
          ),
        );
        return;
      }
      ctx.line(left, 0.85, left + 0.6, 0.85, { color: colors.accent, width: 3 });
      ctx.text(
        ctx.slide.title,
        { x: left, y: 1.0, w: page.w - 2 * left, h: 1.05 },
        {
          role: 'title',
          font: 'heading',
          size: 'title',
          bold: true,
          color: titleInk,
          maxLines: 2,
          lineHeight: 1.12,
          field: 'title',
        },
      );
      const num = ctx.text(
        c.number,
        { x: left - 0.04, y: 0, w: 6.6, h: 2.4 },
        {
          role: 'hero-number',
          font: 'heading',
          sizes: [140, 120, 100, 84],
          bold: true,
          color: colors.accent,
          maxLines: 1,
          lineHeight: 1.0,
          field: 'number',
        },
      );
      const numSize = num.style.size;
      const numW = Math.max(...num.lines.map((l) => l.segments.reduce((a, s) => a + s.width, 0)));
      // Visible digit height ≈ 0.72 em; the box adds the rest above the baseline.
      const capH = (numSize * 0.72) / 72;
      const baseline = num.lines[0]?.baseline ?? numSize / 72;
      const capTopInBox = baseline - capH;

      const beside = page.w - left - 0.8 - (left + numW + 0.7) >= 3.6;
      const labelX = beside ? left + numW + 0.7 : left;
      const labelW = beside ? page.w - 0.8 - labelX : page.w - 2 * left;
      const label = ctx.text(
        c.label,
        { x: labelX, y: 0, w: labelW, h: 1.6 },
        {
          role: 'label',
          font: 'heading',
          size: theme.type.title - 2,
          bold: true,
          color: colors.ink,
          maxLines: 3,
          field: 'label',
        },
      );
      const ctxt = c.context
        ? ctx.text(
            c.context,
            { x: labelX, y: 0, w: labelW, h: 1.4 },
            {
              role: 'context',
              size: 'subtitle',
              color: colors.muted,
              maxLines: 4,
              field: 'context',
            },
          )
        : undefined;
      const textH = label.contentHeight + (ctxt ? 0.2 + ctxt.contentHeight : 0);
      const areaTop = 2.45;
      const areaBottom = page.h - 0.9;
      if (beside) {
        const blockH = Math.max(capH, textH);
        const top = areaTop + (areaBottom - areaTop - blockH) / 2;
        settle(num, top - capTopInBox + (blockH - capH) / 2);
        num.box.h = num.contentHeight + 0.02;
        const ty = top + (blockH - textH) / 2;
        ctx.line(labelX - 0.35, ty, labelX - 0.35, ty + textH, { color: colors.rule, width: 1.25 });
        settle(label, ty);
        if (ctxt) settle(ctxt, ty + label.contentHeight + 0.2);
      } else {
        const blockH = capH + 0.45 + textH;
        const top = areaTop + (areaBottom - areaTop - blockH) / 2;
        settle(num, top - capTopInBox);
        settle(label, top + capH + 0.45);
        if (ctxt) settle(ctxt, top + capH + 0.45 + label.contentHeight + 0.2);
      }
      return;
    }

    // statement
    const st = ctx.text(
      ctx.slide.title,
      { x: left, y: 0, w: width, h: 4.6 },
      {
        role: 'title',
        font: 'heading',
        sizes: [cover + 8, cover + 4, cover, cover - 4, cover - 8],
        bold,
        color: titleInk,
        maxLines: 4,
        lineHeight: 1.1,
        field: 'title',
      },
    );
    const sup = c.support
      ? ctx.text(
          c.support,
          { x: left, y: 0, w: Math.min(width, 9.2), h: 1.4 },
          {
            role: 'support',
            size: theme.type.subtitle + 2,
            color: colors.muted,
            maxLines: 3,
            field: 'support',
          },
        )
      : undefined;
    const ruleGap = 0.4;
    const supGap = 0.45;
    const total = 0.06 + ruleGap + st.contentHeight + (sup ? supGap + sup.contentHeight : 0);
    let y = (page.h - total) / 2 - 0.1;
    ctx.line(left, y, left + 0.9, y, { color: colors.accent, width: 4 });
    y += 0.06 + ruleGap;
    settle(st, y);
    y += st.contentHeight + supGap;
    if (sup) settle(sup, y);
  },
};
