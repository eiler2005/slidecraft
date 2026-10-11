import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildHtml } from '../src/backends/html.ts';
import { buildDeck, checkDeck } from '../src/build.ts';
import { exhibitRoutes } from '../src/library/exhibits.ts';
import { verifyPptx } from '../src/qa/pptx-verify.ts';

const fixture = join(import.meta.dirname, 'fixtures/chrome/deck.yaml');
describe('shared semantic exhibits and design chrome', () => {
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
