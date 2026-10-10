/**
 * Brand import: build a SlideCraft theme from a customer's .pptx / .potx.
 *
 * Reads the Office theme (colour scheme, major/minor fonts) and the master's images
 * (largest raster = logo). Fonts SlideCraft can measure are mapped directly; other brand
 * fonts are used when their files are supplied (`--font-dir`), otherwise mapped to the
 * closest measurable family with a note. The result is plain theme JSON you can edit.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import * as fontkit from 'fontkit';
import JSZip from 'jszip';
import { contrast, luminance, mix, onColor } from '../engine/color.ts';
import type { FontSpec, ThemeInput } from '../spec/theme.ts';

export interface ImportResult {
  theme: ThemeInput;
  themePath: string;
  logo?: string;
  notes: string[];
}

const COLOR_KEYS = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
] as const;

function readColors(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of COLOR_KEYS) {
    const m = new RegExp(`<a:${k}>([\\s\\S]*?)</a:${k}>`).exec(xml);
    if (!m) continue;
    const srgb = /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(m[1]!);
    const sys = /<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/.exec(m[1]!);
    const v = srgb?.[1] ?? sys?.[1];
    if (v) out[k] = `#${v.toUpperCase()}`;
  }
  return out;
}

function readFonts(xml: string): { major?: string; minor?: string } {
  const major = /<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/.exec(xml)?.[1];
  const minor = /<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"/.exec(xml)?.[1];
  return { ...(major ? { major } : {}), ...(minor ? { minor } : {}) };
}

const SANS =
  /arial|helvetica|liberation sans|arimo|segoe|calibri|aptos|roboto|open sans|inter|lato|source sans|gill|verdana|tahoma|futura|avenir|frutiger|univers|din/i;
const SERIF_GEORGIA =
  /georgia|gelasio|cambria|garamond|palatino|book antiqua|charter|merriweather|playfair/i;
const SERIF_TIMES = /times|liberation serif|tinos/i;

/** Map a brand font to a measurable spec, using supplied font files when they match. */
function mapFont(
  name: string | undefined,
  fontDir: string | undefined,
  themeId: string,
  role: string,
  notes: string[],
): FontSpec {
  if (!name) return { family: 'Arial', measure: 'liberation-sans' };
  if (/^(arial|helvetica)$/i.test(name)) return { family: 'Arial', measure: 'liberation-sans' };
  if (/^georgia$/i.test(name)) return { family: 'Georgia', measure: 'gelasio' };
  if (/^times( new roman)?$/i.test(name))
    return { family: 'Times New Roman', measure: 'liberation-serif' };
  if (fontDir && existsSync(fontDir)) {
    const files: Record<string, string> = {};
    for (const f of readdirSync(fontDir)) {
      if (!/\.(ttf|otf)$/i.test(f)) continue;
      try {
        const fk = fontkit.openSync(join(fontDir, f)) as fontkit.Font;
        if (fk.familyName.toLowerCase() !== name.toLowerCase()) continue;
        const sub = fk.subfamilyName.toLowerCase();
        const face =
          /bold/.test(sub) && /italic|oblique/.test(sub)
            ? 'boldItalic'
            : /bold/.test(sub)
              ? 'bold'
              : /italic|oblique/.test(sub)
                ? 'italic'
                : /regular|book|normal|roman/.test(sub)
                  ? 'regular'
                  : undefined;
        if (face && !files[face]) files[face] = join(fontDir, f);
      } catch {
        // not a font
      }
    }
    if (files.regular) {
      notes.push(
        `${role} font "${name}" measured from your font files — run \`slidecraft calibrate --theme ${themeId}\` once to confirm line breaks match PowerPoint.`,
      );
      return {
        family: name,
        measure: `${themeId}-${role}`.replace(/[^a-z0-9-]/g, '-'),
        files: files as FontSpec['files'] & { regular: string },
      };
    }
  }
  const fallback: FontSpec = SERIF_TIMES.test(name)
    ? { family: 'Times New Roman', measure: 'liberation-serif' }
    : SERIF_GEORGIA.test(name)
      ? { family: 'Georgia', measure: 'gelasio' }
      : { family: 'Arial', measure: 'liberation-sans' };
  notes.push(
    `${role} font "${name}" is not measurable without its files — mapped to ${fallback.family}${SANS.test(name) || SERIF_GEORGIA.test(name) || SERIF_TIMES.test(name) ? '' : ' (closest guess)'}. Pass --font-dir with the brand TTF/OTF files to use it exactly.`,
  );
  return fallback;
}

/** The largest raster image referenced by slide masters/layouts — usually the logo. */
async function findLogo(zip: JSZip): Promise<{ name: string; data: Uint8Array } | undefined> {
  const rels = Object.keys(zip.files).filter((n) =>
    /^ppt\/(slideMasters|slideLayouts)\/_rels\/.*\.rels$/.test(n),
  );
  const targets = new Set<string>();
  for (const r of rels) {
    const xml = await zip.file(r)!.async('string');
    for (const m of xml.matchAll(/Target="\.\.\/media\/([^"]+\.(png|jpe?g))"/gi))
      targets.add(`ppt/media/${m[1]}`);
  }
  let best: { name: string; data: Uint8Array } | undefined;
  for (const t of targets) {
    const f = zip.file(t);
    if (!f) continue;
    const data = await f.async('uint8array');
    // logos are small; full-slide background photos are not logos
    if (data.length > 1_500_000) continue;
    if (!best || data.length > best.data.length) best = { name: basename(t), data };
  }
  return best;
}

export async function importTheme(
  file: string,
  opts: { id: string; name?: string; out?: string; fontDir?: string },
): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(readFileSync(file));
  const themeName =
    Object.keys(zip.files).find((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n)) ??
    'ppt/theme/theme1.xml';
  const xml = await zip.file(themeName)?.async('string');
  if (!xml) throw new Error(`${file} has no Office theme (ppt/theme/theme1.xml)`);
  const c = readColors(xml);
  const fonts = readFonts(xml);
  const notes: string[] = [];
  const outDir = resolve(opts.out ?? join(dirname(resolve(file)), 'slidecraft-theme'));
  mkdirSync(outDir, { recursive: true });

  const bg = c.lt1 ?? '#FFFFFF';
  const dark = luminance(bg) < 0.25;
  const ink = c.dk1 ?? '#111111';
  const accent = c.accent1 ?? '#1F5FBF';
  const titleInk = c.dk2 && contrast(c.dk2, bg) >= 4.5 ? c.dk2 : ink;
  const accents = [c.accent1, c.accent2, c.accent3, c.accent4, c.accent5, c.accent6].filter(
    (x): x is string => !!x,
  );
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return -1;
    const d = max - min;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const positive =
    accents.find((a) => hue(a) > 90 && hue(a) < 170 && contrast(a, bg) >= 3) ??
    (dark ? '#4CC38A' : '#2E7D5B');
  const negative =
    accents.find((a) => (hue(a) < 20 || hue(a) > 340) && hue(a) >= 0 && contrast(a, bg) >= 3) ??
    (dark ? '#FF6B6B' : '#B23A3A');
  let muted = mix(ink, bg, 0.42);
  if (contrast(muted, bg) < 4.5) muted = mix(ink, bg, 0.3);

  const heading = mapFont(fonts.major, opts.fontDir, opts.id, 'heading', notes);
  const body = mapFont(fonts.minor ?? fonts.major, opts.fontDir, opts.id, 'body', notes);
  const needsCyr = [heading, body].some((f) => f.measure === 'gelasio');

  const logo = await findLogo(zip);
  let logoRel: string | undefined;
  if (logo) {
    const name = `${opts.id}-logo${extname(logo.name).toLowerCase()}`;
    writeFileSync(join(outDir, name), logo.data);
    logoRel = `./${name}`;
  } else
    notes.push(
      'No raster logo found on the slide masters — add "chrome.logo" by hand if you have one.',
    );

  // copy brand font files next to the theme so the theme folder is portable
  for (const spec of [heading, body]) {
    if (!spec.files) continue;
    for (const [face, p] of Object.entries(spec.files)) {
      const dest = join(outDir, basename(p));
      if (resolve(p) !== dest) copyFileSync(p, dest);
      (spec.files as Record<string, string>)[face] = `./${basename(p)}`;
    }
  }

  const theme: ThemeInput = {
    schemaVersion: 1,
    id: opts.id,
    name: opts.name ?? opts.id.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
    description: `Brand theme imported from ${basename(file)}.`,
    bestFor: ['client-proposal', 'executive-update', 'strategy-recommendation'],
    mood: ['brand'],
    dark,
    prefers: 'pptx',
    colors: {
      background: bg,
      surface: mix(c.lt2 ?? mix(accent, bg, 0.9), bg, 0.55),
      ink,
      muted,
      accent,
      accentText: onColor(accent),
      accentSoft: mix(accent, bg, 0.86),
      rule: mix(ink, bg, 0.78),
      positive,
      negative,
      titleInk,
    },
    chart:
      accents.length >= 4
        ? accents.slice(0, 6)
        : [
            accent,
            ink,
            mix(accent, bg, 0.4),
            mix(ink, bg, 0.5),
            mix(accent, bg, 0.7),
            mix(ink, bg, 0.75),
          ],
    fonts: {
      heading,
      body,
      ...(needsCyr
        ? { cyrillic: { heading: { family: 'Times New Roman', measure: 'liberation-serif' } } }
        : {}),
    },
    type: {
      cover: 40,
      title: 24,
      subtitle: 16,
      heading: 15,
      body: 14,
      minBody: 11,
      small: 10,
      source: 8,
      lineHeight: 1.2,
      titleWeight: 'bold',
    },
    decor: { kind: 'rule', colors: [accent], intensity: 1, onContent: false },
    chrome: {
      titleRule: false,
      accentBar: true,
      pageNumbers: true,
      tracker: true,
      ...(logoRel ? { logo: logoRel } : {}),
    },
    source: `imported from ${basename(file)}`,
  };
  const themePath = join(outDir, `${opts.id}.json`);
  writeFileSync(themePath, `${JSON.stringify(theme, null, 2)}\n`);
  if (contrast(accent, bg) < 3)
    notes.push(
      `accent ${accent} has low contrast on ${bg}; consider a darker accent for text highlights.`,
    );
  return { theme, themePath, ...(logoRel ? { logo: join(outDir, logoRel) } : {}), notes };
}

export function relativeTo(from: string, to: string): string {
  return relative(dirname(from), to) || '.';
}
