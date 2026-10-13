/**
 * A theme from a sample: a reference deck or brand guide (PDF), a screenshot (PNG/JPEG) or a
 * website. Reads the colours (background, ink, accent, chart palette), the fonts and — from a
 * PDF or a picture — the margins, then writes theme JSON on top of a built-in theme, plus a
 * page format with the sample's margins. Fonts SlideCraft cannot measure are mapped to the
 * closest measurable family with a note, exactly as `theme import` does for .potx files.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rasterPixels } from '../backends/resvg.ts';
import { contrast, hexToRgb, luminance, mix, onColor } from '../engine/color.ts';
import { ROOT } from '../paths.ts';
import type { FormatFile } from '../spec/format.ts';
import { Theme, type ThemeInput } from '../spec/theme.ts';
import { getTheme } from './load.ts';
import type { PdfStyle } from './pdf-text.ts';
import { type ImportResult, mapFont, softTint } from './theme-import.ts';

export interface Swatch {
  hex: string;
  weight: number;
  role: 'background' | 'text' | 'fill' | 'brand';
}

/** What a sample tells us; every reader produces this, one derivation turns it into a theme. */
export interface SampleEvidence {
  kind: 'pdf' | 'image' | 'url';
  /** A photograph rather than a page: only its colours count. */
  photo?: boolean;
  swatches: Swatch[];
  fonts: { name: string; role: 'heading' | 'body'; weight: number }[];
  /** Content margins as fractions of the page width/height. */
  margins?: { l: number; r: number; t: number; b: number };
  aspect?: number;
  notes: string[];
}

// ---- colour helpers -------------------------------------------------------------------

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();

/** 0 for greys, up to 1 for pure hues. */
export function chroma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function hue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return -1;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const dist = (a: string, b: string) => {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** Merge near-identical colours (antialiasing, JPEG noise) into weighted clusters. */
export function cluster(sw: Swatch[], within = 28): Swatch[] {
  const out: Swatch[] = [];
  for (const s of [...sw].sort((a, b) => b.weight - a.weight)) {
    const hit = out.find((o) => o.role === s.role && dist(o.hex, s.hex) < within);
    if (hit) hit.weight += s.weight;
    else out.push({ ...s });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** Background, ink, accent and a chart palette from weighted swatches. */
export function derivePalette(swatches: Swatch[]) {
  const all = cluster(swatches);
  const by = (role: Swatch['role']) => all.filter((s) => s.role === role);
  const bgCands = by('background').length ? by('background') : all;
  const bg = bgCands[0]?.hex ?? '#FFFFFF';
  const textual = [...by('text'), ...all.filter((s) => s.role !== 'text')];
  const ink =
    textual.find((s) => contrast(s.hex, bg) >= 7 && chroma(s.hex) < 0.45)?.hex ??
    (luminance(bg) < 0.25 ? '#F5F7FA' : '#111111');
  // the accent: the most used colour with a clear hue that reads on the background
  const brand = by('brand').filter((s) => chroma(s.hex) >= 0.2);
  // candidates only need to stand apart from the page; legibility is fixed below
  const hued = all.filter(
    (s) => s.hex !== bg && chroma(s.hex) >= 0.25 && contrast(s.hex, bg) >= 1.3,
  );
  // the most present vivid colour: area counts, saturation more
  const vivid = [...hued].sort(
    (a, b) => b.weight * chroma(b.hex) ** 2 - a.weight * chroma(a.hex) ** 2,
  );
  let accent = brand[0]?.hex ?? vivid[0]?.hex ?? (luminance(bg) < 0.25 ? '#4DA3FF' : '#1F5FBF');
  // darken (or lighten on dark pages) until small text in the accent is legible (4.5:1)
  for (let i = 0; i < 16 && contrast(accent, bg) < 4.5; i++)
    accent = mix(accent, luminance(bg) < 0.25 ? '#FFFFFF' : '#000000', 0.12);
  const others = vivid
    .map((s) => s.hex)
    .filter((h) => h !== accent && Math.abs(hue(h) - hue(accent)) > 25)
    .filter((h, i, a) => a.findIndex((x) => dist(x, h) < 60) === i)
    .slice(0, 3);
  return { bg, ink, accent, others, clusters: all.slice(0, 12) };
}

// ---- readers -----------------------------------------------------------------------------

async function loadPdfStyle(): Promise<(d: Uint8Array) => Promise<PdfStyle>> {
  const bundled = join(ROOT, 'dist', 'pdf-text.mjs');
  const mod =
    import.meta.url.includes('/dist/') && existsSync(bundled)
      ? await import(pathToFileURL(bundled).href)
      : await import(['.', 'pdf-text.ts'].join('/'));
  return mod.pdfStyle;
}

/** "ABCDEF+ArialMT" → "Arial", "TimesNewRomanPS" → "Times New Roman", "OpenSans" → "Open Sans". */
export function fontFamilyName(raw: string): string {
  return raw
    .replace(/^[A-Z]{6}\+/, '')
    .replace(/(PSMT|PS|MT)$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

export async function readPdfSample(file: string): Promise<SampleEvidence> {
  const s = await (await loadPdfStyle())(new Uint8Array(readFileSync(file)));
  const page = s.page.w * s.page.h || 1;
  const swatches: Swatch[] = [
    ...s.fills.map((f, i) => ({
      hex: f.hex,
      // the largest fill is the page background
      weight: f.area / page,
      role: (i === 0 ? 'background' : 'fill') as Swatch['role'],
    })),
    ...s.text.map((t) => ({ hex: t.hex, weight: t.chars / 100, role: 'text' as const })),
  ];
  if (!s.fills.length) swatches.push({ hex: '#FFFFFF', weight: 1, role: 'background' });
  const fonts = s.fonts.map((f) => fontFamilyName(f.name));
  const big = [...s.fonts].sort((a, b) => b.maxSize - a.maxSize)[0];
  return {
    kind: 'pdf',
    swatches,
    fonts: [
      ...(big ? [{ name: fontFamilyName(big.name), role: 'heading' as const, weight: 1 }] : []),
      ...(fonts[0] ? [{ name: fonts[0], role: 'body' as const, weight: 1 }] : []),
    ],
    ...(s.margins ? { margins: s.margins } : {}),
    aspect: s.page.w / (s.page.h || 1),
    notes: [],
  };
}

/** Share of pixels within ±3 per channel of the most common exact colour. */
function flatShare(pixels: Uint8Array | Uint8ClampedArray): number {
  const count = new Map<number, number>();
  let n = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3]! < 128) continue;
    const k = (pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!;
    count.set(k, (count.get(k) ?? 0) + 1);
    n++;
  }
  let mode = 0;
  let best = 0;
  for (const [k, c] of count)
    if (c > best) {
      best = c;
      mode = k;
    }
  const [r, g, b] = [mode >> 16, (mode >> 8) & 255, mode & 255];
  let near = 0;
  for (let i = 0; i < pixels.length; i += 4)
    if (
      pixels[i + 3]! >= 128 &&
      Math.abs(pixels[i]! - r) <= 3 &&
      Math.abs(pixels[i + 1]! - g) <= 3 &&
      Math.abs(pixels[i + 2]! - b) <= 3
    )
      near++;
  return n ? near / n : 0;
}

export async function readImageSample(file: string): Promise<SampleEvidence> {
  const data = readFileSync(file);
  const mime = /\.png$/i.test(file)
    ? 'image/png'
    : /\.webp$/i.test(file)
      ? 'image/webp'
      : 'image/jpeg';
  // the picture is stretched into a 16:9 frame: colours and margin fractions are unchanged
  const W = 640;
  const H = 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}"><image width="${W}" height="${H}" preserveAspectRatio="none" xlink:href="data:${mime};base64,${data.toString('base64')}"/></svg>`;
  const { width, height, pixels } = await rasterPixels(svg, W);
  // 5-bit buckets per channel merge noise; each bucket reports its pixels' mean colour
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3]! < 128) continue;
    const [r, g, b] = [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    buckets.set(key, e);
  }
  const total = width * height;
  const list = [...buckets.values()].map((e) => ({
    hex: toHex(e.r / e.n, e.g / e.n, e.b / e.n),
    weight: e.n / total,
  }));
  const top = cluster(list.map((s) => ({ ...s, role: 'fill' as const })))[0]!;
  const bg = top.hex;
  // content box: pixels that differ clearly from the background
  let [l, r, t, b] = [width, 0, height, 0];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const d = dist(toHex(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!), bg);
      if (d > 60) {
        l = Math.min(l, x);
        r = Math.max(r, x);
        t = Math.min(t, y);
        b = Math.max(b, y);
      }
    }
  // A slide or page screenshot has one flat background covering much of it; a photograph
  // does not. From a photo only the colours are taken — the page stays light and readable.
  // A dark, muted photo can still fall into one colour cluster, so flatness decides too:
  // a screenshot's background is one exact colour (≥ 0.5 of the pixels within ±3, even as a
  // JPEG), a photograph's most common colour covers under 0.1.
  if (top.weight < 0.35 || flatShare(pixels) < 0.15)
    return {
      kind: 'image',
      photo: true,
      swatches: [
        ...list.map((s) => ({ ...s, role: 'fill' as const })),
        { hex: '#FFFFFF', weight: 1e6, role: 'background' as const },
      ],
      fonts: [],
      notes: [
        'The sample is a photograph: its colours give the accent and chart palette; the page background and text stay light and dark.',
        'Fonts cannot be read from a picture — pass --heading-font / --body-font, or keep the base theme fonts.',
      ],
    };
  const darkOnLight = luminance(bg) >= 0.25;
  return {
    kind: 'image',
    swatches: list.map((s) => ({
      ...s,
      role:
        dist(s.hex, bg) < 28
          ? 'background'
          : contrast(s.hex, bg) >= 7 &&
              chroma(s.hex) < 0.3 &&
              darkOnLight === luminance(s.hex) < 0.25
            ? 'text'
            : 'fill',
    })),
    fonts: [],
    // margins only when the content sits inside a frame (a slide screenshot), not a photo
    ...(r > l && Math.min(l / width, 1 - r / width, t / height, 1 - b / height) > 0.02
      ? { margins: { l: l / width, r: 1 - r / width, t: t / height, b: 1 - b / height } }
      : {}),
    notes: [
      'Fonts cannot be read from a picture — pass --heading-font / --body-font, or keep the base theme fonts.',
    ],
  };
}

const COLOR =
  /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;

function cssHex(v: string): string | undefined {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(v);
  if (m) return Number(m[4] ?? 1) < 0.5 ? undefined : toHex(+m[1]!, +m[2]!, +m[3]!);
  const h = v.replace('#', '');
  if (h.length === 3) return `#${[...h].map((c) => c + c).join('')}`.toUpperCase();
  return `#${h}`.toUpperCase();
}

/** Colours and fonts declared by a web page's CSS (inline styles, <style> and linked sheets). */
export function readCss(css: string, themeColor?: string): Omit<SampleEvidence, 'kind' | 'notes'> {
  const swatches: Swatch[] = [];
  const fonts: SampleEvidence['fonts'] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = rule[1]!.trim().toLowerCase();
    const isRoot = /(^|[\s,])(html|body|:root)\b/.test(sel);
    const isHeading = /\bh[1-3]\b|title|heading|hero/.test(sel);
    for (const d of rule[2]!.matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)) {
      const prop = d[1]!.toLowerCase();
      const value = d[2]!;
      if (prop === 'font-family') {
        const name = value
          .split(',')
          .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
          .find(
            (f) =>
              f &&
              !/^(var\(|inherit|initial|sans-serif|serif|monospace|system-ui|-apple-system|blinkmacsystemfont|ui-)/i.test(
                f,
              ),
          );
        if (name)
          fonts.push({ name, role: isHeading ? 'heading' : 'body', weight: isRoot ? 5 : 1 });
        continue;
      }
      for (const c of value.match(COLOR) ?? []) {
        const hex = cssHex(c);
        if (!hex) continue;
        const role: Swatch['role'] = /^background/.test(prop)
          ? isRoot
            ? 'background'
            : 'fill'
          : prop === 'color'
            ? 'text'
            : prop.startsWith('--') && /brand|primary|accent/.test(prop)
              ? 'brand'
              : 'fill';
        swatches.push({ hex, role, weight: isRoot ? 5 : 1 });
      }
    }
  }
  if (themeColor) {
    const hex = cssHex(themeColor);
    if (hex) swatches.push({ hex, role: 'brand', weight: 10 });
  }
  if (!swatches.some((s) => s.role === 'background'))
    swatches.push({ hex: '#FFFFFF', role: 'background', weight: 3 });
  return { swatches, fonts };
}

export async function readUrlSample(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SampleEvidence> {
  const get = async (u: string) => {
    const res = await fetchImpl(u, { headers: { 'user-agent': 'SlideCraft theme sampler' } });
    if (!res.ok) throw new Error(`${u}: HTTP ${res.status}`);
    return res.text();
  };
  const html = await get(url);
  const sheets = [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)]
    .map((m) => /href=["']([^"']+)["']/i.exec(m[0])?.[1])
    .filter((h): h is string => !!h)
    .slice(0, 6);
  let css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  css += [...html.matchAll(/<(body|html|h[1-3])\b[^>]*style=["']([^"']+)["']/gi)]
    .map((m) => `${m[1]}{${m[2]}}`)
    .join('\n');
  const notes: string[] = [];
  for (const href of sheets) {
    try {
      css += `\n${await get(new URL(href, url).href)}`;
    } catch (e) {
      notes.push(`stylesheet skipped: ${(e as Error).message}`);
    }
  }
  const themeColor = /<meta\b[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i.exec(
    html,
  )?.[1];
  return { kind: 'url', ...readCss(css, themeColor), notes };
}

// ---- theme ---------------------------------------------------------------------------------

export async function themeFromSample(
  input: string,
  opts: {
    id: string;
    name?: string;
    out?: string;
    fontDir?: string;
    headingFont?: string;
    bodyFont?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<ImportResult & { evidence: SampleEvidence }> {
  const isUrl = /^https?:\/\//i.test(input);
  const ev = isUrl
    ? await readUrlSample(input, opts.fetchImpl)
    : /\.pdf$/i.test(input)
      ? await readPdfSample(resolve(input))
      : /\.(png|jpe?g|webp)$/i.test(input)
        ? await readImageSample(resolve(input))
        : (() => {
            throw new Error(`unsupported sample ${input}: use a PDF, PNG/JPEG or an http(s) URL`);
          })();
  const notes = [...ev.notes];
  const derived = derivePalette(ev.swatches);
  const { bg, accent, others } = derived;
  const dark = luminance(bg) < 0.25;
  const base = getTheme(dark ? 'midnight' : 'consulting-classic')!;
  // a photo has no text colour of its own
  const ink = ev.photo ? base.colors.ink : derived.ink;
  let muted = mix(ink, bg, 0.42);
  if (contrast(muted, bg) < 4.5) muted = mix(ink, bg, 0.3);
  const top = (role: 'heading' | 'body') =>
    [...ev.fonts].filter((f) => f.role === role).sort((a, b) => b.weight - a.weight)[0]?.name;
  const headingName = opts.headingFont ?? top('heading') ?? top('body');
  const bodyName = opts.bodyFont ?? top('body') ?? top('heading');
  const heading = headingName
    ? mapFont(headingName, opts.fontDir, opts.id, 'heading', notes)
    : base.fonts.heading;
  const body = bodyName ? mapFont(bodyName, opts.fontDir, opts.id, 'body', notes) : base.fonts.body;
  if (!headingName && !bodyName) notes.push(`No fonts in the sample — kept ${base.name} fonts.`);
  const needsCyr = [heading, body].some((f) => f.measure === 'gelasio');
  const chart = [
    accent,
    ...others,
    ink,
    mix(accent, bg, 0.45),
    mix(ink, bg, 0.55),
    mix(accent, bg, 0.72),
  ].slice(0, 6);
  const source = isUrl ? input : basename(input);
  const theme: ThemeInput = {
    ...(base as ThemeInput),
    id: opts.id,
    name: opts.name ?? opts.id.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
    description: `Theme sampled from ${source}: its colours${headingName ? ', fonts' : ''}${ev.margins ? ' and margins' : ''} on the ${base.name} layout rules.`,
    mood: ['sampled'],
    dark,
    colors: {
      background: bg,
      surface: mix(accent, bg, dark ? 0.88 : 0.95),
      ink,
      muted,
      accent,
      accentText: onColor(accent),
      accentSoft: softTint(accent, bg, ink, muted),
      rule: mix(ink, bg, 0.78),
      positive: base.colors.positive,
      negative: base.colors.negative,
      titleInk: ink,
    },
    chart,
    fonts: {
      heading,
      body,
      ...(needsCyr
        ? { cyrillic: { heading: { family: 'Times New Roman', measure: 'liberation-serif' } } }
        : {}),
    },
    decor: { ...base.decor, colors: [accent] },
    source: `sampled from ${source}`,
  };
  delete (theme as { template?: string }).template;
  delete (theme as { officeTheme?: string }).officeTheme;
  if (contrast(accent, bg) < 4.5)
    notes.push(
      `accent ${accent} reads as large text only (contrast ${contrast(accent, bg).toFixed(1)}:1 on ${bg}).`,
    );

  Theme.parse(theme); // a sampled theme is a valid theme, or nothing is written
  const outDir = resolve(opts.out ?? 'slidecraft-theme');
  mkdirSync(outDir, { recursive: true });
  const themePath = join(outDir, `${opts.id}.json`);
  writeFileSync(themePath, `${JSON.stringify(theme, null, 2)}\n`);

  // spacing: the sample's margins on a slide of the same proportions
  let formatPath: string | undefined;
  if (ev.margins && ev.kind !== 'url') {
    const aspect = ev.aspect ?? 16 / 9;
    const w = Math.abs(aspect - 4 / 3) < 0.05 ? 10 : 13.333;
    const h = +(w / aspect).toFixed(3);
    const m = ev.margins;
    const clamp = (v: number, max: number) => +Math.min(max, Math.max(0.3, v)).toFixed(3);
    const fmt: FormatFile = {
      schemaVersion: 1,
      id: `${opts.id}-frame`,
      name: `${opts.name ?? opts.id} margins`,
      w,
      h,
      margin: {
        l: clamp(m.l * w, 1.6),
        r: clamp(m.r * w, 1.6),
        t: clamp(m.t * h - 0.1, 1.2),
        b: clamp(m.b * h, 1.2),
      },
      source: `margins of ${source}`,
    };
    formatPath = join(outDir, `${opts.id}.format.json`);
    writeFileSync(formatPath, `${JSON.stringify(fmt, null, 2)}\n`);
    notes.push(
      `Margins ${fmt.margin.l}/${fmt.margin.r}/${fmt.margin.t}/${fmt.margin.b} in (l/r/t/b) — set "format: ${basename(formatPath)}" (path relative to the deck) to use them.`,
    );
  }
  return { theme, themePath, ...(formatPath ? { formatPath } : {}), notes, evidence: ev };
}
