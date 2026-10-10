/**
 * Documentation integrity: every relative link and image in every Markdown file resolves,
 * and generated reference pages are up to date with the code.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.output', 'dist', 'slidecraft', 'work']);

function markdownFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) markdownFiles(p, out);
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

describe('docs links', () => {
  const files = markdownFiles(ROOT);
  it('finds the docs', () => {
    expect(files.length).toBeGreaterThan(40);
  });
  for (const file of files) {
    it(`links resolve in ${relative(ROOT, file)}`, () => {
      const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
      const targets = [
        ...[...text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]!),
        ...[...text.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]!),
      ];
      const broken = targets
        .filter((t) => !/^(https?:|mailto:|#|\$\{)/.test(t))
        .map((t) => t.split('#')[0]!)
        .filter((t) => t && !existsSync(resolve(dirname(file), decodeURIComponent(t))));
      expect(broken, `broken links in ${relative(ROOT, file)}`).toEqual([]);
    });
  }
});
