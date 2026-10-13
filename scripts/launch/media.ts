/**
 * Launch media: Product Hunt gallery images (1270×760), the icon (240×240) and the README
 * GIF, composed from real renders in docs/showcase. Run after the example decks are built:
 *   npx tsx scripts/launch/media.ts
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rasterize, rasterPixels } from '../../src/backends/resvg.ts';
import { encodeGif, type Frame } from './gif.ts';

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

  // 1 · hero
  files.push([
    'ph-1-hero.png',
    page(
      `${text('SlideCraft', 70, 110, 30, '#8FB3E8', 'bold')}
${text('Consulting-grade, editable PowerPoint', 70, 175, 46, '#FFFFFF', 'bold')}
${text('decks from one prompt', 70, 232, 46, '#FFFFFF', 'bold')}
${text('Tested in Codex and Claude Code · native text, charts and shapes · every number sourced', 70, 282, 20, '#C7D3E3')}
${slide(png(`${v2}/01-cover.png`), 70, 340, 360)}
${slide(png(`${v2}/03-value-chain.png`), 455, 340, 360)}
${slide(png(`${v2}/07-pilot-plan.png`), 840, 340, 360)}
${text('github.com/eiler2005/slidecraft', 70, 700, 20, '#8FB3E8')}`,
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
      `${text('42 layouts · 14 storylines · 7 themes — or your brand', 60, 80, 32, INK, 'bold')}
${text('Value chain, 7S, waterfall, Marimekko, gantt, 2×2, combo charts… Icons, stock photos, a theme from any PDF or website.', 60, 116, 18, MUTED)}
<image x="60" y="150" width="1150" height="560" preserveAspectRatio="xMidYMid meet" href="${png('docs/gallery/strategy-recommendation--consulting-classic.png')}"/>`,
    ),
  ]);

  for (const [name, svg] of files) writeFileSync(join(OUT, name), await rasterize(svg, 1270));

  // icon: a slide with a rising chevron, in the brand blue
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="52" fill="${NAVY}"/><rect x="44" y="64" width="152" height="112" rx="10" fill="#FFFFFF"/><rect x="60" y="82" width="64" height="9" rx="4" fill="${NAVY}"/><rect x="60" y="98" width="44" height="6" rx="3" fill="#B9C7DA"/><rect x="62" y="140" width="18" height="22" fill="#B9C7DA"/><rect x="88" y="128" width="18" height="34" fill="#7F9CC4"/><rect x="114" y="114" width="18" height="48" fill="${BLUE}"/><polyline points="146,150 162,132 178,112" fill="none" stroke="${BLUE}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  writeFileSync(join(OUT, 'icon-240.png'), await rasterize(icon, 240));

  // GIF: prompt → title chain → cover options → the deck, PowerPoint renders
  const W = 960;
  const frames: Frame[] = [];
  const add = async (svg: string, delay: number) => {
    const p = await rasterPixels(svg, W);
    frames.push({ width: p.width, height: p.height, rgba: p.pixels, delay });
  };
  const caption = (s: string) =>
    `<rect x="0" y="490" width="960" height="50" fill="${NAVY}"/>${text(s, 480, 523, 22, '#FFFFFF', 'bold', 'middle')}`;
  await add(
    page(
      `${text('1 · One prompt', 40, 70, 30, INK, 'bold')}${promptCard(40, 100, 880, PROMPT, 22)}${caption('Codex · Claude Code · any assistant that runs code')}`,
      false,
      960,
      540,
    ),
    2600,
  );
  const titles = JSON.parse(
    readFileSync(join(ROOT, `docs/showcase/${example}/titles.json`), 'utf8'),
  ) as string[];
  await add(
    page(
      `${text('2 · The argument first: action titles', 40, 60, 28, INK, 'bold')}${titles
        .slice(0, 11)
        .map((t, i) =>
          text(
            `${String(i + 1).padStart(2, '0')}  ${t.length > 82 ? `${t.slice(0, 80)}…` : t}`,
            40,
            105 + i * 34,
            17,
            i === 0 ? INK : MUTED,
            i === 0 ? 'bold' : 'normal',
          ),
        )
        .join('')}${caption('You approve the title chain before any slide is built')}`,
      false,
      960,
      540,
    ),
    3000,
  );
  const covers = `docs/showcase/${example}/covers`;
  if (existsSync(join(ROOT, covers)))
    await add(
      page(
        `${text('3 · Pick a cover', 40, 60, 28, INK, 'bold')}${['A', 'B', 'C']
          .filter((l) => existsSync(join(ROOT, covers, `option-${l}.png`)))
          .map(
            (l, i) =>
              `${slide(png(`${covers}/option-${l}.png`), 40 + i * 300, 110, 280)}${text(l, 40 + i * 300, 290, 22, BLUE, 'bold')}`,
          )
          .join('')}${caption('2–3 cover options, compared and recommended')}`,
        false,
        960,
        540,
      ),
      2600,
    );
  for (const s of exSlides.slice(0, 8))
    await add(
      `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><image width="960" height="540" href="${png(s)}"/>${caption('4 · An editable PowerPoint, rendered by PowerPoint')}</svg>`,
      1500,
    );
  writeFileSync(join(ROOT, 'docs/media/slidecraft-demo.gif'), encodeGif(frames));
  if (process.env.GIF_FRAMES) {
    const { encodePng } = await import('../../src/qa/raster.ts');
    frames.forEach((f, i) => {
      const rgb = new Uint8Array((f.rgba.length / 4) * 3);
      for (let a = 0, b = 0; a < f.rgba.length; a += 4, b += 3)
        rgb.set(f.rgba.subarray(a, a + 3), b);
      writeFileSync(
        join(process.env.GIF_FRAMES!, `frame-${i}.png`),
        encodePng({ width: f.width, height: f.height, rgb }),
      );
    });
  }
  console.log(`✔ ${files.length} gallery images, icon and GIF (${frames.length} frames)`);
}

await main(process.argv[2] ?? 'llm-concepts');
