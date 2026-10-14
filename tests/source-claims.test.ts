import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDeck } from '../src/build.ts';

/** A final deck with one table slide and no sources; returns the source diagnostics it gets. */
function sourceCodes(rows: string[][]): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'sc-src-'));
  const deck = join(dir, 'deck.yaml');
  writeFileSync(
    deck,
    `schemaVersion: 1
id: source-claims
title: Five checks expose the gaps that polished slides can hide
theme: consulting-classic
status: final
language: en
slides:
  - id: checks
    layout: data-table
    title: Five checks expose the gaps that polished slides can hide
    header: [Check, Reject when]
    rows: ${JSON.stringify([...rows, ['Owner', 'The COO signs off']])}
`,
  );
  const { diagnostics } = checkDeck(deck);
  // the deck itself must be valid, or an empty result would prove nothing
  expect(diagnostics.filter((d) => d.severity === 'error' && !d.code.startsWith('SC-SRC'))).toEqual(
    [],
  );
  return diagnostics.filter((d) => d.code.startsWith('SC-SRC-00')).map((d) => d.code);
}

// Found in a ChatGPT agent-mode run: numbered checklist labels were taken for data, and the
// agent attached an unrelated source to silence the check.
describe('numbers that order things are not claims (SC-SRC-001/002)', () => {
  it('ignores list indices and step, phase or week numbers', () => {
    expect(
      sourceCodes([
        ['1 · Decision', 'The ask has no accountable owner'],
        ['2. Storyline', 'Titles list topics'],
        ['(3) Evidence', 'Step 2 of the review has no source'],
        ['Phase 4', 'Неделя 5: этап 2 без владельца'],
      ]),
    ).toEqual([]);
  });

  it('still asks for a source for figures', () => {
    expect(sourceCodes([['1 · Decision', 'Cuts writing time by 40%']])).toEqual(['SC-SRC-002']);
    expect(sourceCodes([['Week 12', '42 weekly users']])).toEqual(['SC-SRC-002']);
    expect(sourceCodes([['Revenue', '$69k']])).toEqual(['SC-SRC-002']);
    expect(sourceCodes([['Phase 2.5', 'Budget review']])).toEqual(['SC-SRC-002']);
  });
});
