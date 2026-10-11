/**
 * HTML ↔ PowerPoint parity for ordinary generated decks (YAML → layouts → Scene → HTML/PPTX).
 * Builds each example, renders the editable PPTX in PowerPoint/LibreOffice and the HTML in
 * Chrome, and compares every page with the same worst-region metric as the integration
 * corpus. Diagnostic: it reports, it does not bless goldens. Needs Chrome + Office + Poppler.
 *
 *   npx tsx scripts/generated-parity.ts [examples/<deck>/deck.yaml …]
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { convertToPdf, pptxConvertEngine } from '../src/backends/pptx-convert.ts';
import { buildDeck } from '../src/build.ts';
import { readPpm, visualMetrics } from './lib/deck-regression.ts';

const decks = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('examples')
      .map((d) => join('examples', d, 'deck.yaml'))
      .filter((f) => existsSync(f));
const out = resolve('tests/.output/generated-parity');
if (!(await pptxConvertEngine.detect()).available)
  throw new Error('PowerPoint or LibreOffice is required for actual Office output');

const pages = (pdf: string, dir: string) => {
  mkdirSync(dir, { recursive: true });
  const run = mkdtempSync(join(dir, 'run-'));
  execFileSync('pdftoppm', ['-scale-to-x', '1600', '-scale-to-y', '-1', pdf, join(run, 'p')]);
  return readdirSync(run)
    .filter((f) => f.endsWith('.ppm'))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))
    .map((f) => join(run, f));
};

const rows: { deck: string; slide: number; worst: number; mean: number }[] = [];
for (const deck of decks) {
  const id = basename(dirname(deck));
  const dir = join(out, id);
  const result = await buildDeck(deck, {
    formats: ['pptx', 'html', 'pdf'],
    pptxEngine: 'pptxgenjs',
    pdfEngine: 'html',
    outDir: join(dir, 'build'),
  });
  const file = (kind: string) => result.files.find((f) => f.kind === kind)?.path;
  const pptx = file('pptx');
  const htmlPdf = file('pdf');
  if (!pptx || !htmlPdf) throw new Error(`${id}: missing PPTX or HTML PDF`);
  const officePdf = join(dir, 'office.pdf');
  convertToPdf(pptx, officePdf);
  const a = pages(htmlPdf, join(dir, 'html'));
  const b = pages(officePdf, join(dir, 'office'));
  if (a.length !== b.length) throw new Error(`${id}: page count differs`);
  a.forEach((p, i) => {
    const m = visualMetrics(readPpm(readFileSync(p)), readPpm(readFileSync(b[i]!)));
    rows.push({ deck: id, slide: i + 1, worst: m.worstRegion, mean: m.mean });
  });
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const report = [
  '# Generated decks: HTML ↔ PowerPoint',
  '',
  'Worst 4×4 region (RGB + edge detail) per page at 1600 px; same metric as the integration corpus.',
  '',
  '| Deck | Pages | Min worst region | Median worst region | Pages ≥ 95% |',
  '|---|---|---|---|---|',
  ...[...new Set(rows.map((r) => r.deck))].map((deck) => {
    const w = rows
      .filter((r) => r.deck === deck)
      .map((r) => r.worst)
      .sort((x, y) => x - y);
    return `| ${deck} | ${w.length} | ${pct(w[0]!)} | ${pct(w[Math.floor(w.length / 2)]!)} | ${w.filter((v) => v >= 0.95).length} |`;
  }),
  '',
];
writeFileSync(join(out, 'report.md'), report.join('\n'));
writeFileSync(join(out, 'report.json'), `${JSON.stringify(rows, null, 2)}\n`);
console.log(report.join('\n'));
