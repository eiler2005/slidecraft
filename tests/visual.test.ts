/**
 * Visual regression: every layout example rendered to PNG (bundled fonts, resvg-wasm) in a
 * light and a dark theme, hashed and compared with tests/golden/visual.json. Rendering is
 * deterministic across macOS and Linux, so any hash change is a real pixel change.
 *
 *   UPDATE_GOLDEN=1 npx vitest run tests/visual.test.ts   # accept the new renders
 *
 * On a mismatch the new PNG is written to tests/.output/visual/ (uploaded by CI).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { rasterize } from '../src/backends/resvg.ts';
import { slideSvg } from '../src/backends/svg.ts';
import { composeDeck } from '../src/engine/compose.ts';
import { LAYOUTS } from '../src/layouts/index.ts';
import { Deck, Slide } from '../src/spec/deck.ts';

const GOLDEN = join(import.meta.dirname, 'golden/visual.json');
const OUT = join(import.meta.dirname, '.output/visual');
const update = !!process.env.UPDATE_GOLDEN;
const golden: Record<string, string> = existsSync(GOLDEN)
  ? JSON.parse(readFileSync(GOLDEN, 'utf8'))
  : {};
const seen: Record<string, string> = {};

describe('visual regression', () => {
  for (const theme of ['consulting-classic', 'midnight'])
    for (const def of LAYOUTS)
      def.examples.forEach((ex, i) => {
        const key = `${def.id}#${i}@${theme}`;
        it(key, async () => {
          const raw = {
            id: `v${i}`,
            layout: def.id,
            title: ex.title,
            ...(ex.lead ? { lead: ex.lead } : {}),
            ...(ex.variant ? { variant: ex.variant } : {}),
            ...(ex.sources ? { sources: ex.sources } : {}),
            ...(ex.content as object),
          };
          const deck = Deck.parse({
            schemaVersion: 1,
            id: 'visual',
            title: 'Visual',
            theme,
            sources: (ex.sources ?? []).map((id) => ({
              id,
              title: `Source ${id}`,
              illustrative: true,
            })),
            slides: [raw],
          });
          const { scene } = composeDeck({
            deck,
            slides: [Slide.parse(raw) as never],
            path: '/tmp/visual.yaml',
            baseDir: '/tmp',
            diagnostics: [],
          });
          const png = await rasterize(slideSvg(scene, scene.slides[0]!), 640);
          const hash = createHash('sha256').update(png).digest('hex').slice(0, 16);
          seen[key] = hash;
          if (update) return;
          if (golden[key] !== hash) {
            mkdirSync(OUT, { recursive: true });
            writeFileSync(join(OUT, `${key.replace(/[#@]/g, '-')}.png`), png);
          }
          expect(hash, `${key} changed — see tests/.output/visual/`).toBe(golden[key]);
        }, 30_000);
      });

  afterAll(() => {
    if (update)
      writeFileSync(
        GOLDEN,
        `${JSON.stringify(Object.fromEntries(Object.entries(seen).sort()), null, 2)}\n`,
      );
  });
});
