import {
  ascentRatios,
  type Face,
  faceOf,
  glyphAdvancesPt,
  POWERPOINT_UNITS_PER_INCH,
  textWidthPt,
  vmetrics,
} from './fonts.ts';
import { OFFICE_RULES } from './office-rules.gen.ts';
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

/** Break opportunities shared by layout and glyph placement: spaces, explicit newlines, and
 * after a hyphen between letters ("repeat-driven"), where PowerPoint also wraps. */
const BREAKS = /(\n|[ \t]+)|(?<=\p{L}-)(?=\p{L})/u;

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
    for (const part of r.text.split(BREAKS)) {
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

/** Units per inch that glyph advances snap to, or undefined for raw font units. */
export const advanceGrid = (s: TextStyle) =>
  s.metrics === 'font' ? undefined : POWERPOINT_UNITS_PER_INCH;

/** Font size glyph outlines are drawn at (PowerPoint: whole points, half up). */
export const drawSize = (s: TextStyle) =>
  s.metrics === 'font' || OFFICE_RULES.drawSize === 'nominal' ? s.size : Math.floor(s.size + 0.5);

/** Automatic line pitch in em that PowerPoint uses for a family. */
export const autoPitchEm = (family: string) =>
  OFFICE_RULES.autoSpacing.pitchEm[family] ?? OFFICE_RULES.autoSpacing.pitchEm['*'] ?? 1.2;

/**
 * Line spacing as the multiple PowerPoint receives (1 = automatic), or undefined when it is
 * written as exact points. Generated point spacing becomes a multiple of the same pitch:
 * PowerPoint places multiples deterministically but quantises "Exactly N pt" by up to 1 pt.
 */
export function spacingMultiple(s: TextStyle): number | undefined {
  if (s.lineSpacingAuto) return 1;
  if (s.lineSpacingMultiple !== undefined) return s.lineSpacingMultiple;
  if (s.lineSpacingExact || OFFICE_RULES.exactSpacing.export !== 'percent') return undefined;
  return s.lineSpacing / (autoPitchEm(s.family) * s.size);
}

/** Pen offsets (pt, from the segment start) of every code point, exactly as layout measured
 * them: words and space runs are measured separately, so kerning never crosses a space. */
export function glyphOffsetsPt(s: TextStyle, face: Face, text: string): number[] {
  const out: number[] = [];
  let x = 0;
  for (const part of text.split(BREAKS)) {
    if (!part) continue;
    const measured = /^[ \t]+$/.test(part) ? part.replace(/\t/g, ' ') : part;
    for (const a of glyphAdvancesPt(s.measure, face, s.size, measured, s.kerning, advanceGrid(s))) {
      out.push(x);
      x += a;
    }
  }
  return out;
}

const tokW = (t: Token, s: TextStyle) =>
  pt2in(
    textWidthPt(
      s.measure,
      faceOf(t.bold, t.italic),
      s.size,
      t.space ? t.text.replace(/\t/g, ' ') : t.text,
      s.kerning,
      advanceGrid(s),
    ),
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
  /** Height used for middle/bottom anchoring (OFFICE_RULES.anchorHeight), inches. */
  anchorHeight?: number;
}

/** Break paragraphs into lines for a box width. Positions are relative to the box. */
export function layoutText(
  paragraphs: Paragraph[],
  style: TextStyle,
  width: number,
  bulletIndentPt = 14,
): LaidText {
  const { asc, desc } = vmetrics(style.measure, faceOf(style.bold, style.italic));
  const sizeIn = pt2in(style.size);
  // Line placement follows the calibrated PowerPoint rules (office-rules.gen.ts).
  const office = style.metrics !== 'font';
  const multiple = office ? spacingMultiple(style) : undefined;
  const proportional = multiple !== undefined;
  const { autoSpacing, exactSpacing } = OFFICE_RULES;
  const snapPitch = office && !proportional ? exactSpacing.snapPitchPt : 0;
  const pitchPt = snapPitch
    ? Math.floor(style.lineSpacing / snapPitch + 0.5) * snapPitch
    : style.lineSpacing;
  const ls = pt2in(pitchPt);
  const centered = (ls - sizeIn * (asc + desc)) / 2 + sizeIn * asc;
  const ratios = ascentRatios(style.measure, faceOf(style.bold, style.italic));
  const autoRatio = autoSpacing.ratioByFamily[style.family] ?? ratios[autoSpacing.ratio];
  const baseOffset = !office
    ? centered
    : proportional
      ? multiple <= 1
        ? ls - (1 - autoRatio) * autoPitchEm(style.family) * sizeIn
        : ls * autoSpacing.aboveOneFraction
      : exactSpacing.ratio === 'centered'
        ? centered
        : ls * (exactSpacing.ratioByFamily[style.family] ?? ratios[exactSpacing.ratio]);
  const snap = office ? (proportional ? autoSpacing.snapPt : exactSpacing.snapPt) : 0;
  const baselineAt = (v: number) => (snap ? Math.round((v * 72) / snap + 1e-6) * (snap / 72) : v);
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
        const text = t.text;
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
      const line: Line = { baseline: baselineAt(y + baseOffset), segments };
      if (p.bullet && li === 0) line.bulletX = 0;
      lines.push(line);
      y += ls;
    });
    perPara.push(built.length);
  });

  const last = lines.at(-1);
  const anchorHeight =
    office && OFFICE_RULES.anchorHeight === 'ink' && last
      ? last.baseline + sizeIn * (OFFICE_RULES.descentEmByFamily[style.family] ?? desc)
      : y;
  return {
    lines,
    contentHeight: y,
    maxLineWidth: maxW,
    linesPerParagraph: perPara,
    splitWord,
    anchorHeight,
  };
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
  const h = laid.anchorHeight ?? laid.contentHeight;
  if (style.valign === 'middle') dy = Math.max(0, (box.h - h) / 2);
  if (style.valign === 'bottom') dy = Math.max(0, box.h - h);
  const office = style.metrics !== 'font';
  const whole = (v: number) => Math.round(v * 72) / 72;
  const rounding = office ? OFFICE_RULES.anchorRounding : 'none';
  if (rounding === 'shift') dy = whole(dy);
  const lines = dy
    ? laid.lines.map((l) => ({
        ...l,
        baseline: rounding === 'total' ? whole(l.baseline + dy) : l.baseline + dy,
      }))
    : laid.lines;
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

/**
 * Balanced wrapping for headlines: when the last line is much shorter than the others (a
 * widow such as one word), narrow the box to the smallest width that keeps the same number
 * of lines. The box itself changes, so PowerPoint wraps the exported text the same way.
 */
export function balanceLines(node: TextNode, threshold = 0.6): TextNode {
  if (node.lines.length < 2 || node.style.align !== 'left') return node;
  const width = (l: Line) => l.segments.reduce((w, s) => Math.max(w, s.x + s.width), 0);
  const widths = node.lines.map(width);
  const others = widths.slice(0, -1);
  if (widths.at(-1)! >= threshold * (others.reduce((a, b) => a + b, 0) / others.length))
    return node;
  const count = node.lines.length;
  const lay = (w: number) => layoutText(node.paragraphs, node.style, w, node.bulletIndent);
  let lo = Math.max(...widths) / count;
  let hi = node.box.w;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (lay(mid).lines.length > count) lo = mid;
    else hi = mid;
  }
  // One point of slack keeps the break stable against sub-point measurement noise.
  const w = Math.min(node.box.w, hi + 1 / 72);
  const laid = lay(w);
  if (laid.lines.length !== count) return node;
  const balanced = makeTextNode(node.paragraphs, { ...node.box, w }, node.style, laid, {
    ...(node.role ? { role: node.role } : {}),
    ...(node.pointer ? { pointer: node.pointer } : {}),
    bulletIndent: node.bulletIndent,
  });
  return node.textFrame ? { ...balanced, textFrame: node.textFrame } : balanced;
}

/** Height (inches) the paragraphs need at a fixed style and width. */
export function measureHeight(paragraphs: Paragraph[], style: TextStyle, width: number): number {
  return layoutText(paragraphs, style, width).contentHeight;
}
