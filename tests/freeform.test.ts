import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { findChrome } from '../src/backends/html.ts';
import { buildDeck } from '../src/build.ts';
import { sanitizeCss, sanitizeHtml } from '../src/engine/freeform.ts';

const DECK = join(import.meta.dirname, 'fixtures/freeform/deck.yaml');

describe('freeform HTML', () => {
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
