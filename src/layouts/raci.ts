import { z } from 'zod';
import { cols } from '../engine/format.ts';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const CODE = z.enum(['R', 'A', 'C', 'I', 'A/R', '']);

const schema = z
  .object({
    roles: z
      .array(z.string().max(18))
      .min(3)
      .max(7)
      .describe('Columns: roles or teams, short names'),
    activities: z.array(z.string().max(56)).min(3).max(9).describe('Rows: decisions or activities'),
    cells: z
      .array(z.array(CODE))
      .describe('One row per activity, one code per role: R, A, C, I, A/R or empty'),
    note: z.string().max(140).optional(),
  })
  .strict();

export const raci: LayoutDef<typeof schema> = {
  id: 'raci',
  name: 'RACI / decision rights',
  group: 'people',
  purpose:
    'Use for showing who is Responsible, Accountable, Consulted and Informed for each decision or activity.',
  useWhen: [
    'Governance of a programme or new operating model',
    'Clarifying decision rights before a launch',
    'Hand-offs between teams',
  ],
  avoidWhen: [
    'Just listing team members — use team-cards',
    'More than 7 roles — group roles first',
  ],
  variants: ['raci'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'One accountable owner per decision ends the pricing stalemate',
      content: {
        roles: ['CEO', 'CFO', 'Sales', 'Product', 'Legal'],
        activities: [
          'Set list prices',
          'Approve discounts above 15%',
          'Change packaging',
          'Sign partner contracts',
          'Publish price changes',
        ],
        cells: [
          ['I', 'A', 'C', 'R', ''],
          ['', 'A', 'R', 'I', ''],
          ['I', 'C', 'C', 'A/R', ''],
          ['A', 'C', 'R', '', 'C'],
          ['', 'I', 'R', 'A', 'C'],
        ],
        note: 'Today three of five decisions have two or more accountable owners',
      },
    },
  ],
  compose(ctx, c) {
    const { colors, theme } = ctx;
    const nR = c.roles.length;
    const nA = c.activities.length;
    if (c.cells.length !== nA || c.cells.some((r) => r.length !== nR)) {
      ctx.issue(
        diag('SC-SPEC-001', `cells must be ${nA} rows × ${nR} roles`, {
          pointer: ctx.ptr('cells'),
        }),
      );
      return;
    }
    c.cells.forEach((row, i) => {
      const a = row.filter((v) => v === 'A' || v === 'A/R').length;
      if (a !== 1)
        ctx.issue(
          diag(
            'SC-SPEC-001',
            `"${c.activities[i]}" has ${a} accountable roles — RACI needs exactly one A`,
            { pointer: ctx.ptr(`cells/${i}`), severity: 'warning' },
          ),
        );
    });
    const legendH = 0.4;
    const area = { ...ctx.body, h: ctx.body.h - legendH - (c.note ? 0.4 : 0) };
    const [left, grid] = cols(area, [1.5, Math.max(2.6, nR * 0.62)], 0.2);
    const colW = grid!.w / nR;
    const headH = 0.5;
    const rowH = Math.min(0.6, (area.h - headH) / nA);
    c.roles.forEach((r, i) => {
      ctx.text(
        r,
        { x: grid!.x + i * colW, y: area.y, w: colW, h: headH - 0.08 },
        {
          size: 'small',
          bold: true,
          color: colors.muted,
          align: 'center',
          valign: 'bottom',
          maxLines: 2,
          field: `roles/${i}`,
        },
      );
    });
    ctx.line(area.x, area.y + headH, grid!.x + grid!.w, area.y + headH, {
      color: colors.ink,
      width: 1,
    });
    c.activities.forEach((act, ri) => {
      const y = area.y + headH + ri * rowH;
      ctx.line(area.x, y + rowH, grid!.x + grid!.w, y + rowH, { color: colors.rule, width: 0.5 });
      ctx.text(
        act,
        { x: left!.x, y: y + 0.04, w: left!.w, h: rowH - 0.08 },
        { size: 'body', bold: true, valign: 'middle', maxLines: 2, field: `activities/${ri}` },
      );
      c.cells[ri]!.forEach((code, ci) => {
        if (!code) return;
        const d = Math.min(0.42, rowH * 0.72);
        const cx = grid!.x + ci * colW + colW / 2;
        const cy = y + rowH / 2;
        const box = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
        const acc = code.startsWith('A');
        if (acc) ctx.ellipse(box, { fill: colors.accent, role: 'raci' });
        else if (code === 'R') ctx.ellipse(box, { fill: colors.ink, role: 'raci' });
        else if (code === 'C')
          ctx.ellipse(box, {
            fill: colors.background,
            stroke: { color: colors.ink, width: 1 },
            role: 'raci',
          });
        const ink = acc ? colors.accentText : code === 'R' ? colors.background : colors.ink;
        ctx.text(
          code,
          { x: box.x - 0.1, y: box.y, w: box.w + 0.2, h: box.h },
          {
            size: code.length > 1 ? theme.type.small - 1 : theme.type.small,
            bold: true,
            color: code === 'I' ? colors.muted : ink,
            align: 'center',
            valign: 'middle',
            maxLines: 1,
            fixed: true,
          },
        );
      });
    });
    const ly = area.y + area.h + 0.12;
    const items: [string, string][] = [
      ['A', 'Accountable — one per row'],
      ['R', 'Responsible — does the work'],
      ['C', 'Consulted'],
      ['I', 'Informed'],
    ];
    let lx = area.x;
    const step = Math.min(2.85, area.w / items.length);
    for (const [k, label] of items) {
      const box = { x: lx, y: ly, w: 0.26, h: 0.26 };
      if (k === 'A') ctx.ellipse(box, { fill: colors.accent });
      else if (k === 'R') ctx.ellipse(box, { fill: colors.ink });
      else if (k === 'C')
        ctx.ellipse(box, { fill: colors.background, stroke: { color: colors.ink, width: 1 } });
      ctx.text(
        k,
        { x: lx - 0.05, y: ly, w: 0.36, h: 0.26 },
        {
          size: theme.type.small - 1,
          bold: true,
          color:
            k === 'A'
              ? colors.accentText
              : k === 'R'
                ? colors.background
                : k === 'I'
                  ? colors.muted
                  : colors.ink,
          align: 'center',
          valign: 'middle',
          maxLines: 1,
          fixed: true,
        },
      );
      ctx.text(
        label,
        { x: lx + 0.34, y: ly, w: step - 0.45, h: 0.26 },
        { size: 'small', color: colors.muted, valign: 'middle', maxLines: 1, fixed: true },
      );
      lx += step;
    }
    if (c.note)
      ctx.text(
        c.note,
        { x: area.x, y: ly + 0.38, w: area.w, h: 0.3 },
        { size: 'small', italic: true, color: colors.muted, maxLines: 1, field: 'note' },
      );
  },
};
