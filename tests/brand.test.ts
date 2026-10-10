import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDeck } from '../src/build.ts';
import { installCodex } from '../src/cli/codex.ts';
import { scaffoldDeck } from '../src/cli/workflow.ts';
import { fontPath, registerMeasureFont, textWidthPt } from '../src/engine/fonts.ts';
import { loadBrief, readThemeFile } from '../src/library/load.ts';
import { importTheme } from '../src/library/theme-import.ts';
import { buildCalibrationScene } from '../src/qa/calibrate.ts';
import { Theme } from '../src/spec/theme.ts';

const FIXTURE = join(import.meta.dirname, 'fixtures/skeleton/deck.yaml');

describe('brand import', () => {
  it('turns a PPTX into a valid, loadable theme', async () => {
    const out = mkdtempSync(join(tmpdir(), 'sc-brand-'));
    const built = await buildDeck(FIXTURE, { outDir: out, formats: ['pptx'] });
    const pptx = built.files[0]!.path;
    const r = await importTheme(pptx, { id: 'acme', out: join(out, 'theme') });
    expect(Theme.safeParse(JSON.parse(readFileSync(r.themePath, 'utf8'))).success).toBe(true);
    const t = readThemeFile(r.themePath);
    expect(t.id).toBe('acme');
    expect(t.colors.accent).toMatch(/^#[0-9A-F]{6}$/);
    expect(t.chart.length).toBeGreaterThanOrEqual(4);
  });

  it('measures a brand font registered from files exactly like the file it points to', () => {
    registerMeasureFont('brand-test', {
      regular: fontPath('liberation-sans', 'regular'),
      bold: fontPath('liberation-sans', 'bold'),
    });
    expect(textWidthPt('brand-test', 'regular', 14, 'Partner-led entry')).toBeCloseTo(
      textWidthPt('liberation-sans', 'regular', 14, 'Partner-led entry'),
      6,
    );
    // missing italic falls back to regular
    expect(textWidthPt('brand-test', 'italic', 14, 'x')).toBeCloseTo(
      textWidthPt('brand-test', 'regular', 14, 'x'),
      6,
    );
  });

  it('builds a calibration scene for a theme font set', () => {
    const { scene, cases } = buildCalibrationScene([
      { family: 'Arial', measure: 'liberation-sans' },
    ]);
    expect(scene.slides.length).toBe(6);
    expect(cases.length).toBeGreaterThan(40);
  });
});

describe('workflow fixes from live runs', () => {
  it('scaffold respects the brief slide budget, breadth first', () => {
    const { brief } = loadBrief(
      join(import.meta.dirname, '../examples/strategy-recommendation/brief.yaml'),
    );
    const deck = scaffoldDeck(
      { ...brief!, length: { slides: 5 } },
      'strategy-recommendation',
      'consulting-classic',
    ) as { slides: { id: string }[] };
    expect(deck.slides.map((s) => s.id)).toEqual(['cover', 'summary', 'context', 'options', 'ask']);
  });

  it('installs Codex skills with absolute paths and no Claude-only frontmatter', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sc-codex-'));
    const written = installCodex(dir);
    expect(written.length).toBe(7);
    const main = readFileSync(join(dir, 'slidecraft', 'SKILL.md'), 'utf8');
    expect(main).not.toContain('{{SLIDECRAFT_ROOT}}');
    expect(main).toContain('/dist/slidecraft.mjs');
    const spec = readFileSync(join(dir, 'slidecraft-deck-spec', 'SKILL.md'), 'utf8');
    expect(spec).toMatch(/^---\nname: slidecraft-deck-spec\n/);
    expect(spec).not.toContain('${CLAUDE_PLUGIN_ROOT}');
    expect(existsSync(join(dir, 'slidecraft', 'agents', 'openai.yaml'))).toBe(true);
  });
});
