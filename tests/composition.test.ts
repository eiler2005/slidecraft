import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { checkDeck } from '../src/build.ts';
import { scaffoldDeck } from '../src/cli/workflow.ts';
import { composition } from '../src/layouts/composition.ts';
import { loadBrief, loadStorylines, loadThemes } from '../src/library/load.ts';

function check(slide: object) {
  const dir = mkdtempSync(join(tmpdir(), 'sc-components-'));
  const path = join(dir, 'deck.yaml');
  writeFileSync(
    path,
    YAML.stringify({
      schemaVersion: 1,
      id: 'components',
      title: 'Reusable exhibits',
      theme: 'editorial-fintech',
      slides: [
        {
          id: 'one',
          layout: 'composition',
          title: 'Existing exhibits share a single frame',
          ...slide,
        },
      ],
    }),
  );
  return checkDeck(path);
}
describe('component constructor', () => {
  it('reuses existing layouts, retains nested text pointers and draws chrome once', () => {
    const r = check(composition.examples[0]!.content);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const nodes = r.scene!.slides[0]!.nodes;
    expect(nodes.filter((n) => n.role === 'title')).toHaveLength(1);
    expect(
      nodes.some(
        (n) => 'pointer' in n && n.pointer === '/slides/0/components/1/content/points/0/heading',
      ),
    ).toBe(true);
    expect(nodes.some((n) => n.kind === 'html' || n.kind === 'image')).toBe(false);
  });
  for (const layout of ['missing', 'composition', 'freeform', 'title'])
    it(`rejects ${layout} instead of silently dropping it`, () => {
      const r = check({
        components: [{ id: 'part', layout, box: { x: 0, y: 0, w: 1, h: 1 }, content: {} }],
      });
      expect(r.diagnostics.some((d) => d.code === 'SC-SPEC-002')).toBe(true);
    });
  it('rejects invalid child content, regions, overlaps and duplicate ids', () => {
    const part = {
      id: 'part',
      layout: 'key-points',
      box: { x: 0, y: 0, w: 1, h: 1 },
      content: { points: [] },
    };
    expect(check({ components: [part] }).diagnostics.some((d) => d.code === 'SC-SPEC-001')).toBe(
      true,
    );
    expect(composition.schema.safeParse({ components: [part, part] }).success).toBe(false);
    expect(
      composition.schema.safeParse({ components: [{ ...part, box: { x: 0.5, y: 0, w: 1, h: 1 } }] })
        .success,
    ).toBe(false);
  });
});

describe('storylines × themes remain independent', () => {
  const brief = loadBrief(
    join(import.meta.dirname, '../examples/strategy-recommendation/brief.yaml'),
  ).brief!;
  for (const storyline of loadStorylines())
    for (const theme of loadThemes()) {
      it(`${storyline.id} × ${theme.id} scaffolds and composes`, () => {
        const raw = scaffoldDeck(brief, storyline.id, theme.id);
        const dir = mkdtempSync(join(tmpdir(), 'sc-pair-'));
        const path = join(dir, 'deck.yaml');
        writeFileSync(path, YAML.stringify(raw));
        const r = checkDeck(path);
        expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(r.scene!.slides.length).toBeGreaterThan(0);
      });
    }
});
