/**
 * Collects references and SlideCraft results side by side in one local folder, with page
 * images, difference images, per-slide scores and the calibration reports — from the last
 * calibration corpus run. Output is git-ignored (it contains the integration corpus and
 * large binaries). Guide: docs/how-to/see-results.md.
 *
 *   npm run comparison              # from the last `npm run calibrate -- --stage corpus`
 *   npm run comparison -- --refresh # run the corpus stage first (needs PowerPoint, Chrome, Poppler)
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { diffOverlay, encodePng, readPpm } from '../src/qa/raster.ts';

const args = process.argv.slice(2);
const OUT = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1]! : 'comparison');
const CORPUS = resolve('tests/.output/calibration/corpus');
const TARGET = 0.95;

if (args.includes('--refresh')) {
  const r = spawnSync('npm', ['run', 'calibrate', '--', '--stage', 'corpus'], { stdio: 'inherit' });
  if (r.status !== 0 && r.status !== 1) process.exit(r.status ?? 1);
}
const corpusJson = resolve('tests/.output/calibration/corpus.json');
if (!existsSync(corpusJson))
  throw new Error(
    'No calibration corpus run found. Run `npm run calibrate -- --stage corpus` or pass --refresh.',
  );

interface Row {
  deck: string;
  kind: 'rebuild' | 'generated';
  page: number;
  gate: number;
  pairs: Record<string, number>;
}
interface DeckDef {
  id: string;
  kind: 'rebuild' | 'generated';
  source: string;
  theme?: string;
}
const rows: Row[] = JSON.parse(readFileSync(corpusJson, 'utf8')).rows;
const decks: DeckDef[] = JSON.parse(readFileSync('calibration/corpus.json', 'utf8')).decks;
const ranAt = (() => {
  const d = statSync(corpusJson).mtime;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
})();

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'calibration'), { recursive: true });
for (const f of ['REPORT.md', 'RULES.md', 'corpus.json'])
  copyFileSync(join('calibration', f), join(OUT, 'calibration', f));

const latestRun = (dir: string) => {
  if (!existsSync(dir)) return undefined;
  const runs = readdirSync(dir)
    .filter((d) => d.startsWith('run-'))
    .map((d) => join(dir, d))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const run = runs[0];
  return run
    ? readdirSync(run)
        .filter((f) => f.endsWith('.ppm'))
        .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))
        .map((f) => join(run, f))
    : undefined;
};
const copy = (from: string, toDir: string, name = basename(from)) => {
  if (!existsSync(from)) return undefined;
  mkdirSync(toDir, { recursive: true });
  copyFileSync(from, join(toDir, name));
  return name;
};
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

interface Page {
  n: number;
  images: { label: string; file: string }[];
  scores: { label: string; value: number }[];
  pass: boolean;
}
interface DeckOut {
  id: string;
  kind: string;
  reference: string;
  result: string;
  files: { group: string; label: string; path: string }[];
  pages: Page[];
}
const out: DeckOut[] = [];

for (const deck of decks) {
  const src = join(CORPUS, deck.id);
  const dir = join(OUT, deck.id);
  const deckRows = rows.filter((r) => r.deck === deck.id);
  if (!existsSync(src) || !deckRows.length) {
    console.warn(`skip ${deck.id}: not in the last corpus run`);
    continue;
  }
  mkdirSync(join(dir, 'pages'), { recursive: true });
  const build = join(src, 'build');
  const built = existsSync(build) ? readdirSync(build) : [];
  const pick = (ext: string) => built.find((f) => f.endsWith(ext) && !f.endsWith(`onepager${ext}`));
  const files: DeckOut['files'] = [];
  const add = (
    group: string,
    label: string,
    from: string | undefined,
    sub: string,
    name?: string,
  ) => {
    if (!from) return;
    const n = copy(from, join(dir, sub), name);
    if (n) files.push({ group, label, path: `${deck.id}/${sub}/${n}` });
  };
  let rasters: { label: string; ppm: string[] | undefined }[];
  if (deck.kind === 'rebuild') {
    add('reference', 'Original PPTX', resolve(deck.source), 'reference');
    add(
      'reference',
      'Original rendered by PowerPoint (PDF)',
      join(src, 'original-office.pdf'),
      'reference',
      'original-powerpoint.pdf',
    );
    if (deck.id === 'digital-ruble') {
      add(
        'reference',
        'Historical HTML (diagnostic only)',
        resolve('tests/fixtures/digital-ruble/reference.html'),
        'reference',
        'historical-reference.html',
      );
      add(
        'reference',
        'Historical HTML printed by Chrome (PDF)',
        resolve('tests/.output/digital-ruble/fidelity/reference-html.pdf'),
        'reference',
        'historical-reference.pdf',
      );
    }
    add('result', 'Rebuilt editable PPTX', pick('.pptx') && join(build, pick('.pptx')!), 'result');
    add(
      'result',
      'Rebuilt PPTX rendered by PowerPoint (PDF)',
      join(src, 'pptx-office.pdf'),
      'result',
      'rebuilt-powerpoint.pdf',
    );
    add('result', 'HTML deck', pick('.html') && join(build, pick('.html')!), 'result');
    add(
      'result',
      'HTML printed by Chrome (PDF)',
      pick('.pdf') && join(build, pick('.pdf')!),
      'result',
    );
    rasters = [
      { label: 'Original · PowerPoint', ppm: latestRun(join(src, 'original')) },
      { label: 'Rebuilt PPTX · PowerPoint', ppm: latestRun(join(src, 'pptx')) },
      { label: 'HTML · Chrome', ppm: latestRun(join(src, 'html')) },
    ];
  } else {
    add('source', 'Deck source (YAML)', join(src, 'src', 'deck.yaml'), 'source');
    add(
      'reference',
      'Editable PPTX as PowerPoint renders it (PDF)',
      join(src, 'pptx-office.pdf'),
      'reference',
      'pptx-powerpoint.pdf',
    );
    add('result', 'Editable PPTX', pick('.pptx') && join(build, pick('.pptx')!), 'result');
    add('result', 'HTML deck', pick('.html') && join(build, pick('.html')!), 'result');
    add(
      'result',
      'HTML printed by Chrome (PDF)',
      pick('.pdf') && join(build, pick('.pdf')!),
      'result',
    );
    rasters = [
      { label: 'Editable PPTX · PowerPoint', ppm: latestRun(join(src, 'pptx')) },
      { label: 'HTML · Chrome', ppm: latestRun(join(src, 'html')) },
    ];
  }
  const pages: Page[] = deckRows.map((r) => {
    const i = r.page - 1;
    const n = String(r.page).padStart(2, '0');
    const images: Page['images'] = [];
    const loaded = rasters.map((x) => (x.ppm?.[i] ? readPpm(readFileSync(x.ppm[i]!)) : undefined));
    rasters.forEach((x, k) => {
      if (!loaded[k]) return;
      const file = `${deck.id}/pages/${n}-${k === 0 ? 'reference' : k === 1 && deck.kind === 'rebuild' ? 'pptx' : 'html'}.png`;
      writeFileSync(join(OUT, file), encodePng(loaded[k]!));
      images.push({ label: x.label, file });
    });
    for (let k = 1; k < loaded.length; k++) {
      if (!loaded[0] || !loaded[k]) continue;
      const which = k === 1 && deck.kind === 'rebuild' ? 'pptx' : 'html';
      const file = `${deck.id}/pages/${n}-diff-${which}.png`;
      writeFileSync(join(OUT, file), encodePng(diffOverlay(loaded[0]!, loaded[k]!)));
      images.push({ label: `Difference: reference ↔ ${which.toUpperCase()}`, file });
    }
    return {
      n: r.page,
      images,
      scores: Object.entries(r.pairs).map(([label, value]) => ({ label, value })),
      pass: r.gate >= TARGET,
    };
  });
  const gate = Object.keys(deckRows[0]!.pairs)[0]!;
  writeFileSync(
    join(dir, 'report.md'),
    [
      `# ${deck.id}`,
      '',
      deck.kind === 'rebuild'
        ? 'Reference: the original PowerPoint file as PowerPoint renders it. Result: SlideCraft rebuilt it into an editable PPTX and an HTML deck.'
        : 'Result: SlideCraft generated an editable PPTX and an HTML deck from the same YAML (`result/`). Reference: the editable PPTX as PowerPoint renders it (`reference/`) — the HTML must look the same.',
      '',
      `Calibration run ${ranAt}. Gate pair \`${gate}\`, target ${pct(TARGET)} per page (worst of 16 regions, RGB + edge detail).`,
      '',
      `Pages passing: ${pages.filter((p) => p.pass).length}/${pages.length}.`,
      '',
      `| Page | ${Object.keys(deckRows[0]!.pairs).join(' | ')} | Gate |`,
      `|---|${Object.keys(deckRows[0]!.pairs)
        .map(() => '---')
        .join('|')}|---|`,
      ...deckRows.map(
        (r) =>
          `| ${r.page} | ${Object.values(r.pairs).map(pct).join(' | ')} | ${r.gate >= TARGET ? 'pass' : 'below'} |`,
      ),
      '',
      'Images: `pages/NN-reference.png`, `NN-pptx.png` / `NN-html.png`, and `NN-diff-*.png` (grey = same, red = only in the reference, cyan = only in the result).',
      '',
    ].join('\n'),
  );
  out.push({
    id: deck.id,
    kind: deck.kind,
    reference: deck.kind === 'rebuild' ? 'Original PPTX' : 'Editable PPTX as PowerPoint renders it',
    result: deck.kind === 'rebuild' ? 'Rebuilt editable PPTX + HTML' : 'Editable PPTX + HTML',
    files,
    pages,
  });
  console.log(`✔ ${deck.id}: ${pages.length} pages`);
}

// ─── index.md and a local viewer ───
const summary = out.map((d) => {
  const gates = d.pages.map((p) => p.scores[0]!.value).sort((a, b) => a - b);
  return {
    d,
    min: gates[0]!,
    median: gates[Math.floor(gates.length / 2)]!,
    pass: d.pages.filter((p) => p.pass).length,
  };
});
writeFileSync(
  join(OUT, 'README.md'),
  [
    '# References and SlideCraft results, side by side',
    '',
    `Built by \`npm run comparison\` from the calibration corpus run of ${ranAt}. Open **index.html** for the visual viewer.`,
    'This folder is local (git-ignored): it contains the approved integration corpus and large binaries.',
    '',
    '| Deck | Kind | Reference | Result | Pages ≥ 95 % | Worst page | Median | Report |',
    '|---|---|---|---|---|---|---|---|',
    ...summary.map(
      ({ d, min, median, pass }) =>
        `| ${d.id} | ${d.kind} | ${d.reference} | ${d.result} | ${pass}/${d.pages.length} | ${pct(min)} | ${pct(median)} | [report](${d.id}/report.md) |`,
    ),
    '',
    'Each deck folder: `reference/` (what we compare against), `result/` (what SlideCraft produced), `source/` (deck YAML for generated decks), `pages/` (page images and differences), `report.md` (scores per page).',
    'Calibration evidence: [calibration/REPORT.md](calibration/REPORT.md), [calibration/RULES.md](calibration/RULES.md).',
    '',
  ].join('\n'),
);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const badge = (v: number) => (v >= TARGET ? 'ok' : v >= 0.9 ? 'mid' : 'low');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SlideCraft comparison</title>
<style>
:root{--bg:#f5f7fa;--card:#fff;--ink:#0a2033;--muted:#596e7c;--line:#d5dee7;--ok:#1f7a3a;--mid:#b45309;--low:#b91c1c;--accent:#0960d5}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--card:#161b22;--ink:#e6edf3;--muted:#8b98a5;--line:#30363d;--accent:#58a6ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,Segoe UI,Arial,sans-serif}
header{padding:28px 32px 8px}h1{margin:0 0 4px;font-size:26px}header p{margin:0;color:var(--muted)}
nav{position:sticky;top:0;z-index:2;background:var(--bg);padding:12px 32px;border-bottom:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap}
nav button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;cursor:pointer;font:inherit}
nav button.on{background:var(--accent);border-color:var(--accent);color:#fff}
main{padding:20px 32px 60px}.deck{display:none}.deck.on{display:block}
.files{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin:12px 0 24px}
.files div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.files h3{margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.files a{display:block;color:var(--accent);text-decoration:none;margin:3px 0}
.page{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin:0 0 16px}
.page h4{margin:0 0 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:15px}
.b{font-size:12px;font-weight:700;border-radius:999px;padding:2px 9px;color:#fff}.b.ok{background:var(--ok)}.b.mid{background:var(--mid)}.b.low{background:var(--low)}
.imgs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
figure{margin:0}figure img{width:100%;border:1px solid var(--line);border-radius:6px;display:block;background:#fff}
figcaption{font-size:12px;color:var(--muted);margin-top:4px}
.sum{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-top:10px}
.sum td,.sum th{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left}.sum th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
</style></head><body>
<header><h1>References and SlideCraft results</h1><p>Calibration run ${esc(ranAt)} · target ${pct(TARGET)} per page (worst of 16 regions, RGB + edge detail) · red = only in the reference, cyan = only in the result.</p>
<table class="sum"><tr><th>Deck</th><th>Reference → result</th><th>Pages ≥ 95 %</th><th>Worst</th><th>Median</th></tr>
${summary.map(({ d, min, median, pass }) => `<tr><td>${esc(d.id)}</td><td>${esc(d.reference)} → ${esc(d.result)}</td><td>${pass}/${d.pages.length}</td><td><span class="b ${badge(min)}">${pct(min)}</span></td><td><span class="b ${badge(median)}">${pct(median)}</span></td></tr>`).join('')}
</table></header>
<nav>${out.map((d, i) => `<button type="button" data-d="${esc(d.id)}"${i ? '' : ' class="on"'}>${esc(d.id)}</button>`).join('')}</nav>
<main>${out
  .map(
    (d, i) => `<section class="deck${i ? '' : ' on'}" id="${esc(d.id)}">
<div class="files">${['reference', 'result', 'source']
      .map((g) => {
        const fs = d.files.filter((f) => f.group === g);
        return fs.length
          ? `<div><h3>${g}</h3>${fs.map((f) => `<a href="${esc(f.path)}">${esc(f.label)}</a>`).join('')}</div>`
          : '';
      })
      .join(
        '',
      )}<div><h3>report</h3><a href="${esc(d.id)}/report.md">Scores per page</a><a href="calibration/REPORT.md">Calibration report</a></div></div>
${d.pages
  .map(
    (
      p,
    ) => `<div class="page"><h4>Page ${p.n} ${p.scores.map((s) => `<span class="b ${badge(s.value)}">${esc(s.label)} ${pct(s.value)}</span>`).join(' ')}</h4>
<div class="imgs">${p.images.map((im) => `<figure><a href="${esc(im.file)}" target="_blank"><img loading="lazy" src="${esc(im.file)}" alt="${esc(`${d.id} page ${p.n}: ${im.label}`)}"></a><figcaption>${esc(im.label)}</figcaption></figure>`).join('')}</div></div>`,
  )
  .join('')}
</section>`,
  )
  .join('')}</main>
<script>
document.querySelectorAll('nav button').forEach(function(b){b.addEventListener('click',function(){
document.querySelectorAll('nav button').forEach(function(x){x.classList.toggle('on',x===b)});
document.querySelectorAll('.deck').forEach(function(s){s.classList.toggle('on',s.id===b.dataset.d)});window.scrollTo(0,0);});});
</script></body></html>
`;
writeFileSync(join(OUT, 'index.html'), html);
console.log(`\nOpen ${join(OUT, 'index.html')} — summary in ${join(OUT, 'README.md')}`);
