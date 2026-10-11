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
import type { FormatFile } from '../spec/format.ts';
import type { FontSpec, ThemeInput } from '../spec/theme.ts';
import { readTemplateGeometry } from './template-geometry.ts';

export interface ImportResult {
  theme: ThemeInput;
  themePath: string;
  logo?: string;
  /** Page format with the template's size and title band (use as `format:` in the deck). */
  formatPath?: string;
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

/** Lightest accent tint on which muted text still reads (4.5:1) and ink stays crisp (7:1). */
function softTint(accent: string, bg: string, ink: string, muted: string): string {
  for (const t of [0.86, 0.88, 0.9, 0.92, 0.94, 0.96]) {
    const c = mix(accent, bg, t);
    if (contrast(muted, c) >= 4.5 && contrast(ink, c) >= 7) return c;
  }
  return mix(accent, bg, 0.96);
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

  // template geometry: background art in place, and the title band as a page format
  const geo = await readTemplateGeometry(zip, c);
  const slideArea = geo.size.w * geo.size.h;
  const saved = new Map<string, string>();
  const keep = async (part: string) => {
    if (!saved.has(part)) {
      const data = await zip.file(part)?.async('uint8array');
      if (!data) return undefined;
      const name = `${opts.id}-art-${saved.size + 1}${extname(part).toLowerCase()}`;
      writeFileSync(join(outDir, name), data);
      saved.set(part, `./${name}`);
    }
    return saved.get(part);
  };
  const toArt = async (pics: typeof geo.content) => {
    const out: { image: string; x: number; y: number; w: number; h: number }[] = [];
    for (const p of pics) {
      const image = await keep(p.part);
      if (image)
        out.push({
          image,
          x: +p.x.toFixed(4),
          y: +p.y.toFixed(4),
          w: +p.w.toFixed(4),
          h: +p.h.toFixed(4),
        });
    }
    return out;
  };
  const artCover = await toArt(geo.cover);
  const artContent = await toArt(geo.content);
  const round = <T extends { x: number; y: number; w: number; h: number }>(v: T): T => ({
    ...v,
    x: +v.x.toFixed(4),
    y: +v.y.toFixed(4),
    w: +v.w.toFixed(4),
    h: +v.h.toFixed(4),
  });
  const shapeArt = { cover: geo.coverShapes.map(round), content: geo.contentShapes.map(round) };
  const hasShapes = shapeArt.cover.length + shapeArt.content.length > 0;
  const hasArt = artCover.length + artContent.length > 0 || hasShapes;
  // a small picture on the template is its logo; it is already placed by the art
  const smallPic = [...geo.content, ...geo.cover].some((p) => (p.w * p.h) / slideArea < 0.04);
  if (hasArt)
    notes.push(
      `${saved.size} picture(s) from the template's master and layouts kept as background art in their original positions.`,
    );

  let formatPath: string | undefined;
  if (geo.title && geo.title.y < geo.size.h * 0.4) {
    const t = geo.title;
    const fmt: FormatFile = {
      schemaVersion: 1,
      id: `${opts.id}-frame`,
      name: `${opts.name ?? opts.id} frame`,
      w: +geo.size.w.toFixed(3),
      h: +geo.size.h.toFixed(3),
      margin: {
        l: +Math.max(0.3, t.x).toFixed(3),
        r: +Math.max(0.3, geo.size.w - t.x - t.w).toFixed(3),
        t: +Math.max(0.25, t.y - 0.28).toFixed(3),
        b: +Math.max(
          geo.footer ? Math.max(0.2, geo.size.h - geo.footer.y - geo.footer.h) : 0.38,
          // a wide band of art along the bottom edge: keep the footer above it
          ...geo.content
            .filter(
              (p) =>
                p.w > geo.size.w * 0.6 && p.y + p.h >= geo.size.h - 0.05 && p.h < geo.size.h * 0.3,
            )
            .map((p) => geo.size.h - p.y + 0.12),
        ).toFixed(3),
      },
      source: `title placeholder of ${basename(file)}`,
    };
    formatPath = join(outDir, `${opts.id}.format.json`);
    writeFileSync(formatPath, `${JSON.stringify(fmt, null, 2)}\n`);
    notes.push(
      `Frame: ${fmt.w}×${fmt.h} in, title band where the template has its title — set "format: ${relative(process.cwd(), formatPath)}" (relative to the deck) to use it.`,
    );
  }

  const logo = hasArt && smallPic ? undefined : await findLogo(zip);
  let logoRel: string | undefined;
  if (logo) {
    const name = `${opts.id}-logo${extname(logo.name).toLowerCase()}`;
    writeFileSync(join(outDir, name), logo.data);
    logoRel = `./${name}`;
  } else if (!(hasArt && smallPic))
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
      accentSoft: softTint(accent, bg, ink, muted),
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
      ...(hasArt
        ? {
            art: {
              size: { w: +geo.size.w.toFixed(3), h: +geo.size.h.toFixed(3) },
              cover: artCover,
              content: artContent,
              ...(hasShapes ? { shapes: shapeArt } : {}),
            },
          }
        : {}),
    },
    source: `imported from ${basename(file)}`,
    officeTheme: `${opts.id}.theme.xml`,
    template: `${opts.id}.template${extname(file).toLowerCase() === '.potx' ? '.potx' : '.pptx'}`,
  };
  // the template itself: PPTX output is built on its masters and layouts
  copyFileSync(
    file,
    join(
      outDir,
      `${opts.id}.template${extname(file).toLowerCase() === '.potx' ? '.potx' : '.pptx'}`,
    ),
  );
  // keep the brand's own theme part (no relationships needed: colours, fonts, effects)
  writeFileSync(join(outDir, `${opts.id}.theme.xml`), xml);
  const themePath = join(outDir, `${opts.id}.json`);
  writeFileSync(themePath, `${JSON.stringify(theme, null, 2)}\n`);
  if (contrast(accent, bg) < 3)
    notes.push(
      `accent ${accent} has low contrast on ${bg}; consider a darker accent for text highlights.`,
    );
  return {
    theme,
    themePath,
    ...(logoRel ? { logo: join(outDir, logoRel) } : {}),
    ...(formatPath ? { formatPath } : {}),
    notes,
  };
}

export function relativeTo(from: string, to: string): string {
  return relative(dirname(from), to) || '.';
}
