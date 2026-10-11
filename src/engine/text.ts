import { faceOf, textWidthPt, vmetrics } from './fonts.ts';
import {
  type Box,
  type Line,
  type LineSegment,
  type Paragraph,
  pt2in,
  type Run,
  type TextNode,
  type TextStyle,
} from './scene.ts';

/**
 * Inline markup used in deck text: **bold** and *italic*. Everything else is literal.
 * Kept deliberately tiny so authors and agents cannot produce surprising formatting.
 */
export function parseInline(src: string, base: Partial<Run> = {}): Run[] {
  const runs: Run[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index! > last) runs.push({ ...base, text: src.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) runs.push({ ...base, text: tok.slice(2, -2), bold: true });
    else runs.push({ ...base, text: tok.slice(1, -1), italic: true });
    last = m.index! + tok.length;
  }
  if (last < src.length) runs.push({ ...base, text: src.slice(last) });
  return runs.filter((r) => r.text.length > 0);
}

export function para(
  text: string,
  opts: Partial<Paragraph> & { base?: Partial<Run> } = {},
): Paragraph {
  const { base, ...rest } = opts;
  return { runs: parseInline(text, base), ...rest };
}

export function plainText(paragraphs: Paragraph[]): string {
  return paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
}

interface Token {
  text: string;
  space: boolean;
  newline: boolean;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
  color: string;
  link?: string;
}

function tokenize(p: Paragraph, style: TextStyle): Token[] {
  const out: Token[] = [];
  for (const r of p.runs) {
    const bold = r.bold ?? style.bold ?? false;
    const italic = r.italic ?? style.italic ?? false;
    const color = r.color ?? style.color;
    const link = {
      ...(r.link ? { link: r.link } : {}),
      ...(r.underline !== undefined ? { underline: r.underline } : {}),
    };
    for (const part of r.text.split(/(\n|[ \t]+)/)) {
      if (!part) continue;
      if (part === '\n')
        out.push({ text: '', space: false, newline: true, bold, italic, color, ...link });
      else
        out.push({
          text: part,
          space: /^[ \t]+$/.test(part),
          newline: false,
          bold,
          italic,
          color,
          ...link,
        });
    }
  }
  return out;
}

const tokW = (t: Token, s: TextStyle) =>
  pt2in(
    textWidthPt(s.measure, faceOf(t.bold, t.italic), s.size, t.space ? ' ' : t.text, s.kerning),
  );

export interface LaidText {
  lines: Line[];
  contentHeight: number;
  /** Widest line, inches. */
  maxLineWidth: number;
  /** Number of lines per paragraph. */
  linesPerParagraph: number[];
  /** True when some single word is wider than the available width and had to be split. */
  splitWord: boolean;
}

/** Break paragraphs into lines for a box width. Positions are relative to the box. */
export function layoutText(
  paragraphs: Paragraph[],
  style: TextStyle,
  width: number,
  bulletIndentPt = 14,
): LaidText {
  const ls = pt2in(style.lineSpacing);
  const { asc, desc } = vmetrics(style.measure, faceOf(style.bold, style.italic));
  const sizeIn = pt2in(style.size);
  // Baseline inside an exact-spacing line: center the font's ascent+descent box.
  const baseOffset = (ls - sizeIn * (asc + desc)) / 2 + sizeIn * asc;
  const lines: Line[] = [];
  const perPara: number[] = [];
  let y = 0;
  let maxW = 0;
  let splitWord = false;

  paragraphs.forEach((p, pi) => {
    if (pi > 0 && p.spaceBefore) y += pt2in(p.spaceBefore);
    const indent = p.bullet ? pt2in(bulletIndentPt) : 0;
    const avail = Math.max(0.1, width - indent);
    const tokens = tokenize(p, style);
    type Cur = { toks: { t: Token; w: number }[]; w: number };
    const built: Cur[] = [];
    let cur: Cur = { toks: [], w: 0 };
    const push = () => {
      // trim trailing spaces
      while (cur.toks.length && cur.toks[cur.toks.length - 1]!.t.space) {
        cur.w -= cur.toks.pop()!.w;
      }
      built.push(cur);
      cur = { toks: [], w: 0 };
    };
    for (const t of tokens) {
      if (t.newline) {
        push();
        continue;
      }
      if (t.space && cur.toks.length === 0) continue;
      const w = tokW(t, style);
      if (cur.w + w <= avail + 1e-6 || t.space) {
        cur.toks.push({ t, w });
        cur.w += w;
        continue;
      }
      if (cur.toks.length > 0) push();
      if (w <= avail) {
        cur.toks.push({ t, w });
        cur.w += w;
        continue;
      }
      // Hard-split a word longer than the line.
      splitWord = true;
      let chunk = '';
      for (const ch of t.text) {
        const test = chunk + ch;
        const tw = tokW({ ...t, text: test }, style);
        if (tw > avail && chunk) {
          cur.toks.push({ t: { ...t, text: chunk }, w: tokW({ ...t, text: chunk }, style) });
          cur.w = cur.toks.reduce((a, b) => a + b.w, 0);
          push();
          chunk = ch;
        } else chunk = test;
      }
      if (chunk) {
        const tw = tokW({ ...t, text: chunk }, style);
        cur.toks.push({ t: { ...t, text: chunk }, w: tw });
        cur.w += tw;
      }
    }
    if (cur.toks.length || built.length === 0) push();

    built.forEach((ln, li) => {
      const lineW = ln.w;
      maxW = Math.max(maxW, lineW + indent);
      let x0 = indent;
      if (style.align === 'center') x0 = indent + (avail - lineW) / 2;
      if (style.align === 'right') x0 = indent + (avail - lineW);
      const segments: LineSegment[] = [];
      let x = x0;
      for (const { t, w } of ln.toks) {
        const prev = segments[segments.length - 1];
        const text = t.space ? ' ' : t.text;
        if (
          prev &&
          prev.bold === t.bold &&
          prev.italic === t.italic &&
          prev.underline === t.underline &&
          prev.color === t.color &&
          prev.link === t.link
        ) {
          prev.text += text;
          prev.width += w;
        } else {
          const seg: LineSegment = {
            text,
            x,
            width: w,
            bold: t.bold,
            italic: t.italic,
            color: t.color,
          };
          if (t.link) seg.link = t.link;
          if (t.underline !== undefined) seg.underline = t.underline;
          segments.push(seg);
        }
        x += w;
      }
      const line: Line = { baseline: y + baseOffset, segments };
      if (p.bullet && li === 0) line.bulletX = 0;
      lines.push(line);
      y += ls;
    });
    perPara.push(built.length);
  });

  return { lines, contentHeight: y, maxLineWidth: maxW, linesPerParagraph: perPara, splitWord };
}

export interface FitResult {
  node: TextNode;
  fits: boolean;
  /** Overflow beyond the box height, inches (0 when it fits). */
  overflow: number;
  size: number;
  lines: number;
  maxLines: number;
}

/**
 * Lay out text into a box, stepping the size down through `sizes` until it fits.
 * Never truncates: when nothing fits the smallest attempt is returned with `fits: false`.
 */
export function fitText(
  paragraphs: Paragraph[],
  box: Box,
  style: Omit<TextStyle, 'size' | 'lineSpacing'> & { size?: number },
  sizes: number[],
  lineHeight: number,
  extra: { role?: string; pointer?: string; bulletIndent?: number; maxLines?: number } = {},
): FitResult {
  const tries = sizes.length ? sizes : [style.size ?? 14];
  let result: FitResult | undefined;
  for (const size of tries) {
    const s: TextStyle = {
      ...style,
      size,
      lineSpacing: +(size * lineHeight).toFixed(2),
    } as TextStyle;
    const laid = layoutText(paragraphs, s, box.w, extra.bulletIndent ?? 14);
    const lineCount = laid.lines.length;
    const maxLines = Math.max(1, Math.floor((box.h + 1e-6) / pt2in(s.lineSpacing)));
    const tooMany = extra.maxLines !== undefined && lineCount > extra.maxLines;
    const overflow = Math.max(0, laid.contentHeight - box.h);
    const fits = overflow <= 1e-3 && !tooMany && !laid.splitWord;
    const node = makeTextNode(paragraphs, box, s, laid, extra);
    result = {
      node,
      fits,
      overflow,
      size,
      lines: lineCount,
      maxLines: Math.min(extra.maxLines ?? maxLines, maxLines),
    };
    if (fits) return result;
  }
  return result!;
}

export function makeTextNode(
  paragraphs: Paragraph[],
  box: Box,
  style: TextStyle,
  laid: LaidText,
  extra: { role?: string; pointer?: string; bulletIndent?: number } = {},
): TextNode {
  let dy = 0;
  if (style.valign === 'middle') dy = Math.max(0, (box.h - laid.contentHeight) / 2);
  if (style.valign === 'bottom') dy = Math.max(0, box.h - laid.contentHeight);
  const lines = dy ? laid.lines.map((l) => ({ ...l, baseline: l.baseline + dy })) : laid.lines;
  const node: TextNode = {
    kind: 'text',
    box,
    style,
    paragraphs,
    lines,
    contentHeight: laid.contentHeight,
    bulletIndent: extra.bulletIndent ?? 14,
  };
  if (extra.role) node.role = extra.role;
  if (extra.pointer) node.pointer = extra.pointer;
  return node;
}

/** Height (inches) the paragraphs need at a fixed style and width. */
export function measureHeight(paragraphs: Paragraph[], style: TextStyle, width: number): number {
  return layoutText(paragraphs, style, width).contentHeight;
}
