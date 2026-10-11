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
