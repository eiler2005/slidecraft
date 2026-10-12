import { z } from 'zod';
import { mix } from '../engine/color.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    stages: z
      .array(
        z
          .object({
            name: z.string().max(22),
            output: z.string().max(90).describe('What the stage delivers'),
          })
          .strict(),
      )
      .min(3)
      .max(4),
    gates: z
      .array(
        z
          .object({
            name: z.string().max(18),
            criteria: z.array(z.string().max(60)).min(1).max(3).describe('Evidence needed to pass'),
            decider: z.string().max(30).describe('Who decides at the gate'),
          })
          .strict(),
      )
      .describe('One gate on each boundary between stages (stages − 1)'),
    current: z.number().int().min(0).optional().describe('Index of the stage we are in now'),
  })
  .strict();

export const gateMatrix: LayoutDef<typeof schema> = {
  id: 'gate-matrix',
  name: 'Stages and gates',
  group: 'sequence',
  purpose:
    'Use for a stage-gate plan: what each stage delivers and what evidence opens the next one, and who decides.',
  useWhen: [
    'Phased investments with go / no-go decisions',
    'Pilots that scale only on evidence',
    'Launch readiness',
  ],
  avoidWhen: [
    'Dates matter more than criteria — use timeline (gantt)',
    'More than four stages — group them',
  ],
  variants: ['gates'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Each phase is funded only when the previous gate shows evidence, capping risk at €6M',
      content: {
        stages: [
          { name: 'Pilot', output: '15 partner-sourced clients live in two regions' },
          {
            name: 'Scale partners',
            output: 'Four partners, 40 reference clients, unit economics proven',
          },
          { name: 'Go direct', output: 'Direct sales team for enterprise accounts' },
        ],
        gates: [
          {
            name: 'Gate 1',
            criteria: ['≥ 15 signed clients', 'Churn below 3% a quarter'],
            decider: 'Board',
          },
          {
            name: 'Gate 2',
            criteria: ['≥ 40 references', 'CAC payback under 18 months'],
            decider: 'Board + CFO',
          },
        ],
        current: 0,
      },
      sources: ['market-model'],
    },
  ],
  compose(ctx, c) {
    const { colors, theme, body } = ctx;
    const n = c.stages.length;
    if (c.gates.length !== n - 1) {
      ctx.issue({
        code: 'SC-SPEC-001',
        severity: 'error',
        message: `${n} stages need ${n - 1} gates (got ${c.gates.length})`,
        pointer: ctx.ptr('gates'),
      });
      return;
    }
    const gateW = 2.25;
    const stageW = (body.w - gateW * (n - 1)) / n;
    const bandH = 0.62;
    const y0 = body.y;
    // stage band across the top
    ctx.rect(
      { x: body.x, y: y0 + bandH / 2 - 0.02, w: body.w, h: 0.04 },
      { fill: colors.rule, role: 'axis' },
    );
    c.stages.forEach((st, i) => {
      const x = body.x + i * (stageW + gateW);
      const cur = c.current === i;
      const fill = cur ? colors.accent : mix(colors.accent, colors.background, 0.82);
      ctx.rect({ x, y: y0, w: stageW, h: bandH }, { fill, radius: 0.06, role: 'stage' });
      ctx.text(
        st.name,
        { x: x + 0.15, y: y0, w: stageW - 0.3, h: bandH },
        {
          font: 'heading',
          size: 'heading',
          bold: true,
          color: cur ? colors.accentText : colors.ink,
          align: 'center',
          valign: 'middle',
          maxLines: 1,
          field: `stages/${i}/name`,
        },
      );
      ctx.text(
        ctx.t('delivers').toUpperCase(),
        { x, y: y0 + bandH + 0.25, w: stageW, h: 0.24 },
        {
          size: theme.type.source + 0.5,
          bold: true,
          color: colors.muted,
          maxLines: 1,
          fixed: true,
        },
      );
      ctx.text(
        st.output,
        { x, y: y0 + bandH + 0.52, w: stageW, h: body.h - bandH - 0.6 },
        { size: 'body', field: `stages/${i}/output` },
      );
      if (cur)
        ctx.text(
          'We are here',
          { x, y: y0 - 0.3, w: stageW, h: 0.24 },
          {
            size: 'small',
            bold: true,
            color: colors.accent,
            align: 'center',
            maxLines: 1,
            fixed: true,
          },
        );
    });
    c.gates.forEach((g, i) => {
      const gx = body.x + (i + 1) * stageW + i * gateW;
      const cx = gx + gateW / 2;
      const cy = y0 + bandH / 2;
      const r = 0.36;
      ctx.polygon(
        [
          [cx, cy - r],
          [cx + r, cy],
          [cx, cy + r],
          [cx - r, cy],
        ],
        { fill: colors.ink, role: 'gate' },
      );
      ctx.text(
        String(i + 1),
        { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r },
        {
          size: 'small',
          bold: true,
          color: colors.background,
          align: 'center',
          valign: 'middle',
          maxLines: 1,
          fixed: true,
        },
      );
      const tx = gx + 0.15;
      const tw = gateW - 0.3;
      ctx.rect(
        { x: gx + 0.08, y: y0 + bandH + 0.2, w: gateW - 0.16, h: body.h - bandH - 0.25 },
        { fill: colors.surface, role: 'gate-panel' },
      );
      ctx.text(
        g.name.toUpperCase(),
        { x: tx, y: y0 + bandH + 0.3, w: tw, h: 0.26 },
        { size: 'small', bold: true, color: colors.ink, maxLines: 1, field: `gates/${i}/name` },
      );
      ctx.text(
        ctx.paragraphs(g.criteria, { bullet: true, spaceBefore: 4 }),
        { x: tx, y: y0 + bandH + 0.62, w: tw, h: body.h - bandH - 1.4 },
        { size: theme.type.body - 1, field: `gates/${i}/criteria` },
      );
      ctx.text(
        `**Decides:** ${g.decider}`,
        { x: tx, y: y0 + body.h - 0.7, w: tw, h: 0.46 },
        {
          size: 'small',
          color: colors.muted,
          maxLines: 2,
          valign: 'bottom',
          field: `gates/${i}/decider`,
        },
      );
    });
  },
};
