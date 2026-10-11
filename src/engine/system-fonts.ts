/**
 * Locate installed font files by family name, in the order an Office renderer resolves
 * them: fonts bundled with Office first (PowerPoint for Mac prefers its own, often newer
 * copies — e.g. a Calibri that has ₽), then user and system font folders.
 */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';
import * as fontkit from 'fontkit';
import type { Face } from './fonts.ts';

export type FaceFiles = Partial<Record<Face, string>> & { regular: string };

export function fontDirs(): string[] {
  const env = process.env.SLIDECRAFT_FONT_DIRS?.split(':').filter(Boolean) ?? [];
  const office = '/Applications/Microsoft PowerPoint.app/Contents/Resources/DFonts';
  const win = process.env.WINDIR ? [join(process.env.WINDIR, 'Fonts')] : [];
  return [
    ...env,
    office,
    '/Library/Fonts/Microsoft',
    join(homedir(), 'Library/Fonts'),
    '/Library/Fonts',
    '/System/Library/Fonts/Supplemental',
    ...win,
    '/usr/share/fonts',
    join(homedir(), '.fonts'),
  ];
}

interface Entry {
  family: string;
  face: Face;
  path: string;
}
const indexCache = new Map<string, Entry[]>();

function faceOfFont(f: fontkit.Font): Face | undefined {
  const sub = (f.subfamilyName ?? '').toLowerCase();
  const bold = /bold|black|heavy/.test(sub);
  const italic = /italic|oblique/.test(sub);
  if (/light|thin|medium|semibold|condensed|narrow/.test(sub)) return undefined;
  return bold ? (italic ? 'boldItalic' : 'bold') : italic ? 'italic' : 'regular';
}

function indexDir(dir: string): Entry[] {
  const hit = indexCache.get(dir);
  if (hit) return hit;
  const out: Entry[] = [];
  const walk = (d: string, depth: number) => {
    let names: string[];
    try {
      names = readdirSync(d);
    } catch {
      return;
    }
    for (const name of names) {
      const path = join(d, name);
      const ext = extname(name).toLowerCase();
      if (ext !== '.ttf' && ext !== '.otf') {
        if (!ext && depth < 3) walk(path, depth + 1);
        continue;
      }
      try {
        const f = fontkit.openSync(path) as fontkit.Font;
        const face = faceOfFont(f);
        if (face) out.push({ family: f.familyName, face, path });
      } catch {
        // unreadable or unsupported font file
      }
    }
  };
  walk(dir, 0);
  indexCache.set(dir, out);
  return out;
}

/** Face files for `family` from the first folder that has its regular face. */
export function findFontFiles(family: string, dirs = fontDirs()): FaceFiles | undefined {
  const want = family.toLowerCase();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const faces = indexDir(dir).filter((e) => e.family.toLowerCase() === want);
    const regular = faces.find((e) => e.face === 'regular');
    if (!regular) continue;
    const files: FaceFiles = { regular: regular.path };
    for (const face of ['bold', 'italic', 'boldItalic'] as const) {
      const file = faces.find((e) => e.face === face);
      if (file) files[face] = file.path;
    }
    return files;
  }
  return undefined;
}
