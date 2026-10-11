import { z } from 'zod';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const Kind = z.enum(['meeting', 'decision', 'output', 'work']);

const schema = z
  .object({
    periods: z
      .array(z.string().max(10))
      .min(4)
      .max(13)
      .describe('Columns: weeks, months or sprints'),
    rows: z
      .array(
        z
          .object({
            name: z.string().max(28).describe('Role, forum or team'),
            events: z
              .array(
                z
                  .object({
                    at: z.number().int().min(0).describe('Period index, 0-based'),
                    span: z.number().int().min(1).optional().describe('Periods covered (work)'),
                    kind: Kind.default('meeting'),
                    label: z.string().max(18).optional(),
                  })
                  .strict(),
              )
              .max(13),
          })
          .strict(),
      )
      .min(2)
      .max(7),
    today: z.number().int().min(0).optional().describe('Highlight the current period'),
  })
  .strict();

export const cadence: LayoutDef<typeof schema> = {
  id: 'cadence',
  name: 'Role calendar',
  group: 'sequence',
  purpose:
    'Use for showing who takes part when: roles or forums against a shared calendar, with recurring meetings, decisions, outputs and work periods.',
  useWhen: [
    'Governance cadence: steerco, working groups, reviews',
    'Planning cycles and reporting calendars',
    'Who is needed in which week of a programme',
  ],
  avoidWhen: [
    'Workstreams with dependencies — use timeline (gantt)',
    'One-off milestones only — use timeline (milestones)',
  ],
  variants: ['grid'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'A monthly rhythm keeps decisions with the steerco and work with the teams',
      content: {
        periods: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        today: 2,
        rows: [
          {
            name: 'Steering committee',
            events: [
              { at: 0, kind: 'decision', label: 'Budget' },
              { at: 2, kind: 'decision', label: 'Gate 1' },
              { at: 5, kind: 'decision', label: 'Gate 2' },
            ],
          },
          {
            name: 'Programme office',
            events: [0, 1, 2, 3, 4, 5].map((at) => ({
              at,
              kind: 'meeting' as const,
              label: 'Review',
            })),
          },
          {
            name: 'Workstream leads',
            events: [
              { at: 0, span: 3, kind: 'work', label: 'Pilot' },
              { at: 3, span: 3, kind: 'work', label: 'Roll-out' },
            ],
          },
          {
            name: 'Finance',
            events: [
              { at: 2, kind: 'output', label: 'Q1 report' },
              { at: 5, kind: 'output', label: 'H1 report' },
            ],
          },
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors } = ctx;
    const nP = c.periods.length;
    const legendH = 0.42;
    const labelW = 2.3;
    const gx = body.x + labelW;
    const colW = (body.w - labelW) / nP;
    const headH = 0.4;
    const rowH = Math.min(0.95, (body.h - legendH - headH) / c.rows.length);
    const gridH = rowH * c.rows.length;
    const top = body.y + headH;
    if (c.today !== undefined && c.today < nP)
      ctx.rect(
        { x: gx + c.today * colW, y: body.y, w: colW, h: headH + gridH },
        { fill: colors.accentSoft, role: 'today' },
      );
    c.periods.forEach((p, i) => {
      ctx.text(
        p,
        { x: gx + i * colW, y: body.y, w: colW, h: headH - 0.06 },
        {
          size: 'small',
          bold: true,
          color: i === c.today ? colors.accent : colors.muted,
          align: 'center',
          valign: 'bottom',
          maxLines: 1,
          field: `periods/${i}`,
        },
      );
    });
    ctx.line(body.x, top, gx + nP * colW, top, { color: colors.ink, width: 1 });
    c.rows.forEach((r, ri) => {
      const y = top + ri * rowH;
      ctx.line(body.x, y + rowH, gx + nP * colW, y + rowH, { color: colors.rule, width: 0.5 });
      ctx.text(
        r.name,
        { x: body.x, y, w: labelW - 0.15, h: rowH },
        {
          size: 'body',
          bold: true,
          valign: 'middle',
          maxLines: 2,
          field: `rows/${ri}/name`,
        },
      );
      const my = y + rowH * 0.36;
      r.events.forEach((e, ei) => {
        if (e.at >= nP) {
          ctx.issue(
            diag('SC-SPEC-001', `event at ${e.at} is outside the ${nP} periods`, {
              pointer: ctx.ptr(`rows/${ri}/events/${ei}`),
            }),
          );
          return;
        }
        const span = Math.min(e.span ?? 1, nP - e.at);
        const cx = gx + (e.at + 0.5) * colW;
        const s = 0.13;
        if (e.kind === 'work')
          ctx.rect(
            { x: gx + e.at * colW + 0.06, y: my - 0.1, w: span * colW - 0.12, h: 0.2 },
            {
              fill: colors.accentSoft,
              stroke: { color: colors.accent, width: 0.75 },
              radius: 0.04,
              role: 'work',
            },
          );
        else if (e.kind === 'decision')
          ctx.polygon(
            [
              [cx, my - s - 0.03],
              [cx + s + 0.03, my],
              [cx, my + s + 0.03],
              [cx - s - 0.03, my],
            ],
            { fill: colors.accent, role: 'decision' },
          );
        else if (e.kind === 'output')
          ctx.rect(
            { x: cx - s, y: my - s, w: 2 * s, h: 2 * s },
            { fill: colors.background, stroke: { color: colors.ink, width: 1.25 }, role: 'output' },
          );
        else
          ctx.ellipse(
            { x: cx - s, y: my - s, w: 2 * s, h: 2 * s },
            { fill: colors.ink, role: 'meeting' },
          );
        if (e.label) {
          const lw = (e.kind === 'work' ? span : 1) * colW;
          const lx = e.kind === 'work' ? gx + e.at * colW : cx - colW / 2;
          ctx.text(
            e.label,
            { x: lx + 0.03, y: my + 0.17, w: lw - 0.06, h: rowH * 0.64 - 0.2 },
            {
              size: 'small',
              color: colors.muted,
              align: 'center',
              maxLines: 2,
              field: `rows/${ri}/events/${ei}/label`,
            },
          );
        }
      });
    });
    const ly = top + gridH + 0.14;
    let lx = body.x;
    const items: [string, string][] = [
      ['meeting', 'Meeting'],
      ['decision', 'Decision'],
      ['output', 'Output'],
      ['work', 'Work period'],
    ];
    for (const [k, label] of items) {
      const cy = ly + 0.13;
      if (k === 'meeting')
        ctx.ellipse({ x: lx, y: cy - 0.1, w: 0.2, h: 0.2 }, { fill: colors.ink });
      else if (k === 'decision')
        ctx.polygon(
          [
            [lx + 0.1, cy - 0.12],
            [lx + 0.22, cy],
            [lx + 0.1, cy + 0.12],
            [lx - 0.02, cy],
          ],
          { fill: colors.accent },
        );
      else if (k === 'output')
        ctx.rect(
          { x: lx, y: cy - 0.1, w: 0.2, h: 0.2 },
          { fill: colors.background, stroke: { color: colors.ink, width: 1.25 } },
        );
      else
        ctx.rect(
          { x: lx - 0.05, y: cy - 0.08, w: 0.32, h: 0.16 },
          { fill: colors.accentSoft, stroke: { color: colors.accent, width: 0.75 }, radius: 0.03 },
        );
      ctx.text(
        label,
        { x: lx + 0.36, y: ly, w: 1.8, h: 0.26 },
        { size: 'small', color: colors.muted, valign: 'middle', maxLines: 1, fixed: true },
      );
      lx += Math.min(2.4, body.w / items.length);
    }
  },
};
