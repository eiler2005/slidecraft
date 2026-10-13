/**
 * Static product site for GitHub Pages: the full gallery (every storyline in every theme,
 * every layout example), the example decks in every output format, and links into the docs.
 * Generated in CI and never committed, so the gallery can grow without bloating git;
 * the repository keeps only the curated images that README and docs embed.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { buildDeck } from './build.ts';
import { buildGallery, buildHero } from './gallery.ts';
import { LAYOUTS } from './layouts/index.ts';
import { loadStorylines, loadThemes } from './library/load.ts';
import { ROOT, VERSION } from './paths.ts';

const REPO = 'https://github.com/eiler2005/slidecraft';
const SITE = 'https://eiler2005.github.io/slidecraft/';
const TAGLINE = 'Editable PowerPoint decks from one prompt';
const SUMMARY =
  'Paste one prompt into ChatGPT, Claude or Codex and get an editable PowerPoint — action titles, sourced numbers and a review before hand-off. Not a picture of slides.';
/** Shown first under "Example decks": a cover photo, a framework deck, the deck about SlideCraft. */
const FEATURED = ['fde-engineer-en-v2', 'llm-concepts', 'slidecraft-overview'];
/** Launch media copied next to the page: the explainer GIF, the social card and the icon. */
const MEDIA: [string, string][] = [
  ['docs/media/launch/slidecraft-story.gif', 'slidecraft-story.gif'],
  ['docs/media/launch/social-preview.png', 'og.png'],
  ['docs/media/launch/icon-240.png', 'icon.png'],
];

/** The one-prompt block from the README, so the site and the README never disagree. */
export function onePrompt(readme = readFileSync(join(ROOT, 'README.md'), 'utf8')): string {
  const section = readme.split(/^## The easiest way: one prompt$/m)[1] ?? '';
  const block = /```text\n([\s\S]*?)\n```/.exec(section);
  if (!block) throw new Error('README: no ```text block under "The easiest way: one prompt"');
  return block[1]!;
}
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
  for (const [from, to] of MEDIA) copyFileSync(join(ROOT, from), join(out, to));

  const examples: { id: string; title: string; files: { kind: string; path: string }[] }[] = [];
  // the deck about SlideCraft first, then the rest alphabetically
  const dirs = readdirSync(join(ROOT, 'examples'))
    .filter((d) => existsSync(join(ROOT, 'examples', d, 'deck.yaml')))
    .sort((a, b) =>
      a === 'slidecraft-overview' ? -1 : b === 'slidecraft-overview' ? 1 : a.localeCompare(b),
    );
  for (const dir of dirs) {
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
    page({ storylines, themes, examples, hero: relative(out, hero), prompt: onePrompt() }),
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
  prompt: string;
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
  const card = (e: (typeof d.examples)[number]) =>
    // the cover opens the HTML deck: page through it in the browser (← →, N for notes)
    `<figure class="card">${(() => {
      const html = e.files.find((f) => f.kind === 'html');
      const img = `<img loading="lazy" src="examples/${e.id}/cover.png" alt="${esc(e.title)}">`;
      return html ? `<a href="${html.path}" title="Open in the browser">${img}</a>` : img;
    })()}<figcaption><b>${esc(e.title)}</b><br>${e.files
      .map((f) => `<a href="${f.path}">${KIND_LABEL[f.kind] ?? f.kind}</a>`)
      .join(
        ' · ',
      )} · <a href="${REPO}/blob/main/examples/${e.id}/deck.yaml">deck.yaml</a></figcaption></figure>`;
  const featured = FEATURED.flatMap((id) => d.examples.filter((e) => e.id === id));
  const ex = d.examples
    .filter((e) => !FEATURED.includes(e.id))
    .map(card)
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SlideCraft — ${esc(TAGLINE)}</title>
<meta name="description" content="${esc(SUMMARY)}">
<link rel="icon" type="image/png" href="icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SlideCraft">
<meta property="og:title" content="SlideCraft — ${esc(TAGLINE)}">
<meta property="og:description" content="${esc(SUMMARY)}">
<meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}og.png">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:image:alt" content="SlideCraft: editable PowerPoint decks from one prompt, with three slides from an example deck">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="SlideCraft — ${esc(TAGLINE)}">
<meta name="twitter:description" content="${esc(SUMMARY)}">
<meta name="twitter:image" content="${SITE}og.png">
<style>
:root{--bg:#fbfaf7;--ink:#14181f;--muted:#5b6472;--rule:#e2e5ea;--accent:#1f4e9e;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0f1216;--ink:#eef1f5;--muted:#9aa4b2;--rule:#262c35;--accent:#7aa7ff;--card:#161a20}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,"Segoe UI",Arial,sans-serif}
main{max-width:1240px;margin:0 auto;padding:0 16px 64px}a{color:var(--accent)}
header{padding:56px 0 24px}h1{font-size:clamp(28px,5vw,48px);line-height:1.1;margin:0 0 12px}header p{color:var(--muted);max-width:760px;font-size:18px}
nav{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}h2{margin:56px 0 8px;font-size:26px}h2+p{color:var(--muted);margin-top:0}
.hero{width:100%;border-radius:10px;border:1px solid var(--rule)}
.cta{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0 28px}.btn{display:inline-block;padding:10px 18px;border-radius:8px;border:1px solid var(--accent);font-weight:600;text-decoration:none}
.btn.primary{background:var(--accent);color:var(--bg)}.gif{width:100%;height:auto;display:block;border-radius:10px;border:1px solid var(--rule)}
.prompt{position:relative;background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:16px 16px 12px}.prompt pre{margin:0;white-space:pre-wrap;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;color:var(--ink)}
.prompt button{position:absolute;top:10px;right:10px;font:600 13px/1 -apple-system,"Segoe UI",Arial,sans-serif;padding:8px 12px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:var(--bg);cursor:pointer}
.points{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0 0;padding:0;list-style:none}.points li{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:14px 16px}.points b{display:block;margin-bottom:4px}
.note{color:var(--muted);font-size:14px}
@media (max-width:640px){.prompt{padding-top:52px}}
.story{border-top:1px solid var(--rule);padding:20px 0}.story h3{margin:0}.story p{color:var(--muted);margin:4px 0 12px}
.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
figure{margin:0}img{width:100%;height:auto;display:block;border:1px solid var(--rule);border-radius:6px;background:#fff}
figcaption{font-size:13px;color:var(--muted);padding-top:6px}figcaption b{color:var(--accent);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}.card figcaption span{display:block;margin-top:2px}
footer{color:var(--muted);font-size:13px;border-top:1px solid var(--rule);margin-top:64px;padding-top:16px}
code{font-size:13px}
</style></head><body><main>
<header><nav><a href="#start">One prompt</a><a href="#examples">Examples</a><a href="#storylines">Storylines × themes</a><a href="#layouts">Layouts</a><a href="${REPO}/tree/main/docs">Documentation</a><a href="${REPO}">GitHub</a></nav>
<h1>SlideCraft — ${esc(TAGLINE)}</h1><p>${esc(SUMMARY)}</p>
<div class="cta"><a class="btn primary" href="#start">Copy the prompt</a><a class="btn" href="#examples">See example decks</a><a class="btn" href="${REPO}">GitHub</a></div>
<img class="gif" src="slidecraft-story.gif" width="1280" height="720" alt="SlideCraft in 30 seconds: one prompt, the action-title chain, cover options, the built deck, a wrong total caught, and the editable PowerPoint"></header>
<h2 id="start">Start with one prompt</h2><p>No install, no YAML. Paste this into ChatGPT (agent mode), Codex, Claude or Claude Code — any assistant that can run code and open a link — and fill in the brackets.</p>
<div class="prompt"><button type="button" id="copy">Copy</button><pre id="prompt">${esc(d.prompt)}</pre></div>
<p class="note">The assistant runs <code>npx @eiler2005/slidecraft</code> on its side, shows you the titles and covers to approve, then hands you the .pptx and a PDF. Tested with Codex and Claude Code. For repeat work, <a href="${REPO}#install">install it into your assistant</a>.</p>
<ul class="points"><li><b>Native PowerPoint</b>Text, tables, charts, icons and notes stay editable — not a picture of slides.</li><li><b>A consulting method</b>Action titles, one message per slide, ${LAYOUTS.length} layouts with measured limits.</li><li><b>Checked before you see it</b>Every number sourced, totals add up, text fits by PowerPoint's own rules, a final visual review.</li></ul>
<h2 id="examples">Example decks</h2><p>Built in CI from <code>examples/</code> with SlideCraft ${VERSION}. Click a cover to page through the deck in your browser, or download any format.</p><div class="grid">${featured.map(card).join('')}</div>
<h3>More examples</h3><div class="grid">${ex}</div>
<p><img class="hero" loading="lazy" src="${d.hero}" alt="Slides from SlideCraft example decks"></p>
<h2 id="storylines">Storylines × themes</h2><p>${d.storylines.length} storylines in all ${d.themes.length} themes — the storyline is the task, the theme is the look; any pair works.</p>${matrix}
<h2 id="layouts">Layouts</h2><p>${LAYOUTS.length} layouts — each one a content contract with capacity limits. Shown in consulting-classic.</p><div class="grid">${layouts}</div>
<footer>SlideCraft ${VERSION} · PolyForm Shield 1.0.0 · generated by <code>slidecraft site</code> · <a href="${REPO}">${basename(REPO)}</a></footer>
</main><script>document.getElementById('copy').addEventListener('click',function(){var b=this;navigator.clipboard.writeText(document.getElementById('prompt').textContent).then(function(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},1600)})})</script></body></html>
`;
}
