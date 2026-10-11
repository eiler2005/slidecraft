import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import YAML from 'yaml';
import type { z } from 'zod';
import { isMeasureFont, registerMeasureFont } from '../engine/fonts.ts';
import { FORMATS, makeFormat, registerFormat } from '../engine/format.ts';
import { getLayout } from '../layouts/index.ts';
import { STORYLINES_DIR, THEMES_DIR } from '../paths.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import { Brief } from '../spec/brief.ts';
import { Deck, type DeckDoc, GhostSlide, parseSourceRef, Slide } from '../spec/deck.ts';
import { FormatFile } from '../spec/format.ts';
import { Storyline } from '../spec/storyline.ts';
import type { Theme } from '../spec/theme.ts';
import { Theme as ThemeSchema } from '../spec/theme.ts';
import { type DataReport, resolveData } from './data.ts';

/** Parse a theme file; register its brand fonts and resolve its logo relative to the file. */
export function readThemeFile(path: string): Theme {
  const abs = resolve(path);
  const r = ThemeSchema.safeParse(JSON.parse(readFileSync(abs, 'utf8')));
  if (!r.success) throw new Error(`Invalid theme ${path}: ${r.error.message}`);
  const theme = r.data;
  const base = dirname(abs);
  const specs = [
    theme.fonts.heading,
    theme.fonts.body,
    theme.fonts.cyrillic?.heading,
    theme.fonts.cyrillic?.body,
  ];
  for (const f of specs) {
    if (!f?.files) continue;
    const files = Object.fromEntries(
      Object.entries(f.files).map(([k, v]) => [k, resolve(base, v)]),
    ) as { regular: string };
    registerMeasureFont(f.measure, files);
  }
  for (const f of specs) {
    if (f && !isMeasureFont(f.measure))
      throw new Error(
        `Theme ${theme.id}: unknown measure font "${f.measure}" — add "files" with the font's TTF/OTF`,
      );
  }
  if (theme.chrome.logo) theme.chrome.logo = resolve(base, theme.chrome.logo);
  if (theme.chrome.art)
    for (const list of [theme.chrome.art.cover, theme.chrome.art.content])
      for (const a of list) a.image = resolve(base, a.image);
  if (theme.officeTheme) theme.officeTheme = resolve(base, theme.officeTheme);
  if (theme.template) theme.template = resolve(base, theme.template);
  return theme;
}

let themeCache: Theme[] | undefined;
export function loadThemes(): Theme[] {
  if (themeCache) return themeCache;
  themeCache = readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readThemeFile(join(THEMES_DIR, f)));
  return themeCache;
}

/** Make a theme from outside the library (e.g. a brand theme next to the deck) available by id. */
export function registerTheme(theme: Theme): void {
  const all = loadThemes();
  const i = all.findIndex((t) => t.id === theme.id);
  if (i >= 0) all[i] = theme;
  else all.push(theme);
}

export function getTheme(id: string): Theme | undefined {
  return loadThemes().find((t) => t.id === id);
}

let storyCache: Storyline[] | undefined;
export function loadStorylines(): Storyline[] {
  if (storyCache) return storyCache;
  if (!existsSync(STORYLINES_DIR)) return [];
  storyCache = readdirSync(STORYLINES_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => {
      const raw = YAML.parse(readFileSync(join(STORYLINES_DIR, f), 'utf8'));
      const r = Storyline.safeParse(raw);
      if (!r.success) throw new Error(`Invalid storyline ${f}: ${r.error.message}`);
      return r.data;
    });
  return storyCache;
}

export function getStoryline(id: string): Storyline | undefined {
  return loadStorylines().find((s) => s.id === id);
}

export function zodDiagnostics(err: z.ZodError, prefix = ''): Diagnostic[] {
  return err.issues.map((i) =>
    diag('SC-SPEC-001', i.message, {
      ...(/Unrecognized key/.test(i.message) &&
      /"(theme|storyline|format|footer|output|schemaVersion|language|author)"/.test(i.message)
        ? {
            hint: 'This is a deck-level field — move it to the top of deck.yaml, not inside a slide.',
          }
        : /Unrecognized key/.test(i.message)
          ? {
              hint: 'If this key looks like the end of a sentence, a value containing ", " or ": " inside { … } was split by YAML — quote the value, e.g. { summary: "Two resellers, direct later" }.',
            }
          : {}),
      pointer: `${prefix}/${i.path.map(String).join('/')}`,
      ...(i.code === 'too_big' && 'maximum' in i ? { limit: `max ${String(i.maximum)}` } : {}),
    }),
  );
}

export interface LoadedDeck {
  deck: DeckDoc;
  slides: Slide[];
  path: string;
  baseDir: string;
  diagnostics: Diagnostic[];
  /** Facts and data files the deck read (for the manifest). */
  data?: DataReport;
}

/** Load and validate deck.yaml, expanding `- include: file.yaml` entries. */
export function loadDeck(path: string): LoadedDeck {
  const abs = resolve(path);
  const baseDir = dirname(abs);
  const diagnostics: Diagnostic[] = [];
  const raw = YAML.parse(readFileSync(abs, 'utf8'));
  const top = Deck.safeParse(raw);
  if (!top.success) {
    return {
      deck: raw as DeckDoc,
      slides: [],
      path: abs,
      baseDir,
      diagnostics: zodDiagnostics(top.error),
    };
  }
  const deck = top.data;
  // `theme: ./brand/contoso.json` — a brand theme file next to the deck
  if (/\.json$/i.test(deck.theme)) {
    const p = resolve(baseDir, deck.theme);
    if (!existsSync(p)) {
      diagnostics.push(
        diag('SC-SPEC-002', `Theme file not found: ${deck.theme}`, { pointer: '/theme' }),
      );
    } else {
      try {
        const t = readThemeFile(p);
        registerTheme(t);
        deck.theme = t.id;
      } catch (e) {
        diagnostics.push(
          diag('SC-SPEC-001', String(e instanceof Error ? e.message : e), { pointer: '/theme' }),
        );
      }
    }
  }
  // `format: ./brand/contoso.format.json` — page size and margins from a brand template
  if (/\.json$/i.test(deck.format)) {
    const p = resolve(baseDir, deck.format);
    const r = existsSync(p) ? FormatFile.safeParse(JSON.parse(readFileSync(p, 'utf8'))) : undefined;
    if (!r?.success)
      diagnostics.push(
        diag(
          'SC-SPEC-002',
          r
            ? `Invalid format file ${deck.format}: ${r.error.message}`
            : `Format file not found: ${deck.format}`,
          {
            pointer: '/format',
          },
        ),
      );
    else {
      registerFormat(makeFormat(r.data.id, r.data.w, r.data.h, r.data.margin));
      deck.format = r.data.id;
    }
  } else if (!FORMATS[deck.format])
    diagnostics.push(
      diag(
        'SC-SPEC-001',
        `Unknown format "${deck.format}" — use ${Object.keys(FORMATS).join(', ')} or a format JSON path`,
        {
          pointer: '/format',
        },
      ),
    );
  const expanded: unknown[] = [];
  deck.slides.forEach((s, i) => {
    if (s && typeof s === 'object' && 'include' in (s as object)) {
      const inc = resolve(baseDir, String((s as { include: string }).include));
      if (!existsSync(inc)) {
        diagnostics.push(
          diag('SC-SPEC-004', `Include not found: ${(s as { include: string }).include}`, {
            pointer: `/slides/${i}/include`,
          }),
        );
        return;
      }
      const list = YAML.parse(readFileSync(inc, 'utf8'));
      if (!Array.isArray(list)) {
        diagnostics.push(
          diag('SC-SPEC-004', `Include is not a YAML list: ${(s as { include: string }).include}`, {
            pointer: `/slides/${i}/include`,
          }),
        );
        return;
      }
      expanded.push(...list);
    } else expanded.push(s);
  });

  const slides: Slide[] = [];
  const seen = new Set<string>();
  const sourceIds = new Set(deck.sources.map((s) => s.id));
  // facts and `from:` data ranges, resolved before the slides are validated
  const data = resolveData(deck.facts, expanded, baseDir);
  expanded.splice(0, expanded.length, ...data.slides);
  deck.title = data.text(deck.title);
  if (deck.subtitle) deck.subtitle = data.text(deck.subtitle);
  if (deck.footer) deck.footer = data.text(deck.footer);
  diagnostics.push(...data.diagnostics);

  expanded.forEach((s, i) => {
    const st = (s as { status?: string })?.status;
    const ghost = st === 'ghost' || (st === undefined && deck.status === 'ghost');
    if (ghost) {
      const g = GhostSlide.safeParse(s);
      if (!g.success) {
        diagnostics.push(...zodDiagnostics(g.error, `/slides/${i}`));
        return;
      }
      const def = getLayout(g.data.layout);
      if (g.data.variant && def && !def.variants.includes(g.data.variant)) {
        diagnostics.push(
          diag('SC-SPEC-002', `Unknown variant "${g.data.variant}" for ${def.id}`, {
            pointer: `/slides/${i}/variant`,
          }),
        );
      }
      if (seen.has(g.data.id))
        diagnostics.push(
          diag('SC-SPEC-003', `Duplicate slide id "${g.data.id}"`, {
            pointer: `/slides/${i}/id`,
            slide: g.data.id,
          }),
        );
      seen.add(g.data.id);
      slides.push(g.data as unknown as Slide);
      return;
    }
    const r = Slide.safeParse(s);
    if (!r.success) {
      const layout = (s as { layout?: string })?.layout;
      const issues = zodDiagnostics(r.error, `/slides/${i}`);
      if (layout && !issues.some((d) => d.message.includes('discriminator')))
        diagnostics.push(...issues);
      else
        diagnostics.push(
          diag('SC-SPEC-002', `Unknown or missing layout "${layout ?? ''}"`, {
            pointer: `/slides/${i}/layout`,
          }),
        );
      return;
    }
    const slide = r.data as Slide;
    if (seen.has(slide.id))
      diagnostics.push(
        diag('SC-SPEC-003', `Duplicate slide id "${slide.id}"`, {
          pointer: `/slides/${i}/id`,
          slide: slide.id,
        }),
      );
    seen.add(slide.id);
    for (const ref of slide.sources ?? []) {
      const r = parseSourceRef(ref);
      if (!sourceIds.has(r.id))
        diagnostics.push(
          diag(r.where ? 'SC-SRC-003' : 'SC-SPEC-002', `Unknown source id "${r.id}"`, {
            pointer: `/slides/${i}/sources`,
            slide: slide.id,
          }),
        );
      else {
        // a page past the end of the document (`pages` is recorded by `slidecraft ingest`)
        const pages = deck.sources.find((s) => s.id === r.id)?.pages;
        const last = Number(/^p\d+-(\d+)$/.exec(ref.split('#')[1] ?? '')?.[1] ?? r.page);
        if (pages && last > pages)
          diagnostics.push(
            diag('SC-SRC-003', `"${ref}" cites page ${last}; "${r.id}" has ${pages} pages`, {
              pointer: `/slides/${i}/sources`,
              slide: slide.id,
            }),
          );
      }
    }
    slides.push(slide);
  });
  if (!getTheme(deck.theme))
    diagnostics.push(diag('SC-SPEC-002', `Unknown theme "${deck.theme}"`, { pointer: '/theme' }));
  if (deck.storyline && !getStoryline(deck.storyline)) {
    diagnostics.push(
      diag('SC-SPEC-002', `Unknown storyline "${deck.storyline}"`, {
        pointer: '/storyline',
        severity: 'warning',
      }),
    );
  }
  return {
    deck,
    slides,
    path: abs,
    baseDir,
    diagnostics,
    ...(Object.keys(data.report.facts).length || data.report.files.length
      ? { data: data.report }
      : {}),
  };
}

export function loadBrief(path: string): { brief?: Brief; diagnostics: Diagnostic[] } {
  const raw = YAML.parse(readFileSync(resolve(path), 'utf8'));
  const r = Brief.safeParse(raw);
  if (!r.success) return { diagnostics: zodDiagnostics(r.error) };
  return { brief: r.data, diagnostics: [] };
}
