import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { rankCoverArt } from '../src/layouts/cover-art.ts';
import { chooseCover, coverOptions } from '../src/library/covers.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const deckYaml = `schemaVersion: 1
id: c
title: Covers
theme: consulting-classic
slides:
  - id: cover
    layout: title
    variant: cover
    title: An AI platform lets the claims team grow revenue without new hires
    kicker: Steering committee
    image: assets/missing.jpg
    imageQuery: claims office
`;

describe('cover options', () => {
  it('ranks motifs by the words of the deck', () => {
    const r = rankCoverArt('An AI platform lets the claims team grow revenue');
    expect(r[0]!.score).toBeGreaterThan(0);
    expect(
      r
        .slice(0, 2)
        .map((x) => x.art)
        .sort(),
    ).toEqual(['growth', 'network']);
  });

  it('renders two to three options and writes the chosen one into deck.yaml', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-covers-'));
    dirs.push(dir);
    const deck = join(dir, 'deck.yaml');
    writeFileSync(deck, deckYaml);
    const r = await coverOptions(deck);
    expect(r.options.length).toBeGreaterThanOrEqual(2);
    expect(r.options.length).toBeLessThanOrEqual(3);
    expect(r.options.every((o) => existsSync(o.preview))).toBe(true);
    expect(existsSync(r.picker)).toBe(true);
    expect(r.options[0]!.facts.topicWords?.length).toBeGreaterThan(0);
    const b = chooseCover(deck, 'B');
    const yaml = readFileSync(deck, 'utf8');
    expect(yaml).toContain(`art: ${b.fields.art}`);
    expect(yaml).not.toContain('imageQuery');
    expect(yaml).not.toContain('image:');
  });
});
