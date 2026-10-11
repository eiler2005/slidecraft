/** Real Office previews. Scene/resvg previews cannot certify a PPTX renderer. */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { convertToPdf, pptxConvertEngine } from './pptx-convert.ts';
import { previewName } from './resvg.ts';
import type { Engine } from './types.ts';

export const pptxPreviewEngine: Engine = {
  id: 'pptx-convert',
  kind: 'png',
  label: 'PNG previews rendered from PPTX by Office',
  license: 'uses your installed office suite and Poppler',
  needsPptx: true,
  capabilities: {
    editable: false,
    nativeCharts: true,
    speakerNotes: false,
    fidelity: 'identical',
    install: 'PowerPoint or LibreOffice, plus Poppler (pdftoppm)',
    ci: false,
  },
  async detect() {
    const office = await pptxConvertEngine.detect();
    if (!office.available) return office;
    if (spawnSync('pdftoppm', ['-v']).status !== 0)
      return { available: false, detail: 'pdftoppm not found', install: 'Install Poppler' };
    return { available: true, detail: `${office.detail}; Poppler PNG rasterisation` };
  },
  async render(scene, opts) {
    if (!opts.pptxPath) throw new Error('Office PNG previews require a built PPTX');
    const width = opts.previewWidth ?? 1600;
    if (!Number.isSafeInteger(width) || width < 1 || width > 10000)
      throw new Error('Office preview width must be an integer between 1 and 10000');
    const tmp = mkdtempSync(join(tmpdir(), 'slidecraft-office-preview-'));
    try {
      const pdf = join(tmp, 'office.pdf');
      convertToPdf(opts.pptxPath, pdf);
      execFileSync(
        'pdftoppm',
        ['-png', '-scale-to-x', String(width), '-scale-to-y', '-1', pdf, join(tmp, 'page')],
        { timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const pages = readdirSync(tmp)
        .filter((f) => /^page-\d+\.png$/.test(f))
        .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));
      if (pages.length !== scene.slides.length)
        throw new Error(`Office returned ${pages.length} pages for ${scene.slides.length} slides`);
      // Separate directory prevents confusing real Office renders with Scene thumbnails.
      const dir = join(opts.outDir, 'previews-office');
      mkdirSync(dir, { recursive: true });
      const files = pages.map((page, i) => {
        const slide = scene.slides[i]!;
        const path = join(dir, previewName(slide.index, slide.id));
        copyFileSync(join(tmp, page), path);
        return { path, kind: 'png' as const, engine: 'pptx-convert' };
      });
      const office = await pptxConvertEngine.detect();
      return {
        files,
        diagnostics: [],
        limitations: [
          `Actual PPTX rendered by ${office.detail}; PNGs rasterised by Poppler. Visual comparison/review is still required.`,
        ],
      };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  },
};
