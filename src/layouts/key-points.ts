import { z } from 'zod';
import { cols, columns, inset } from '../engine/format.ts';
import { Icon } from '../engine/icons.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    points: z
      .array(
        z
          .object({
            heading: z.string().max(60).describe('The point as a short claim, not a topic label'),
            body: z
              .string()
              .max(220)
              .optional()
              .describe('Evidence or implication in one or two sentences'),
            metric: z
              .string()
              .max(10)
              .optional()
              .describe('Proof number shown prominently, e.g. "+18%", "€40M", "3×"'),
            icon: Icon.optional().describe(
              'Icon above the point (Tabler set); give every point one or none',
            ),
          })
          .strict(),
      )
      .min(2)
      .max(4)
      .describe(
        '2–4 parallel points that together prove the title; list variant reads best with 3–4',
      ),
  })
  .strict();

export const keyPoints: LayoutDef<typeof schema> = {
  id: 'key-points',
  name: 'Key points',
  group: 'message',
  purpose:
    'Use for two to four parallel points that together prove the title, each with a short heading, support and an optional proof number.',
  useWhen: [
    'Three reasons, pillars or findings that support the action title',
    'Parallel points of equal weight where each can carry one proof number',
  ],
  avoidWhen: [
    'The whole argument as situation, complication and resolution — use exec-summary',
    'Several KPIs with no explanatory text — use kpi-tiles',
    'Steps in order — use process-steps',
  ],
  variants: ['columns', 'cards', 'list'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Three strengths make Contoso a credible partner for the German launch',
      variant: 'columns',
      content: {
        points: [
          {
            metric: '+18%',
            heading: 'Revenue has compounded for four years',
            body: 'Contoso grew 18% a year since 2022 and funds its own expansion without new capital.',
          },
          {
            metric: '9 in 10',
            heading: 'Clients renew after the first year',
            body: 'Renewal is highest among regulated customers, the segment we target in Germany.',
          },
          {
            metric: '12',
            heading: 'Integration partners already operate in DACH',
            body: 'Existing alliances cover three of the five largest German system integrators.',
          },
        ],
      },
      sources: ['contoso-annual'],
    },
    {
      title: 'Northwind wins on speed, coverage and cost against regional rivals',
      variant: 'cards',
      content: {
        points: [
          {
            heading: 'Speed to value',
            body: 'Clients go live in 6 weeks against an industry norm of 5 months.',
            metric: '6 wks',
          },
          {
            heading: 'Coverage',
            body: 'One platform serves finance, supply chain and HR without separate contracts.',
            metric: '3 areas',
          },
          {
            heading: 'Total cost',
            body: 'Three-year cost of ownership is a quarter below the closest competitor.',
            metric: '-24%',
          },
          {
            heading: 'Support',
            body: 'Local-language support is available around the clock for every paying client.',
            metric: '24/7',
          },
        ],
      },
      sources: ['market-scan'],
    },
    {
      title: 'Fabrikam can cut onboarding cost by acting on three levers',
      variant: 'list',
      content: {
        points: [
          {
            heading: 'Automate document checks',
            body: 'Machine review replaces manual checking for 80% of applications and frees the compliance team for exceptions.',
            metric: '-35%',
          },
          {
            heading: 'Consolidate vendors',
            body: 'Moving from seven identity providers to two simplifies contracts and reduces licence spend.',
            metric: '-€1.2M',
          },
          {
            heading: 'Standardise the journey',
            body: 'One onboarding flow across all markets removes local rework and shortens training for new staff.',
            metric: '-9 days',
          },
        ],
      },
      sources: ['fabrikam-ops'],
    },
    {
      title: 'Three capabilities let the platform team ship AI features safely',
      variant: 'columns',
      content: {
        points: [
          {
            icon: 'database',
            heading: 'Clean data where the work happens',
            body: 'Customer and order data reach the models through one governed interface.',
          },
          {
            icon: 'shield-check',
            heading: 'Guardrails before launch',
            body: 'Every feature passes evaluation and red-team tests before it reaches users.',
          },
          {
            icon: 'chart-line',
            heading: 'Usage measured weekly',
            body: 'Adoption and the business metric are reviewed with the owner every week.',
          },
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors, theme } = ctx;
    const n = c.points.length;
    const hasMetric = c.points.some((p) => p.metric);
    const hasIcon = c.points.some((p) => p.icon);
    const iconSize = 0.42;
    const metricSizes = [48, 44, 40, 36, 32, 28];

    if (ctx.variant === 'list') {
      const gapRows = 0;
      const rowH = Math.min(1.5, body.h / n);
      const hasMetricCol = hasMetric;
      ctx.line(body.x, body.y, body.x + body.w, body.y, { color: colors.ink, width: 1 });
      c.points.forEach((p, i) => {
        const y = body.y + i * (rowH + gapRows);
        if (i > 0) ctx.line(body.x, y, body.x + body.w, y, { color: colors.rule, width: 0.75 });
        const row = { x: body.x, y, w: body.w, h: rowH };
        const [headCol, rest] = cols(row, [35, 65], 0.4);
        const iconW = hasIcon ? iconSize + 0.2 : 0;
        if (p.icon)
          ctx.icon(
            p.icon,
            { x: headCol!.x, y: y + 0.2, w: iconSize, h: iconSize },
            {
              field: `points/${i}/icon`,
            },
          );
        const headBox = { ...headCol!, x: headCol!.x + iconW, w: headCol!.w - iconW };
        const metricW = hasMetricCol ? 1.9 : 0;
        const bodyBox = { ...rest!, w: rest!.w - (metricW ? metricW + 0.3 : 0) };
        const pad = 0.2;
        ctx.text(p.heading, inset(headBox, { t: pad, b: pad }), {
          role: 'heading',
          font: 'heading',
          size: theme.type.heading + 2,
          bold: true,
          maxLines: 3,
          field: `points/${i}/heading`,
        });
        if (p.body) {
          ctx.text(p.body, inset(bodyBox, { t: pad + 0.02, b: pad }), {
            role: 'body',
            size: 'body',
            color: colors.ink,
            field: `points/${i}/body`,
          });
        }
        if (p.metric) {
          ctx.text(
            p.metric,
            {
              x: rest!.x + rest!.w - metricW,
              y: y + pad - 0.04,
              w: metricW,
              h: Math.min(0.8, rowH - 2 * pad + 0.04),
            },
            {
              role: 'metric',
              font: 'heading',
              sizes: [32, 30, 28, 26, 24, 22, 20],
              bold: true,
              color: colors.accent,
              align: 'right',
              maxLines: 1,
              lineHeight: 1.0,
              field: `points/${i}/metric`,
            },
          );
        }
      });
      const yEnd = body.y + n * rowH;
      ctx.line(body.x, yEnd, body.x + body.w, yEnd, { color: colors.rule, width: 0.75 });
      return;
    }

    const isCards = ctx.variant === 'cards';
    const gap = isCards ? 0.3 : n === 4 ? 0.4 : 0.55;
    const parts = columns(body, n, gap);
    const bodySize =
      n === 2 ? theme.type.body + 3 : n === 3 ? theme.type.body + 1 : theme.type.body;
    const headSize = theme.type.heading + (n === 4 ? 1 : 3);
    const padX = isCards ? 0.25 : 0;
    const top = isCards ? 0.06 + 0.25 : 0.0;

    let heads: number[] = [];
    const heightsPass = c.points.map((p, i) => {
      const part = parts[i]!;
      if (isCards) {
        ctx.rect(part, { fill: colors.surface, role: 'card' });
        ctx.rect(
          { x: part.x, y: part.y, w: part.w, h: 0.06 },
          { fill: colors.accent, role: 'card-bar' },
        );
      } else {
        ctx.line(part.x, part.y, part.x + part.w, part.y, { color: colors.accent, width: 2.5 });
      }
      const inner = { x: part.x + padX, y: part.y + (isCards ? top : 0.3), w: part.w - 2 * padX };
      let y = inner.y;
      if (p.icon)
        ctx.icon(
          p.icon,
          { x: inner.x, y, w: iconSize, h: iconSize },
          { field: `points/${i}/icon` },
        );
      if (hasIcon) y += iconSize + 0.22;
      if (p.metric) {
        ctx.text(
          p.metric,
          { x: inner.x, y, w: inner.w, h: 0.85 },
          {
            role: 'metric',
            font: 'heading',
            sizes: metricSizes,
            bold: true,
            color: colors.accent,
            maxLines: 1,
            lineHeight: 1.0,
            field: `points/${i}/metric`,
          },
        );
      }
      if (hasMetric) y += 1.05;
      const head = ctx.text(
        p.heading,
        { x: inner.x, y, w: inner.w, h: 1.3 },
        {
          role: 'heading',
          font: 'heading',
          size: headSize,
          bold: true,
          maxLines: 3,
          field: `points/${i}/heading`,
        },
      );
      heads.push(Math.min(head.box.h, head.contentHeight));
      return { inner, y };
    });

    const headH = Math.max(...heads, 0);
    c.points.forEach((p, i) => {
      if (!p.body) return;
      const { inner, y } = heightsPass[i]!;
      const by = y + headH + 0.18;
      const bottom = parts[i]!.y + parts[i]!.h - (isCards ? 0.25 : 0);
      ctx.text(
        p.body,
        { x: inner.x, y: by, w: inner.w, h: Math.max(0.5, bottom - by) },
        { role: 'body', size: bodySize, color: colors.ink, field: `points/${i}/body` },
      );
    });
    heads = [];
  },
};
