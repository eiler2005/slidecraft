import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizeZip } from '../src/backends/pptxgenjs.ts';
import { buildDeck } from '../src/build.ts';
import { declaredPartsExist } from '../src/qa/pptx-verify.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const declared = async (zip: JSZip) =>
  [
    ...((await zip.file('[Content_Types].xml')!.async('string')).matchAll(
      /PartName="\/([^"]+)"/g,
    ) ?? []),
  ].map((m) => m[1]!);

// Found in a ChatGPT agent-mode run: pptxgenjs 4.0.1 declares slideMaster2.xml … slideMasterN.xml
// in [Content_Types].xml (one per slide) but writes only slideMaster1.xml.
describe('PPTX package: every declared part exists (SC-PPTX-004)', () => {
  it('a multi-slide deck declares only the parts it contains', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-pkg-'));
    dirs.push(out);
    const r = await buildDeck('examples/llm-concepts/deck.yaml', {
      outDir: out,
      formats: ['pptx'],
    });
    expect(r.diagnostics.filter((d) => d.code === 'SC-PPTX-004')).toEqual([]);
    const zip = await JSZip.loadAsync(readFileSync(r.files.find((f) => f.kind === 'pptx')!.path));
    expect((await declared(zip)).filter((p) => !zip.files[p])).toEqual([]);
    expect((await declared(zip)).filter((p) => p.startsWith('ppt/slideMasters/'))).toEqual([
      'ppt/slideMasters/slideMaster1.xml',
    ]);
    expect(
      Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length,
    ).toBe(r.scene!.slides.length);
  }, 60_000);

  it('drops only missing slide masters; any other missing part is reported', async () => {
    const zin = new JSZip();
    const type = 'application/vnd.openxmlformats-officedocument.presentationml';
    zin.file(
      '[Content_Types].xml',
      `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${type}.slideMaster+xml"/>` +
        `<Override PartName="/ppt/slideMasters/slideMaster2.xml" ContentType="${type}.slideMaster+xml"/>` +
        `<Override PartName="/ppt/slides/slide1.xml" ContentType="${type}.slide+xml"/>` +
        `<Override PartName="/ppt/slides/slide2.xml" ContentType="${type}.slide+xml"/>` +
        `</Types>`,
    );
    zin.file('ppt/slideMasters/slideMaster1.xml', '<p:sldMaster/>');
    zin.file('ppt/slides/slide1.xml', '<p:sld/>');
    const buf = await normalizeZip(
      await zin.generateAsync({ type: 'nodebuffer' }),
      new Date('2026-01-01T00:00:00Z'),
    );
    const zip = await JSZip.loadAsync(buf);
    expect(await declared(zip)).toEqual([
      'ppt/slideMasters/slideMaster1.xml',
      'ppt/slides/slide1.xml',
      'ppt/slides/slide2.xml',
    ]);
    const found = await declaredPartsExist(zip);
    expect(found.map((d) => [d.code, d.message])).toEqual([
      [
        'SC-PPTX-004',
        '[Content_Types].xml declares /ppt/slides/slide2.xml, which is not in the file',
      ],
    ]);
  });
});
