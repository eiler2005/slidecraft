/** Public synthetic exhibit corpus; one canonical example for every native diagram/advanced variant. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { LAYOUTS } from '../src/layouts/index.ts';
import { ROOT } from '../src/paths.ts';

const variants = new Set([
  'dumbbell',
  'slopegraph',
  'bump',
  'ridgeline',
  'streamgraph',
  'beeswarm',
]);
for (const theme of ['consulting-classic', 'midnight']) {
  const slides = LAYOUTS.flatMap((def) =>
    def.examples
      .filter((ex) => def.tags?.includes('diagram') || variants.has(ex.variant ?? ''))
      .map((ex, i) => ({
        id: `${def.id}-${ex.variant ?? i}`,
        layout: def.id,
        title: ex.title,
        ...(ex.variant ? { variant: ex.variant } : {}),
        tracker: def.name,
        status: 'final',
        sources: ['illustrative'],
        notes:
          'Synthetic demonstration. Values are illustrative, not client data. Diagram marks are editable native objects; advanced charts use shapes rather than embedded chart worksheets.',
        ...ex.content,
      })),
  );
  const folder = join(
    ROOT,
    'examples',
    theme === 'midnight' ? 'diagram-gallery-midnight' : 'diagram-gallery',
  );
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, 'deck.yaml'),
    YAML.stringify({
      schemaVersion: 1,
      id: theme === 'midnight' ? 'diagram-gallery-midnight' : 'diagram-gallery',
      title: 'Native diagrams and analytical exhibits',
      theme,
      status: 'final',
      sources: [
        {
          id: 'illustrative',
          title: 'Illustrative synthetic data — not client observations',
          illustrative: true,
        },
      ],
      slides,
    }),
  );
  console.log(`${folder}: ${slides.length} slides`);
}
