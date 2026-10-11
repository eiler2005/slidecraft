import { existsSync, readFileSync } from 'node:fs';
import { getLayout } from '../layouts/index.ts';
import type { LoadedDeck } from '../library/load.ts';
import { getTheme } from '../library/load.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import { pngSize } from '../qa/pptx-verify.ts';
import type { Slide } from '../spec/deck.ts';
import type { FontSpec, Theme } from '../spec/theme.ts';
import { mix } from './color.ts';
import { createContext } from './context.ts';
import { decorSvg } from './decor.ts';
import { missingGlyphs } from './fonts.ts';
import { FORMATS, type Format } from './format.ts';
import type { Box, Master, Run, Scene, SceneNode, SceneSlide, TextStyle } from './scene.ts';
import { layoutText, makeTextNode, para } from './text.ts';

const COMMON_KEYS = new Set([
  'id',
  'layout',
  'variant',
  'title',
  'lead',
  'tracker',
  'sources',
  'source',
  'notes',
  'status',
  'ghost',
]);

export function slideContent(slide: Slide): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(slide)) if (!COMMON_KEYS.has(k)) out[k] = v;
  return out;
}

function collectStrings(v: unknown, out: string[]): void {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out));
}

/** Plans and governance: their numbers are commitments (dates, durations, steps), not data claims. */
const PLAN_LAYOUTS = new Set([
  'next-steps',
  'timeline',
  'process-steps',
  'gate-matrix',
  'agenda',
  'raci',
  'team-cards',
]);

/** Keys whose numbers are structure (dates, indices, positions), not claims needing a source. */
const NON_CLAIM_KEYS = new Set([
  'due',
  'date',
  'periods',
  'start',
  'end',
  'today',
  'current',
  'highlight',
  'recommended',
  'x',
  'y',
  'decimals',
  'presenter',
  'owner',
  'contact',
  'kicker',
]);

function hasNumbers(v: unknown, key = ''): boolean {
  if (NON_CLAIM_KEYS.has(key)) return false;
  if (typeof v === 'number') return true;
  if (typeof v === 'string')
    return /\d/.test(v.replace(/\b(19|20)\d\d\b/g, '').replace(/\bQ[1-4]\b/g, ''));
  if (Array.isArray(v)) return v.some((x) => hasNumbers(x, key));
  if (v && typeof v === 'object') return Object.entries(v).some(([k, x]) => hasNumbers(x, k));
  return false;
}

/** Pick fonts, applying the theme's Cyrillic override when deck text needs it. */
export function resolveFonts(
  theme: Theme,
  allText: string,
  diagnostics: Diagnostic[],
): { heading: FontSpec; body: FontSpec } {
  const fonts = { heading: theme.fonts.heading, body: theme.fonts.body };
  for (const role of ['heading', 'body'] as const) {
    const miss = missingGlyphs(fonts[role].measure, allText);
    if (!miss.length) continue;
    const alt = theme.fonts.cyrillic?.[role];
    if (alt && missingGlyphs(alt.measure, allText).length === 0) {
      fonts[role] = alt;
    } else {
      diagnostics.push(
        diag(
          'SC-GLYPH-001',
          `${role} font ${fonts[role].family} lacks glyphs: ${miss.slice(0, 12).join(' ')}`,
          {
            pointer: '/theme',
          },
        ),
      );
    }
  }
  return fonts;
}

function textStyle(
  font: FontSpec,
  size: number,
  color: string,
  extra: Partial<TextStyle> = {},
): TextStyle {
  return {
    family: font.family,
    measure: font.measure,
    size,
    lineSpacing: +(size * 1.2).toFixed(2),
    color,
    align: 'left',
    valign: 'top',
    ...extra,
  };
}

function staticText(text: string, box: Box, style: TextStyle, role: string) {
  const ps = [para(text)];
  return makeTextNode(ps, box, style, layoutText(ps, style, box.w), { role });
}

function buildMasters(
  theme: Theme,
  format: Format,
  fonts: { heading: FontSpec; body: FontSpec },
  footer?: string,
): Record<string, Master> {
  const c = theme.colors;
  const masters: Record<string, Master> = {};
  const small = theme.type.source + 0.5;
  for (const id of ['cover', 'content', 'divider'] as const) {
    const nodes: SceneNode[] = [];
    const svg = decorSvg(theme, id, format.w, format.h);
    if (svg) {
      nodes.push({
        kind: 'image',
        box: { x: 0, y: 0, w: format.w, h: format.h },
        svg,
        alt: '',
        fit: 'cover',
        decorative: true,
        role: 'decor',
      });
    }
    const bg = c.background;
    if (theme.chrome.logo && existsSync(theme.chrome.logo)) {
      const size = pngSize(readFileSync(theme.chrome.logo));
      const ratio = size ? size.w / size.h : 3;
      const h = id === 'cover' ? 0.55 : 0.3;
      const w = Math.min(id === 'cover' ? 2.6 : 1.6, h * ratio);
      const hh = w / ratio;
      const box =
        id === 'cover'
          ? { x: format.w - format.margin.r - w, y: format.h - 0.95 - hh / 2, w, h: hh }
          : { x: format.w - format.margin.r - w, y: format.margin.t - 0.04, w, h: hh };
      nodes.push({
        kind: 'image',
        box,
        path: theme.chrome.logo,
        alt: 'Logo',
        fit: 'contain',
        decorative: true,
        role: 'logo',
      });
    }
    if (id === 'content' || id === 'divider') {
      const ft = footer ?? theme.chrome.footer;
      if (ft)
        nodes.push(staticText(ft, format.footer, textStyle(fonts.body, small, c.muted), 'footer'));
    }
    const m: Master = { id, background: bg, nodes };
    if (theme.chrome.pageNumbers && id !== 'cover') {
      m.slideNumber = {
        box: format.pageNumber,
        style: textStyle(fonts.body, small, c.muted, { align: 'right' }),
      };
    }
    masters[id] = m;
  }
  return masters;
}

export interface ComposeResult {
  scene: Scene;
  diagnostics: Diagnostic[];
}

export function composeDeck(loaded: LoadedDeck): ComposeResult {
  const { deck, slides, baseDir } = loaded;
  const diagnostics: Diagnostic[] = [];
  const theme = getTheme(deck.theme) ?? getTheme('consulting-classic')!;
  const format = FORMATS[deck.format] ?? FORMATS['wide-16x9']!;
  const strings: string[] = [deck.title, deck.subtitle ?? '', deck.footer ?? ''];
  slides.forEach((s) => collectStrings(s, strings));
  const fonts = resolveFonts(theme, strings.join(' '), diagnostics);
  const masters = buildMasters(theme, format, fonts, deck.footer);
  const c = theme.colors;
  const sourceMap = new Map(deck.sources.map((s) => [s.id, s]));
  const sceneSlides: SceneSlide[] = [];

  slides.forEach((slide, index) => {
    const def = getLayout(slide.layout)!;
    const variant = (slide.variant as string | undefined) ?? def.variants[0];
    const body = slide.lead ? format.body : format.bodyNoLead;
    const ctx = createContext({
      theme,
      format,
      fonts,
      slideId: slide.id,
      slideIndex: index,
      variant,
      body,
      baseDir,
      slide: { title: slide.title, ...(slide.lead ? { lead: slide.lead } : {}) },
    });
    const isGhost =
      slide.status === 'ghost' || (slide.status === undefined && deck.status === 'ghost');

    if (def.frame === 'standard') {
      if (theme.chrome.tracker && slide.tracker) {
        ctx.text(slide.tracker.toUpperCase(), format.tracker, {
          role: 'tracker',
          size: 'small',
          bold: true,
          color: c.accent,
          fixed: true,
          maxLines: 1,
          field: 'tracker',
        });
      }
      if (theme.chrome.accentBar && !(theme.chrome.tracker && slide.tracker))
        ctx.rect(
          { x: format.title.x, y: format.title.y - 0.1, w: 0.55, h: 0.05 },
          { fill: c.accent, role: 'accent-bar' },
        );
      const t = theme.type.title;
      const fitDiags = ctx.diagnostics.length;
      const titleNode = ctx.text(slide.title, format.title, {
        role: 'title',
        font: 'heading',
        sizes: [t, t - 2],
        bold: theme.type.titleWeight === 'bold',
        color: c.titleInk ?? c.ink,
        maxLines: 2,
        lineHeight: 1.12,
        field: 'title',
      });
      // Replace generic fit errors on titles with the title-specific code.
      const added = ctx.diagnostics.splice(fitDiags);
      if (added.some((d) => d.code === 'SC-FIT-001' || d.code === 'SC-FIT-003')) {
        ctx.diagnostics.push(
          diag(
            'SC-TITLE-001',
            `Title needs ${titleNode.lines.length} lines at ${titleNode.style.size}pt`,
            {
              slide: slide.id,
              pointer: ctx.ptr('title'),
              measured: `${slide.title.length} chars`,
              limit: '2 lines (~90 chars)',
            },
          ),
        );
      }
      if (theme.chrome.titleRule) {
        const yRule = format.title.y + format.title.h + 0.04;
        ctx.line(format.title.x, yRule, format.title.x + format.title.w, yRule, {
          color: c.rule,
          width: 0.75,
        });
      }
      if (slide.lead)
        ctx.text(slide.lead, format.lead, {
          role: 'lead',
          size: 'subtitle',
          color: c.muted,
          maxLines: 1,
          field: 'lead',
        });

      const words = slide.title.trim().split(/\s+/).length;
      if (words < 5)
        ctx.issue(
          diag(
            'SC-TITLE-002',
            `Title "${slide.title}" has ${words} words — likely a topic, not a claim`,
            { pointer: ctx.ptr('title') },
          ),
        );
      if (/[.]$/.test(slide.title.trim()))
        ctx.issue(diag('SC-TITLE-003', 'Title ends with a period', { pointer: ctx.ptr('title') }));
    }

    if (isGhost) {
      const g = slide.ghost;
      const box = def.frame === 'standard' ? body : { x: 1, y: 3.2, w: format.w - 2, h: 2.6 };
      ctx.rect(box, {
        fill: mix(c.surface, c.background, 0.3),
        stroke: { color: c.muted, width: 1, dash: 'dash' },
        radius: 0.08,
        role: 'ghost',
      });
      const lines = [
        `**Exhibit:** ${g?.exhibit ?? `${def.name} (${variant})`}`,
        g?.data ? `**Data:** ${g.data}` : '',
        `**Confidence:** ${g?.confidence ?? 'likely'}`,
      ].filter(Boolean);
      ctx.text(
        lines,
        { x: box.x + 0.4, y: box.y + 0.35, w: box.w - 0.8, h: box.h - 0.7 },
        { role: 'ghost-note', size: 'body', color: c.muted, valign: 'middle', align: 'center' },
      );
      if (def.frame === 'none')
        ctx.text(
          slide.title,
          { x: 1, y: 1.6, w: format.w - 2, h: 1.4 },
          { role: 'title', font: 'heading', size: theme.type.title + 4, bold: true, maxLines: 2 },
        );
    } else {
      const content = def.schema.parse(slideContent(slide));
      def.compose(ctx, content);
    }

    // Source line
    const srcTitles = (slide.sources ?? []).map((id) => sourceMap.get(id)).filter((s) => !!s);
    const illustrative = srcTitles.some((s) => s!.illustrative);
    const srcText = [
      illustrative ? 'Illustrative data.' : '',
      srcTitles.length
        ? `Source: ${srcTitles.map((s) => s!.title + (s!.date ? ` (${s!.date})` : '')).join('; ')}`
        : '',
      slide.source ? (srcTitles.length ? slide.source : `Source: ${slide.source}`) : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (srcText && def.frame === 'standard') {
      // Same text as srcText, split into runs so registry titles with a URL become links.
      const runs: Run[] = [];
      const add = (text: string, link?: string) => {
        if (text) runs.push(link ? { text, link } : { text });
      };
      if (illustrative)
        add(srcTitles.length || slide.source ? 'Illustrative data. ' : 'Illustrative data.');
      if (srcTitles.length) {
        add('Source: ');
        srcTitles.forEach((s, k) => {
          add(s!.title, s!.url);
          add(`${s!.date ? ` (${s!.date})` : ''}${k < srcTitles.length - 1 ? '; ' : ''}`);
        });
      }
      if (slide.source)
        add(
          `${srcTitles.length ? ' ' : ''}${srcTitles.length ? slide.source : `Source: ${slide.source}`}`,
        );
      ctx.text([{ runs }], format.source, {
        role: 'source',
        size: 'source',
        color: c.muted,
        maxLines: 2,
        valign: 'bottom',
        field: 'sources',
      });
    }
    if (
      !isGhost &&
      def.frame === 'standard' &&
      !srcText &&
      !PLAN_LAYOUTS.has(def.id) &&
      hasNumbers(slideContent(slide))
    ) {
      ctx.issue(
        deck.status === 'final'
          ? diag('SC-SRC-002', 'Slide shows numbers but cites no source', {
              pointer: ctx.ptr('sources'),
            })
          : diag('SC-SRC-001', 'Slide shows numbers but cites no source', {
              pointer: ctx.ptr('sources'),
            }),
      );
    }

    diagnostics.push(...ctx.diagnostics);
    const sceneSlide: SceneSlide = {
      id: slide.id,
      index,
      layout: def.id,
      variant,
      master: isGhost && def.frame === 'none' ? 'content' : def.master,
      nodes: ctx.nodes,
      title: slide.title,
    };
    if (slide.notes) sceneSlide.notes = slide.notes;
    sceneSlides.push(sceneSlide);
  });

  const scene: Scene = {
    deckId: deck.id,
    title: deck.title,
    language: deck.language,
    format: { id: format.id, w: format.w, h: format.h },
    themeId: theme.id,
    masters,
    slides: sceneSlides,
    palette: {
      background: c.background,
      ink: c.titleInk ?? c.ink,
      muted: c.muted,
      accent: c.accent,
      rule: c.rule,
      surface: c.surface,
    },
    fonts: {
      heading: { family: fonts.heading.family, measure: fonts.heading.measure },
      body: { family: fonts.body.family, measure: fonts.body.measure },
    },
    meta: {
      ...(deck.subtitle ? { subtitle: deck.subtitle } : {}),
      ...(deck.date ? { date: deck.date } : {}),
      ...(deck.organization ? { organization: deck.organization } : {}),
    },
  };
  if (deck.author) scene.author = deck.author;
  if (theme.officeTheme) scene.officeTheme = theme.officeTheme;
  return { scene, diagnostics };
}
