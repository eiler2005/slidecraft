import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { findChrome } from '../src/backends/html.ts';
import { pptFontFace } from '../src/backends/pptxgenjs.ts';
import { buildDeck } from '../src/build.ts';
import { sanitizeCss, sanitizeHtml } from '../src/engine/freeform.ts';

const DECK = join(import.meta.dirname, 'fixtures/freeform/deck.yaml');
const EDITABLE_DEFAULT = join(import.meta.dirname, 'fixtures/freeform/editable-default.yaml');
const EDITABLE_PSEUDO = join(import.meta.dirname, 'fixtures/freeform/editable-pseudo.yaml');
const EDITABLE_AUTHORED = join(import.meta.dirname, 'fixtures/freeform/editable-authored.yaml');
const NATIVE_CANVAS = join(import.meta.dirname, 'fixtures/native-canvas/deck.yaml');

describe('freeform HTML', () => {
  it('reports every unsupported feature instead of silently dropping embedded visuals', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-ff-unsupported-'));
    const r = await buildDeck(
      join(import.meta.dirname, 'fixtures/freeform/unsupported-native.yaml'),
      { outDir: out, formats: ['pptx'] },
    );
    const errors = r.diagnostics.filter((d) => d.code === 'SC-EDIT-002');
    expect(errors.some((d) => d.message.includes('svg') && d.message.includes('gradient'))).toBe(
      true,
    );
    expect(r.files.some((f) => f.kind === 'pptx')).toBe(false);
  });
  it('maps browser-only system font aliases to a valid PowerPoint font', () => {
    expect(pptFontFace('system-ui')).toBe('Arial');
    expect(pptFontFace('System Font')).toBe('System Font');
    expect(pptFontFace('Aptos')).toBe('Aptos');
  });

  it('converts supported freeform HTML into editable native PPTX by default', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-ff-editable-'));
    const r = await buildDeck(EDITABLE_DEFAULT, { outDir: out, formats: ['pptx'] });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const zip = await JSZip.loadAsync(readFileSync(r.files.find((f) => f.kind === 'pptx')!.path));
    const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
    expect(rels).not.toContain('/image');
  });

  it('writes native-canvas as editable PowerPoint text and shapes, not a body PNG', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-native-canvas-'));
    const r = await buildDeck(NATIVE_CANVAS, { outDir: out, formats: ['pptx'] });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const zip = await JSZip.loadAsync(readFileSync(r.files.find((f) => f.kind === 'pptx')!.path));
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(xml).toContain('91%');
    expect(xml).toContain('<p:sp>');
    const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
    expect(rels).not.toContain('/image');
  });

  it('converts CSS pseudo-elements and CSS border triangles into editable primitives', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-ff-pseudo-'));
    const r = await buildDeck(EDITABLE_PSEUDO, { outDir: out, formats: ['pptx'] });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const zip = await JSZip.loadAsync(readFileSync(r.files.find((f) => f.kind === 'pptx')!.path));
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
    expect(xml).toContain('EDITABLE');
    expect(xml).toContain('Браузерная геометрия');
    expect(xml).toContain('prst="ellipse"');
    expect(xml).toContain('<a:custGeom>');
    // The 24px card radius is 0.25in; OOXML adj is radius/min(width,height).
    expect(xml).toContain('fmla="val 13333"');
    expect(rels).not.toContain('/image');
  });

  it('uses a named authored PPT alternative when one is supplied alongside HTML', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-ff-authored-'));
    const r = await buildDeck(EDITABLE_AUTHORED, { outDir: out, formats: ['pptx'] });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const zip = await JSZip.loadAsync(readFileSync(r.files.find((f) => f.kind === 'pptx')!.path));
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
    expect(xml).toContain('Редактируемая подпись');
    expect(xml).not.toContain('This remains the HTML reference');
    expect(xml).toContain('sc:authored/ppt/card-label');
    expect(xml).toContain('fmla="val 11429"');
    expect(xml).not.toContain('typeface="System Font"');
    expect(rels).not.toContain('/image');
  });

  it('strips scripts, handlers, frames and remote URLs; inlines local images', () => {
    const r = sanitizeHtml(
      '<div onclick="x()">a</div><script>alert(1)</script><iframe src="https://x.test"></iframe><img src="https://x.test/a.png"><img src="assets/reconciliation.png"><a href="javascript:alert(1)">b</a>',
      join(import.meta.dirname, '../examples/narrative-story'),
    );
    expect(r.html).not.toMatch(/script|onclick|iframe|https:|javascript:/);
    expect(r.html).toContain('src="data:image/png;base64,');
    expect(r.removed).toEqual(
      expect.arrayContaining([
        'script',
        'event handler',
        'iframe',
        'remote URL',
        'javascript: URL',
      ]),
    );
    expect(
      sanitizeCss('@import url(https://x.test/a.css); .a{background:url(https://x.test/b.png)}')
        .css,
    ).not.toMatch(/https|@import/);
  });

  it.skipIf(!findChrome())(
    'measures overflow and text size, rasterises for PPTX/PNG, keeps live HTML',
    async () => {
      const out = mkdtempSync(join(tmpdir(), 'sc-ff-'));
      const r = await buildDeck(DECK, { outDir: out, formats: ['pptx', 'png', 'html'] });
      const codes = r.diagnostics.map((d) => `${d.code}@${d.slide}`);
      expect(codes).toEqual(
        expect.arrayContaining(['SC-FIT-004@tiny', 'SC-FIT-005@tiny', 'SC-HTML-001@numbers']),
      );
      expect(codes).not.toContain('SC-FIT-004@numbers');
      expect(codes).not.toContain('SC-SRC-001@tiny');
      const zip = await JSZip.loadAsync(readFileSync(r.files.find((f) => f.kind === 'pptx')!.path));
      expect(Object.keys(zip.files).some((n) => /^ppt\/media\/.*\.png$/.test(n))).toBe(true);
      const html = readFileSync(r.files.find((f) => f.kind === 'html')!.path, 'utf8');
      expect(html).toContain('<foreignObject');
      expect(html).toContain('more applications per adviser');
      expect(html).not.toContain('alert(1)');
    },
    120_000,
  );
});
