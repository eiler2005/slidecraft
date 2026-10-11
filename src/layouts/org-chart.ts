import { z } from 'zod';
import type { LayoutDef } from './types.ts';

const Person = z
  .object({
    name: z.string().max(36).describe('Person or unit name'),
    role: z.string().max(48).optional(),
  })
  .strict();

const Unit = Person.extend({
  members: z
    .array(z.string().max(40))
    .max(4)
    .optional()
    .describe('Up to four names or sub-teams listed under the unit'),
  highlight: z.boolean().optional().describe('Emphasise this unit (new, changing, the ask)'),
}).strict();

const schema = z
  .object({
    root: Person.describe('Top of the chart'),
    units: z.array(Unit).min(2).max(5).describe('Direct reports or units'),
  })
  .strict();

export const orgChart: LayoutDef<typeof schema> = {
  id: 'org-chart',
  name: 'Org chart',
  group: 'people',
  purpose:
    'Use for a reporting structure two levels deep: who leads, which units report to them and who sits in each.',
  useWhen: [
    'Programme or project governance',
    'A proposed organisation — highlight the new or changing unit',
    'Showing the team that will deliver',
  ],
  avoidWhen: [
    'Decision rights matter more than lines — use raci',
    'Biographies matter — use team-cards',
  ],
  variants: ['tree'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'A small transformation office reports to the COO and owns the four workstreams',
      content: {
        root: { name: 'Transformation office', role: 'Sponsor: Chief Operating Officer' },
        units: [
          {
            name: 'Customer onboarding',
            role: 'Lead: Head of Sales Ops',
            members: ['Process design', 'CRM changes'],
          },
          {
            name: 'Finance automation',
            role: 'Lead: Financial Controller',
            members: ['Credit checks', 'e-Invoicing', 'Close'],
          },
          {
            name: 'Data platform',
            role: 'Lead: new hire, Q1',
            members: ['Data model', 'Quality rules', 'Reporting'],
            highlight: true,
          },
          {
            name: 'Change and training',
            role: 'Lead: HR Business Partner',
            members: ['Communications', 'Training'],
          },
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors, theme } = ctx;
    const n = c.units.length;
    const rootW = Math.min(4.2, body.w * 0.4);
    const rootH = 0.9;
    const rootX = body.x + (body.w - rootW) / 2;
    ctx.rect({ x: rootX, y: body.y, w: rootW, h: rootH }, { fill: colors.ink, role: 'node' });
    ctx.text(
      c.root.name,
      { x: rootX + 0.15, y: body.y + 0.1, w: rootW - 0.3, h: 0.4 },
      {
        size: 'heading',
        bold: true,
        color: colors.background,
        align: 'center',
        valign: 'middle',
        maxLines: 1,
        field: 'root/name',
      },
    );
    if (c.root.role)
      ctx.text(
        c.root.role,
        { x: rootX + 0.15, y: body.y + 0.5, w: rootW - 0.3, h: 0.32 },
        {
          size: 'small',
          color: colors.background,
          align: 'center',
          maxLines: 1,
          field: 'root/role',
        },
      );
    const gap = 0.22;
    const uw = (body.w - gap * (n - 1)) / n;
    const busY = body.y + rootH + 0.35;
    const unitY = busY + 0.35;
    const unitH = 1.05;
    const mid = body.x + body.w / 2;
    ctx.line(mid, body.y + rootH, mid, busY, { color: colors.muted, width: 1 });
    ctx.line(body.x + uw / 2, busY, body.x + body.w - uw / 2, busY, {
      color: colors.muted,
      width: 1,
    });
    c.units.forEach((u, i) => {
      const x = body.x + i * (uw + gap);
      ctx.line(x + uw / 2, busY, x + uw / 2, unitY, { color: colors.muted, width: 1 });
      ctx.rect(
        { x, y: unitY, w: uw, h: unitH },
        { fill: u.highlight ? colors.accent : colors.surface, role: 'node' },
      );
      ctx.text(
        u.name,
        { x: x + 0.14, y: unitY + 0.1, w: uw - 0.28, h: 0.52 },
        {
          size: theme.type.body,
          bold: true,
          color: u.highlight ? colors.accentText : colors.ink,
          align: 'center',
          valign: 'middle',
          maxLines: 2,
          field: `units/${i}/name`,
        },
      );
      if (u.role)
        ctx.text(
          u.role,
          { x: x + 0.1, y: unitY + 0.64, w: uw - 0.2, h: 0.34 },
          {
            size: 'small',
            color: u.highlight ? colors.accentText : colors.muted,
            align: 'center',
            maxLines: 2,
            field: `units/${i}/role`,
          },
        );
      if (u.members?.length) {
        const my = unitY + unitH + 0.22;
        ctx.line(x + uw / 2, unitY + unitH, x + uw / 2, my, { color: colors.rule, width: 0.75 });
        ctx.text(
          ctx.paragraphs(u.members, { spaceBefore: 6 }),
          { x: x + 0.05, y: my + 0.06, w: uw - 0.1, h: body.y + body.h - my - 0.06 },
          { size: 'small', align: 'center', field: `units/${i}/members` },
        );
      }
    });
  },
};
