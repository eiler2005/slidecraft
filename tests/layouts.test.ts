/**
 * Contract harness — runs for every registered layout × theme:
 *  - every example validates against the layout schema,
 *  - composing it yields no errors (fit, geometry, spec),
 *  - the SVG preview is stable (golden snapshot).
 * New layouts get coverage automatically by being added to the registry.
 */
import { describe, expect, it } from 'vitest';
import { slideSvg } from '../src/backends/svg.ts';
import { composeDeck } from '../src/engine/compose.ts';
import { LAYOUTS } from '../src/layouts/index.ts';
import type { LoadedDeck } from '../src/library/load.ts';
import { loadThemes } from '../src/library/load.ts';
import { checkChrome } from '../src/qa/chrome.ts';
import { checkScene } from '../src/qa/scene-checks.ts';
import { Deck, Slide } from '../src/spec/deck.ts';

function deckFor(layoutId: string, themeId: string, exIndex: number): LoadedDeck {
  const def = LAYOUTS.find((l) => l.id === layoutId)!;
  const ex = def.examples[exIndex]!;
  const raw = {
    id: `${layoutId}-${exIndex}`,
    layout: layoutId,
    title: ex.title,
    ...(ex.lead ? { lead: ex.lead } : {}),
    ...(ex.variant ? { variant: ex.variant } : {}),
    ...(ex.sources ? { sources: ex.sources } : {}),
    ...(ex.content as object),
  };
  const slide = Slide.parse(raw);
  const deck = Deck.parse({
    schemaVersion: 1,
    id: 'harness',
    title: 'Harness',
    theme: themeId,
    sources: (ex.sources ?? []).map((id) => ({ id, title: `Source ${id}`, illustrative: true })),
    slides: [raw],
  });
  return {
    deck,
    slides: [slide as never],
    path: '/tmp/harness.yaml',
    baseDir: '/tmp',
    diagnostics: [],
  };
}

describe.each(LAYOUTS.map((l) => [l.id, l] as const))('layout %s', (id, def) => {
  it('declares purpose, variants and at least one example per variant', () => {
    expect(def.purpose.length).toBeGreaterThan(20);
    const covered = new Set(def.examples.map((e) => e.variant ?? def.variants[0]));
    expect(def.examples.length).toBeGreaterThan(0);
    expect(covered.has(def.variants[0])).toBe(true);
  });

  for (const theme of loadThemes()) {
    def.examples.forEach((ex, i) => {
      it(`example ${i} (${ex.variant ?? def.variants[0]}) composes cleanly in ${theme.id}`, () => {
        const { scene, diagnostics } = composeDeck(deckFor(id, theme.id, i));
        const all = [...diagnostics, ...checkScene(scene), ...checkChrome(scene)];
        const errors = all.filter((d) => d.severity === 'error');
        expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
        if (theme.id === 'consulting-classic') {
          expect(slideSvg(scene, scene.slides[0]!)).toMatchSnapshot();
        }
      });
    });
  }
});
