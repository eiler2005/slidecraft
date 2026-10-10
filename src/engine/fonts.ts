import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import { FONTS_DIR } from '../paths.ts';
import type { MeasureFont } from '../spec/theme.ts';

export type Face = 'regular' | 'bold' | 'italic' | 'boldItalic';

const FILES: Record<MeasureFont, Record<Face, string>> = {
  'liberation-sans': {
    regular: 'liberation-sans/LiberationSans-Regular.ttf',
    bold: 'liberation-sans/LiberationSans-Bold.ttf',
    italic: 'liberation-sans/LiberationSans-Italic.ttf',
    boldItalic: 'liberation-sans/LiberationSans-BoldItalic.ttf',
  },
  'liberation-serif': {
    regular: 'liberation-serif/LiberationSerif-Regular.ttf',
    bold: 'liberation-serif/LiberationSerif-Bold.ttf',
    italic: 'liberation-serif/LiberationSerif-Italic.ttf',
    boldItalic: 'liberation-serif/LiberationSerif-BoldItalic.ttf',
  },
  gelasio: {
    regular: 'gelasio/Gelasio-Regular.ttf',
    bold: 'gelasio/Gelasio-Bold.ttf',
    italic: 'gelasio/Gelasio-Italic.ttf',
    boldItalic: 'gelasio/Gelasio-BoldItalic.ttf',
  },
};

/** Family names as registered inside the TTF files (used by SVG/HTML renderers). */
export const VECTOR_FAMILY: Record<MeasureFont, string> = {
  'liberation-sans': 'Liberation Sans',
  'liberation-serif': 'Liberation Serif',
  gelasio: 'Gelasio',
};

export function faceOf(bold?: boolean, italic?: boolean): Face {
  if (bold && italic) return 'boldItalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'regular';
}

export function fontPath(font: MeasureFont, face: Face): string {
  return join(FONTS_DIR, FILES[font][face]);
}

export function allFontPaths(): { font: MeasureFont; face: Face; path: string }[] {
  const out: { font: MeasureFont; face: Face; path: string }[] = [];
  for (const font of Object.keys(FILES) as MeasureFont[]) {
    for (const face of Object.keys(FILES[font]) as Face[]) {
      out.push({ font, face, path: fontPath(font, face) });
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

/** Advance width of `text` at 1pt, in points. No kerning, no ligatures (PPTX is written with kern=0). */
export function unitWidth(font: MeasureFont, face: Face, text: string): number {
  const key = `${font}:${face}:${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  const f = load(font, face);
  const run = f.font.layout(text, { kern: false, liga: false, clig: false } as never);
  const w = run.advanceWidth / f.upm;
  widthCache.set(key, w);
  return w;
}

/** Width of text in points at the given size. */
export function textWidthPt(font: MeasureFont, face: Face, size: number, text: string): number {
  return unitWidth(font, face, text) * size;
}

/** Ascent and descent per em (for baseline placement). */
export function vmetrics(font: MeasureFont, face: Face = 'regular'): { asc: number; desc: number } {
  const f = load(font, face);
  return { asc: f.ascent / f.upm, desc: f.descent / f.upm };
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
