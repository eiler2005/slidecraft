import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDeck } from '../src/build.ts';
import { findInMaterials, ingest } from '../src/library/ingest.ts';
import { parseSourceRef } from '../src/spec/deck.ts';

describe('client material with page-level sources', () => {
  it('ingests a PDF and a workbook, registers sources and finds phrases with their page', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-ingest-'));
    cpSync(join(import.meta.dirname, 'fixtures/data'), dir, { recursive: true });
    cpSync(
      join(import.meta.dirname, '../docs/showcase/slidecraft-overview.pdf'),
      join(dir, 'overview.pdf'),
    );
    const deck = join(dir, 'deck.yaml');
    const r = await ingest([join(dir, 'overview.pdf'), join(dir, 'rates.csv')], { deck });
    expect(r.map((x) => [x.id, x.kind, x.sections, x.added])).toEqual([
      ['overview', 'pdf', 12, true],
      ['rates', 'csv', 1, true],
    ]);
    const md = readFileSync(join(dir, 'materials/overview.md'), 'utf8');
    expect(md).toContain('## p. 9 {#p9}');
    expect(md).toContain('98.6% identical line breaks');
    expect(readFileSync(deck, 'utf8')).toMatch(
      /- id: overview\n\s+title: .+\n(\s+date: .+\n)?\s+file: overview\.pdf\n\s+pages: 12/,
    );
    const hits = findInMaterials('identical line breaks', join(dir, 'materials'));
    expect(hits[0]).toMatchObject({ ref: 'overview#p9', where: 'p. 9' });
    expect(existsSync(join(dir, 'materials/rates.md'))).toBe(true);
  }, 60_000);

  it('cites a page on the slide source line', () => {
    expect(parseSourceRef('annual-report#p14')).toEqual({
      id: 'annual-report',
      where: 'p. 14',
      page: 14,
    });
    expect(parseSourceRef('deck#slide3').where).toBe('slide 3');
    expect(parseSourceRef('model#sheet:Plan').where).toBe('sheet Plan');
    const dir = mkdtempSync(join(tmpdir(), 'sc-pages-'));
    const deck = join(dir, 'deck.yaml');
    writeFileSync(
      deck,
      readFileSync(join(import.meta.dirname, 'fixtures/linked/deck.yaml'), 'utf8').replace(
        'sources: [eurostat]',
        'sources: [eurostat#p9]',
      ),
    );
    const r = checkDeck(deck);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const source = r.scene!.slides[0]!.nodes.find((n) => n.kind === 'text' && n.role === 'source');
    const text =
      source && source.kind === 'text'
        ? source.paragraphs[0]!.runs.map((x) => x.text).join('')
        : '';
    expect(text).toContain('Eurostat tourism statistics (2025), p. 9');
  });
});
