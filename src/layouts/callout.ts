import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { cols } from '../engine/format.ts';
import type { Box } from '../engine/scene.ts';
import { diag } from '../qa/codes.ts';
import { pngSize } from '../qa/pptx-verify.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    image: z.string().optional().describe('Screenshot or photo, relative to the deck file'),
    alt: z.string().max(140).describe('What the image shows'),
    steps: z
      .array(
        z
          .object({
            action: z.string().max(70).describe('What the reader does'),
            result: z.string().max(80).optional().describe('What they should see'),
            x: z
              .number()
              .min(0)
              .max(1)
              .optional()
              .describe('Callout position on the image, 0–1 from the left'),
            y: z
              .number()
              .min(0)
              .max(1)
              .optional()
              .describe('Callout position on the image, 0–1 from the top'),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    check: z.string().max(110).optional().describe('How to verify the result'),
  })
  .strict();

/** Where an image drawn with `contain` actually lands inside its box. */
function contained(box: Box, path?: string): Box {
  if (!path || !existsSync(path)) return box;
  const size = pngSize(readFileSync(path));
  if (!size) return box;
  const k = Math.min(box.w / size.w, box.h / size.h);
  const w = size.w * k;
  const h = size.h * k;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export const callout: LayoutDef<typeof schema> = {
  id: 'callout',
  name: 'Callouts and steps',
  group: 'sequence',
  purpose:
    'Use for showing someone how to do something on a screen or object: numbered callouts on the picture, the action and expected result for each, and how to check it worked.',
  useWhen: [
    'Training and onboarding: where to click, what to expect',
    'Explaining a new tool, form or dashboard to its users',
    'Field or lab procedures with a photo of the object',
  ],
  avoidWhen: [
    'Steps without a picture — use process-steps',
    'A system view with findings — use architecture',
  ],
  variants: ['image-left'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Approving an invoice takes three clicks and shows a green status when done',
      content: {
        image: 'examples/narrative-story/assets/reconciliation.png',
        alt: 'Screenshot of the invoice queue with the approve button and status column',
        steps: [
          {
            action: 'Open the invoice from the queue',
            result: 'The detail pane opens on the right',
            x: 0.22,
            y: 0.3,
          },
          {
            action: 'Check amount and cost centre',
            result: 'Both fields are filled; mismatches show in red',
            x: 0.62,
            y: 0.45,
          },
          { action: 'Click Approve', result: 'Status turns green: Approved', x: 0.8, y: 0.78 },
        ],
        check: 'The invoice leaves your queue and appears under Approved today',
      },
    },
  ],
  compose(ctx, c) {
    const { body, colors, theme } = ctx;
    const [left, right] = cols(body, [1.45, 1], 0.45);
    const path = c.image
      ? isAbsolute(c.image)
        ? c.image
        : resolve(ctx.baseDir, c.image)
      : undefined;
    ctx.image(left!, c.image, c.alt, {
      fit: 'contain',
      field: 'image',
      label: 'Screenshot placeholder',
    });
    const img = contained(left!, path);
    const r = 0.19;
    const marker = (cx: number, cy: number, n: number) => {
      ctx.ellipse(
        { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r },
        { fill: colors.accent, stroke: { color: colors.background, width: 1.5 }, role: 'marker' },
      );
      ctx.text(
        String(n),
        { x: cx - r - 0.05, y: cy - r, w: 2 * r + 0.1, h: 2 * r },
        {
          size: theme.type.small,
          bold: true,
          color: colors.accentText,
          align: 'center',
          valign: 'middle',
          maxLines: 1,
          fixed: true,
        },
      );
    };
    c.steps.forEach((s, i) => {
      if ((s.x === undefined) !== (s.y === undefined))
        ctx.issue(
          diag('SC-SPEC-001', 'callout needs both x and y', { pointer: ctx.ptr(`steps/${i}`) }),
        );
      if (s.x !== undefined && s.y !== undefined)
        marker(img.x + s.x * img.w, img.y + s.y * img.h, i + 1);
    });
    const checkH = c.check ? 0.95 : 0;
    const listH = right!.h - checkH - (c.check ? 0.2 : 0);
    const rowH = Math.min(1.2, listH / c.steps.length);
    c.steps.forEach((s, i) => {
      const y = right!.y + i * rowH;
      marker(right!.x + r, y + r + 0.02, i + 1);
      ctx.text(
        s.action,
        { x: right!.x + 0.55, y, w: right!.w - 0.55, h: s.result ? 0.56 : rowH - 0.1 },
        {
          size: 'body',
          bold: true,
          maxLines: 2,
          field: `steps/${i}/action`,
        },
      );
      if (s.result)
        ctx.text(
          `→ ${s.result}`,
          { x: right!.x + 0.55, y: y + 0.56, w: right!.w - 0.55, h: rowH - 0.62 },
          {
            size: 'small',
            color: colors.muted,
            maxLines: 2,
            field: `steps/${i}/result`,
          },
        );
    });
    if (c.check) {
      const cy = right!.y + right!.h - checkH;
      ctx.rect(
        { x: right!.x, y: cy, w: right!.w, h: checkH },
        { fill: colors.accentSoft, role: 'check' },
      );
      ctx.rect(
        { x: right!.x, y: cy, w: 0.06, h: checkH },
        { fill: colors.accent, role: 'accent-rule' },
      );
      ctx.text(
        [{ runs: [{ text: 'Check: ', bold: true }, { text: c.check }] }],
        { x: right!.x + 0.25, y: cy, w: right!.w - 0.4, h: checkH },
        {
          size: 'small',
          valign: 'middle',
          maxLines: 3,
          field: 'check',
        },
      );
    }
  },
};
