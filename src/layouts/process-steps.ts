import { z } from 'zod';
import { ensureContrast, mix } from '../engine/color.ts';
import { columns } from '../engine/format.ts';
import { Icon } from '../engine/icons.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    steps: z
      .array(
        z
          .object({
            title: z.string().max(36).describe('Verb-led step name, e.g. "Sign two partners"'),
            body: z
              .string()
              .max(150)
              .optional()
              .describe('What happens and the output of the step'),
            owner: z.string().max(30).optional(),
            icon: Icon.optional().describe('Icon for the step (Tabler set); every step or none'),
          })
          .strict(),
      )
      .min(3)
      .max(6),
    highlight: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Index of the step to emphasise (e.g. where we are now)'),
  })
  .strict();

export const processSteps: LayoutDef<typeof schema> = {
  id: 'process-steps',
  name: 'Process steps',
  group: 'sequence',
  purpose:
    'Use for a sequence of 3–6 steps where order matters — an approach, a method or a customer journey.',
  useWhen: [
    'Explaining the approach or methodology',
    'A phased plan without dates',
    'How a product or process works',
  ],
  avoidWhen: [
    'Steps with dates and durations — use timeline (gantt)',
    'Unordered points — use key-points',
  ],
  variants: ['chevrons', 'numbered'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'A four-step partner-led entry limits risk at every stage',
      variant: 'chevrons',
      content: {
        steps: [
          {
            title: 'Select partners',
            body: 'Shortlist six resellers; sign two with exclusive mid-market rights',
            owner: 'Strategy',
          },
          {
            title: 'Localise',
            body: 'German UI, data residency in Frankfurt, local payment methods',
            owner: 'Product',
          },
          {
            title: 'Launch pilots',
            body: '15 reference clients through partners, success team on site',
            owner: 'Sales',
          },
          {
            title: 'Scale direct',
            body: 'Hire direct sales once 40 references are live',
            owner: 'Country lead',
          },
        ],
        highlight: 0,
      },
    },
    {
      title: 'Our diagnostic moves from data to decisions in five weeks',
      variant: 'numbered',
      content: {
        steps: [
          {
            title: 'Frame the question',
            body: 'Agree the decision, scope and hypotheses with the sponsor in week one',
          },
          {
            title: 'Gather evidence',
            body: 'Interviews, finance data and a customer survey run in parallel',
          },
          {
            title: 'Analyse',
            body: 'Test each hypothesis; kill the ones the data does not support',
          },
          {
            title: 'Recommend',
            body: 'Synthesis workshop and a board-ready recommendation in week five',
          },
        ],
      },
    },
    {
      title: 'Each AI feature moves from a user problem to a measured release in four steps',
      variant: 'chevrons',
      content: {
        steps: [
          {
            icon: 'users',
            title: 'Sit with users',
            body: 'Map the workflow and its data with the people who do the work',
          },
          {
            icon: 'target',
            title: 'Pick the job',
            body: 'Choose the step where AI changes cost, time or quality most',
          },
          {
            icon: 'code',
            title: 'Build',
            body: 'Connect data, prompts, evaluations and guardrails',
          },
          {
            icon: 'chart-line',
            title: 'Ship and measure',
            body: 'Track adoption and the business metric every week',
          },
        ],
        highlight: 3,
      },
    },
  ],
  compose(ctx, c) {
    const { colors, theme, body } = ctx;
    const n = c.steps.length;
    const hasIcon = c.steps.some((s) => s.icon);
    const iconSize = 0.38;
    const iconRow = hasIcon ? iconSize + 0.2 : 0;
    if (ctx.variant === 'chevrons') {
      const h = 0.78;
      const notch = 0.24;
      const gap = 0.06;
      const w = (body.w - notch - gap * (n - 1)) / n;
      const y = body.y;
      c.steps.forEach((s, i) => {
        const x0 = body.x + i * (w + gap);
        const x1 = x0 + w;
        const pts: [number, number][] =
          i === 0
            ? [
                [x0, y],
                [x1, y],
                [x1 + notch, y + h / 2],
                [x1, y + h],
                [x0, y + h],
              ]
            : [
                [x0, y],
                [x1, y],
                [x1 + notch, y + h / 2],
                [x1, y + h],
                [x0, y + h],
                [x0 + notch, y + h / 2],
              ];
        const hl = c.highlight === i;
        ctx.polygon(pts, { fill: hl ? colors.accent : colors.surface, role: 'chevron' });
        const tx = x0 + (i === 0 ? 0.18 : notch + 0.12);
        ctx.text(
          s.title,
          { x: tx, y, w: x1 - tx + notch * 0.4, h },
          {
            font: 'heading',
            size: 'heading',
            bold: true,
            color: hl ? colors.accentText : colors.ink,
            valign: 'middle',
            maxLines: 2,
            field: `steps/${i}/title`,
          },
        );
        if (s.icon)
          ctx.icon(
            s.icon,
            { x: x0 + 0.05, y: y + h + 0.28, w: iconSize, h: iconSize },
            { color: hl ? colors.accent : colors.muted, field: `steps/${i}/icon` },
          );
        const by = y + h + 0.28 + iconRow;
        const bw = w - 0.1;
        const ownerH = s.owner ? 0.3 : 0;
        if (s.body)
          ctx.text(
            s.body,
            { x: x0 + 0.05, y: by, w: bw, h: body.y + body.h - by - ownerH - 0.05 },
            { size: 'body', color: colors.ink, field: `steps/${i}/body` },
          );
        if (s.owner) {
          ctx.line(
            x0 + 0.05,
            body.y + body.h - ownerH - 0.02,
            x0 + 0.45,
            body.y + body.h - ownerH - 0.02,
            { color: hl ? colors.accent : colors.rule, width: 1.5 },
          );
          ctx.text(
            s.owner,
            { x: x0 + 0.05, y: body.y + body.h - ownerH + 0.04, w: bw, h: 0.24 },
            {
              size: 'small',
              color: colors.muted,
              maxLines: 1,
              fixed: true,
              field: `steps/${i}/owner`,
            },
          );
        }
      });
      return;
    }
    // numbered
    const colsB = columns(body, n, 0.4);
    const numH = 0.85;
    colsB.forEach((b, i) => {
      const s = c.steps[i]!;
      const hl = c.highlight === undefined || c.highlight === i;
      // steps that are not highlighted recede, but their large numbers still read (3:1)
      const numColor = hl
        ? colors.accent
        : ensureContrast(mix(colors.accent, colors.background, 0.45), colors.background, 3);
      ctx.text(
        String(i + 1).padStart(2, '0'),
        { x: b.x, y: b.y, w: 1.1, h: numH },
        {
          font: 'heading',
          size: theme.type.title + 14,
          bold: true,
          color: numColor,
          maxLines: 1,
          fixed: true,
        },
      );
      if (i < n - 1) {
        const ly = b.y + numH / 2;
        ctx.line(
          b.x + 1.05,
          ly,
          b.x + b.w + 0.3,
          ly,
          { color: colors.rule, width: 1 },
          { arrowEnd: true },
        );
      }
      if (s.icon)
        ctx.icon(
          s.icon,
          { x: b.x, y: b.y + numH + 0.1, w: iconSize, h: iconSize },
          { color: hl ? colors.accent : colors.muted, field: `steps/${i}/icon` },
        );
      ctx.text(
        s.title,
        { x: b.x, y: b.y + numH + 0.1 + iconRow, w: b.w, h: 0.62 },
        { font: 'heading', size: 'heading', bold: true, maxLines: 2, field: `steps/${i}/title` },
      );
      if (s.body)
        ctx.text(
          s.body,
          {
            x: b.x,
            y: b.y + numH + 0.8 + iconRow,
            w: b.w,
            h: b.h - numH - 0.8 - iconRow - (s.owner ? 0.35 : 0),
          },
          { size: 'body', color: colors.ink, field: `steps/${i}/body` },
        );
      if (s.owner)
        ctx.text(
          s.owner,
          { x: b.x, y: b.y + b.h - 0.28, w: b.w, h: 0.24 },
          {
            size: 'small',
            color: colors.muted,
            maxLines: 1,
            fixed: true,
            field: `steps/${i}/owner`,
          },
        );
    });
  },
};
