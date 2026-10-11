import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { rasterize } from '../src/backends/resvg.ts';

for (const name of ['slide-constructor', 'render-and-verify']) {
  it(`keeps ${name} in English with an accessible SVG and a renderable preview`, async () => {
    const dir = join(import.meta.dirname, '../docs/assets/architecture');
    const html = readFileSync(join(dir, `${name}.html`), 'utf8');
    const svg = readFileSync(join(dir, `${name}.svg`), 'utf8');
    expect(html).toContain('lang="en"');
    expect(html).not.toMatch(/[А-Яа-яЁё]/);
    expect(svg).not.toMatch(/[А-Яа-яЁё]/);
    expect(svg).toContain('role="img"');
    expect(svg).toContain(`aria-labelledby="${name}-title ${name}-desc"`);
    const png = await rasterize(svg, 1280);
    const out = join(import.meta.dirname, '.output/architecture');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, `${name}.png`), png);
    expect(png.length).toBeGreaterThan(10000);
  });
}

for (const name of ['deck-workflow', 'quality-stages', 'calibration-loop', 'office-text-rules']) {
  it(`keeps workflow diagram ${name} in English, accessible and renderable`, async () => {
    const svg = readFileSync(
      join(import.meta.dirname, '../docs/assets/workflow', `${name}.svg`),
      'utf8',
    );
    expect(svg).not.toMatch(/[А-Яа-яЁё]/);
    expect(svg).toContain('role="img"');
    expect(svg).toContain(`aria-labelledby="${name}-title ${name}-desc"`);
    const png = await rasterize(svg, 1280);
    expect(png.length).toBeGreaterThan(10000);
  });
}
