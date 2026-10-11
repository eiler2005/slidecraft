import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve the SlideCraft package root both from sources (`src/…`) and from the
 * committed bundle (`dist/slidecraft.mjs`): walk up until our package.json.
 */
function findRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        const name = JSON.parse(readFileSync(pkg, 'utf8')).name;
        if (name === 'slidecraft' || name === '@eiler2005/slidecraft') return dir;
      } catch {
        // keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`SlideCraft root not found from ${start}`);
}

export const ROOT = findRoot(dirname(fileURLToPath(import.meta.url)));
export const FONTS_DIR = join(ROOT, 'fonts');
export const LIBRARY_DIR = join(ROOT, 'library');
export const THEMES_DIR = join(LIBRARY_DIR, 'themes');
export const STORYLINES_DIR = join(LIBRARY_DIR, 'storylines');
export const DOCS_DIR = join(ROOT, 'docs');
export const SCHEMAS_DIR = join(ROOT, 'schemas');

export function resvgWasmPath(): string {
  const bundled = join(ROOT, 'dist', 'resvg.wasm');
  if (existsSync(bundled)) return bundled;
  return resolve(ROOT, 'node_modules', '@resvg', 'resvg-wasm', 'index_bg.wasm');
}

export const VERSION: string = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
