import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  paragraphs,
  pptxInventory,
  readPpm,
  textDelta,
  visualMetrics,
} from '../scripts/lib/deck-regression.ts';

describe('Digital Ruble baseline and regression machinery', () => {
  const dir = join(import.meta.dirname, 'fixtures/digital-ruble');
  const baseline = JSON.parse(readFileSync(join(dir, 'baseline.json'), 'utf8'));
  it('pins the original PPTX and font-externalised historical HTML, not the candidate', async () => {
    for (const asset of [baseline.original, baseline.reference])
      expect(
        createHash('sha256')
          .update(readFileSync(join(dir, asset.file)))
          .digest('hex'),
      ).toBe(asset.sha256);
    const source = await pptxInventory(readFileSync(join(dir, baseline.original.file)));
    expect(source).toHaveLength(22);
    expect(source.every((s) => s.text.length > 0)).toBe(true);
    const html = readFileSync(join(dir, baseline.reference.file), 'utf8');
    expect(html.match(/<section class="slide/g)).toHaveLength(22);
    expect(html).not.toMatch(/@font-face\{font-family:"System Font";[^}]*base64/);
    expect(readFileSync(join(dir, 'deck.yaml'), 'utf8')).not.toContain('Mobile Documents');
  });
  it('detects deleted tokens, punctuation changes and duplicate counts without depending on line wrapping', () => {
    expect(textDelta(['A B A'], ['A', 'B A'])).toEqual({ missing: [], added: [] });
    expect(textDelta(['A B A'], ['A B!'])).toEqual({
      missing: [
        { token: 'A', count: 1 },
        { token: 'B', count: 1 },
      ],
      added: [{ token: 'B!', count: 1 }],
    });
    expect(
      paragraphs('<a:p><a:r><a:t>&#x41;&amp;</a:t></a:r><a:br/><a:r><a:t>B</a:t></a:r></a:p>'),
    ).toEqual(['A& B']);
    expect(
      paragraphs(
        '<a:p><a:r><a:t>A</a:t></a:r><a:br><a:rPr lang="ru-RU"/></a:br><a:r><a:t>B</a:t></a:r></a:p>',
      ),
    ).toEqual(['A B']);
  });
  it('uses presentation order and relationships, preserving numeric notes and ignoring slide-number placeholders', async () => {
    const zip = new JSZip();
    zip.file(
      'ppt/presentation.xml',
      '<p:sldIdLst><p:sldId id="2" r:id="b"/><p:sldId id="1" r:id="a"/></p:sldIdLst>',
    );
    zip.file(
      'ppt/_rels/presentation.xml.rels',
      '<Relationships><Relationship Target="/ppt/slides/slide1.xml" Id="a"/><Relationship Id="b" Target="slides/slide2.xml"/></Relationships>',
    );
    zip.file('ppt/slides/slide1.xml', '<p:sp><a:p><a:r><a:t>One</a:t></a:r></a:p></p:sp>');
    zip.file('ppt/slides/slide2.xml', '<p:sp><a:p><a:r><a:t>Two</a:t></a:r></a:p></p:sp>');
    zip.file(
      'ppt/slides/_rels/slide2.xml.rels',
      '<Relationship Id="n" Target="../notesSlides/notesSlide2.xml" Type="test/notesSlide"/>',
    );
    zip.file(
      'ppt/notesSlides/notesSlide2.xml',
      '<p:sp><p:ph type="body"/><a:p><a:r><a:t>123</a:t></a:r></a:p></p:sp><p:sp><p:ph type="sldNum"/><a:p><a:r><a:t>2</a:t></a:r></a:p></p:sp>',
    );
    const result = await pptxInventory(await zip.generateAsync({ type: 'uint8array' }));
    expect(result.map((s) => s.text)).toEqual([['Two'], ['One']]);
    expect(result[0]!.notes).toEqual(['123']);
  });
  it('parses PPM comments and does not eat whitespace-valued first pixels', () => {
    expect([
      ...readPpm(
        Buffer.concat([Buffer.from('P6\n# Poppler\n1 1\n255\n'), Buffer.from([10, 32, 13])]),
      ).rgb,
    ]).toEqual([10, 32, 13]);
    expect(() => readPpm(Buffer.from('P6\n1 1\n255\n'))).toThrow('length');
  });
  it('does not let a mostly white page hide a missing small exhibit', () => {
    const white = { width: 100, height: 100, rgb: new Uint8Array(30000).fill(255) };
    const mark = { ...white, rgb: white.rgb.slice() };
    for (let y = 10; y < 20; y++)
      for (let x = 10; x < 20; x++) mark.rgb.fill(0, (y * 100 + x) * 3, (y * 100 + x) * 3 + 3);
    expect(visualMetrics(mark, mark).worstRegion).toBe(1);
    const diff = visualMetrics(mark, white);
    expect(diff.mean).toBeGreaterThan(0.98);
    expect(diff.worstRegion).toBeLessThan(0.95);
    expect(() => visualMetrics(mark, { ...white, width: 101 })).toThrow('dimensions');
  });
});
