import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDeck, checkDeck } from '../src/build.ts';
import { importPptx } from '../src/library/pptx-import.ts';

describe('pptx import (M5)', () => {
  it('round-trips a built deck into a valid draft with charts and tables recognised', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-import-'));
    const built = await buildDeck(
      join(import.meta.dirname, '../examples/strategy-recommendation/deck.yaml'),
      {
        outDir: join(dir, 'built'),
        formats: ['pptx'],
      },
    );
    const r = await importPptx(built.files[0]!.path, {
      out: join(dir, 'imported'),
      id: 'roundtrip',
    });
    expect(r.slides).toBe(11);
    expect(r.layouts['chart-takeaway']).toBeGreaterThanOrEqual(2);
    expect(r.layouts['data-table']).toBe(1);
    const c = checkDeck(r.deckPath);
    expect(c.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(c.scene?.slides[1]?.title).toBe(
      'Entering Germany now captures a €40M window before two rivals scale',
    );
  });
});
