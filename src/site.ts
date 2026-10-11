/**
 * Static product site for GitHub Pages: the full gallery (every storyline in every theme,
 * every layout example), the example decks in every output format, and links into the docs.
 * Generated in CI and never committed, so the gallery can grow without bloating git;
 * the repository keeps only the curated images that README and docs embed.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { buildDeck } from './build.ts';
import { buildGallery, buildHero } from './gallery.ts';
import { LAYOUTS } from './layouts/index.ts';
import { loadStorylines, loadThemes } from './library/load.ts';
import { ROOT, VERSION } from './paths.ts';

const REPO = 'https://github.com/eiler2005/slidecraft';
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SiteResult {
  out: string;
  pages: number;
  images: number;
  examples: number;
}

export async function buildSite(outDir = 'site'): Promise<SiteResult> {
  const out = resolve(outDir);
  mkdirSync(out, { recursive: true });
  const storylines = loadStorylines();
  const themes = loadThemes();
  const g = await buildGallery({
    out: join(out, 'gallery'),
    storylines,
    themes: themes.map((t) => t.id),
    width: 1200,
  });
  const hero = await buildHero(join(out, 'gallery', 'hero.png'));

  const examples: { id: string; title: string; files: { kind: string; path: string }[] }[] = [];
  for (const dir of readdirSync(join(ROOT, 'examples')).sort()) {
    const deck = join(ROOT, 'examples', dir, 'deck.yaml');
    const r = await buildDeck(deck, {
      outDir: join(out, 'examples', dir),
      formats: ['pptx', 'pdf', 'html', 'onepager', 'docx', 'png'],
    });
    const cover = r.files.find((f) => f.kind === 'png');
    if (cover) copyFileSync(cover.path, join(out, 'examples', dir, 'cover.png'));
    rmSync(join(out, 'examples', dir, 'previews'), { recursive: true, force: true });
    examples.push({
      id: dir,
      title: r.scene?.title ?? dir,
      files: r.files
        .filter((f) => f.kind !== 'png')
        .map((f) => ({ kind: f.kind, path: relative(out, f.path) })),
    });
  }
  writeFileSync(
    join(out, 'index.html'),
    page({ storylines, themes, examples, hero: relative(out, hero) }),
  );
  writeFileSync(join(out, '.nojekyll'), '');
  return { out, pages: 1, images: g.files.length + 1, examples: examples.length };
}

const KIND_LABEL: Record<string, string> = {
  pptx: 'PowerPoint',
  pdf: 'PDF',
  html: 'HTML deck',
  onepager: 'One-pager',
  docx: 'Word memo',
};

function page(d: {
  storylines: ReturnType<typeof loadStorylines>;
  themes: ReturnType<typeof loadThemes>;
  examples: { id: string; title: string; files: { kind: string; path: string }[] }[];
  hero: string;
}): string {
  const matrix = d.storylines
    .map(
      (s) =>
        `<section class="story" id="${s.id}"><h3>${esc(s.name)}</h3><p>${esc(s.summary)}</p><div class="row">${d.themes
          .map(
            (t) =>
              `<figure><a href="gallery/${s.id}--${t.id}.png"><img loading="lazy" src="gallery/${s.id}--${t.id}.png" alt="${esc(`${s.name} in ${t.name}`)}"></a><figcaption>${esc(t.name)}${s.themes.includes(t.id) ? ' <b>recommended</b>' : ''}</figcaption></figure>`,
          )
          .join('')}</div></section>`,
    )
    .join('');
  const layouts = LAYOUTS.flatMap((l) =>
    l.examples.map(
      (ex) =>
        `<figure class="card"><img loading="lazy" src="gallery/layouts/${l.id}--${ex.variant ?? l.variants[0]}.png" alt="${esc(`${l.name} — ${ex.variant ?? l.variants[0]}`)}"><figcaption><code>${l.id}</code> · ${esc(ex.variant ?? l.variants[0])}<br><span>${esc(l.purpose)}</span></figcaption></figure>`,
    ),
  ).join('');
  const ex = d.examples
    .map(
      (e) =>
        `<figure class="card"><img loading="lazy" src="examples/${e.id}/cover.png" alt="${esc(e.title)}"><figcaption><b>${esc(e.title)}</b><br>${e.files
          .map((f) => `<a href="${f.path}">${KIND_LABEL[f.kind] ?? f.kind}</a>`)
          .join(
            ' · ',
          )} · <a href="${REPO}/blob/main/examples/${e.id}/deck.yaml">deck.yaml</a></figcaption></figure>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SlideCraft — gallery</title>
<meta name="description" content="Describe the goal. Pick a look. Ship a partner-ready deck. Editable PPTX, vector PDF, HTML, one-pager and Word memo from one spec.">
<style>
:root{--bg:#fbfaf7;--ink:#14181f;--muted:#5b6472;--rule:#e2e5ea;--accent:#1f4e9e;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0f1216;--ink:#eef1f5;--muted:#9aa4b2;--rule:#262c35;--accent:#7aa7ff;--card:#161a20}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,"Segoe UI",Arial,sans-serif}
main{max-width:1240px;margin:0 auto;padding:0 16px 64px}a{color:var(--accent)}
header{padding:56px 0 24px}h1{font-size:clamp(28px,5vw,48px);line-height:1.1;margin:0 0 12px}header p{color:var(--muted);max-width:760px;font-size:18px}
nav{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}h2{margin:56px 0 8px;font-size:26px}h2+p{color:var(--muted);margin-top:0}
.hero{width:100%;border-radius:10px;border:1px solid var(--rule)}
.story{border-top:1px solid var(--rule);padding:20px 0}.story h3{margin:0}.story p{color:var(--muted);margin:4px 0 12px}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
figure{margin:0}img{width:100%;display:block;border:1px solid var(--rule);border-radius:6px;background:#fff}
figcaption{font-size:13px;color:var(--muted);padding-top:6px}figcaption b{color:var(--accent);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}.card figcaption span{display:block;margin-top:2px}
footer{color:var(--muted);font-size:13px;border-top:1px solid var(--rule);margin-top:64px;padding-top:16px}
code{font-size:13px}
</style></head><body><main>
<header><h1>SlideCraft</h1><p>Describe the goal. Pick a look. Ship a partner-ready deck. One spec becomes editable PowerPoint, vector PDF, an HTML deck, a one-pager and a Word memo.</p>
<nav><a href="${REPO}">GitHub</a><a href="${REPO}#quick-start">Quick start</a><a href="${REPO}/tree/main/docs">Documentation</a><a href="#examples">Examples</a><a href="#storylines">Storylines × themes</a><a href="#layouts">Layouts</a></nav>
<img class="hero" src="${d.hero}" alt="Slides from SlideCraft example decks"></header>
<h2 id="examples">Example decks</h2><p>Built in CI from <code>examples/</code> with SlideCraft ${VERSION}. Download any format.</p><div class="grid">${ex}</div>
<h2 id="storylines">Storylines × themes</h2><p>${d.storylines.length} storylines in all ${d.themes.length} themes — the storyline is the task, the theme is the look; any pair works.</p>${matrix}
<h2 id="layouts">Layouts</h2><p>${LAYOUTS.length} layouts — each one a content contract with capacity limits. Shown in consulting-classic.</p><div class="grid">${layouts}</div>
<footer>SlideCraft ${VERSION} · MIT · generated by <code>slidecraft site</code> · <a href="${REPO}">${basename(REPO)}</a></footer>
</main></body></html>
`;
}
