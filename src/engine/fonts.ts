import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import { FONTS_DIR } from '../paths.ts';
import type { MeasureFont } from '../spec/theme.ts';
import { OFFICE_RULES } from './office-rules.gen.ts';

export type Face = 'regular' | 'bold' | 'italic' | 'boldItalic';

interface FontEntry {
  /** Family name inside the TTF files (used by SVG / HTML / PNG renderers). */
  vector: string;
  /** Absolute paths per face; missing faces fall back to regular. */
  files: Partial<Record<Face, string>> & { regular: string };
  builtin: boolean;
}

const BUILTIN: Record<string, { vector: string; files: Record<Face, string> }> = {
  'liberation-sans': {
    vector: 'Liberation Sans',
    files: {
      regular: 'liberation-sans/LiberationSans-Regular.ttf',
      bold: 'liberation-sans/LiberationSans-Bold.ttf',
      italic: 'liberation-sans/LiberationSans-Italic.ttf',
      boldItalic: 'liberation-sans/LiberationSans-BoldItalic.ttf',
    },
  },
  'liberation-serif': {
    vector: 'Liberation Serif',
    files: {
      regular: 'liberation-serif/LiberationSerif-Regular.ttf',
      bold: 'liberation-serif/LiberationSerif-Bold.ttf',
      italic: 'liberation-serif/LiberationSerif-Italic.ttf',
      boldItalic: 'liberation-serif/LiberationSerif-BoldItalic.ttf',
    },
  },
  gelasio: {
    vector: 'Gelasio',
    files: {
      regular: 'gelasio/Gelasio-Regular.ttf',
      bold: 'gelasio/Gelasio-Bold.ttf',
      italic: 'gelasio/Gelasio-Italic.ttf',
      boldItalic: 'gelasio/Gelasio-BoldItalic.ttf',
    },
  },
};

/**
 * Measure-font registry: the bundled metric-compatible fonts plus brand fonts that
 * themes register from their own TTF/OTF files (ADR 0005). Every engine reads from here.
 */
const REGISTRY = new Map<string, FontEntry>(
  Object.entries(BUILTIN).map(([id, e]) => [
    id,
    {
      vector: e.vector,
      files: Object.fromEntries(
        Object.entries(e.files).map(([f, rel]) => [f, join(FONTS_DIR, rel)]),
      ) as FontEntry['files'],
      builtin: true,
    },
  ]),
);

/**
 * Installed fonts each bundled family is metric-compatible with, as full/PostScript names
 * per face. Browsers prefer them via CSS local() so HTML shows the glyph shapes PowerPoint
 * draws; the bundled file stays the fallback. Nothing licensed is embedded.
 */
const LOCAL_EQUIVALENTS: Record<string, Record<Face, string[]>> = {
  'liberation-sans': {
    regular: ['Arial', 'ArialMT'],
    bold: ['Arial Bold', 'Arial-BoldMT'],
    italic: ['Arial Italic', 'Arial-ItalicMT'],
    boldItalic: ['Arial Bold Italic', 'Arial-BoldItalicMT'],
  },
  'liberation-serif': {
    regular: ['Times New Roman', 'TimesNewRomanPSMT'],
    bold: ['Times New Roman Bold', 'TimesNewRomanPS-BoldMT'],
    italic: ['Times New Roman Italic', 'TimesNewRomanPS-ItalicMT'],
    boldItalic: ['Times New Roman Bold Italic', 'TimesNewRomanPS-BoldItalicMT'],
  },
  gelasio: {
    regular: ['Georgia'],
    bold: ['Georgia Bold', 'Georgia-Bold'],
    italic: ['Georgia Italic', 'Georgia-Italic'],
    boldItalic: ['Georgia Bold Italic', 'Georgia-BoldItalic'],
  },
};

export function localEquivalents(font: MeasureFont, face: Face): string[] {
  return LOCAL_EQUIVALENTS[font]?.[face] ?? [];
}

export const BUILTIN_MEASURE_FONTS = Object.keys(BUILTIN);
let registryVersion = 0;
export const fontRegistryVersion = () => registryVersion;

/** Register a brand font for measuring and vector rendering. Idempotent per id. */
export function registerMeasureFont(
  id: string,
  files: Partial<Record<Face, string>> & { regular: string },
  vector?: string,
): void {
  const prev = REGISTRY.get(id);
  if (prev && prev.files.regular === files.regular) return;
  let family = vector;
  if (!family) {
    try {
      family = (fontkit.openSync(files.regular) as fontkit.Font).familyName;
    } catch {
      family = id;
    }
  }
  REGISTRY.set(id, { vector: family, files, builtin: false });
  fontCache.clear();
  widthCache.clear();
  advanceCache.clear();
  registryVersion++;
}

export function isMeasureFont(id: string): boolean {
  return REGISTRY.has(id);
}

export function measureFontIds(): string[] {
  return [...REGISTRY.keys()];
}

function entry(id: string): FontEntry {
  const e = REGISTRY.get(id);
  if (!e)
    throw new Error(
      `Unknown measure font "${id}" — use ${BUILTIN_MEASURE_FONTS.join(', ')} or give the theme font files`,
    );
  return e;
}

/** Family name inside the font files (SVG/HTML/PNG). */
export function vectorFamily(id: MeasureFont): string {
  return entry(id).vector;
}

/** @deprecated use vectorFamily(); kept for callers that index by id. */
export const VECTOR_FAMILY: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, k: string) => entry(k).vector,
  ownKeys: () => [...REGISTRY.keys()],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

export function faceOf(bold?: boolean, italic?: boolean): Face {
  if (bold && italic) return 'boldItalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'regular';
}

export function fontPath(font: MeasureFont, face: Face): string {
  const e = entry(font);
  return e.files[face] ?? e.files.regular;
}

export function allFontPaths(): { font: MeasureFont; face: Face; path: string }[] {
  const out: { font: MeasureFont; face: Face; path: string }[] = [];
  for (const [font, e] of REGISTRY) {
    for (const face of ['regular', 'bold', 'italic', 'boldItalic'] as Face[]) {
      if (e.files[face] || face === 'regular') out.push({ font, face, path: fontPath(font, face) });
    }
  }
  return out;
}

const bufCache = new Map<string, Buffer>();
export function fontBuffer(font: MeasureFont, face: Face): Buffer {
  const p = fontPath(font, face);
  let b = bufCache.get(p);
  if (!b) {
    b = readFileSync(p);
    bufCache.set(p, b);
  }
  return b;
}

interface Loaded {
  font: fontkit.Font;
  upm: number;
  ascent: number;
  descent: number;
}

const fontCache = new Map<string, Loaded>();
function load(font: MeasureFont, face: Face): Loaded {
  const key = `${font}:${face}`;
  let f = fontCache.get(key);
  if (!f) {
    const fk = fontkit.create(fontBuffer(font, face)) as fontkit.Font;
    f = { font: fk, upm: fk.unitsPerEm, ascent: fk.ascent, descent: Math.abs(fk.descent) };
    fontCache.set(key, f);
  }
  return f;
}

const widthCache = new Map<string, number>();

/** Advance width of `text` at 1pt, in points. Ligatures are off; kerning is explicit. */
export function unitWidth(font: MeasureFont, face: Face, text: string, kerning = false): number {
  const key = `${font}:${face}:${kerning}:${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  const f = load(font, face);
  const run = f.font.layout(text, { kern: kerning, liga: false, clig: false } as never);
  const w = run.advanceWidth / f.upm;
  widthCache.set(key, w);
  return w;
}

/** PowerPoint lays text out in master units (1/576 inch); calibrated in office-rules.gen.ts. */
export const POWERPOINT_UNITS_PER_INCH = OFFICE_RULES.advance.unitsPerInch;

const advanceCache = new Map<string, number[]>();

/**
 * Pen advance of every code point, in points. With `grid` (units per inch) each glyph
 * advance snaps to that grid; pair kerning follows OFFICE_RULES.advance.snapKerning.
 */
export function glyphAdvancesPt(
  font: MeasureFont,
  face: Face,
  size: number,
  text: string,
  kerning = false,
  grid?: number,
): number[] {
  const key = `${font}:${face}:${size}:${kerning}:${grid ?? 0}:${text}`;
  const hit = advanceCache.get(key);
  if (hit) return hit;
  const f = load(font, face);
  const opts = { liga: false, clig: false } as const;
  const plain = f.font.layout(text, { ...opts, kern: false } as never);
  const run = kerning ? f.font.layout(text, { ...opts, kern: true } as never) : plain;
  const chars = [...text];
  const scale = size / f.upm;
  const snap = (pt: number) => (grid ? Math.round((pt * grid) / 72) * (72 / grid) : pt);
  let out: number[];
  if (plain.positions.length === chars.length && run.positions.length === chars.length) {
    out = plain.positions.map((p, i) => {
      const base = p.xAdvance * scale;
      const kern = run.positions[i]!.xAdvance * scale - base;
      return snap(base) + (OFFICE_RULES.advance.snapKerning ? snap(kern) : kern);
    });
  } else {
    // Clusters that do not map 1:1 to code points keep their total on the first one.
    const total = snap(run.advanceWidth * scale);
    out = chars.map((_, i) => (i === 0 ? total : 0));
  }
  advanceCache.set(key, out);
  return out;
}

/** Width of text in points at the given size. */
export function textWidthPt(
  font: MeasureFont,
  face: Face,
  size: number,
  text: string,
  kerning = false,
  grid?: number,
): number {
  if (grid)
    return glyphAdvancesPt(font, face, size, text, kerning, grid).reduce((a, b) => a + b, 0);
  return unitWidth(font, face, text, kerning) * size;
}

/** Ascent and descent per em (for baseline placement). */
export function vmetrics(font: MeasureFont, face: Face = 'regular'): { asc: number; desc: number } {
  const f = load(font, face);
  return { asc: f.ascent / f.upm, desc: f.descent / f.upm };
}

/** Ascent share of the line box: 'hhea' (ascender ÷ ascender+descender of the hhea table,
 * what PowerPoint uses for automatic spacing) and 'typo' (OS/2 typo metrics, exact spacing). */
export function ascentRatios(
  font: MeasureFont,
  face: Face = 'regular',
): { hhea: number; typo: number } {
  const f = load(font, face).font as fontkit.Font & {
    hhea: { ascent: number; descent: number };
    'OS/2'?: { typoAscender: number; typoDescender: number };
  };
  const hhea = f.hhea.ascent / (f.hhea.ascent - f.hhea.descent);
  const os2 = f['OS/2'];
  const typo =
    os2 && os2.typoAscender > 0 ? os2.typoAscender / (os2.typoAscender - os2.typoDescender) : hhea;
  return { hhea, typo };
}

export function hasGlyphs(font: MeasureFont, text: string): boolean {
  const f = load(font, 'regular');
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x20) continue;
    if (!f.font.hasGlyphForCodePoint(cp)) return false;
  }
  return true;
}

export function missingGlyphs(font: MeasureFont, text: string): string[] {
  const f = load(font, 'regular');
  const miss = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x20) continue;
    if (!f.font.hasGlyphForCodePoint(cp)) miss.add(ch);
  }
  return [...miss];
}
