import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildHtml } from '../src/backends/html.ts';
import { buildDeck, checkDeck } from '../src/build.ts';
import { exhibitRoutes } from '../src/library/exhibits.ts';
import { checkChrome } from '../src/qa/chrome.ts';
import { verifyHtml } from '../src/qa/html-verify.ts';
import { verifyPptx } from '../src/qa/pptx-verify.ts';

const fixture = join(import.meta.dirname, 'fixtures/chrome/deck.yaml');
describe('shared semantic exhibits and design chrome', () => {
  it('verifies chrome in serialized HTML and catches a dropped frame node', () => {
    const scene = checkDeck(fixture).scene!;
    const html = buildHtml(scene);
    expect(verifyHtml(html, scene)).toEqual([]);
    const broken = html.replace('data-sc-role="chrome-side-rail"', 'data-sc-role="lost"');
    expect(
      verifyHtml(broken, scene).some(
        (d) => d.code === 'SC-HTML-002' && d.message.includes('side-rail'),
      ),
    ).toBe(true);
  });
  it('rejects missing chrome independently of the composer and keeps a canvas frame by default', () => {
    const r = checkDeck(fixture);
    const scene = structuredClone(r.scene!);
    scene.slides[0]!.nodes = scene.slides[0]!.nodes.filter((n) => n.role !== 'chrome-page-number');
    expect(
      checkChrome(scene).some(
        (d) => d.code === 'SC-CHROME-001' && d.message.includes('page-number'),
      ),
    ).toBe(true);
    scene.slides[0]!.nodes.push(scene.slides[0]!.nodes.find((n) => n.role === 'title')!);
    expect(checkChrome(scene).some((d) => d.message.includes('title'))).toBe(true);
  });
  it('detects a surviving title whose geometry or font size was corrupted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-chrome-size-'));
    const r = await buildDeck(fixture, { formats: ['pptx'], outDir: dir, pptxEngine: 'pptxgenjs' });
    const zip = await JSZip.loadAsync(readFileSync(r.files[0]!.path));
    const part = 'ppt/slides/slide1.xml';
    const xml = await zip.file(part)!.async('string');
    zip.file(
      part,
      xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (shape) =>
        shape.includes('SlideCraft Title')
          ? shape.replace(/sz="\d+"/g, 'sz="600"').replace(/cx="\d+"/, 'cx="914400"')
          : shape,
      ),
    );
    const broken = join(dir, 'broken.pptx');
    writeFileSync(broken, await zip.generateAsync({ type: 'nodebuffer' }));
    const checked = await verifyPptx(broken, r.scene!);
    expect(checked.diagnostics.filter((d) => d.code === 'SC-PPTX-003')).toHaveLength(2);
  });
  it('links visual relationships to real existing layout contracts', () => {
    const routes = exhibitRoutes();
    expect(routes.length).toBeGreaterThan(8);
    expect(exhibitRoutes('bridge')[0]!.layouts.map((l) => l.id)).toEqual(['waterfall']);
    expect(exhibitRoutes('architecture')[0]!.layouts.some((l) => l.id === 'architecture')).toBe(
      true,
    );
    for (const route of routes)
      for (const layout of route.layouts) expect(layout.variants.length).toBeGreaterThan(0);
  });
  it('composes title, sources, page badge and bottom line independently of the exhibit', () => {
    const r = checkDeck(fixture);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    for (const slide of r.scene!.slides) {
      const roles = slide.nodes.map((n) => n.role);
      expect(roles).toEqual(
        expect.arrayContaining([
          'title',
          'tracker',
          'source',
          'chrome-page-badge',
          'chrome-page-number',
          'chrome-side-rail',
          'chrome-section-marker',
          'chrome-title-rule',
          'chrome-takeaway',
        ]),
      );
      expect(roles.filter((role) => role === 'title')).toHaveLength(1);
      expect(slide.master).toBe('content');
    }
    const html = buildHtml(r.scene!);
    expect(html).toContain('Illustrative service survey');
    expect(html).toContain('Independent exhibit content');
    expect(html).toContain('The operating model must fit');
  });
  it('exports the chrome as native objects and detects a removed rail or notes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-chrome-'));
    const r = await buildDeck(fixture, { formats: ['pptx'], outDir: dir, pptxEngine: 'pptxgenjs' });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const path = r.files[0]!.path;
    const zip = await JSZip.loadAsync(readFileSync(path));
    const part = 'ppt/slides/slide1.xml';
    const xml = await zip.file(part)!.async('string');
    expect(xml).toContain('sc:panorama/chrome/side-rail');
    expect(xml).not.toContain('<p:pic>');
    zip.file(part, xml.replace('sc:panorama/chrome/side-rail', 'removed-rail'));
    for (const name of Object.keys(zip.files))
      if (/^ppt\/notesSlides\/notesSlide\d+.xml$/.test(name)) zip.remove(name);
    const broken = join(dir, 'broken.pptx');
    writeFileSync(broken, await zip.generateAsync({ type: 'nodebuffer' }));
    const verified = await verifyPptx(broken, r.scene!);
    expect(
      verified.diagnostics.some((d) => d.code === 'SC-PPTX-002' && d.message.includes('side-rail')),
    ).toBe(true);
    expect(
      verified.diagnostics.some((d) => d.code === 'SC-PPTX-002' && d.message.includes('notes')),
    ).toBe(true);
  });
});
