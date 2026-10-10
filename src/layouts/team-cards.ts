import { z } from 'zod';
import { cols, inset, rows } from '../engine/format.ts';
import type { Box } from '../engine/scene.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    people: z
      .array(
        z
          .object({
            name: z.string().max(40).describe('Full name'),
            role: z.string().max(50).describe('Role or title, plus the relevant function'),
            bio: z
              .string()
              .max(150)
              .optional()
              .describe('One sentence of relevant experience; credentials, not a life story'),
            image: z
              .string()
              .optional()
              .describe(
                'Path to a portrait photo, relative to the deck file; empty shows a placeholder',
              ),
          })
          .strict(),
      )
      .min(2)
      .max(6)
      .describe('The people, in order of importance; more than four are shown in two rows'),
  })
  .strict();

type Person = z.infer<typeof schema>['people'][number];

export const teamCards: LayoutDef<typeof schema> = {
  id: 'team-cards',
  name: 'Team cards',
  group: 'people',
  purpose:
    'Use for introducing the people behind a proposal: who leads, who delivers, who the client sponsors are.',
  useWhen: [
    'Proposal or engagement team slide with two to six people',
    'Steering committee, governance or advisory board line-up',
    'Named owners of a program after the decision',
  ],
  avoidWhen: [
    'More than six people — group by team in a table (data-table)',
    'Assigning actions to people — use next-steps',
    'A sequence of responsibilities over time — use timeline',
  ],
  variants: ['cards', 'compact'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'A senior team that has run three German launches leads the entry',
      variant: 'cards',
      content: {
        people: [
          {
            name: 'Anna Keller',
            role: 'Managing Director, DACH',
            bio: 'Built Fabrikam’s German business from zero to €60M in five years.',
          },
          {
            name: 'Marcus Lindgren',
            role: 'Head of Partnerships',
            bio: 'Signed 40 channel partners across the Nordics and the DACH region.',
          },
          {
            name: 'Priya Nair',
            role: 'Chief Financial Officer',
            bio: 'Led the Contoso carve-out and two cross-border integrations.',
          },
          {
            name: 'Tomas Weber',
            role: 'Program Director',
            bio: 'Ran Northwind’s UK platform migration on time and 8% under budget.',
          },
        ],
      },
    },
    {
      title: 'Six accountable owners cover every workstream of the launch',
      variant: 'compact',
      content: {
        people: [
          {
            name: 'Anna Keller',
            role: 'Sponsor, Managing Director DACH',
            bio: 'Owns the P&L and the board relationship.',
          },
          {
            name: 'Marcus Lindgren',
            role: 'Partnerships lead',
            bio: 'Shortlist, negotiation and onboarding of the first ten partners.',
          },
          {
            name: 'Priya Nair',
            role: 'Finance lead',
            bio: 'Phase gates, budget control and the entity set-up.',
          },
          {
            name: 'Tomas Weber',
            role: 'Program director',
            bio: 'Integrated plan, risks and weekly steering reports.',
          },
          {
            name: 'Elena Rossi',
            role: 'Product and localization lead',
            bio: 'German-language product, data residency and compliance.',
          },
          {
            name: 'Jonas Becker',
            role: 'Sales enablement lead',
            bio: 'Playbooks, training and the reference-client program.',
          },
        ],
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors, theme } = ctx;
    const people = c.people;
    const n = people.length;
    const gap = 0.3;
    // Up to four people share one row; five or six split into two rows of three.
    const perRow = n <= 4 ? n : Math.ceil(n / 2);
    const slots = Math.max(perRow, 3);
    const rowCount = n <= 4 ? 1 : 2;
    const rowBoxes = rows(
      body,
      Array.from({ length: rowCount }, () => 1),
      0.35,
    );
    const place = (rowBox: Box, count: number): Box[] =>
      cols(
        rowBox,
        Array.from({ length: slots }, () => 1),
        gap,
      ).slice(0, count);

    const cells: Box[] = [];
    for (let r = 0; r < rowCount; r++) {
      const count = Math.min(perRow, n - r * perRow);
      cells.push(...place(rowBoxes[r]!, count));
    }

    const writeText = (p: Person, i: number, area: Box, accentRule: boolean) => {
      let y = area.y;
      if (accentRule) {
        ctx.rect({ x: area.x, y, w: 0.5, h: 0.045 }, { fill: colors.accent, role: 'accent-rule' });
        y += 0.2;
      }
      const name = ctx.text(
        p.name,
        { x: area.x, y, w: area.w, h: 0.7 },
        {
          role: 'name',
          font: 'heading',
          size: 'heading',
          bold: true,
          color: colors.ink,
          maxLines: 2,
          field: `people/${i}/name`,
        },
      );
      y += Math.min(name.contentHeight, 0.7) + 0.04;
      const role = ctx.text(
        p.role,
        { x: area.x, y, w: area.w, h: 0.5 },
        {
          role: 'role',
          size: 'small',
          bold: true,
          color: colors.accent,
          maxLines: 2,
          field: `people/${i}/role`,
        },
      );
      y += Math.min(role.contentHeight, 0.5) + 0.12;
      if (p.bio) {
        const h = area.y + area.h - y;
        ctx.text(
          p.bio,
          { x: area.x, y, w: area.w, h },
          {
            role: 'bio',
            size: rowCount === 2 ? theme.type.body - 2 : 'body',
            color: colors.muted,
            field: `people/${i}/bio`,
          },
        );
      }
    };

    if (ctx.variant === 'compact') {
      people.forEach((p, i) => {
        const cell = cells[i]!;
        writeText(p, i, { ...cell, y: cell.y + 0.1 }, true);
      });
      return;
    }

    people.forEach((p, i) => {
      const cell = cells[i]!;
      const alt = `Portrait of ${p.name}`;
      const label = 'Photo';
      if (rowCount === 1) {
        const imgH = cell.h * 0.55;
        ctx.rect(cell, { fill: colors.surface, role: 'card' });
        ctx.image({ x: cell.x, y: cell.y, w: cell.w, h: imgH }, p.image, alt, {
          fit: 'cover',
          field: `people/${i}/image`,
          label,
        });
        ctx.rect(
          { x: cell.x, y: cell.y + imgH, w: cell.w, h: 0.05 },
          { fill: colors.accent, role: 'card-accent' },
        );
        writeText(
          p,
          i,
          { x: cell.x + 0.22, y: cell.y + imgH + 0.25, w: cell.w - 0.44, h: cell.h - imgH - 0.4 },
          false,
        );
      } else {
        // Two rows: image beside the text so the card stays readable at half height.
        const imgW = Math.min(1.5, cell.w * 0.4);
        ctx.rect(cell, { fill: colors.surface, role: 'card' });
        ctx.image({ x: cell.x, y: cell.y, w: imgW, h: cell.h }, p.image, alt, {
          fit: 'cover',
          field: `people/${i}/image`,
          label,
        });
        ctx.rect(
          { x: cell.x + imgW, y: cell.y, w: 0.05, h: cell.h },
          { fill: colors.accent, role: 'card-accent' },
        );
        writeText(
          p,
          i,
          inset(
            { x: cell.x + imgW + 0.05, y: cell.y, w: cell.w - imgW - 0.05, h: cell.h },
            { l: 0.2, r: 0.15, t: 0.18, b: 0.1 },
          ),
          false,
        );
      }
    });
  },
};
