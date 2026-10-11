import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeDeck } from '../src/engine/compose.ts';
import { checkScene } from '../src/qa/scene-checks.ts';
import { Deck, Slide } from '../src/spec/deck.ts';

describe('scene checks', () => {
  it('flags text hidden under an opaque shape drawn after it (SC-GEOM-004)', () => {
    const raw = {
      id: 'k',
      layout: 'kpi-tiles',
      title: 'Labels on KPI cards must stay visible above the card background',
      source: 'Test',
      tiles: [
        { value: '32', label: 'Slide layouts' },
        { value: '14', label: 'Storylines' },
      ],
    };
    const deck = Deck.parse({ schemaVersion: 1, id: 't', title: 'T', slides: [raw] });
    const { scene } = composeDeck({
      deck,
      slides: [Slide.parse(raw) as never],
      path: '/tmp/t.yaml',
      baseDir: '/tmp',
      diagnostics: [],
    });
    expect(checkScene(scene).filter((d) => d.code === 'SC-GEOM-004')).toEqual([]);
    // move a card after the labels: the label underneath becomes invisible
    const nodes = scene.slides[0]!.nodes;
    const card = nodes.findIndex((n) => n.kind === 'rect' && n.role === 'card');
    nodes.push(nodes.splice(card, 1)[0]!);
    expect(checkScene(scene).map((d) => d.code)).toContain('SC-GEOM-004');
  });
});

describe('new: a goal sentence becomes the deck id', () => {
  it('drops filler words and transliterates Cyrillic', async () => {
    const { slugFrom } = await import('../src/cli/commands.ts');
    expect(slugFrom('The board should approve a partner-led entry into Germany')).toBe(
      'board-approve-partner-led-entry-germany',
    );
    expect(slugFrom('Q3 steerco update for the ERP programme')).toBe(
      'q3-steerco-update-erp-programme',
    );
    expect(slugFrom('Совет директоров утверждает выход в Германию')).toBe(
      'sovet-direktorov-utverzhdaet-vykhod-germaniyu',
    );
  });
});

describe('cross-slide consistency (SC-CONSIST-001)', () => {
  it('does not mistake freeform CSS percentages for business metrics', async () => {
    const { checkConsistency } = await import('../src/qa/consistency.ts');
    const d = checkConsistency([
      { id: 'one', html: '<style>.card{width:20%}</style><div>Revenue is 10%</div>' },
      { id: 'two', html: '<style>.card{width:10%}</style><div>Revenue is 10%</div>' },
    ]);
    expect(d).toEqual([]);
  });

  it('flags one metric shown with two values, and accepts rounding', async () => {
    const { checkConsistency } = await import('../src/qa/consistency.ts');
    const slides = [
      { id: 'summary', title: 'Germany adds €40M revenue by 2028 on a partner-led entry' },
      { id: 'value', tiles: [{ value: '€42M', label: 'Germany revenue by 2028' }] },
      { id: 'plan', title: 'The plan delivers €40.2M revenue by 2028 with two partners' },
      { id: 'speed', title: 'Partners cut time to first revenue from 18 to 7 months' },
    ];
    const d = checkConsistency(slides);
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain('€42M on value');
    expect(d[0]!.message).toContain('€40M on summary');
  });

  it('finds no contradictions in the example decks', async () => {
    const { checkDeck } = await import('../src/build.ts');
    const { existsSync, readdirSync } = await import('node:fs');
    const root = join(import.meta.dirname, '../examples');
    for (const dir of readdirSync(root).filter((d) => existsSync(join(root, d, 'deck.yaml')))) {
      const r = checkDeck(join(import.meta.dirname, '../examples', dir, 'deck.yaml'));
      expect(
        r.diagnostics.filter((x) => x.code === 'SC-CONSIST-001').map((x) => `${dir}: ${x.message}`),
      ).toEqual([]);
    }
  });
});
