import { z } from 'zod';
import { mix } from '../engine/color.ts';
import { textWidthPt } from '../engine/fonts.ts';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    milestones: z
      .array(
        z
          .object({
            date: z.string().max(16),
            title: z.string().max(40),
            body: z.string().max(90).optional(),
            highlight: z.boolean().optional(),
          })
          .strict(),
      )
      .min(3)
      .max(8)
      .optional()
      .describe('milestones variant'),
    periods: z
      .array(z.string().max(10))
      .min(3)
      .max(12)
      .optional()
      .describe('gantt variant: column headers, e.g. "Q1 26"'),
    rows: z
      .array(
        z
          .object({
            name: z.string().max(30).describe('Workstream'),
            highlight: z.boolean().optional(),
            bars: z
              .array(
                z
                  .object({
                    start: z.number().int().min(0),
                    end: z.number().int().min(0).describe('Inclusive period index'),
                    label: z.string().max(30).optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(3),
          })
          .strict(),
      )
      .min(2)
      .max(8)
      .optional()
      .describe('gantt variant: workstreams on the shared period axis'),
    today: z.number().int().min(0).optional().describe('gantt: period index of "today"'),
  })
  .strict();

export const timeline: LayoutDef<typeof schema> = {
  id: 'timeline',
  name: 'Timeline',
  group: 'sequence',
  purpose: 'Use for dated milestones or a phased roadmap on one shared time axis.',
  useWhen: [
    'Roadmaps and phased plans',
    'History of how we got here',
    'Project status against plan',
  ],
  avoidWhen: [
    'Steps without dates — use process-steps',
    'More than 8 workstreams — split by phase',
  ],
  variants: ['milestones', 'gantt'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'First German revenue lands in Q3 2027, nine months after the decision',
      variant: 'milestones',
      content: {
        milestones: [
          { date: 'Nov 2026', title: 'Board decision', body: 'Phase-1 budget of €6M approved' },
          {
            date: 'Jan 2027',
            title: 'Partners signed',
            body: 'Two resellers with mid-market rights',
          },
          {
            date: 'Apr 2027',
            title: 'Localised product',
            body: 'German UI and Frankfurt hosting live',
          },
          {
            date: 'Jul 2027',
            title: 'First revenue',
            body: '15 pilot clients go live',
            highlight: true,
          },
          { date: 'Q1 2028', title: 'Gate 2', body: 'Scale direct sales if 40 references' },
        ],
      },
    },
    {
      title: 'Localisation is the critical path; sales scale only after Gate 2',
      variant: 'gantt',
      content: {
        periods: ['Q4 26', 'Q1 27', 'Q2 27', 'Q3 27', 'Q4 27', 'Q1 28'],
        rows: [
          { name: 'Partner selection', bars: [{ start: 0, end: 1, label: 'Shortlist → sign' }] },
          {
            name: 'Localisation',
            highlight: true,
            bars: [{ start: 1, end: 2, label: 'Critical path' }],
          },
          { name: 'Pilot clients', bars: [{ start: 2, end: 4, label: '15 references' }] },
          { name: 'Direct sales', bars: [{ start: 5, end: 5, label: 'Gate 2' }] },
        ],
        today: 0,
      },
    },
  ],
  compose(ctx, c) {
    const { colors, theme, body } = ctx;
    if (ctx.variant === 'milestones') {
      const ms = c.milestones ?? [];
      if (!ms.length) {
        ctx.issue(
          diag('SC-SPEC-001', 'milestones variant needs milestones', {
            pointer: ctx.ptr('milestones'),
          }),
        );
        return;
      }
      const n = ms.length;
      const axisY = body.y + body.h / 2;
      const slot = body.w / n;
      ctx.line(body.x, axisY, body.x + body.w, axisY, { color: colors.rule, width: 2 });
      ms.forEach((m, i) => {
        const cx = body.x + slot * (i + 0.5);
        const above = i % 2 === 0;
        const r = m.highlight ? 0.13 : 0.085;
        const w = Math.min(slot * 1.8, 2.8);
        const bx = Math.max(body.x, Math.min(cx - w / 2, body.x + body.w - w));
        const textH = body.h / 2 - 0.35;
        const ty = above ? body.y : axisY + 0.35;
        ctx.line(cx, above ? axisY - 0.3 : axisY + 0.3, cx, axisY, {
          color: m.highlight ? colors.accent : colors.rule,
          width: 1,
        });
        ctx.ellipse(
          { x: cx - r, y: axisY - r, w: 2 * r, h: 2 * r },
          {
            fill: m.highlight ? colors.accent : colors.background,
            stroke: { color: m.highlight ? colors.accent : colors.ink, width: 1.5 },
            role: 'milestone',
          },
        );
        const lines = [`**${m.date}**`, `**${m.title}**`, ...(m.body ? [m.body] : [])];
        const ps = ctx.paragraphs(lines);
        ps[0]!.runs.forEach((run) => {
          run.color = m.highlight ? colors.accent : colors.muted;
        });
        if (ps[2]) ps[2].runs.forEach((run) => (run.color = colors.muted));
        ctx.text(
          ps,
          { x: bx, y: ty, w, h: textH },
          {
            size: 'body',
            align: 'center',
            valign: above ? 'bottom' : 'top',
            field: `milestones/${i}`,
          },
        );
      });
      return;
    }

    const periods = c.periods ?? [];
    const rws = c.rows ?? [];
    if (!periods.length || !rws.length) {
      ctx.issue(
        diag('SC-SPEC-001', 'gantt variant needs periods and rows', {
          pointer: ctx.ptr(periods.length ? 'rows' : 'periods'),
        }),
      );
      return;
    }
    const nameW = Math.min(2.9, body.w * 0.22);
    const gx = body.x + nameW;
    const gw = body.w - nameW;
    const colW = gw / periods.length;
    const headH = 0.4;
    const rowH = Math.min(0.75, (body.h - headH) / rws.length);
    const gridH = rowH * rws.length;
    periods.forEach((p, i) => {
      const x = gx + i * colW;
      ctx.text(
        p,
        { x, y: body.y, w: colW, h: headH - 0.08 },
        {
          size: 'small',
          bold: true,
          color: colors.muted,
          align: 'center',
          valign: 'bottom',
          maxLines: 1,
          fixed: true,
          field: `periods/${i}`,
        },
      );
      ctx.line(x, body.y + headH, x, body.y + headH + gridH, { color: colors.rule, width: 0.5 });
    });
    ctx.line(gx + gw, body.y + headH, gx + gw, body.y + headH + gridH, {
      color: colors.rule,
      width: 0.5,
    });
    ctx.line(body.x, body.y + headH, body.x + body.w, body.y + headH, {
      color: colors.ink,
      width: 1,
    });
    rws.forEach((r, ri) => {
      const y = body.y + headH + ri * rowH;
      ctx.line(body.x, y + rowH, body.x + body.w, y + rowH, { color: colors.rule, width: 0.5 });
      ctx.text(
        r.name,
        { x: body.x, y: y + 0.05, w: nameW - 0.15, h: rowH - 0.1 },
        { size: 'body', bold: true, valign: 'middle', maxLines: 2, field: `rows/${ri}/name` },
      );
      r.bars.forEach((b, bi) => {
        const s = Math.min(b.start, periods.length - 1);
        const e = Math.max(s, Math.min(b.end, periods.length - 1));
        if (b.end >= periods.length || b.start > b.end) {
          ctx.issue(
            diag(
              'SC-SPEC-001',
              `Bar ${bi} of "${r.name}" is outside the ${periods.length} periods`,
              { pointer: ctx.ptr(`rows/${ri}/bars/${bi}`) },
            ),
          );
        }
        const bx = gx + s * colW + 0.06;
        const bw = (e - s + 1) * colW - 0.12;
        const bh = rowH * 0.56;
        const by = y + (rowH - bh) / 2;
        const fill = r.highlight ? colors.accent : mix(colors.accent, colors.background, 0.62);
        const ink = r.highlight ? colors.accentText : colors.ink;
        ctx.rect(
          { x: bx, y: by, w: bw, h: bh },
          { fill, radius: Math.min(0.08, bh / 2), role: 'bar' },
        );
        if (b.label) {
          const tw =
            textWidthPt(ctx.fonts.body.measure, 'regular', theme.type.small, b.label) / 72 + 0.2;
          const inside = tw <= bw;
          const lx = inside ? bx + 0.1 : bx + bw + 0.08;
          const lw = inside ? bw - 0.15 : Math.max(0.5, gx + gw - lx);
          ctx.text(
            b.label,
            { x: lx, y: by, w: lw, h: bh },
            {
              size: 'small',
              color: inside ? ink : colors.muted,
              valign: 'middle',
              maxLines: 1,
              fixed: true,
              field: `rows/${ri}/bars/${bi}/label`,
            },
          );
        }
      });
    });
    if (c.today !== undefined && c.today < periods.length) {
      const tx = gx + (c.today + 0.5) * colW;
      ctx.line(tx, body.y + headH - 0.05, tx, body.y + headH + gridH + 0.05, {
        color: colors.accent,
        width: 1.25,
        dash: 'dash',
      });
      ctx.text(
        'Today',
        { x: tx - 0.5, y: body.y + headH + gridH + 0.06, w: 1, h: 0.24 },
        {
          size: 'small',
          bold: true,
          color: colors.accent,
          align: 'center',
          maxLines: 1,
          fixed: true,
        },
      );
    }
  },
};
