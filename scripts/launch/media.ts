/**
 * Launch media: Product Hunt gallery images (1270×760), the social preview (1280×640, GitHub card
 * and og:image) and the icon (240×240), composed from
 * real renders in docs/showcase. The README GIF comes from scripts/launch/gif-story.ts. Run after the example decks are built:
 *   npx tsx scripts/launch/media.ts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rasterize } from '../../src/backends/resvg.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'docs/media/launch');
const NAVY = '#0B1F3A';
const BLUE = '#1F5FBF';
const INK = '#0B1F3A';
const MUTED = '#5B6B7F';

const png = (p: string) =>
  `data:image/png;base64,${readFileSync(join(ROOT, p)).toString('base64')}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A slide image with a soft shadow and a hairline frame. */
function slide(src: string, x: number, y: number, w: number, label?: string): string {
  const h = (w * 9) / 16;
  return `<g><rect x="${x + 4}" y="${y + 8}" width="${w}" height="${h}" rx="8" fill="#000" opacity="0.18"/>
<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" href="${src}"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#D5DCE5" stroke-width="1"/>
${label ? `<text x="${x}" y="${y + h + 28}" font-family="Liberation Sans" font-size="17" fill="${MUTED}">${esc(label)}</text>` : ''}</g>`;
}

function text(
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight: 'normal' | 'bold' = 'normal',
  anchor = 'start',
): string {
  return `<text x="${x}" y="${y}" font-family="Liberation Sans" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(s)}</text>`;
}

function page(body: string, dark = false, W = 1270, H = 760): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${dark ? NAVY : '#F4F6F9'}"/>${body}</svg>`;
}

function promptCard(x: number, y: number, w: number, lines: string[], size = 17): string {
  const h = 46 + lines.length * (size + 9);
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#FFFFFF" stroke="#D5DCE5"/>
${lines.map((l, i) => text(l, x + 26, y + 40 + i * (size + 9), size, i === 0 ? INK : MUTED, i === 0 ? 'bold' : 'normal')).join('')}</g>`;
}

const PROMPT = [
  'Study github.com/eiler2005/slidecraft and make me',
  'an editable PowerPoint deck.',
  'Topic: Key concepts for understanding LLMs and AI agents',
  'For whom: managers and engineers new to AI',
  'Length: 10–12 slides · Style: calm consulting look',
];

async function main(example: string) {
  mkdirSync(OUT, { recursive: true });
  const ex = `docs/showcase/${example}/previews-office`;
  const exSlides = readdirSync(join(ROOT, ex))
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((f) => `${ex}/${f}`);
  const v2 = 'docs/showcase/fde-engineer/en-v2/previews-office';
  const qa = 'docs/showcase/fde-engineer/en-v2/visual-qa';
  const files: [string, string][] = [];

  // 1 · hero: one slide large enough to read, its parts numbered. The page above it already shows
  // the name and tagline, so the image makes a different point instead of repeating them.
  const heroW = 820;
  const heroY = 200;
  const heroH = (heroW * 9) / 16;
  // marker heights as fractions of the slide: action title, chart, source line
  const parts: [number, string, string][] = [
    [0.117, 'Action title', 'states the point, not the topic'],
    [0.55, 'Native chart', 'edit the numbers, the bars move'],
    [0.903, 'Every number sourced', 'totals checked before you see it'],
  ];
  const marker = (n: number, cx: number, cy: number) =>
    `<circle cx="${cx}" cy="${cy}" r="17" fill="#3D7BE0" stroke="#FFFFFF" stroke-width="3"/>${text(String(n), cx, cy + 7, 19, '#FFFFFF', 'bold', 'middle')}`;
  files.push([
    'ph-1-hero.png',
    page(
      `${text('SlideCraft', 60, 62, 24, '#8FB3E8', 'bold')}
${text('One prompt in your AI assistant,', 60, 116, 40, '#FFFFFF', 'bold')}
${text('this slide out — editable in PowerPoint', 60, 166, 40, '#FFFFFF', 'bold')}
${slide(png(`${v2}/07-pilot-plan.png`), 60, heroY, heroW)}
${parts
  .map(([f, a, b], i) => {
    const y = heroY + f * heroH;
    const ty = heroY + 40 + i * 150;
    return `${marker(i + 1, 60, y)}${marker(i + 1, 935, ty - 8)}${text(a, 965, ty, 24, '#FFFFFF', 'bold')}${text(b, 965, ty + 30, 18, '#C7D3E3')}`;
  })
  .join('')}
${text('ChatGPT · Claude · Codex  →  .pptx · PDF · HTML', 60, 720, 20, '#8FB3E8')}
${text('github.com/eiler2005/slidecraft', 1210, 720, 20, '#8FB3E8', 'normal', 'end')}`,
      true,
    ),
  ]);

  // 2 · one prompt → the deck
  files.push([
    'ph-2-one-prompt.png',
    page(
      `${text('One prompt in your assistant…', 60, 80, 32, INK, 'bold')}
${promptCard(60, 110, 560, PROMPT)}
${text('…an editable .pptx back', 660, 80, 32, INK, 'bold')}
${exSlides
  .slice(0, 6)
  .map((s, i) => slide(png(s), 660 + (i % 2) * 290, 110 + Math.floor(i / 2) * 182, 270))
  .join('')}
${[
  'Brief → storyline → action titles →',
  'cover options → slides → checks → review.',
  '',
  'You approve at four short checkpoints;',
  'everything else is automated.',
]
  .map((l, i) => text(l, 60, 360 + i * 30, 20, MUTED))
  .join('')}`,
    ),
  ]);

  // 3 · PowerPoint = browser
  files.push([
    'ph-3-editable.png',
    page(
      `${text('Native PowerPoint, not a picture of slides', 60, 80, 34, INK, 'bold')}
${text('Text, tables, charts, icons and notes stay editable; the HTML deck breaks lines exactly like PowerPoint.', 60, 118, 19, MUTED)}
${slide(png(`${qa}/07-pilot-plan-pptx.png`), 60, 170, 560, 'Rendered by PowerPoint')}
${slide(png(`${qa}/07-pilot-plan-html.png`), 650, 170, 560, 'Rendered by the browser')}
${text('Combo chart: native PowerPoint chart with a second axis — edit the numbers, the bars move.', 60, 690, 19, MUTED)}`,
    ),
  ]);

  // 4 · checks
  files.push([
    'ph-4-checks.png',
    page(
      `${text('Checked before you see it', 60, 80, 34, INK, 'bold')}
${slide(png(`${v2}/08-budget.png`), 60, 130, 600)}
${[
  ['Totals add up', 'SC-CONSIST-002 caught $69k vs $67k'],
  ['One number, one value', 'the same metric agrees on every slide'],
  ['Every number sourced', 'sources in the footer and the notes'],
  ['Text fits, never shrinks', 'measured with PowerPoint’s own rules'],
  ['A reviewer model looks', 'at every slide, writes a report'],
]
  .map(
    ([a, b], i) =>
      `<circle cx="712" cy="${152 + i * 92}" r="12" fill="${BLUE}"/>${text(a!, 738, 158 + i * 92, 22, INK, 'bold')}${text(b!, 738, 186 + i * 92, 17, MUTED)}`,
  )
  .join('')}`,
    ),
  ]);

  // 5 · library
  files.push([
    'ph-5-library.png',
    page(
      `${text('46 layouts · 14 storylines · 7 themes — or your brand', 60, 80, 32, INK, 'bold')}
${text('Value chain, 7S, waterfall, Marimekko, gantt, 2×2, combo charts… Icons, stock photos, a theme from any PDF or website.', 60, 116, 18, MUTED)}
<image x="60" y="150" width="1150" height="560" preserveAspectRatio="xMidYMid meet" href="${png('docs/gallery/strategy-recommendation--consulting-classic.png')}"/>`,
    ),
  ]);

  for (const [name, svg] of files) writeFileSync(join(OUT, name), await rasterize(svg, 1270));

  // social preview (GitHub repository card, og:image of the site): 1280×640
  const social = page(
    `${text('SlideCraft', 64, 92, 28, '#8FB3E8', 'bold')}
${text('Editable PowerPoint decks', 64, 158, 50, '#FFFFFF', 'bold')}
${text('from one prompt', 64, 220, 50, '#FFFFFF', 'bold')}
${text('ChatGPT · Claude · Codex — action titles, sourced numbers, a review before hand-off', 64, 268, 21, '#C7D3E3')}
${slide(png(`${v2}/01-cover.png`), 64, 318, 360)}
${slide(png(`${v2}/03-value-chain.png`), 460, 318, 360)}
${slide(png(`${v2}/07-pilot-plan.png`), 856, 318, 360)}
${text('github.com/eiler2005/slidecraft', 64, 600, 20, '#8FB3E8')}`,
    true,
    1280,
    640,
  );
  writeFileSync(join(OUT, 'social-preview.png'), await rasterize(social, 1280));

  // icon: a slide with a rising chevron, in the brand blue
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="52" fill="${NAVY}"/><rect x="44" y="64" width="152" height="112" rx="10" fill="#FFFFFF"/><rect x="60" y="82" width="64" height="9" rx="4" fill="${NAVY}"/><rect x="60" y="98" width="44" height="6" rx="3" fill="#B9C7DA"/><rect x="62" y="140" width="18" height="22" fill="#B9C7DA"/><rect x="88" y="128" width="18" height="34" fill="#7F9CC4"/><rect x="114" y="114" width="18" height="48" fill="${BLUE}"/><polyline points="146,150 162,132 178,112" fill="none" stroke="${BLUE}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  writeFileSync(join(OUT, 'icon-240.png'), await rasterize(icon, 240));
  // the Claude plugin directory listing icon: a square PNG, 512–2048 px, read from this path
  writeFileSync(join(ROOT, '.claude-plugin/icon.png'), await rasterize(icon, 1024));

  // the explainer GIF is scripts/launch/gif-story.ts
  console.log(`✔ ${files.length} gallery images, the social preview and the icon`);
}

await main(process.argv[2] ?? 'llm-concepts');
