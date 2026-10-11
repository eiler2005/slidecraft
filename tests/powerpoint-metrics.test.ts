import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { fontFaceCss } from '../src/backends/html.ts';
import { crispAxisLines, endMarkLikeLastRun, renderPptx } from '../src/backends/pptxgenjs.ts';
import { textSvg } from '../src/backends/svg.ts';
import { checkDeck } from '../src/build.ts';
import { glyphAdvancesPt, POWERPOINT_UNITS_PER_INCH, textWidthPt } from '../src/engine/fonts.ts';
import { OFFICE_RULES } from '../src/engine/office-rules.gen.ts';
import type { TextStyle } from '../src/engine/scene.ts';
import { findFontFiles } from '../src/engine/system-fonts.ts';
import {
  balanceLines,
  drawSize,
  glyphOffsetsPt,
  layoutText,
  makeTextNode,
  spacingMultiple,
} from '../src/engine/text.ts';
import { FONTS_DIR } from '../src/paths.ts';

const style = (over: Partial<TextStyle> = {}): TextStyle => ({
  family: 'Arial',
  measure: 'liberation-sans',
  size: 15,
  lineSpacing: 18,
  color: '#000000',
  align: 'left',
  valign: 'top',
  ...over,
});
const unit = 72 / POWERPOINT_UNITS_PER_INCH;

describe('PowerPoint text metrics (shared by every engine)', () => {
  it('snaps each glyph advance to master units while pair kerning stays exact', () => {
    const plain = glyphAdvancesPt('liberation-sans', 'regular', 13.5, 'Office', false, 576);
    for (const a of plain) expect(Math.abs(a / unit - Math.round(a / unit))).toBeLessThan(1e-9);
    const raw = glyphAdvancesPt('liberation-sans', 'regular', 13.5, 'AVATAR', true);
    const snapped = glyphAdvancesPt('liberation-sans', 'regular', 13.5, 'AVATAR', true, 576);
    const kernFree = glyphAdvancesPt('liberation-sans', 'regular', 13.5, 'AVATAR', false);
    // Kerned glyphs differ from the grid by exactly their (unsnapped) kerning adjustment.
    snapped.forEach((a, i) => {
      const k = raw[i]! - kernFree[i]!;
      expect(a - k).toBeCloseTo(Math.round(kernFree[i]! / unit) * unit, 9);
    });
    expect(textWidthPt('liberation-sans', 'regular', 13.5, 'AVATAR', true, 576)).toBeCloseTo(
      snapped.reduce((s, a) => s + a, 0),
      9,
    );
  });

  it('measures and keeps runs of spaces instead of collapsing them', () => {
    const s = style();
    const one = layoutText([{ runs: [{ text: 'A B' }] }], s, 10).lines[0]!;
    const three = layoutText([{ runs: [{ text: 'A   B' }] }], s, 10).lines[0]!;
    expect(three.segments.map((x) => x.text).join('')).toBe('A   B');
    const width = (l: typeof one) => l.segments.reduce((w, x) => w + x.width, 0);
    const space = textWidthPt('liberation-sans', 'regular', 15, ' ', false, 576) / 72;
    expect(width(three) - width(one)).toBeCloseTo(2 * space, 9);
  });

  it('places automatic-spacing baselines on whole points in the ascent:descent ratio', () => {
    const s = style({ size: 12.75, lineSpacing: 15.3, lineSpacingAuto: true });
    const laid = layoutText([{ runs: [{ text: 'one two three four five six' }] }], s, 0.9);
    expect(laid.lines.length).toBeGreaterThan(2);
    for (const l of laid.lines) expect(l.baseline * 72).toBeCloseTo(Math.round(l.baseline * 72), 9);
    // Raw font units keep the previous continuous placement.
    const raw = layoutText([{ runs: [{ text: 'one' }] }], { ...s, metrics: 'font' }, 3);
    expect((raw.lines[0]!.baseline * 72) % 1).not.toBeCloseTo(0, 3);
  });

  it('draws glyphs at whole points while advances follow the nominal size', () => {
    expect([12.75, 13.5, 23.25, 9.75, 16.5].map((size) => drawSize(style({ size })))).toEqual([
      13, 14, 23, 10, 17,
    ]);
    expect(drawSize(style({ size: 23.25, metrics: 'font' }))).toBe(23.25);
  });

  it('positions every glyph in SVG/HTML exactly where layout measured it', () => {
    const s = style({ size: 13.5 });
    const node = makeTextNode(
      [{ runs: [{ text: 'Wave  AV' }] }],
      { x: 1, y: 1, w: 4, h: 1 },
      s,
      layoutText([{ runs: [{ text: 'Wave  AV' }] }], s, 4),
    );
    const svg = textSvg(node);
    const xs = /<text x="([^"]+)"/.exec(svg)![1]!.split(' ').map(Number);
    const offsets = glyphOffsetsPt(s, 'regular', 'Wave  AV');
    expect(xs).toHaveLength(8);
    xs.forEach((x, i) => expect(x).toBeCloseTo(+((1 + offsets[i]! / 72) * 96).toFixed(2), 2));
    expect(svg).toContain('font-size="18.67"');
    expect(svg).toContain('white-space:pre');
  });
});

describe('PPTX export details PowerPoint takes into account', () => {
  it('gives the paragraph mark the last run properties, without its hyperlink', () => {
    const xml =
      '<a:p><a:r><a:rPr sz="1650" b="1"><a:latin typeface="Calibri"/><a:hlinkClick r:id="rId2"/></a:rPr><a:t>x</a:t></a:r><a:endParaRPr sz="1650"/></a:p><a:p><a:endParaRPr sz="900"/></a:p>';
    expect(endMarkLikeLastRun(xml)).toBe(
      '<a:p><a:r><a:rPr sz="1650" b="1"><a:latin typeface="Calibri"/><a:hlinkClick r:id="rId2"/></a:rPr><a:t>x</a:t></a:r><a:endParaRPr sz="1650" b="1"><a:latin typeface="Calibri"/></a:endParaRPr></a:p><a:p><a:endParaRPr sz="900"/></a:p>',
    );
  });

  it('turns axis-aligned preset lines into one-segment freeforms, keeping slopes and arrows', () => {
    const line = (cx: number, cy: number, extra = '') =>
      `<p:sp><p:spPr><a:xfrm><a:off x="1" y="2"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="12700">${extra}</a:ln></p:spPr></p:sp>`;
    const out = crispAxisLines(
      line(500, 0) + line(0, 300) + line(500, 40) + line(500, 0, '<a:tailEnd type="triangle"/>'),
    );
    expect(out.match(/<a:custGeom>/g)).toHaveLength(2);
    expect(out).toContain(
      '<a:path w="500" h="0" fill="none"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="500" y="0"/>',
    );
    expect(out.match(/prst="line"/g)).toHaveLength(2);
  });

  it('writes those rules into an actual exported deck', async () => {
    const scene = checkDeck('tests/fixtures/chrome/deck.yaml').scene!;
    const zip = await JSZip.loadAsync(await renderPptx(scene, new Date(0)));
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    for (const p of xml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []) {
      const face = /<a:rPr\b[^>]*>[\s\S]*?<a:latin typeface="([^"]+)"/.exec(p)?.[1];
      if (face && p.includes('<a:endParaRPr'))
        expect(p).toMatch(new RegExp(`<a:endParaRPr\\b[^>]*>[\\s\\S]*?typeface="${face}"`));
    }
    expect(xml).not.toMatch(/<a:ext cx="\d+" cy="0"\/><\/a:xfrm><a:prstGeom prst="line">/);
  });
});

describe('fonts resolve like Office and HTML prefers the installed originals', () => {
  it('finds every face of a family by its internal names, first folder wins', () => {
    const a = mkdtempSync(join(tmpdir(), 'sc-fonts-a-'));
    const b = mkdtempSync(join(tmpdir(), 'sc-fonts-b-'));
    try {
      for (const f of ['Regular', 'Bold', 'Italic', 'BoldItalic'])
        copyFileSync(
          join(FONTS_DIR, 'liberation-sans', `LiberationSans-${f}.ttf`),
          join(b, `x-${f}.ttf`),
        );
      copyFileSync(
        join(FONTS_DIR, 'liberation-sans', 'LiberationSans-Regular.ttf'),
        join(a, 'r.ttf'),
      );
      const first = findFontFiles('Liberation Sans', [a, b])!;
      expect(first.regular).toBe(join(a, 'r.ttf'));
      expect(first.bold).toBeUndefined();
      const full = findFontFiles('liberation sans', [b])!;
      expect(Object.keys(full).sort()).toEqual(['bold', 'boldItalic', 'italic', 'regular']);
      expect(findFontFiles('No Such Family', [a, b])).toBeUndefined();
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });

  it('lets browsers use metric-compatible originals before the bundled fallback', () => {
    const css = fontFaceCss('Liberation Sans');
    expect(css).toMatch(
      /font-weight:bold;font-style:normal;[^}]*src:local\("Arial Bold"\),local\("Arial-BoldMT"\),url\(data:font\/ttf/,
    );
    expect(css).toMatch(
      /font-weight:normal;font-style:normal;[^}]*src:local\("Arial"\),local\("ArialMT"\),url\(/,
    );
  });
});

describe('line breaking and spacing PowerPoint reproduces', () => {
  const s = (over: Partial<TextStyle> = {}): TextStyle => ({
    family: 'Arial',
    measure: 'liberation-sans',
    size: 20,
    lineSpacing: 24,
    bold: true,
    color: '#000000',
    align: 'left',
    valign: 'top',
    ...over,
  });
  const text = (l: { segments: { text: string }[] }) => l.segments.map((x) => x.text).join('');

  it('breaks after a hyphen between letters, never between digits', () => {
    const lines = layoutText(
      [{ runs: [{ text: 'Growth is organic and repeat-driven' }] }],
      s(),
      4.2,
    ).lines;
    expect(lines.map(text)).toEqual(['Growth is organic and repeat-', 'driven']);
    const years = layoutText([{ runs: [{ text: 'Plan 2026-27 now' }] }], s(), 1.4).lines.map(text);
    expect(years.some((l) => l.endsWith('2026-'))).toBe(false);
  });

  it('balances headlines that would end on a widow, keeping the line count', () => {
    const style = s({ size: 28, lineSpacing: 31 });
    const paragraphs = [
      {
        runs: [
          { text: 'Regional part-load freight is a €14B market in our first three countries' },
        ],
      },
    ];
    const node = makeTextNode(
      paragraphs,
      { x: 0, y: 0, w: 11.3, h: 1.2 },
      style,
      layoutText(paragraphs, style, 11.3),
    );
    expect(text(node.lines.at(-1)!)).toBe('countries');
    const balanced = balanceLines(node);
    expect(balanced.lines).toHaveLength(node.lines.length);
    expect(balanced.box.w).toBeLessThan(node.box.w);
    expect(text(balanced.lines.at(-1)!).split(' ').length).toBeGreaterThan(2);
    expect(balanceLines(balanced)).toBe(balanced);
  });

  it('writes generated point spacing as the equivalent multiple, keeps authored points', () => {
    expect(spacingMultiple(s({ size: 20, lineSpacing: 26.4 }))).toBeCloseTo(26.4 / (1.2 * 20), 9);
    expect(spacingMultiple(s({ lineSpacingExact: true }))).toBeUndefined();
    expect(spacingMultiple(s({ lineSpacingAuto: true }))).toBe(1);
    expect(spacingMultiple(s({ lineSpacingMultiple: 0.9 }))).toBe(0.9);
  });

  it('places multiple-spaced baselines on whole points by the calibrated rule', () => {
    const style = s({ size: 18, lineSpacing: 18 * 1.2 * 1.1, bold: false });
    const laid = layoutText([{ runs: [{ text: 'one\ntwo\nthree' }] }], style, 5);
    const pitch = style.lineSpacing;
    laid.lines.forEach((l, i) =>
      expect(l.baseline * 72).toBeCloseTo(
        Math.round(i * pitch + pitch * OFFICE_RULES.autoSpacing.aboveOneFraction),
        6,
      ),
    );
  });
});

describe('line direction in PPTX', () => {
  it('flips preset lines so the arrowhead ends where the Scene line ends', async () => {
    const scene = checkDeck('tests/fixtures/chrome/deck.yaml').scene!;
    const slide = scene.slides[0]!;
    const stroke = { color: '#000000', width: 1 };
    slide.nodes = [
      { kind: 'line', x1: 1, y1: 3, x2: 1, y2: 1, stroke, arrowEnd: true, role: 'up' },
      { kind: 'line', x1: 3, y1: 1, x2: 1, y2: 1, stroke, arrowEnd: true, role: 'left' },
      { kind: 'line', x1: 1, y1: 1, x2: 3, y2: 2, stroke, arrowEnd: true, role: 'down-right' },
      { kind: 'line', x1: 3, y1: 1, x2: 1, y2: 2, stroke, arrowEnd: true, role: 'down-left' },
    ];
    scene.slides = [slide];
    const zip = await JSZip.loadAsync(await renderPptx(scene, new Date(0)));
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const xfrms = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
      .map((m) => m[0])
      .filter((sp) => sp.includes('tailEnd'))
      .map((sp) => /<a:xfrm([^>]*)>/.exec(sp)![1]!);
    expect(xfrms).toHaveLength(4);
    expect(xfrms[0]).toMatch(/flipV="1"/);
    expect(xfrms[0]).not.toMatch(/flipH/);
    expect(xfrms[1]).toMatch(/flipH="1"/);
    expect(xfrms[1]).not.toMatch(/flipV/);
    expect(xfrms[2]).not.toMatch(/flip/);
    expect(xfrms[3]).toMatch(/flipH="1"/);
    expect(xfrms[3]).not.toMatch(/flipV/);
  });
});
