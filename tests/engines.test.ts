import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/backends/extra.ts';
import { detect, findEngine, resolveEngine } from '../src/backends/registry.ts';
import { buildDeck } from '../src/build.ts';
import { scaffoldDeck } from '../src/cli/workflow.ts';
import { loadBrief } from '../src/library/load.ts';
import { templateOptions } from '../src/library/rank.ts';
import { recommendOutput } from '../src/library/recommend.ts';

const FIXTURE = join(import.meta.dirname, 'fixtures/skeleton/deck.yaml');
const EXAMPLE_BRIEF = join(import.meta.dirname, '../examples/strategy-recommendation/brief.yaml');
const available = async (kind: 'pdf' | 'pptx' | 'html', id: string) => {
  const e = findEngine(kind, id);
  return !!e && (await detect(e)).available;
};

describe('html engine', () => {
  it('writes one self-contained file with every slide and no network references', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-html-'));
    const r = await buildDeck(FIXTURE, { outDir: out, formats: ['html'] });
    const f = r.files.find((x) => x.kind === 'html')!;
    const html = readFileSync(f.path, 'utf8');
    for (const s of r.scene!.slides)
      expect(html).toContain(s.title.replace(/&/g, '&amp;').slice(0, 30));
    expect(html).not.toMatch(/(src|href)=["']https?:\/\//);
    expect(html).toContain('@font-face');
  });
});

describe('optional engines', async () => {
  const chrome = await available('pdf', 'html');
  const at = await available('pptx', 'artifact-tool');
  const convert =
    (await available('pdf', 'pptx-convert')) && process.env.SLIDECRAFT_TEST_CONVERT === '1';

  it.skipIf(!chrome)('prints a PDF with system Chrome', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-hpdf-'));
    const r = await buildDeck(FIXTURE, { outDir: out, formats: ['pdf'], pdfEngine: 'html' });
    const f = r.files.find((x) => x.kind === 'pdf')!;
    expect(statSync(f.path).size).toBeGreaterThan(10_000);
  });

  it.skipIf(!at)('builds PPTX through the local artifact-tool runtime', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-at-'));
    const r = await buildDeck(FIXTURE, {
      outDir: out,
      formats: ['pptx'],
      pptxEngine: 'artifact-tool',
    });
    expect(r.files[0]?.engine).toBe('artifact-tool');
    expect(r.diagnostics.filter((d) => d.code === 'SC-PPTX-001')).toEqual([]);
  });

  it.skipIf(!convert)('converts PPTX to PDF with the office suite', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-conv-'));
    const r = await buildDeck(FIXTURE, {
      outDir: out,
      formats: ['pptx', 'pdf', 'png'],
      pdfEngine: 'pptx-convert',
      pngEngine: 'pptx-convert',
    });
    expect(existsSync(r.files.find((x) => x.kind === 'pdf')!.path)).toBe(true);
    const images = r.files.filter((x) => x.kind === 'png');
    expect(images).toHaveLength(r.scene!.slides.length);
    expect(
      images.every((x) => x.engine === 'pptx-convert' && x.path.includes('previews-office')),
    ).toBe(true);
  });
});

describe('workflow helpers', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps automatic export portable in Codex and uses the same recommendation', async () => {
    vi.stubEnv('SLIDECRAFT_IN_CODEX', '1');
    vi.stubEnv('SLIDECRAFT_PPTX_ENGINE', 'auto');
    expect((await resolveEngine('pptx', 'auto')).engine?.id).toBe('pptxgenjs');
    expect((await recommendOutput(['codex'])).engines.pptx).toBe('pptxgenjs');
  });

  it('does not replace an explicitly requested unknown engine with another renderer', async () => {
    vi.stubEnv('SLIDECRAFT_PPTX_ENGINE', 'pptxgenjs');
    const result = await resolveEngine('pptx', 'missing-evaluation-engine');
    expect(result.engine).toBeUndefined();
    expect(result.reason).toContain('unknown');
  });
  it('ranks the strategy storyline first for a strategy brief and offers three distinct options', () => {
    const { brief } = loadBrief(EXAMPLE_BRIEF);
    const opts = templateOptions(brief!);
    expect(opts.map((o) => o.option)).toEqual(['A', 'B', 'C']);
    expect(opts[0]!.storyline).toBe('strategy-recommendation');
    expect(new Set(opts.map((o) => `${o.storyline}/${o.theme}`)).size).toBe(3);
  });

  it('recommends PowerPoint-rendered PDF only when the deck is sent as PDF and a converter exists', async () => {
    const plain = await recommendOutput(['edit-together']);
    expect(plain.engines).toEqual({ pptx: 'pptxgenjs', pdf: 'native' });
    const web = await recommendOutput(['web-link']);
    expect(web.formats).toContain('html');
  });

  it('scaffolds a ghost deck with one slide per storyline slot', () => {
    const { brief } = loadBrief(EXAMPLE_BRIEF);
    const deck = scaffoldDeck(brief!, 'strategy-recommendation', 'consulting-classic') as {
      slides: { status: string }[];
    };
    expect(deck.slides.length).toBeGreaterThanOrEqual(9);
    expect(deck.slides.every((s) => s.status === 'ghost')).toBe(true);
  });

  it('validates ghost slides without content fields but still checks layout and variant', async () => {
    const { writeFileSync } = await import('node:fs');
    const dir = mkdtempSync(join(tmpdir(), 'sc-ghost-'));
    const p = join(dir, 'deck.yaml');
    writeFileSync(
      p,
      'schemaVersion: 1\nid: g\ntitle: Ghost\nstatus: ghost\nslides:\n  - { id: a, layout: waterfall, title: A claim that the waterfall will prove }\n  - { id: b, layout: waterfall, variant: nope, title: Another claim the deck will prove }\n',
    );
    const { checkDeck } = await import('../src/build.ts');
    const r = checkDeck(p);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['SC-SPEC-002']);
  });

  it('honours SLIDECRAFT_PPTX_ENGINE for auto and falls back when unavailable', async () => {
    vi.stubEnv('SLIDECRAFT_PPTX_ENGINE', 'does-not-exist');
    expect((await resolveEngine('pptx', 'auto')).engine?.id).toBe('pptxgenjs');
    vi.stubEnv('SLIDECRAFT_PPTX_ENGINE', 'pptxgenjs');
    expect((await resolveEngine('pptx', 'auto')).reason).toContain('SLIDECRAFT_PPTX_ENGINE');
  });
});
