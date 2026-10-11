import { z } from 'zod';
import { cols } from '../engine/format.ts';
import type { Box } from '../engine/scene.ts';
import { diag } from '../qa/codes.ts';
import type { ComposeContext, LayoutDef } from './types.ts';

const Level = z
  .object({
    name: z.string().max(24),
    description: z.string().max(90).optional().describe('What this level looks like (staircase)'),
  })
  .strict();

const Dimension = z
  .object({
    name: z.string().max(30),
    current: z.number().int().min(1).describe('Level today, 1-based'),
    target: z.number().int().min(1).describe('Level we aim for, 1-based'),
  })
  .strict();

const schema = z
  .object({
    levels: z.array(Level).min(3).max(5).describe('Maturity levels, lowest first'),
    dimensions: z
      .array(Dimension)
      .min(1)
      .max(6)
      .optional()
      .describe('grid variant: capabilities assessed on the levels'),
    current: z.number().int().min(1).optional().describe('staircase variant: level today'),
    target: z.number().int().min(1).optional().describe('staircase variant: target level'),
    targetLabel: z.string().max(30).optional().describe('e.g. "Target by end of 2027"'),
  })
  .strict();

type C = z.infer<typeof schema>;

function staircase(ctx: ComposeContext, body: Box, c: C) {
  const { colors, theme } = ctx;
  const n = c.levels.length;
  const cur = c.current ?? 1;
  const tgt = c.target;
  if (cur > n || (tgt !== undefined && tgt > n)) {
    ctx.issue(
      diag('SC-SPEC-001', `current/target must be between 1 and ${n}`, {
        pointer: ctx.ptr('current'),
      }),
    );
    return;
  }
  const markH = 0.4;
  const area = { ...body, y: body.y + markH, h: body.h - markH };
  const steps = cols(area, Array(n).fill(1), 0.12);
  const minH = area.h * 0.45;
  c.levels.forEach((lv, i) => {
    const s = steps[i]!;
    const h = minH + ((area.h - minH) * i) / Math.max(1, n - 1);
    const y = area.y + area.h - h;
    const isCur = i + 1 === cur;
    const isTgt = tgt !== undefined && i + 1 === tgt;
    ctx.rect(
      { x: s.x, y, w: s.w, h },
      { fill: isTgt ? colors.accent : isCur ? colors.accentSoft : colors.surface, role: 'step' },
    );
    ctx.text(
      String(i + 1),
      { x: s.x + 0.18, y: y + 0.14, w: 0.6, h: 0.5 },
      {
        font: 'heading',
        size: theme.type.title + 2,
        bold: true,
        color: isTgt ? colors.accentText : colors.accent,
        maxLines: 1,
        fixed: true,
      },
    );
    ctx.text(
      lv.name,
      { x: s.x + 0.18, y: y + 0.66, w: s.w - 0.36, h: 0.62 },
      {
        size: 'heading',
        bold: true,
        color: isTgt ? colors.accentText : colors.ink,
        maxLines: 2,
        field: `levels/${i}/name`,
      },
    );
    if (lv.description)
      ctx.text(
        lv.description,
        { x: s.x + 0.18, y: y + 1.32, w: s.w - 0.36, h: Math.max(0.4, h - 1.46) },
        {
          size: 'small',
          color: isTgt ? colors.accentText : colors.muted,
          field: `levels/${i}/description`,
        },
      );
    if (isCur || isTgt)
      ctx.text(
        isTgt ? (c.targetLabel ?? 'Target').toUpperCase() : 'TODAY',
        { x: s.x, y: y - markH, w: s.w, h: markH - 0.08 },
        {
          size: 'small',
          bold: true,
          color: isTgt ? colors.accent : colors.ink,
          valign: 'bottom',
          maxLines: 1,
          field: isTgt ? 'targetLabel' : 'current',
        },
      );
  });
}

function grid(ctx: ComposeContext, body: Box, c: C) {
  const { colors } = ctx;
  const n = c.levels.length;
  const dims = c.dimensions ?? [];
  if (!dims.length) {
    ctx.issue(
      diag('SC-SPEC-001', 'grid variant needs dimensions', { pointer: ctx.ptr('dimensions') }),
    );
    return;
  }
  dims.forEach((d, i) => {
    if (d.current > n || d.target > n)
      ctx.issue(
        diag('SC-SPEC-001', `"${d.name}": levels run from 1 to ${n}`, {
          pointer: ctx.ptr(`dimensions/${i}`),
        }),
      );
  });
  const legendH = 0.4;
  const area = { ...body, h: body.h - legendH };
  const [left, g] = cols(area, [1.25, 3.4], 0.25);
  const colW = g!.w / n;
  const headH = 0.62;
  const rowH = Math.min(0.85, (area.h - headH) / dims.length);
  c.levels.forEach((lv, i) => {
    const x = g!.x + i * colW;
    ctx.text(
      `${i + 1}`,
      { x, y: area.y, w: colW, h: 0.26 },
      { size: 'small', bold: true, color: colors.accent, align: 'center', maxLines: 1 },
    );
    ctx.text(
      lv.name,
      { x: x + 0.05, y: area.y + 0.26, w: colW - 0.1, h: headH - 0.3 },
      {
        size: 'small',
        bold: true,
        color: colors.muted,
        align: 'center',
        maxLines: 1,
        field: `levels/${i}/name`,
      },
    );
    if (i > 0)
      ctx.line(x, area.y + headH, x, area.y + headH + rowH * dims.length, {
        color: colors.rule,
        width: 0.5,
        dash: 'dot',
      });
  });
  ctx.line(area.x, area.y + headH, g!.x + g!.w, area.y + headH, { color: colors.ink, width: 1 });
  const cx = (lvl: number) => g!.x + (lvl - 0.5) * colW;
  dims.forEach((d, ri) => {
    const y = area.y + headH + ri * rowH;
    const cy = y + rowH / 2;
    ctx.line(area.x, y + rowH, g!.x + g!.w, y + rowH, { color: colors.rule, width: 0.5 });
    ctx.text(
      d.name,
      { x: left!.x, y: y + 0.04, w: left!.w, h: rowH - 0.08 },
      { size: 'body', bold: true, valign: 'middle', maxLines: 2, field: `dimensions/${ri}/name` },
    );
    const cur = Math.min(n, d.current);
    const tgt = Math.min(n, d.target);
    const r = Math.min(0.15, rowH * 0.22);
    if (tgt !== cur) {
      ctx.rect(
        { x: Math.min(cx(cur), cx(tgt)), y: cy - 0.035, w: Math.abs(cx(tgt) - cx(cur)), h: 0.07 },
        { fill: colors.accentSoft, role: 'gap' },
      );
      ctx.ellipse(
        { x: cx(tgt) - r, y: cy - r, w: 2 * r, h: 2 * r },
        { fill: colors.accent, role: 'target' },
      );
    }
    ctx.ellipse(
      { x: cx(cur) - r, y: cy - r, w: 2 * r, h: 2 * r },
      { fill: colors.ink, role: 'current' },
    );
  });
  const ly = area.y + area.h + 0.12;
  let lx = area.x;
  for (const [fill, label] of [
    [colors.ink, 'Today'],
    [colors.accent, c.targetLabel ?? 'Target'],
  ] as const) {
    ctx.ellipse({ x: lx, y: ly + 0.04, w: 0.2, h: 0.2 }, { fill });
    ctx.text(
      label,
      { x: lx + 0.3, y: ly, w: 2.6, h: 0.28 },
      { size: 'small', color: colors.muted, valign: 'middle', maxLines: 1, fixed: true },
    );
    lx += 3.0;
  }
}

export const maturityModel: LayoutDef<typeof schema> = {
  id: 'maturity-model',
  name: 'Maturity model',
  group: 'decide',
  purpose:
    'Use for showing where an organisation stands on a maturity scale and where it should get to — one capability as a staircase, or several on one grid.',
  useWhen: [
    'Capability assessments (data, AI, security, operations)',
    'Setting a target level and the gap per dimension',
    'Explaining what the next level would look like',
  ],
  avoidWhen: [
    'Levels that do not build on each other — use key-points',
    'Scores that are really numbers — use a bar chart',
  ],
  variants: ['grid', 'staircase'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Data foundations are a level behind the use cases we want to run next year',
      variant: 'grid',
      content: {
        levels: [
          { name: 'Ad hoc' },
          { name: 'Repeatable' },
          { name: 'Defined' },
          { name: 'Managed' },
          { name: 'Optimised' },
        ],
        dimensions: [
          { name: 'Data quality', current: 2, target: 4 },
          { name: 'Governance and ownership', current: 2, target: 3 },
          { name: 'Platform and tooling', current: 3, target: 4 },
          { name: 'Skills and roles', current: 1, target: 3 },
          { name: 'Use-case delivery', current: 3, target: 4 },
        ],
        targetLabel: 'Target by end of 2027',
      },
      sources: ['assessment'],
    },
    {
      title: 'We run AI pilots today; the next level is a shared platform with clear owners',
      variant: 'staircase',
      content: {
        levels: [
          {
            name: 'Experiments',
            description: 'Individual teams try tools; no shared data or rules',
          },
          { name: 'Pilots', description: 'Funded pilots with business owners and success metrics' },
          {
            name: 'Platform',
            description: 'Shared models, data and guardrails; reuse across functions',
          },
          {
            name: 'Embedded',
            description: 'AI in core processes with monitoring, budgets and accountability',
          },
        ],
        current: 2,
        target: 3,
        targetLabel: 'Target for 2027',
      },
    },
  ],
  compose(ctx, c) {
    if (ctx.variant === 'staircase') staircase(ctx, ctx.body, c);
    else grid(ctx, ctx.body, c);
  },
};
