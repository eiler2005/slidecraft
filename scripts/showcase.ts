/**
 * Build the showcase deck — the deck about SlideCraft, made with SlideCraft — into
 * docs/showcase/: PPTX, PDF, one-pager and a contact sheet for the README.
 * Builds are byte-reproducible; CI fails if docs/showcase/ is stale (`npm run showcase`).
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDeck } from '../src/build.ts';
import { contactSheetPng } from '../src/gallery.ts';
import { ROOT } from '../src/paths.ts';

const deck = join(ROOT, 'examples/slidecraft-overview/deck.yaml');
const out = join(ROOT, 'docs/showcase');
const tmp = mkdtempSync(join(tmpdir(), 'sc-showcase-'));
try {
  const r = await buildDeck(deck, { outDir: tmp, formats: ['pptx', 'pdf', 'onepager'] });
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length) throw new Error(errors.map((d) => `${d.code} ${d.message}`).join('\n'));
  mkdirSync(out, { recursive: true });
  for (const f of r.files) copyFileSync(f.path, join(out, f.path.split('/').pop()!));
  writeFileSync(join(out, 'slidecraft-overview.png'), await contactSheetPng(r.scene!, 1600));
  console.log(`✔ ${r.files.length + 1} files in docs/showcase/`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
