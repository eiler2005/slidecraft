import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { renderPptx } from '../src/backends/pptxgenjs.ts';
import { textSvg } from '../src/backends/svg.ts';
import { checkDeck } from '../src/build.ts';
import { textWidthPt } from '../src/engine/fonts.ts';
import { layoutText, makeTextNode } from '../src/engine/text.ts';

describe('shared typography contract', () => {
  it('exports exactly horizontal and vertical lines without introducing a slope', async () => {
    const scene = checkDeck('tests/fixtures/chrome/deck.yaml').scene!;
    const slide = scene.slides[0]!;
    slide.nodes = [
      { kind: 'line', x1: 1, y1: 1, x2: 3, y2: 1, stroke: { color: '#000000', width: 1 } },
      { kind: 'line', x1: 1, y1: 1, x2: 1, y2: 3, stroke: { color: '#000000', width: 1 } },
    ];
    scene.slides = [slide];
    const zip = await JSZip.loadAsync(await renderPptx(scene, new Date(0)));
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(xml).toContain('<a:ext cx="1828800" cy="0"/>');
    expect(xml).toContain('<a:ext cx="0" cy="1828800"/>');
  });

  it('measures optional kerning and retains underlining through layout and both exporters', async () => {
    const scene = checkDeck('tests/fixtures/chrome/deck.yaml').scene!;
    const slide = scene.slides[0]!;
    const title = slide.nodes.find((n) => n.kind === 'text')!;
    if (title.kind !== 'text') throw new Error('Expected text fixture');
    const base = {
      ...title.style,
      measure: 'liberation-sans',
      family: 'Arial',
      size: 24,
      lineSpacing: 29,
    };
    expect(textWidthPt(base.measure, 'regular', 24, 'AVATAR', true)).toBeLessThan(
      textWidthPt(base.measure, 'regular', 24, 'AVATAR', false),
    );
    const paragraphs = [{ runs: [{ text: 'AVATAR', underline: true }] }];
    const a = makeTextNode(
      paragraphs,
      { x: 1, y: 1, w: 5, h: 1 },
      { ...base, kerning: true, lineSpacingAuto: true },
      layoutText(paragraphs, { ...base, kerning: true }, 5),
      { role: 'title' },
    );
    const b = makeTextNode(
      paragraphs,
      { x: 1, y: 3, w: 5, h: 1 },
      { ...base, kerning: false, lineSpacingMultiple: 1.2 },
      layoutText(paragraphs, { ...base, kerning: false }, 5),
      { role: 'ppt:comparison' },
    );
    expect(a.lines[0]!.segments[0]!.underline).toBe(true);
    expect(a.lines[0]!.segments[0]!.width).toBeLessThan(b.lines[0]!.segments[0]!.width);
    expect(textSvg(a)).toContain('font-kerning="normal"');
    expect(textSvg(b)).toContain('font-kerning="none"');
    expect(textSvg(a)).toContain('text-decoration="underline"');
    b.textFrame = {
      box: { x: 2, y: 2, w: 4, h: 2 },
      insets: { l: 0.1, r: 0.2, t: 0.03, b: 0.04 },
      valign: 'middle',
    };
    slide.nodes = [a, b];
    scene.slides = [slide];
    const zip = await JSZip.loadAsync(await renderPptx(scene, new Date(0)));
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => m[0]);
    expect(shapes[0]).toContain('kern="100"');
    expect(shapes[0]).toContain('u="sng"');
    expect(shapes[0]).not.toContain('<a:lnSpc>');
    expect(shapes[1]).toContain('kern="400000"');
    expect(shapes[1]).toContain('<a:spcPct val="120000"/>');
    expect(shapes[1]).toContain('lIns="91440"');
    expect(shapes[1]).toContain('rIns="182880"');
    expect(shapes[1]).toContain('tIns="27432"');
    expect(shapes[1]).toContain('bIns="36576"');
  });
});
