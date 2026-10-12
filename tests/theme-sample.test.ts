import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { contrast } from '../src/engine/color.ts';
import {
  derivePalette,
  fontFamilyName,
  readCss,
  themeFromSample,
} from '../src/library/theme-sample.ts';
import { Theme } from '../src/spec/theme.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'sc-sample-'));
  dirs.push(d);
  return d;
};

describe('theme from a sample', () => {
  it('reads colours and fonts from CSS, with the brand variable and theme-color first', () => {
    const ev = readCss(
      `:root{--brand-primary:#E4572E} body{background:#FAFAF7;color:#1B1B1B;font-family:"Source Sans Pro",Arial,sans-serif}
       h1,h2{font-family:Merriweather,Georgia,serif;color:#222} .btn{background:#E4572E;border:1px solid rgba(0,0,0,.1)}`,
      '#E4572E',
    );
    const p = derivePalette(ev.swatches);
    expect(p.bg).toBe('#FAFAF7');
    expect(p.ink).toBe('#1B1B1B');
    expect(contrast(p.accent, p.bg)).toBeGreaterThanOrEqual(3);
    expect(ev.fonts.find((f) => f.role === 'heading')?.name).toBe('Merriweather');
    expect(ev.fonts.find((f) => f.role === 'body')?.name).toBe('Source Sans Pro');
  });

  it('names fonts the way people write them', () => {
    expect(fontFamilyName('ABCDEF+ArialMT')).toBe('Arial');
    expect(fontFamilyName('TimesNewRomanPSMT')).toBe('Times New Roman');
    expect(fontFamilyName('OpenSans')).toBe('Open Sans');
  });

  it('builds a valid theme and margins from a reference PDF', async () => {
    const out = tmp();
    const r = await themeFromSample('docs/showcase/fde-engineer/en/fde-engineer-en.pdf', {
      id: 'from-pdf',
      out,
    });
    const t = Theme.parse(JSON.parse(readFileSync(r.themePath, 'utf8')));
    expect(t.colors.background).toBe('#FFFFFF');
    expect(t.colors.accent).toBe('#1F5FBF');
    expect(t.colors.ink).toBe('#0B1F3A');
    expect(t.fonts.body.family).toBe('Arial');
    const fmt = JSON.parse(readFileSync(r.formatPath!, 'utf8'));
    expect(fmt.w).toBeCloseTo(13.333);
    expect(fmt.margin.l).toBeGreaterThan(0.4);
    expect(fmt.margin.l).toBeLessThan(0.8);
  });

  it('samples a slide screenshot: background, accent and content margins', async () => {
    const out = tmp();
    const { rasterize } = await import('../src/backends/resvg.ts');
    const { writeFileSync } = await import('node:fs');
    // a white 16:9 page, a teal bar and dark text set 10 % in from each side
    const png = join(out, 'shot.png');
    writeFileSync(
      png,
      await rasterize(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#FFFFFF"/><rect x="160" y="90" width="1280" height="40" fill="#0E7C7B"/><rect x="160" y="200" width="900" height="60" fill="#14213D"/><rect x="160" y="740" width="1280" height="70" fill="#E5ECEC"/></svg>',
        1600,
      ),
    );
    const r = await themeFromSample(png, { id: 'from-png', out, bodyFont: 'Georgia' });
    const t = Theme.parse(JSON.parse(readFileSync(r.themePath, 'utf8')));
    expect(t.colors.background).toBe('#FFFFFF');
    expect(t.colors.ink).toBe('#14213D');
    expect(contrast(t.colors.accent, t.colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(t.fonts.body.family).toBe('Georgia');
    const fmt = JSON.parse(readFileSync(r.formatPath!, 'utf8'));
    expect(fmt.margin.l).toBeCloseTo(1.333, 1);
  });

  it('takes only the colours of a photograph', async () => {
    const out = tmp();
    const r = await themeFromSample('examples/fde-engineer-en-v2/assets/cover.jpg', {
      id: 'from-photo',
      out,
    });
    expect(r.evidence.photo).toBe(true);
    expect(r.theme.colors.background).toBe('#FFFFFF');
    expect(r.formatPath).toBeUndefined();
  });

  it('samples a website with its linked stylesheet', async () => {
    const out = tmp();
    const pages: Record<string, string> = {
      'https://brand.example/':
        '<html><head><meta name="theme-color" content="#0A7E5A"><link rel="stylesheet" href="/s.css"></head><body></body></html>',
      'https://brand.example/s.css':
        'body{background:#ffffff;color:#101820;font-family:Helvetica,sans-serif}',
    };
    const fetchImpl = (async (u: string) =>
      ({ ok: true, text: async () => pages[u] ?? '' }) as Response) as typeof fetch;
    const r = await themeFromSample('https://brand.example/', { id: 'from-url', out, fetchImpl });
    expect(r.theme.colors.accent).toBe('#0A7E5A');
    expect(r.theme.colors.ink).toBe('#101820');
    expect(r.theme.fonts.body.family).toBe('Arial');
    expect(r.formatPath).toBeUndefined();
  });
});
