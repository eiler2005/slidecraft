import { z } from 'zod';
import type { LayoutDef } from './types.ts';

const Status = z.enum(['none', 'planned', 'partial', 'full']);

const Item = z.object({ label: z.string().max(28), status: Status }).strict();

const schema = z
  .object({
    groups: z
      .array(z.object({ name: z.string().max(24), items: z.array(Item).min(1).max(6) }).strict())
      .min(2)
      .max(6)
      .describe('Rows of functions or capabilities; keep the same rows between snapshots'),
    snapshot: z
      .string()
      .max(30)
      .optional()
      .describe('When the map was taken, e.g. "As of Q3 2026"'),
    statusLabels: z
      .object({
        none: z.string().max(24).optional(),
        planned: z.string().max(24).optional(),
        partial: z.string().max(24).optional(),
        full: z.string().max(24).optional(),
      })
      .strict()
      .optional()
      .describe('Words for the four states, e.g. "Live" instead of "Full"'),
  })
  .strict();

export const coverageMap: LayoutDef<typeof schema> = {
  id: 'coverage-map',
  name: 'Coverage map',
  group: 'decide',
  purpose:
    'Use for showing the state of many functions at once on stable geometry — what is covered, partly covered, planned or missing.',
  useWhen: [
    'Capability or automation coverage across a value chain',
    'Status of the same functions over successive snapshots',
    'Where the gaps are before choosing priorities',
  ],
  avoidWhen: [
    'Fewer than six items — use key-points or a table',
    'Statuses with dates and owners — use data-table or gate-matrix',
  ],
  variants: ['grid'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Automation covers most of order-to-cash; record-to-report is the gap to close next',
      content: {
        snapshot: 'As of Q3 2026',
        statusLabels: { full: 'Live', partial: 'Partly live', planned: 'Planned', none: 'Manual' },
        groups: [
          {
            name: 'Order-to-cash',
            items: [
              { label: 'Credit check', status: 'full' },
              { label: 'Order entry', status: 'full' },
              { label: 'Invoicing', status: 'partial' },
              { label: 'Collections', status: 'planned' },
            ],
          },
          {
            name: 'Procure-to-pay',
            items: [
              { label: 'Requisitions', status: 'full' },
              { label: 'Invoice matching', status: 'partial' },
              { label: 'Payments', status: 'full' },
            ],
          },
          {
            name: 'Record-to-report',
            items: [
              { label: 'Journals', status: 'none' },
              { label: 'Reconciliations', status: 'planned' },
              { label: 'Consolidation', status: 'none' },
              { label: 'Reporting', status: 'partial' },
            ],
          },
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors } = ctx;
    const words = {
      none: 'Missing',
      planned: 'Planned',
      partial: 'Partial',
      full: 'Full',
      ...c.statusLabels,
    };
    const legendH = 0.45;
    const area = { ...body, h: body.h - legendH };
    const labelW = 2.3;
    const maxItems = Math.max(...c.groups.map((g) => g.items.length));
    const gap = 0.14;
    const cellW = (area.w - labelW - gap * (maxItems - 1)) / maxItems;
    const rowGap = 0.18;
    const rowH = Math.min(1.0, (area.h - rowGap * (c.groups.length - 1)) / c.groups.length);
    const style = (s: z.infer<typeof Status>) =>
      s === 'full'
        ? { fill: colors.accent, ink: colors.accentText }
        : s === 'partial'
          ? { fill: colors.accentSoft, ink: colors.ink, stroke: { color: colors.accent, width: 1 } }
          : s === 'planned'
            ? {
                fill: colors.background,
                ink: colors.ink,
                stroke: { color: colors.muted, width: 1, dash: 'dash' as const },
              }
            : { fill: colors.surface, ink: colors.muted };
    c.groups.forEach((g, gi) => {
      const y = area.y + gi * (rowH + rowGap);
      ctx.text(
        g.name,
        { x: area.x, y, w: labelW - 0.2, h: rowH },
        { size: 'body', bold: true, valign: 'middle', maxLines: 2, field: `groups/${gi}/name` },
      );
      g.items.forEach((it, ii) => {
        const x = area.x + labelW + ii * (cellW + gap);
        const st = style(it.status);
        ctx.rect(
          { x, y, w: cellW, h: rowH },
          {
            fill: st.fill,
            ...(st.stroke ? { stroke: st.stroke } : {}),
            radius: 0.05,
            role: 'cell',
          },
        );
        ctx.text(
          it.label,
          { x: x + 0.1, y, w: cellW - 0.2, h: rowH },
          {
            size: 'small',
            bold: it.status === 'full',
            color: st.ink,
            align: 'center',
            valign: 'middle',
            maxLines: 2,
            field: `groups/${gi}/items/${ii}/label`,
          },
        );
      });
    });
    const rowsEnd = area.y + c.groups.length * (rowH + rowGap) - rowGap;
    const ly = Math.min(area.y + area.h + 0.15, rowsEnd + 0.4);
    let lx = area.x;
    for (const s of ['full', 'partial', 'planned', 'none'] as const) {
      const st = style(s);
      ctx.rect(
        { x: lx, y: ly, w: 0.34, h: 0.24 },
        { fill: st.fill, ...(st.stroke ? { stroke: st.stroke } : {}), radius: 0.04 },
      );
      ctx.text(
        words[s],
        { x: lx + 0.44, y: ly - 0.02, w: 1.9, h: 0.28 },
        { size: 'small', color: colors.muted, valign: 'middle', maxLines: 1, fixed: true },
      );
      lx += 2.3;
    }
    if (c.snapshot)
      ctx.text(
        c.snapshot,
        { x: area.x + area.w - 2.6, y: ly - 0.02, w: 2.6, h: 0.28 },
        {
          size: 'small',
          bold: true,
          color: colors.ink,
          align: 'right',
          valign: 'middle',
          maxLines: 1,
          field: 'snapshot',
        },
      );
  },
};
