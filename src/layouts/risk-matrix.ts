import { z } from 'zod';
import { mix } from '../engine/color.ts';
import { cols } from '../engine/format.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    risks: z
      .array(
        z
          .object({
            id: z.string().max(4).describe('Short id shown in the grid, e.g. "R1"'),
            title: z.string().max(60),
            likelihood: z.number().int().min(1).max(3).describe('1 low · 2 medium · 3 high'),
            impact: z.number().int().min(1).max(3).describe('1 low · 2 medium · 3 high'),
            owner: z.string().max(22).optional(),
            mitigation: z.string().max(70).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
  })
  .strict();

export const riskMatrix: LayoutDef<typeof schema> = {
  id: 'risk-matrix',
  name: 'Risk heatmap',
  group: 'decide',
  purpose: 'Use for showing the main risks by likelihood and impact, with owners and mitigations.',
  useWhen: [
    'Risk sections of investment and programme decks',
    'Steering-committee risk reviews',
    'Pre-mortems',
  ],
  avoidWhen: [
    'Risks without any assessment — use data-table',
    'More than eight risks — show the top ones and move the rest to backup',
  ],
  variants: ['heatmap'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Two high risks need owners this quarter; the rest are monitored',
      content: {
        risks: [
          {
            id: 'R1',
            title: 'Partners under-deliver pipeline',
            likelihood: 2,
            impact: 3,
            owner: 'Strategy',
            mitigation: 'Quarterly targets with exit clauses',
          },
          {
            id: 'R2',
            title: 'Localisation slips past Q2',
            likelihood: 3,
            impact: 3,
            owner: 'Product',
            mitigation: 'Dedicated squad, scope frozen',
          },
          {
            id: 'R3',
            title: 'Rivals undercut on price',
            likelihood: 3,
            impact: 2,
            owner: 'Sales',
            mitigation: 'Price floor agreed with CFO',
          },
          {
            id: 'R4',
            title: 'Data-residency audit delay',
            likelihood: 1,
            impact: 2,
            owner: 'Legal',
          },
          { id: 'R5', title: 'Key hire not found', likelihood: 2, impact: 1, owner: 'HR' },
        ],
      },
      sources: ['market-model'],
    },
  ],
  compose(ctx, c) {
    const { colors, theme } = ctx;
    const [gridArea, list] = cols(ctx.body, [1.15, 1.25], 0.45);
    const g = gridArea!;
    const axisW = 0.5;
    const side = Math.min(g.w - axisW, g.h - 0.85);
    const cell = side / 3;
    const gx = g.x + axisW;
    const gy = g.y + 0.3;
    const sev = (l: number, i: number) => l * i;
    for (let li = 1; li <= 3; li++) {
      for (let im = 1; im <= 3; im++) {
        const s = sev(li, im);
        const fill =
          s >= 6
            ? mix(colors.negative, colors.background, 0.55)
            : s >= 3
              ? mix(colors.negative, colors.background, 0.82)
              : mix(colors.positive, colors.background, 0.82);
        ctx.rect(
          { x: gx + (im - 1) * cell, y: gy + (3 - li) * cell, w: cell, h: cell },
          { fill, stroke: { color: colors.background, width: 2 }, role: 'cell' },
        );
      }
    }
    // axes
    ctx.text(
      'LIKELIHOOD',
      { x: g.x, y: g.y, w: 2, h: 0.24 },
      { size: theme.type.source, bold: true, color: colors.muted, maxLines: 1, fixed: true },
    );
    ['High', 'Med', 'Low'].forEach((t, i) =>
      ctx.text(
        t,
        { x: g.x, y: gy + i * cell + cell / 2 - 0.12, w: axisW - 0.08, h: 0.24 },
        { size: 'small', color: colors.muted, align: 'right', maxLines: 1, fixed: true },
      ),
    );
    ['Low', 'Medium', 'High'].forEach((t, i) =>
      ctx.text(
        t,
        { x: gx + i * cell, y: gy + side + 0.05, w: cell, h: 0.24 },
        { size: 'small', color: colors.muted, align: 'center', maxLines: 1, fixed: true },
      ),
    );
    ctx.text(
      'IMPACT',
      { x: gx, y: gy + side + 0.3, w: side, h: 0.24 },
      {
        size: theme.type.source,
        bold: true,
        color: colors.muted,
        align: 'center',
        maxLines: 1,
        fixed: true,
      },
    );
    // markers, spread within a cell
    const byCell = new Map<string, number>();
    c.risks.forEach((r, i) => {
      const key = `${r.likelihood}-${r.impact}`;
      const k = byCell.get(key) ?? 0;
      byCell.set(key, k + 1);
      const d = Math.min(0.46, cell * 0.36);
      const cx =
        gx + (r.impact - 1) * cell + cell / 2 + (k % 2 === 0 ? -1 : 1) * (k > 0 ? d * 0.6 : 0);
      const cy = gy + (3 - r.likelihood) * cell + cell / 2 + (k > 1 ? d * 0.65 : 0);
      const high = sev(r.likelihood, r.impact) >= 6;
      ctx.ellipse(
        { x: cx - d / 2, y: cy - d / 2, w: d, h: d },
        { fill: high ? colors.negative : colors.ink, role: 'risk' },
      );
      ctx.text(
        r.id,
        { x: cx - d / 2 - 0.05, y: cy - d / 2, w: d + 0.1, h: d },
        {
          size: theme.type.small - 1,
          bold: true,
          color: colors.background,
          align: 'center',
          valign: 'middle',
          maxLines: 1,
          fixed: true,
          field: `risks/${i}/id`,
        },
      );
    });
    // list, highest severity first
    const sorted = c.risks
      .map((r, i) => ({ r, i }))
      .sort((a, b) => sev(b.r.likelihood, b.r.impact) - sev(a.r.likelihood, a.r.impact));
    const L = list!;
    const rowH = Math.min(0.78, L.h / sorted.length);
    sorted.forEach(({ r, i }, k) => {
      const y = L.y + k * rowH;
      const high = sev(r.likelihood, r.impact) >= 6;
      if (k > 0) ctx.line(L.x, y, L.x + L.w, y, { color: colors.rule, width: 0.5 });
      ctx.text(
        r.id,
        { x: L.x, y: y + 0.08, w: 0.5, h: 0.3 },
        {
          size: 'body',
          bold: true,
          color: high ? colors.negative : colors.ink,
          maxLines: 1,
          fixed: true,
        },
      );
      ctx.text(
        `**${r.title}**${r.owner ? `  ·  ${r.owner}` : ''}`,
        { x: L.x + 0.55, y: y + 0.06, w: L.w - 0.55, h: 0.32 },
        { size: theme.type.body - 1, maxLines: 1, field: `risks/${i}/title` },
      );
      if (r.mitigation)
        ctx.text(
          r.mitigation,
          { x: L.x + 0.55, y: y + 0.36, w: L.w - 0.55, h: rowH - 0.4 },
          { size: 'small', color: colors.muted, maxLines: 1, field: `risks/${i}/mitigation` },
        );
    });
  },
};
