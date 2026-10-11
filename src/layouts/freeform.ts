import { z } from 'zod';
import { vectorFamily } from '../engine/fonts.ts';
import { sanitizeCss, sanitizeHtml } from '../engine/freeform.ts';
import { diag } from '../qa/codes.ts';
import type { LayoutDef } from './types.ts';

const pptStroke = z
  .object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    width: z.number().positive(),
    dash: z.enum(['solid', 'dash', 'dot']).optional(),
  })
  .strict();
const pptItem = z.discriminatedUnion('kind', [
  z
    .object({
      id: z.string().regex(/^[a-z][a-z0-9-]*$/),
      kind: z.literal('text'),
      x: z.number(),
      y: z.number(),
      w: z.number().positive(),
      h: z.number().positive(),
      text: z.string(),
      size: z.number().positive(),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
      lineHeight: z.number().positive().optional(),
    })
    .strict(),
  z
    .object({
      id: z.string().regex(/^[a-z][a-z0-9-]*$/),
      kind: z.enum(['rect', 'ellipse']),
      x: z.number(),
      y: z.number(),
      w: z.number().positive(),
      h: z.number().positive(),
      fill: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      fillOpacity: z.number().min(0).max(1).optional(),
      stroke: pptStroke.optional(),
      radius: z.number().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      id: z.string().regex(/^[a-z][a-z0-9-]*$/),
      kind: z.literal('line'),
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
      stroke: pptStroke,
      arrowEnd: z.boolean().optional(),
    })
    .strict(),
]);

const schema = z
  .object({
    html: z
      .string()
      .max(12000)
      .describe(
        'HTML fragment for the slide body. Theme tokens: var(--ink), var(--accent), var(--font-heading)…',
      ),
    css: z.string().max(6000).optional().describe('CSS for the fragment; scoped to this slide'),
    ppt: z
      .array(pptItem)
      .min(1)
      .max(250)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        message: 'PowerPoint alternative ids must be unique within the slide',
      })
      .optional()
      .describe(
        'Editable PowerPoint equivalent, with stable ids and coordinates in inches relative to the HTML canvas. This is used for PPTX while html remains the visual reference.',
      ),
    alt: z
      .string()
      .min(10)
      .max(300)
      .describe('What the slide shows, in words — for screen readers and the DOCX memo'),
  })
  .strict();

export const freeform: LayoutDef<typeof schema> = {
  id: 'freeform',
  name: 'Freeform HTML',
  group: 'message',
  purpose:
    'Use for a browser-first creative exhibit no layout covers: HTML and CSS inside the standard frame, checked for overflow and text size like every other slide.',
  useWhen: [
    'Keynotes and story decks that need a bespoke visual',
    'A one-off diagram or composition that would take too long to build from layouts',
    'HTML-first decks presented from a browser',
  ],
  avoidWhen: [
    'Any exhibit a layout already covers — layouts stay editable in PowerPoint',
    'Complex CSS without a verified editable equivalent: supply ppt primitives rather than silently rasterising content',
  ],
  variants: ['body'],
  frame: 'standard',
  master: 'content',
  schema,
  examples: [
    {
      title: 'Three numbers tell the story of the first year',
      content: {
        alt: 'Three large numbers in a row: 14 days to 1 day onboarding, 80 percent automated checks, 2.1 times more applications',
        css: '.row{display:flex;gap:28px;height:100%;align-items:stretch}.cell{flex:1;background:var(--surface);border-top:6px solid var(--accent);padding:28px}.n{font-family:var(--font-heading);font-weight:700;font-size:64pt;line-height:1;color:var(--accent)}.l{margin-top:16px;font-size:var(--size-body);color:var(--ink)}.s{margin-top:8px;font-size:var(--size-small);color:var(--muted)}',
        html: '<div class="row"><div class="cell"><div class="n">1 day</div><div class="l">to onboard a standard client</div><div class="s">down from 14 days</div></div><div class="cell"><div class="n">80%</div><div class="l">of checks run automatically</div><div class="s">the rest go to a specialist</div></div><div class="cell"><div class="n">2.1×</div><div class="l">more applications per adviser</div><div class="s">same team, same hours</div></div></div>',
      },
      sources: ['ops-review'],
    },
  ],
  compose(ctx, c) {
    const { colors, theme, fonts } = ctx;
    const h = sanitizeHtml(c.html, ctx.baseDir);
    const s = c.css ? sanitizeCss(c.css) : { css: undefined, removed: [] as string[] };
    const removed = [...h.removed, ...s.removed];
    if (removed.length)
      ctx.issue(
        diag('SC-HTML-001', `Removed from freeform HTML: ${removed.join(', ')}`, {
          pointer: ctx.ptr('html'),
        }),
      );
    const fam = (f: typeof fonts.heading) =>
      `"${vectorFamily(f.measure)}", ${f.family}, sans-serif`;
    ctx.add({
      kind: 'html',
      box: ctx.body,
      html: h.html,
      ...(s.css ? { css: s.css } : {}),
      alt: c.alt,
      vars: {
        '--ink': colors.ink,
        '--muted': colors.muted,
        '--accent': colors.accent,
        '--accent-text': colors.accentText,
        '--accent-soft': colors.accentSoft,
        '--surface': colors.surface,
        '--rule': colors.rule,
        '--bg': colors.background,
        '--positive': colors.positive,
        '--negative': colors.negative,
        '--font-heading': fam(fonts.heading),
        '--font-body': fam(fonts.body),
        '--size-title': `${theme.type.title}pt`,
        '--size-heading': `${theme.type.heading}pt`,
        '--size-body': `${theme.type.body}pt`,
        '--size-small': `${theme.type.small}pt`,
      },
      ...(c.ppt ? { ppt: c.ppt } : {}),
      role: 'freeform',
      pointer: ctx.ptr('html'),
    });
  },
};
