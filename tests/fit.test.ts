/**
 * Contract capacity and the fit-fix loop.
 *  - Every string field of every layout example, filled to the longest length its contract
 *    accepts, must still fit its box: limits are promises the geometry keeps.
 *  - `fix` reports contract and fit problems with a budget and applies rewrites by pointer.
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeDeck } from '../src/engine/compose.ts';
import { LAYOUTS } from '../src/layouts/index.ts';
import { applyFixes, fitTasks } from '../src/library/fix.ts';
import { checkScene } from '../src/qa/scene-checks.ts';
import { Deck, Slide } from '../src/spec/deck.ts';

const WORDS =
  'partners bring paying clients faster than direct sales and keep acquisition cost within the agreed limit for the pilot regions '.repeat(
    8,
  );
const SKIP = new Set(['id', 'from', 'to', 'image', 'value', 'delta', 'at', 'html', 'css', 'alt']);

describe('contract capacity', () => {
  it.each(LAYOUTS.map((l) => [l.id, l] as const))(
    '%s: every field at its contract max fits',
    (_id, def) => {
      const problems: string[] = [];
      def.examples.forEach((ex, ei) => {
        const raw = {
          id: 'x',
          layout: def.id,
          title: ex.title,
          ...(ex.variant ? { variant: ex.variant } : {}),
          ...structuredClone(ex.content as object),
        } as Record<string, unknown>;
        const walk = (o: unknown, path: string) => {
          if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${path}/${i}`));
          else if (o && typeof o === 'object')
            for (const k of Object.keys(o)) {
              const rec = o as Record<string, unknown>;
              const v = rec[k];
              if (typeof v === 'string' && v.length > 8 && !SKIP.has(k)) {
                for (const n of [
                  300, 260, 220, 180, 140, 120, 100, 90, 80, 60, 50, 40, 30, 24, 20,
                ]) {
                  rec[k] = WORDS.slice(0, n).trim();
                  const r = Slide.safeParse(raw);
                  if (!r.success) continue;
                  const deck = Deck.parse({
                    schemaVersion: 1,
                    id: 'cap',
                    title: 'Cap',
                    sources: [],
                    slides: [raw],
                  });
                  const { scene, diagnostics } = composeDeck({
                    deck,
                    slides: [r.data as never],
                    path: '/tmp/cap.yaml',
                    baseDir: '/tmp',
                    diagnostics: [],
                  });
                  for (const d of [...diagnostics, ...checkScene(scene)])
                    if (d.code === 'SC-FIT-001' || d.code === 'SC-GEOM-001')
                      problems.push(
                        `example ${ei} ${path}/${k} at ${n} chars: ${d.code} ${d.message}`,
                      );
                  break;
                }
                rec[k] = v;
              } else walk(v, `${path}/${k}`);
            }
        };
        walk(raw, '');
      });
      expect(problems).toEqual([]);
    },
    60_000,
  );
});

describe('fit-fix loop', () => {
  it('reports over-long fields with a budget, in deck.yaml and in includes, and applies rewrites', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-fix-'));
    cpSync(join(import.meta.dirname, 'fixtures/overflow'), dir, { recursive: true });
    const deck = join(dir, 'deck.yaml');
    const tasks = fitTasks(deck);
    expect(tasks.map((t) => [t.pointer, t.budget])).toEqual([
      ['/slides/0/points/0/body', 220],
      ['/slides/1/tiles/0/label', 50],
    ]);
    expect(tasks[1]!.file).toMatch(/sections\/more\.yaml$/);
    const fixes = join(dir, 'fixes.json');
    writeFileSync(
      fixes,
      JSON.stringify([
        {
          pointer: '/slides/0/points/0/body',
          text: 'Both resellers signed letters of intent and want to start before summer',
        },
        { pointer: '/slides/1/tiles/0/label', text: 'Paying clients by end of Q2' },
      ]),
    );
    const r = applyFixes(deck, JSON.parse(readFileSync(fixes, 'utf8')));
    expect(r).toMatchObject({ applied: 2, errors: [], remaining: [] });
    expect(readFileSync(deck, 'utf8')).toContain('# kept: comments survive fixes');
    expect(readFileSync(join(dir, 'sections/more.yaml'), 'utf8')).toContain('# section file');
  });

  it('rejects pointers that do not name a slide field', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-fix-'));
    cpSync(join(import.meta.dirname, 'fixtures/overflow'), dir, { recursive: true });
    const r = applyFixes(join(dir, 'deck.yaml'), [{ pointer: '/title', text: 'x' }]);
    expect(r.errors[0]).toMatch(/not a slide field/);
  });
});
