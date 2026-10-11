import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome, runChrome } from '../src/backends/html.ts';
import { convertToPdf, pptxConvertEngine } from '../src/backends/pptx-convert.ts';
import { buildDeck } from '../src/build.ts';
import { pptxInventory, readPpm, textDelta, visualMetrics } from './lib/deck-regression.ts';

const fixture = resolve('tests/fixtures/digital-ruble');
const config = JSON.parse(readFileSync(join(fixture, 'baseline.json'), 'utf8'));
const out = resolve('tests/.output/digital-ruble');
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
for (const baseline of [config.original, config.reference])
  if (sha(join(fixture, baseline.file)) !== baseline.sha256)
    throw new Error(
      `Baseline changed: ${baseline.file}; never auto-accept a candidate as reference`,
    );
if (!existsSync('/System/Library/Fonts/SFNS.ttf'))
  throw new Error(
    'Historical reference requires locally licensed SFNS.ttf on macOS. Not skipped or silently substituted.',
  );
const chrome = findChrome();
if (!chrome) throw new Error('Chrome is required for real HTML rendering');
const office = await pptxConvertEngine.detect();
if (!office.available)
  throw new Error(
    'PowerPoint or LibreOffice is required; Scene thumbnails cannot replace Office output',
  );
mkdirSync(out, { recursive: true });
console.log('Building editable PPTX and live HTML, plus Chrome PDF…');
const result = await buildDeck(join(fixture, config.candidate), {
  formats: ['pptx', 'html', 'pdf'],
  pptxEngine: 'pptxgenjs',
  pdfEngine: 'html',
  outDir: join(out, 'candidate'),
});
const getFile = (kind: string) => {
  const file = result.files.find((f) => f.kind === kind);
  if (!file) throw new Error(`Missing ${kind} output: ${JSON.stringify(result.diagnostics)}`);
  return file.path;
};
const original = join(fixture, config.original.file);
const candidate = getFile('pptx');
console.log('Rendering original and candidate in Office…');
const originalPdf = join(out, 'original-office.pdf');
const candidatePdf = join(out, 'candidate-office.pdf');
convertToPdf(original, originalPdf);
convertToPdf(candidate, candidatePdf);
const referencePdf = join(out, 'reference-html.pdf');
const profile = mkdtempSync(join(tmpdir(), 'sc-regression-chrome-'));
try {
  await runChrome(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      '--no-pdf-header-footer',
      `--user-data-dir=${profile}`,
      `--print-to-pdf=${referencePdf}`,
      '--virtual-time-budget=5000',
      pathToFileURL(join(fixture, config.reference.file)).href,
    ],
    120000,
    referencePdf,
  );
} finally {
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function pages(pdf: string, name: string) {
  const dir = join(out, name);
  mkdirSync(dir, { recursive: true });
  // Explicit numbered pages in a new per-run directory avoid stale pages from older runs.
  const current = mkdtempSync(join(dir, 'run-'));
  execFileSync(
    'pdftoppm',
    ['-scale-to-x', '1600', '-scale-to-y', '-1', pdf, join(current, 'page')],
    { timeout: 180000 },
  );
  return readdirSync(current)
    .filter((p) => /^page-\d+\.ppm$/.test(p))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))
    .map((p) => join(current, p));
}
console.log('Comparing all pages: original, historical HTML, current HTML, actual PPTX…');
const rasters = {
  original: pages(originalPdf, 'original-office'),
  historical: pages(referencePdf, 'historical-html'),
  html: pages(getFile('pdf'), 'current-html'),
  pptx: pages(candidatePdf, 'candidate-office'),
};
const expected = await pptxInventory(readFileSync(original));
const actual = await pptxInventory(readFileSync(candidate));
if (
  expected.length !== config.slides ||
  actual.length !== config.slides ||
  Object.values(rasters).some((p) => p.length !== config.slides)
)
  throw new Error('Page count mismatch across source, HTML or Office output');
const slides = expected.map((source, i) => {
  const output = actual[i]!;
  const text = textDelta(source.text, output.text);
  const notes = textDelta(source.notes, output.notes);
  const compare = (a: keyof typeof rasters, b: keyof typeof rasters) =>
    visualMetrics(readPpm(readFileSync(rasters[a][i]!)), readPpm(readFileSync(rasters[b][i]!)));
  const htmlToPptx = compare('html', 'pptx');
  const historicalToPptx = compare('historical', 'pptx');
  const originalToPptx = compare('original', 'pptx');
  return {
    slide: i + 1,
    text,
    notes,
    original: source,
    candidate: output,
    htmlToPptx,
    historicalToPptx,
    originalToPptx,
    // Pictures are deliberately conservative: this fixture expects fully native exhibits.
    nativeObjectsPass: output.pictures === 0 && output.shapes > 0,
    textPass: text.missing.length === 0 && text.added.length === 0,
    notesPass: notes.missing.length === 0,
    // The original owns content; the approved redesign HTML owns the new look.
    // Original visual distance is informational, not a contradictory second style gate.
    visualPass: [htmlToPptx, historicalToPptx].every((m) => m.worstRegion >= config.target),
  };
});
const report = {
  schemaVersion: 1,
  fixture: config.id,
  createdAt: new Date().toISOString(),
  baseline: config,
  provenance: {
    node: process.version,
    platform: process.platform,
    chrome: execFileSync(chrome, ['--version'], { encoding: 'utf8' }).trim(),
    office: office.detail,
    poppler: spawnSync('pdftoppm', ['-v'], { encoding: 'utf8' }).stderr.trim(),
    systemFontSha256: sha('/System/Library/Fonts/SFNS.ttf'),
    candidateInputs: Object.fromEntries(
      [
        'deck.yaml',
        'theme/public-tech.json',
        'sections/core.yaml',
        'sections/international.yaml',
        'sections/appendix.yaml',
      ].map((file) => [file, sha(join(fixture, file))]),
    ),
    originalSha256: sha(original),
    candidateSha256: sha(candidate),
    htmlSha256: sha(getFile('html')),
  },
  metric:
    'RGB MAE + edge-detail MAE in 4x4 regions at 1600px. Worst region must meet target. Not a calibrated human perception score.',
  limitations: [
    'Token multiset check is case/punctuation sensitive but cannot validate semantic order.',
    'Inventory includes slide shapes/tables/chart caches and speaker notes, not inherited master text.',
    'Actual source fonts and Office versions affect results; review every rendered slide.',
    'Original and historical HTML are separate references; conflicting appearances must not be averaged away.',
  ],
  diagnostics: result.diagnostics,
  rasters,
  slides,
  visualReview: false,
  automaticPass:
    !result.diagnostics.some((d) => d.severity === 'error') &&
    slides.every((s) => s.nativeObjectsPass && s.textPass && s.notesPass && s.visualPass),
};
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
writeFileSync(
  join(out, 'report.md'),
  [
    '# Digital Ruble regression',
    '',
    `Automatic acceptance: **${report.automaticPass ? 'PASS' : 'FAIL'}**. Manual visual review: not complete.`,
    '',
    report.metric,
    '',
    '| Slide | Exact text | Notes preserved | Native objects | Worst HTML/PPTX region | Worst historical/PPTX region |',
    '|---|---|---|---|---|---|',
    ...slides.map(
      (s) =>
        `| ${s.slide} | ${s.textPass ? 'PASS' : 'FAIL'} | ${s.notesPass ? 'PASS' : 'FAIL'} | ${s.nativeObjectsPass ? 'PASS' : 'FAIL'} | ${percent(s.htmlToPptx.worstRegion)} | ${percent(s.historicalToPptx.worstRegion)} |`,
    ),
    '',
    'Original PPTX is the content authority; frozen HTML owns the redesigned look. Original visual distance is informational.',
    '',
    'Detailed token deltas, fonts, input hashes, rasters and diagnostics: [report.json](report.json).',
    '',
  ].join('\n'),
);
console.log(
  JSON.stringify(
    {
      report: join(out, 'report.json'),
      automaticPass: report.automaticPass,
      slides: slides.length,
      textPass: slides.filter((s) => s.textPass).length,
      notesPass: slides.filter((s) => s.notesPass).length,
      nativeObjectsPass: slides.filter((s) => s.nativeObjectsPass).length,
      visualPass: slides.filter((s) => s.visualPass).length,
      worstHtmlRegion: Math.min(...slides.map((s) => s.htmlToPptx.worstRegion)),
    },
    null,
    2,
  ),
);
process.exitCode = report.automaticPass ? 0 : 1;
