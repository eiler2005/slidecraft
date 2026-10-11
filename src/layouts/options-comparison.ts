import { z } from 'zod';
import { ensureContrast, mix } from '../engine/color.ts';
import { cols, rows } from '../engine/format.ts';
import type { Box } from '../engine/scene.ts';
import { diag } from '../qa/codes.ts';
import type { ComposeContext, LayoutDef } from './types.ts';

const schema = z
  .object({
    options: z
      .array(
        z
          .object({
            name: z.string().max(28),
            summary: z.string().max(60).optional().describe('One line on what the option is'),
          })
          .strict(),
      )
      .min(2)
      .max(5),
    criteria: z
      .array(
        z
          .object({
            name: z.string().max(40).describe('Same criteria for every option'),
            weight: z.string().max(12).optional().describe('e.g. "High", "30%"'),
          })
          .strict(),
      )
      .min(2)
      .max(6),
    cells: z
      .array(z.array(z.union([z.string().max(70), z.number().int().min(0).max(4)])))
      .describe('One row per criterion, one value per option: text (text variant) or 0–4 (rating)'),
    recommended: z.number().int().min(0).optional().describe('Index of the recommended option'),
    verdict: z.string().max(140).optional().describe('One-line conclusion shown under the grid'),
  })
  .strict();

/** Harvey ball: outline circle plus a filled sector for quarter steps 0–4. */
export function harveyBall(ctx: ComposeContext, box: Box, quarters: number, color: string): void {
  const r = Math.min(box.w, box.h) / 2;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const disk = { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
  ctx.ellipse(disk, { fill: ctx.colors.background, stroke: { color, width: 1 }, role: 'harvey' });
  if (quarters >= 4) {
    ctx.ellipse(disk, { fill: color, role: 'harvey' });
    return;
  }
  if (quarters <= 0) return;
  const sweep = (quarters / 4) * Math.PI * 2;
  const steps = Math.max(6, Math.round(24 * (quarters / 4)));
  const pts: [number, number][] = [[cx, cy]];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (sweep * i) / steps;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  ctx.polygon(pts, { fill: color, role: 'harvey' });
}

export const optionsComparison: LayoutDef<typeof schema> = {
  id: 'options-comparison',
  name: 'Options comparison',
  group: 'decide',
  purpose: 'Use for comparing 2–5 options on the same criteria and showing which one wins and why.',
  useWhen: [
    'Choosing between strategic options, vendors or scenarios',
    'Showing that "do nothing" was considered',
    'Any recommendation that needs a transparent comparison',
  ],
  avoidWhen: [
    'Two dimensions of prioritisation — use matrix-2x2',
    'Numeric comparisons of one metric — use chart-takeaway (bar)',
  ],
  variants: ['text', 'rating'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'A partner-led entry beats direct build and acquisition on speed and risk',
      variant: 'text',
      content: {
        options: [
          { name: 'Direct build', summary: 'Own sales team from day one' },
          { name: 'Partner-led', summary: 'Two resellers, direct later' },
          { name: 'Acquire', summary: 'Buy a local player' },
        ],
        criteria: [
          { name: 'Time to first revenue' },
          { name: 'Capital at risk' },
          { name: 'Control of customer' },
          { name: 'Reversibility' },
        ],
        cells: [
          ['18 months', '7 months', '4 months'],
          ['€14M', '€6M', '€35–45M'],
          ['Full', 'Shared in years 1–2', 'Full'],
          ['Low — sunk cost', 'High — exit gates', 'Very low'],
        ],
        recommended: 1,
        verdict:
          'Partner-led keeps €6M at risk with quarterly exit gates and still reaches revenue in 2027',
      },
      sources: ['strategy-analysis'],
    },
    {
      title: 'Fabrikam scores highest on the criteria that carry most weight',
      variant: 'rating',
      content: {
        options: [
          { name: 'Contoso' },
          { name: 'Fabrikam' },
          { name: 'Tailspin' },
          { name: 'Do nothing' },
        ],
        criteria: [
          { name: 'Functional fit', weight: '30%' },
          { name: 'Integration effort', weight: '25%' },
          { name: 'Total cost (5 years)', weight: '25%' },
          { name: 'Vendor viability', weight: '20%' },
        ],
        cells: [
          [3, 4, 2, 0],
          [2, 3, 3, 4],
          [2, 3, 4, 3],
          [4, 3, 2, 1],
        ],
        recommended: 1,
      },
      sources: ['vendor-rfp'],
    },
  ],
  compose(ctx, c) {
    const { colors, theme } = ctx;
    const nOpt = c.options.length;
    const nCrit = c.criteria.length;
    const bad =
      c.cells.length !== nCrit
        ? `cells has ${c.cells.length} rows for ${nCrit} criteria`
        : c.cells.findIndex((r) => r.length !== nOpt) >= 0
          ? `every cells row needs ${nOpt} values`
          : '';
    if (bad) {
      ctx.issue(diag('SC-SPEC-001', bad, { pointer: ctx.ptr('cells') }));
      return;
    }
    const rating = ctx.variant === 'rating';
    const wrongType = c.cells
      .flat()
      .some((v) => (rating ? typeof v !== 'number' : typeof v !== 'string'));
    if (wrongType) {
      ctx.issue(
        diag(
          'SC-SPEC-001',
          rating
            ? 'rating variant needs integers 0–4 in cells'
            : 'text variant needs text in cells',
          { pointer: ctx.ptr('cells') },
        ),
      );
      return;
    }
    let area = ctx.body;
    if (c.verdict || rating) {
      const [grid, foot] = rows(ctx.body, [6, c.verdict ? 0.85 : 0.35], 0.18);
      area = grid!;
      if (c.verdict) {
        ctx.rect(foot!, { fill: colors.surface, role: 'verdict-band' });
        ctx.rect(
          { x: foot!.x, y: foot!.y, w: 0.06, h: foot!.h },
          { fill: colors.accent, role: 'verdict-accent' },
        );
        ctx.text(
          `**Verdict:** ${c.verdict}`,
          { x: foot!.x + 0.25, y: foot!.y, w: foot!.w - (rating ? 3.6 : 0.5), h: foot!.h },
          { size: 'body', valign: 'middle', maxLines: 2, field: 'verdict' },
        );
      }
      if (rating) {
        // legend: five balls, right-aligned
        const lw = 3.1;
        const lx = foot!.x + foot!.w - lw;
        const ly = foot!.y + foot!.h / 2;
        ctx.text(
          'Weak',
          { x: lx, y: ly - 0.12, w: 0.5, h: 0.24 },
          { size: 'small', color: colors.muted, maxLines: 1, fixed: true, align: 'right' },
        );
        for (let q = 0; q <= 4; q++)
          harveyBall(
            ctx,
            { x: lx + 0.62 + q * 0.38, y: ly - 0.12, w: 0.24, h: 0.24 },
            q,
            colors.ink,
          );
        ctx.text(
          'Strong',
          { x: lx + 2.55, y: ly - 0.12, w: 0.6, h: 0.24 },
          { size: 'small', color: colors.muted, maxLines: 1, fixed: true },
        );
      }
    }
    const colBoxes = cols(area, [1.35, ...c.options.map(() => 1)], 0);
    const rec = c.recommended !== undefined && c.recommended < nOpt ? c.recommended : undefined;
    // the RECOMMENDED label sits above the name, so its column needs the same two summary lines
    const headH = (c.options.some((o) => o.summary) ? 0.85 : 0.55) + (rec !== undefined ? 0.22 : 0);
    const rowH = (area.h - headH) / nCrit;
    const top = area.y;

    if (rec !== undefined) {
      const b = colBoxes[rec + 1]!;
      ctx.rect(
        { x: b.x + 0.04, y: top, w: b.w - 0.08, h: area.h },
        { fill: colors.accentSoft, role: 'recommended' },
      );
    }
    // header
    c.options.forEach((o, i) => {
      const b = colBoxes[i + 1]!;
      const isRec = rec === i;
      const inner = { x: b.x + 0.15, y: top + 0.08, w: b.w - 0.3, h: headH - 0.12 };
      if (isRec) {
        ctx.text(
          'RECOMMENDED',
          { x: inner.x, y: inner.y, w: inner.w, h: 0.22 },
          {
            size: theme.type.source + 0.5,
            bold: true,
            color: ensureContrast(colors.accent, colors.accentSoft),
            align: 'center',
            maxLines: 1,
            fixed: true,
          },
        );
      }
      const nameY = inner.y + (isRec ? 0.22 : 0);
      ctx.text(
        o.name,
        { x: inner.x, y: nameY, w: inner.w, h: 0.3 },
        {
          font: 'heading',
          size: 'heading',
          bold: true,
          color: isRec ? ensureContrast(colors.accent, colors.accentSoft) : colors.ink,
          align: 'center',
          maxLines: 1,
          field: `options/${i}/name`,
        },
      );
      if (o.summary)
        ctx.text(
          o.summary,
          { x: inner.x, y: nameY + 0.3, w: inner.w, h: inner.y + inner.h - nameY - 0.3 },
          {
            size: 'small',
            color: colors.muted,
            align: 'center',
            maxLines: 2,
            field: `options/${i}/summary`,
          },
        );
    });
    const left = colBoxes[0]!;
    ctx.line(left.x, top + headH, area.x + area.w, top + headH, { color: colors.ink, width: 1 });
    // rows
    c.criteria.forEach((cr, r) => {
      const y = top + headH + r * rowH;
      if (r > 0) ctx.line(left.x, y, area.x + area.w, y, { color: colors.rule, width: 0.5 });
      ctx.text(
        cr.name,
        { x: left.x, y: y + 0.1, w: left.w - 0.2, h: rowH - (cr.weight ? 0.4 : 0.2) },
        {
          size: 'body',
          bold: true,
          valign: cr.weight ? 'top' : 'middle',
          field: `criteria/${r}/name`,
        },
      );
      if (cr.weight)
        ctx.text(
          `Weight ${cr.weight}`,
          { x: left.x, y: y + rowH - 0.32, w: left.w - 0.2, h: 0.24 },
          { size: 'small', color: colors.muted, maxLines: 1, fixed: true },
        );
      c.cells[r]!.forEach((v, i) => {
        const b = colBoxes[i + 1]!;
        if (rating) {
          const d = Math.min(0.36, rowH * 0.55);
          harveyBall(
            ctx,
            { x: b.x + b.w / 2 - d / 2, y: y + rowH / 2 - d / 2, w: d, h: d },
            Number(v),
            rec === i ? colors.accent : colors.ink,
          );
        } else {
          ctx.text(
            String(v),
            { x: b.x + 0.15, y: y + 0.08, w: b.w - 0.3, h: rowH - 0.16 },
            {
              size: theme.type.body - 1,
              align: 'center',
              valign: 'middle',
              bold: rec === i,
              color: rec === i ? colors.ink : mix(colors.ink, colors.muted, 0.3),
              field: `cells/${r}/${i}`,
            },
          );
        }
      });
    });
    ctx.line(left.x, area.y + area.h, area.x + area.w, area.y + area.h, {
      color: colors.rule,
      width: 0.5,
    });
  },
};
