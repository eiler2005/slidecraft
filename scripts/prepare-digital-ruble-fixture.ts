/** Explicit one-time registration. Never run automatically during a test. */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { pptxInventory } from './lib/deck-regression.ts';

const [original, deckDir, historicalHtml] = process.argv.slice(2);
if (!original || !deckDir || !historicalHtml)
  throw new Error(
    'Usage: tsx scripts/prepare-digital-ruble-fixture.ts ORIGINAL.pptx DECK_DIRECTORY HISTORICAL.html',
  );
const out = resolve('tests/fixtures/digital-ruble');
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const pptx = readFileSync(original);
const inventory = await pptxInventory(pptx);
const html = readFileSync(historicalHtml, 'utf8');
// SFNS is a locally licensed system font, not a redistributable test asset.
const reference = html.replace(/@font-face\{font-family:"System Font";[^}]+\}/g, (rule) =>
  rule.replace(/src:url\([^)]*\)/, 'src:url(file:///System/Library/Fonts/SFNS.ttf)'),
);
if (reference === html)
  throw new Error(
    'Expected historical System Font embedding was not found; inspect before registering',
  );
mkdirSync(join(out, 'sections'), { recursive: true });
mkdirSync(join(out, 'theme'), { recursive: true });
copyFileSync(original, join(out, 'Digital_Ruble_Explainer_RU_v3.pptx'));
writeFileSync(join(out, 'reference.html'), reference);
for (const file of ['core.yaml', 'international.yaml', 'appendix.yaml'])
  copyFileSync(join(deckDir, 'sections', file), join(out, 'sections', file));
copyFileSync(join(deckDir, 'theme/public-tech.json'), join(out, 'theme/public-tech.json'));
const deck = YAML.parse(readFileSync(join(deckDir, 'redesign.yaml'), 'utf8'));
// No user-specific iCloud paths; this fixture's authoritative source is the original PPTX.
for (const source of deck.sources ?? [])
  if (source.file) source.file = 'Digital_Ruble_Explainer_RU_v3.pptx';
writeFileSync(join(out, 'deck.yaml'), YAML.stringify(deck, { lineWidth: 0 }));
const manifest = {
  schemaVersion: 1,
  id: 'digital-ruble',
  slides: inventory.length,
  original: { file: 'Digital_Ruble_Explainer_RU_v3.pptx', sha256: sha(pptx) },
  reference: {
    file: 'reference.html',
    sha256: sha(reference),
    historicalSha256: sha(html),
    transformation:
      'Only embedded System Font font-face URLs replaced with local SFNS.ttf; no text, geometry or styling changed.',
  },
  candidate: 'deck.yaml',
  target: 0.95,
  consent:
    'Owner explicitly authorised storing the original and regression fixture in Git on 2026-10-11.',
  fontRequirements: [
    'Local macOS /System/Library/Fonts/SFNS.ttf',
    'Original PPTX uses locally installed Office fonts; inspect the report.',
  ],
};
writeFileSync(join(out, 'baseline.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify({
    registered: out,
    slides: inventory.length,
    originalSha256: sha(pptx),
    referenceSha256: sha(reference),
  }),
);
