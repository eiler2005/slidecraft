import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import YAML from 'yaml';
import type { z } from 'zod';
import { STORYLINES_DIR, THEMES_DIR } from '../paths.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import { Brief } from '../spec/brief.ts';
import { Deck, type DeckDoc, GhostSlide, Slide } from '../spec/deck.ts';
import { getLayout } from '../layouts/index.ts';
import { Storyline } from '../spec/storyline.ts';
import { Theme } from '../spec/theme.ts';

let themeCache: Theme[] | undefined;
export function loadThemes(): Theme[] {
  if (themeCache) return themeCache;
  themeCache = readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(THEMES_DIR, f), 'utf8'));
      const r = Theme.safeParse(raw);
      if (!r.success) throw new Error(`Invalid theme ${f}: ${r.error.message}`);
      return r.data;
    });
  return themeCache;
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
        diagnostics.push(diag('SC-SPEC-002', `Unknown variant "${g.data.variant}" for ${def.id}`, { pointer: `/slides/${i}/variant` }));
      }
      if (seen.has(g.data.id)) diagnostics.push(diag('SC-SPEC-003', `Duplicate slide id "${g.data.id}"`, { pointer: `/slides/${i}/id`, slide: g.data.id }));
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
    for (const sid of slide.sources ?? []) {
      if (!sourceIds.has(sid))
        diagnostics.push(
          diag('SC-SPEC-002', `Unknown source id "${sid}"`, {
            pointer: `/slides/${i}/sources`,
            slide: slide.id,
          }),
        );
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
  return { deck, slides, path: abs, baseDir, diagnostics };
}

export function loadBrief(path: string): { brief?: Brief; diagnostics: Diagnostic[] } {
  const raw = YAML.parse(readFileSync(resolve(path), 'utf8'));
  const r = Brief.safeParse(raw);
  if (!r.success) return { diagnostics: zodDiagnostics(r.error) };
  return { brief: r.data, diagnostics: [] };
}
