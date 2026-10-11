import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { TextNode } from '../src/engine/scene.ts';
import { plainText } from '../src/engine/text.ts';
import { importPptxScene } from '../src/library/pptx-scene-import.ts';

const corpus = resolve('tests/fixtures/digital-ruble/Digital_Ruble_Explainer_RU_v3.pptx');

describe('geometry-preserving PPTX Scene import', () => {
  it('retains the authoritative original layout, chrome, source typography, and notes', async () => {
    const result = await importPptxScene(corpus);
    expect(result.scene.slides).toHaveLength(22);
    expect(result.scene.format.w).toBeCloseTo(13 + 1 / 3);
    expect(result.scene.format.h).toBe(7.5);
    expect(result.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    const slide = result.scene.slides[1]!;
    expect(slide.background).toBe('#F4F7FA');
    expect(slide.nodes[0]).toMatchObject({
      kind: 'rect',
      box: { x: 0, y: 0, w: 0.125, h: 7.5 },
      fill: '#075BCB',
    });
    const texts = slide.nodes.filter((n): n is TextNode => n.kind === 'text');
    const title = texts.find((n) => n.role === 'title')!;
    expect(plainText(title.paragraphs)).toBe(
      'Три формы рубля различаются прежде всего тем, кто вам должен',
    );
    expect(title.style).toMatchObject({
      family: 'Calibri',
      size: 23.25,
      bold: true,
      kerning: true,
      lineSpacingAuto: true,
    });
    expect(title.textFrame?.isTextBox).toBe(false);
    // Default Office insets are .1in horizontally; never assume a zero-margin text box.
    expect(title.box.x).toBeCloseTo(609600 / 914400 + 0.1);
    expect(title.box.w).toBeCloseTo(10344150 / 914400 - 0.2);
    expect(texts.find((n) => plainText(n.paragraphs) === '02')?.style.size).toBe(9.75);
    expect(texts.find((n) => plainText(n.paragraphs) === '02')?.style.kerning).toBe(false);
    expect(
      texts.filter((n) =>
        ['Наличные', 'Банковский депозит', 'Цифровой рубль'].includes(plainText(n.paragraphs)),
      ),
    ).toHaveLength(3);
    const grouped = texts.find((n) => plainText(n.paragraphs).startsWith('Физический платеж'))!;
    expect(grouped.paragraphs).toHaveLength(3);
    expect(grouped.lines).toHaveLength(3);
    expect(grouped.textFrame?.insets).toEqual({ l: 0.1, r: 0.1, t: 0.05, b: 0.05 });
    const rich = result.scene.slides[11]!.nodes.find(
      (n): n is TextNode => n.kind === 'text' && plainText(n.paragraphs).startsWith('Банк А'),
    )!;
    expect(rich.paragraphs).toHaveLength(2);
    expect(rich.textFrame).toBeDefined();
    expect(rich.paragraphs[0]!.runs[0]!.bold).toBe(true);
    expect(rich.paragraphs[1]!.runs[0]!.bold).toBe(false);
    expect(result.shapes.filter((s) => s.slide === 2)).toHaveLength(30);
    expect(result.scene.slides.filter((s) => s.notes)).toHaveLength(22);
    expect(
      result.scene.slides
        .flatMap((s) => s.nodes)
        .some((n) => n.kind === 'html' || n.kind === 'image'),
    ).toBe(false);
    expect(result.diagnostics.filter((d) => d.code !== 'PPTX-FONT-SUBSTITUTION')).toEqual([]);
  });

  it('resolves automatic table row growth and restores the implicit Office grid', async () => {
    const result = await importPptxScene(corpus);
    const slide = result.scene.slides[17]!;
    const table = result.shapes.find((s) => s.slide === 18 && s.type === 'graphicFrame')!;
    const nodes = table.nodes.map((i) => slide.nodes[i]!);
    const cells = nodes.filter((n) => n.kind === 'rect');
    const grid = nodes.filter((n) => n.kind === 'line');
    expect(cells).toHaveLength(18);
    // Office merges six rows by three columns into7horizontal+4vertical strokes.
    expect(grid).toHaveLength(11);
    expect(grid.every((n) => n.stroke.color === '#000000' && n.stroke.width === 1)).toBe(true);
    expect(grid.find((n) => n.y1 === n.y2)?.x1).toBeCloseTo(table.box.x - 0.5 / 72);
    // The two wrapped label rows grow from 46.5pt to 48pt. The final source
    // graphicFrame is 270pt tall although its raw row minima total only267pt.
    expect(cells[3]!.box.h * 72).toBeCloseTo(48);
    expect(cells[9]!.box.h * 72).toBeCloseTo(48);
    const bottom = Math.max(...cells.map((c) => c.box.y + c.box.h));
    expect(bottom - table.box.y).toBeCloseTo(table.box.h);
    const body = nodes.find(
      (n): n is TextNode =>
        n.kind === 'text' && plainText(n.paragraphs) === 'Что получает владелец',
    )!;
    expect(body.style.lineSpacing).toBe(18);
    expect(body.style.kerning).toBe(false);
    expect(body.lines[1]!.baseline - body.lines[0]!.baseline).toBeCloseTo(18 / 72);
    expect(
      slide.nodes
        .filter((n): n is TextNode => n.kind === 'text')
        .flatMap((n) => n.paragraphs.flatMap((p) => p.runs))
        .filter((r) => r.link?.startsWith('https://')),
    ).toHaveLength(2);
    expect(
      slide.nodes
        .filter((n): n is TextNode => n.kind === 'text')
        .flatMap((n) => n.paragraphs.flatMap((p) => p.runs))
        .filter((r) => r.link)
        .every((r) => r.color === '#467886'),
    ).toBe(true);
    expect(
      slide.nodes
        .filter((n): n is TextNode => n.kind === 'text')
        .flatMap((n) => n.paragraphs.flatMap((p) => p.runs))
        .filter((r) => r.link && r.underline),
    ).toHaveLength(2);
  });

  it('lets explicit noFill suppress an outer grid border and expands arbitrary overflowing rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pptx-table-'));
    try {
      const zip = new JSZip();
      zip.file(
        'ppt/presentation.xml',
        '<p:presentation><p:sldIdLst><p:sldId r:id="first"/></p:sldIdLst><p:sldSz cy="6858000" cx="12192000"/></p:presentation>',
      );
      zip.file(
        'ppt/_rels/presentation.xml.rels',
        '<Relationships><Relationship Id="first" Target="slides/slide1.xml"/></Relationships>',
      );
      const cell = (text: string, props = '') =>
        `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800"><a:latin typeface="Arial"/></a:rPr><a:t>${text}</a:t></a:r></a:p></a:txBody><a:tcPr>${props}<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:tcPr></a:tc>`;
      zip.file(
        'ppt/slides/slide1.xml',
        `<p:sld><p:cSld><p:spTree><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="Table"/></p:nvGraphicFramePr><p:xfrm><a:off x="914400" y="914400"/><a:ext cx="3657600" cy="182880"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="1828800"/><a:gridCol w="1828800"/></a:tblGrid><a:tr h="91440">${cell('A long label that wraps across several lines', '<a:lnL><a:noFill/></a:lnL>')}${cell('B')}</a:tr><a:tr h="91440">${cell('C')}${cell('D', '<a:lnB w="25400"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnB>')}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`,
      );
      const file = join(dir, 'table.pptx');
      writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }));
      const imported = await importPptxScene(file, { strict: true });
      const nodes = imported.scene.slides[0]!.nodes;
      const cells = nodes.filter((n) => n.kind === 'rect');
      const lines = nodes.filter((n) => n.kind === 'line');
      expect(cells[0]!.box.h).toBeGreaterThan(0.7);
      expect(cells[2]!.box.y).toBeCloseTo(cells[0]!.box.y + cells[0]!.box.h);
      expect(lines.some((n) => n.x1 === 1 && n.x2 === 1 && n.y1 === 1)).toBe(false);
      expect(lines.find((n) => n.stroke.color === '#FF0000')?.stroke.width).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses relationship order, decodes entities, and reports unsupported objects instead of claiming fidelity', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pptx-scene-'));
    try {
      const zip = new JSZip();
      zip.file(
        'ppt/presentation.xml',
        '<p:presentation><p:sldIdLst><p:sldId r:id="second"/><p:sldId r:id="first"/></p:sldIdLst><p:sldSz cy="6858000" cx="12192000"/></p:presentation>',
      );
      zip.file(
        'ppt/_rels/presentation.xml.rels',
        '<Relationships><Relationship Target="slides/slide1.xml" Id="first"/><Relationship Id="second" Target="slides/slide2.xml"/></Relationships>',
      );
      const slide = (text: string, extra = '') =>
        `<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="title"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="9144000" cy="91440"/></a:xfrm><a:noFill/></p:spPr><p:txBody><a:bodyPr lIns="0" rIns="0" tIns="0" bIns="0"/><a:p><a:pPr><a:lnSpc><a:spcPct val="120000"/></a:lnSpc><a:defRPr sz="2400" kern="2500"><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>${extra}</p:spTree></p:cSld></p:sld>`;
      zip.file('ppt/slides/slide1.xml', slide('First'));
      zip.file(
        'ppt/slides/slide2.xml',
        slide(
          'Second &amp; &#x20BD;',
          '<p:pic><p:nvPicPr><p:cNvPr id="3" name="Unsupported picture"/></p:nvPicPr></p:pic>',
        ),
      );
      const file = join(dir, 'fixture.pptx');
      writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }));
      const imported = await importPptxScene(file);
      expect(imported.scene.slides.map((s) => s.title)).toEqual(['Second & ₽', 'First']);
      expect(imported.scene.slides[0]!.nodes[0]).toMatchObject({
        kind: 'text',
        box: { x: 1, y: 1, w: 10 },
        textFrame: {
          box: { x: 1, y: 1, w: 10, h: 0.1 },
          insets: { l: 0, r: 0, t: 0, b: 0 },
          valign: 'top',
        },
        style: {
          size: 24,
          family: 'Arial',
          lineSpacingAuto: false,
          lineSpacingMultiple: 1.2,
          kerning: false,
        },
      });
      const overflowing = imported.scene.slides[0]!.nodes[0] as TextNode;
      expect(overflowing.contentHeight).toBeGreaterThan(overflowing.textFrame!.box.h);
      expect(imported.diagnostics).toEqual([
        expect.objectContaining({ code: 'PPTX-OBJECT', slide: 1, shape: 'Unsupported picture' }),
      ]);
      await expect(importPptxScene(file, { strict: true })).rejects.toThrow('PPTX-OBJECT');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
