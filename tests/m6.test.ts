import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/build.ts';

const LINKED = join(import.meta.dirname, 'fixtures/linked/deck.yaml');
const URL = 'https://ec.europa.eu/eurostat/web/tourism';

describe('source hyperlinks and accessibility', () => {
  it('links registry sources in PPTX, PDF and HTML; tags the PDF', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-links-'));
    const r = await buildDeck(LINKED, { outDir: out, formats: ['pptx', 'pdf', 'html'] });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const file = (k: string) => r.files.find((f) => f.kind === k)!.path;

    const zip = await JSZip.loadAsync(readFileSync(file('pptx')));
    const slide = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
    expect(slide).toContain('<a:hlinkClick');
    expect(slide).toContain('hlinkClr');
    expect(rels).toContain(URL);

    const pdf = readFileSync(file('pdf')).toString('latin1');
    expect(pdf).toContain(`(${URL})`);
    expect(pdf).toContain('/StructTreeRoot');
    expect(pdf).toMatch(/\/S \/H1/);
    expect(pdf).toMatch(/\/S \/Figure/);
    expect(pdf).toMatch(/\/S \/TH/);
    expect(pdf).toContain('/Marked true');

    expect(readFileSync(file('html'), 'utf8')).toContain(`<a href="${URL}"`);
  });
});

describe('documents: A4, one-pager, DOCX', () => {
  const STRATEGY = join(import.meta.dirname, '../examples/strategy-recommendation/deck.yaml');

  it('every layout example composes cleanly in A4 landscape', async () => {
    const { composeDeck } = await import('../src/engine/compose.ts');
    const { LAYOUTS } = await import('../src/layouts/index.ts');
    const { checkScene } = await import('../src/qa/scene-checks.ts');
    const { Deck, Slide } = await import('../src/spec/deck.ts');
    const errors: string[] = [];
    for (const def of LAYOUTS)
      def.examples.forEach((ex, i) => {
        const raw = {
          id: `x-${i}`,
          layout: def.id,
          title: ex.title,
          ...(ex.lead ? { lead: ex.lead } : {}),
          ...(ex.variant ? { variant: ex.variant } : {}),
          ...(ex.sources ? { sources: ex.sources } : {}),
          ...(ex.content as object),
        };
        const deck = Deck.parse({
          schemaVersion: 1,
          id: 'a4',
          title: 'A4',
          format: 'a4-landscape',
          sources: (ex.sources ?? []).map((id) => ({
            id,
            title: `Source ${id}`,
            illustrative: true,
          })),
          slides: [raw],
        });
        const { scene, diagnostics } = composeDeck({
          deck,
          slides: [Slide.parse(raw) as never],
          path: '/tmp/a4.yaml',
          baseDir: '/tmp',
          diagnostics: [],
        });
        expect(scene.format.id).toBe('a4-landscape');
        for (const d of [...diagnostics, ...checkScene(scene)])
          if (d.severity === 'error') errors.push(`${def.id}#${i}: ${d.code} ${d.message}`);
      });
    expect(errors).toEqual([]);
  });

  it('builds a one-pager and a Word memo, both reproducible', async () => {
    const a = mkdtempSync(join(tmpdir(), 'sc-docs-a-'));
    const b = mkdtempSync(join(tmpdir(), 'sc-docs-b-'));
    const ra = await buildDeck(STRATEGY, { outDir: a, formats: ['onepager', 'docx'] });
    const rb = await buildDeck(STRATEGY, { outDir: b, formats: ['onepager', 'docx'] });
    const kinds = ra.files.map((f) => f.kind).sort();
    expect(kinds).toEqual(['docx', 'onepager']);
    for (const [i, f] of ra.files.entries())
      expect(readFileSync(f.path).equals(readFileSync(rb.files[i]!.path))).toBe(true);

    const pdf = readFileSync(ra.files.find((f) => f.kind === 'onepager')!.path).toString('latin1');
    expect(pdf).toContain('/MediaBox [0 0 595.296 841.896]');

    const zip = await JSZip.loadAsync(readFileSync(ra.files.find((f) => f.kind === 'docx')!.path));
    const doc = await zip.file('word/document.xml')!.async('string');
    expect(doc).toContain('w:val="Heading1"');
    expect(doc).toContain('Partners cut time to first revenue from 18 to 7 months');
    expect(doc).toContain('<w:tbl>');
    expect(doc).toMatch(/descr="[^"]+"/);
    expect(Object.keys(zip.files).some((n) => n.startsWith('word/media/'))).toBe(true);
  });
});

describe('image generation', () => {
  it('fills empty image slots from a prompt and writes the path back into the YAML', async () => {
    const { createServer } = await import('node:http');
    const { writeFileSync } = await import('node:fs');
    const { generateImages, openAiProvider, planImages } = await import('../src/library/images.ts');
    const { loadDeck } = await import('../src/library/load.ts');
    const png = readFileSync(
      join(import.meta.dirname, '../examples/narrative-story/assets/reconciliation.png'),
    );
    const prompts: string[] = [];
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        prompts.push(JSON.parse(body).prompt);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as { port: number }).port;
    const dir = mkdtempSync(join(tmpdir(), 'sc-img-'));
    const deck = join(dir, 'deck.yaml');
    writeFileSync(
      deck,
      `schemaVersion: 1
id: img
title: Images
slides:
  # the story beat
  - id: market
    layout: text-image
    title: Mornings at the Campo de' Fiori market set the pace of a Roman day
    body: [Stalls open at seven; by ten the square belongs to tourists.]
    alt: Market stalls with vegetables in a Roman square
    imagePrompt: Morning market stalls with vegetables in a sunny Roman piazza
`,
    );
    try {
      const jobs = planImages(deck);
      expect(jobs.map((j) => j.image)).toEqual(['assets/market.png']);
      const r = await generateImages(
        jobs,
        openAiProvider({ OPENAI_API_KEY: 'test', OPENAI_BASE_URL: `http://127.0.0.1:${port}/v1` }),
      );
      expect(r.failed).toEqual([]);
      expect(prompts[0]).toContain('Roman piazza');
      expect(prompts[0]).toContain('No text');
      const yaml = readFileSync(deck, 'utf8');
      expect(yaml).toContain('# the story beat');
      expect(yaml).toContain('image: assets/market.png');
      expect(planImages(deck)).toEqual([]);
      expect(loadDeck(deck).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    } finally {
      server.close();
    }
  });
});
