/** Exercise the shipped PDF reader without node_modules, including on the minimum Node. */
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isolated = mkdtempSync(join(tmpdir(), 'sc-pdf-standalone-'));
try {
  copyFileSync(join(root, 'dist/pdf-text.mjs'), join(isolated, 'pdf-text.mjs'));
  const { pdfPages, pdfStyle } = await import(pathToFileURL(join(isolated, 'pdf-text.mjs')).href);
  const data = readFileSync(join(root, 'docs/showcase/fde-engineer/en/fde-engineer-en.pdf'));
  const pages = await pdfPages(new Uint8Array(data));
  const style = await pdfStyle(new Uint8Array(data));
  assert.equal(pages.pages.length, 6);
  assert.ok(style.fills.some((v) => v.hex === '#1F5FBF' && v.area > 0));
  assert.ok(style.text.some((v) => v.hex === '#0B1F3A' && v.chars > 0));
  console.log(`Standalone PDF reader passed on ${process.version}: six pages, preserved colours`);
} finally {
  rmSync(isolated, { recursive: true, force: true });
}
