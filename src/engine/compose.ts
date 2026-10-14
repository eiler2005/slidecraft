import { existsSync, readFileSync } from 'node:fs';
import { creditLine, type ImageCredit } from '../layouts/image-credit.ts';
import { getLayout } from '../layouts/index.ts';
import type { LoadedDeck } from '../library/load.ts';
import { getTheme } from '../library/load.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import { pngSize } from '../qa/pptx-verify.ts';
import { parseSourceRef, type Slide } from '../spec/deck.ts';
import type { FontSpec, Theme } from '../spec/theme.ts';
import { composeHeader, composeSource, composeTakeaway } from './chrome.ts';
import { mix } from './color.ts';
import { createContext } from './context.ts';
import { decorSvg } from './decor.ts';
import { missingGlyphs } from './fonts.ts';
import { FORMATS, type Format } from './format.ts';
import { isDefaultSourcePrefix, label } from './i18n.ts';
import { sourceNotes, withSourceNotes } from './notes.ts';
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
  'frame',
  'bottomLine',
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

/** A list index at the start of a label: "1 · Decision", "2. Storyline", "(3) Evidence". */
const ENUMERATOR = /^\s*\(?\d{1,2}\s*[.)·:–—-]\s+/;
/** A position in a sequence, not a measured quantity: "Step 2", "Phase 3", "Неделя 4". */
const SEQUENCE =
  /(?<![\p{L}\d])(?:step|phase|stage|wave|week|day|month|quarter|sprint|round|option|check|part|section|chapter|slide|level|tier|шаг|этап|фаза|волна|неделя|день|месяц|квартал|спринт|вариант|раздел|часть|уровень)\s+\d{1,2}(?![\d.,%])/giu;

/** Strips numbers that order or name things (years, quarters, list indices, steps) and keeps data. */
function claimDigits(s: string): string {
  return s
    .replace(ENUMERATOR, '')
    .replace(SEQUENCE, '')
    .replace(/\b(19|20)\d\d\b/g, '')
    .replace(/\bQ[1-4]\b/g, '');
}

function hasNumbers(v: unknown, key = ''): boolean {
  if (NON_CLAIM_KEYS.has(key)) return false;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return /\d/.test(claimDigits(v));
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
  for (const id of ['cover', 'content', 'divider', 'canvas'] as const) {
    const nodes: SceneNode[] = [];
    // brand template art first, scaled from the template's slide size to this format
    const art = theme.chrome.art;
    if (art && id !== 'canvas') {
      const sx = format.w / art.size.w;
      const sy = format.h / art.size.h;
      const shapes = art.shapes
        ? id === 'content'
          ? art.shapes.content
          : art.shapes.cover.length
            ? art.shapes.cover
            : art.shapes.content
        : [];
      for (const sh of shapes) {
        const box = { x: sh.x * sx, y: sh.y * sy, w: sh.w * sx, h: sh.h * sy };
        const stroke = sh.stroke ? { color: sh.stroke.color, width: sh.stroke.width } : undefined;
        if (sh.kind === 'line')
          nodes.push({
            kind: 'line',
            x1: box.x,
            y1: box.y,
            x2: box.x + box.w,
            y2: box.y + box.h,
            stroke: stroke ?? { color: sh.fill ?? c.rule, width: 1 },
            role: 'art',
          });
        else
          nodes.push({
            kind: sh.kind,
            box,
            ...(sh.fill ? { fill: sh.fill } : {}),
            ...(stroke ? { stroke } : {}),
            ...(sh.kind === 'rect' && sh.radius ? { radius: sh.radius * Math.min(sx, sy) } : {}),
            role: 'art',
          });
      }
      const list = id === 'content' ? art.content : art.cover.length ? art.cover : art.content;
      for (const a of list)
        if (existsSync(a.image))
          nodes.push({
            kind: 'image',
            box: { x: a.x * sx, y: a.y * sy, w: a.w * sx, h: a.h * sy },
            path: a.image,
            alt: '',
            fit: 'cover',
            decorative: true,
            role: 'art',
          });
    }
    const svg = id === 'canvas' ? undefined : decorSvg(theme, id, format.w, format.h);
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
    if (
      theme.chrome.pageNumbers &&
      !theme.chrome.pageBadge &&
      (id === 'content' || id === 'divider')
    ) {
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
    const frame =
      slide.frame ??
      (def.master === 'canvas' ? (theme.chrome.canvasFrame ?? 'standard') : def.frame);
    const fullBody = slide.lead ? format.body : format.bodyNoLead;
    const takeawayHeight = slide.bottomLine ? (theme.chrome.takeaway?.height ?? 0.65) + 0.12 : 0;
    const body = { ...fullBody, h: fullBody.h - takeawayHeight };
    const ctx = createContext({
      theme,
      format,
      fonts,
      slideId: slide.id,
      slideIndex: index,
      variant,
      body,
      baseDir,
      language: deck.language,
      slide: { title: slide.title, ...(slide.lead ? { lead: slide.lead } : {}) },
    });
    const isGhost =
      slide.status === 'ghost' || (slide.status === undefined && deck.status === 'ghost');

    if (frame === 'standard') {
      composeHeader(ctx, slide, index);
    }

    if (isGhost) {
      // a ghost is a sketch; say so loudly, especially when the content is already written
      const filled = Object.keys(slide).some(
        (k) =>
          ![
            'id',
            'layout',
            'variant',
            'title',
            'lead',
            'tracker',
            'status',
            'ghost',
            'notes',
            'sources',
            'source',
            'frame',
          ].includes(k),
      );
      ctx.issue(
        diag(
          'SC-GHOST-001',
          filled
            ? 'Slide has content but is still marked as a ghost, so it renders as a sketch'
            : 'Slide is still a ghost: only the planned exhibit is shown',
          {
            pointer: ctx.ptr('status'),
            hint: filled
              ? 'Remove `status: ghost` (here and on the deck) and the `ghost:` block to render the content.'
              : 'Write the content against `slidecraft layouts <layout> --json`, then remove `status: ghost`.',
          },
        ),
      );
      const g = slide.ghost;
      const box = frame === 'standard' ? body : { x: 1, y: 3.2, w: format.w - 2, h: 2.6 };
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
      if (frame === 'none')
        ctx.text(
          slide.title,
          { x: 1, y: 1.6, w: format.w - 2, h: 1.4 },
          { role: 'title', font: 'heading', size: theme.type.title + 4, bold: true, maxLines: 2 },
        );
    } else {
      const content = def.schema.parse(slideContent(slide));
      def.compose(ctx, content);
    }

    if (slide.bottomLine && !isGhost)
      composeTakeaway(
        ctx,
        slide.bottomLine,
        fullBody.y + fullBody.h - (theme.chrome.takeaway?.height ?? 0.65),
      );

    // Source line (the prefix follows the deck language unless a theme sets its own)
    const sourcePrefix = isDefaultSourcePrefix(theme.chrome.sources?.prefix)
      ? label(deck.language, 'source')
      : theme.chrome.sources!.prefix!;
    // "annual-report#p14": the source plus where in it
    const srcTitles = (slide.sources ?? [])
      .map((ref) => {
        const r = parseSourceRef(ref);
        const src = sourceMap.get(r.id);
        if (!src) return undefined;
        const title =
          src.title + (src.date ? ` (${src.date})` : '') + (r.where ? `, ${r.where}` : '');
        const url =
          src.url && r.page && /\.pdf($|\?)/i.test(src.url) ? `${src.url}#page=${r.page}` : src.url;
        return { ...src, title, ...(url ? { url } : {}), date: undefined };
      })
      .filter((s) => !!s);
    const illustrative = srcTitles.some((s) => s!.illustrative);
    const illustrativeLabel = label(deck.language, 'illustrative');
    // a stock photo's author and licence travel with the slide's sources (the cover shows
    // them on the picture)
    const credit =
      def.id === 'title' ? undefined : (slide as { imageCredit?: ImageCredit }).imageCredit;
    const creditText = credit ? creditLine(credit, label(deck.language, 'photo')) : '';
    const srcText = [
      illustrative ? illustrativeLabel : '',
      srcTitles.length
        ? `Source: ${srcTitles.map((s) => s!.title + (s!.date ? ` (${s!.date})` : '')).join('; ')}`
        : '',
      slide.source ? (srcTitles.length ? slide.source : `${sourcePrefix} ${slide.source}`) : '',
      creditText ? `${creditText}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (srcText && frame === 'standard') {
      // Same text as srcText, split into runs so registry titles with a URL become links.
      const runs: Run[] = [];
      const add = (text: string, link?: string) => {
        if (text) runs.push(link ? { text, link } : { text });
      };
      if (illustrative)
        add(srcTitles.length || slide.source ? `${illustrativeLabel} ` : illustrativeLabel);
      if (srcTitles.length) {
        add(`${sourcePrefix} `);
        srcTitles.forEach((s, k) => {
          add(s!.title, s!.url);
          add(`${s!.date ? ` (${s!.date})` : ''}${k < srcTitles.length - 1 ? '; ' : ''}`);
        });
      }
      if (slide.source)
        add(
          `${srcTitles.length ? ' ' : ''}${srcTitles.length ? slide.source : `${sourcePrefix} ${slide.source}`}`,
        );
      if (credit) {
        add(srcTitles.length || slide.source || illustrative ? ' ' : '');
        add(`${creditText}.`, credit.source);
      }
      composeSource(ctx, runs);
    }
    if (
      !isGhost &&
      frame === 'standard' &&
      !srcTitles.length &&
      !slide.source &&
      !PLAN_LAYOUTS.has(def.id) &&
      hasNumbers(
        def.id === 'freeform'
          ? // visible text only: numbers in tags, attributes and CSS are not data
            {
              text: String((slide as { html?: string }).html ?? '').replace(
                /<style[\s\S]*?<\/style>|<[^>]*>/g,
                ' ',
              ),
            }
          : slideContent(slide),
      )
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
      master:
        (isGhost && frame === 'none') || (frame === 'standard' && def.master === 'canvas')
          ? 'content'
          : def.master,
      nodes: ctx.nodes,
      title: slide.title,
      requiredRoles:
        frame === 'standard'
          ? [
              'title',
              ...(theme.chrome.tracker && slide.tracker ? ['tracker'] : []),
              ...(theme.chrome.titleRule ? ['chrome-title-rule'] : []),
              ...(theme.chrome.sideRail ? ['chrome-side-rail'] : []),
              ...(theme.chrome.accentBar && theme.chrome.markerWithTracker && slide.tracker
                ? ['chrome-section-marker']
                : []),
              ...(theme.chrome.pageNumbers ? ['page-number'] : []),
              ...((deck.footer ?? theme.chrome.footer) ? ['footer'] : []),
              ...(theme.chrome.pageNumbers && theme.chrome.pageBadge ? ['chrome-page-badge'] : []),
              ...(srcText && theme.chrome.sources?.visible !== false ? ['source'] : []),
              ...(slide.bottomLine && !isGhost
                ? ['chrome-takeaway-band', 'chrome-takeaway-accent', 'chrome-takeaway']
                : []),
            ]
          : [],
    };
    // Notes say where the slide's facts come from (PPTX, HTML, DOCX and notes PDF alike).
    const notes = withSourceNotes(slide.notes, sourceNotes(slide, sourceMap, deck.language));
    if (notes) sceneSlide.notes = notes;
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
  if (theme.template && existsSync(theme.template)) {
    const footer = deck.footer ?? theme.chrome.footer;
    scene.template = { path: theme.template, ...(footer ? { footer } : {}) };
  }
  return { scene, diagnostics };
}
