/**
 * The explainer GIF: what SlideCraft does, scene by scene, from real renders.
 * Problem → one prompt → storyline → cover → build → checks → editable → result, with a step
 * bar on every frame and short cross-fades between scenes. Dark stage, white slides.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rasterPixels } from '../../src/backends/resvg.ts';
import { LAYOUTS } from '../../src/layouts/index.ts';
import type { Frame } from './gif.ts';

const W = 960;
const H = 540;
const STAGE = '#0B1F3A';
const STAGE2 = '#16305A';
const WHITE = '#FFFFFF';
const SOFT = '#A9BCD6';
const ACCENT = '#4C8DF6';
const GREEN = '#35C08A';
const RED = '#FF6B5E';
const INK = '#0B1F3A';
const MUTED = '#5B6B7F';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let uid = 0;

function t(
  s: string,
  x: number,
  y: number,
  size: number,
  color = WHITE,
  weight: 'normal' | 'bold' = 'normal',
  anchor: 'start' | 'middle' | 'end' = 'start',
): string {
  return `<text x="${x}" y="${y}" font-family="Liberation Sans" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(s)}</text>`;
}

/** Round badge with a drawn tick, cross or number (fonts have no ✓/✕). */
function badge(
  cx: number,
  cy: number,
  kind: 'tick' | 'cross' | 'bang',
  color: string,
  r = 12,
): string {
  const k = r / 12;
  const mark =
    kind === 'tick'
      ? `<path d="M ${cx - 5 * k} ${cy} L ${cx - 1.5 * k} ${cy + 4 * k} L ${cx + 5.5 * k} ${cy - 4.5 * k}" stroke="#fff" stroke-width="${2.6 * k}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : kind === 'cross'
        ? `<path d="M ${cx - 4.5 * k} ${cy - 4.5 * k} L ${cx + 4.5 * k} ${cy + 4.5 * k} M ${cx + 4.5 * k} ${cy - 4.5 * k} L ${cx - 4.5 * k} ${cy + 4.5 * k}" stroke="#fff" stroke-width="${2.6 * k}" stroke-linecap="round"/>`
        : `<path d="M ${cx} ${cy - 5.5 * k} L ${cx} ${cy + 1.5 * k}" stroke="#fff" stroke-width="${2.8 * k}" stroke-linecap="round"/><circle cx="${cx}" cy="${cy + 5.2 * k}" r="${1.6 * k}" fill="#fff"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>${mark}`;
}

const STEPS = ['Prompt', 'Storyline', 'Cover', 'Build', 'Checks', 'Editable'];

function stepBar(current: number): string {
  const w = (W - 120) / STEPS.length;
  const y = 30;
  let out = `<line x1="${60 + w / 2}" y1="${y}" x2="${60 + w * (STEPS.length - 0.5)}" y2="${y}" stroke="#2C4A78" stroke-width="2"/>`;
  out += `<line x1="${60 + w / 2}" y1="${y}" x2="${60 + w * (current + 0.5)}" y2="${y}" stroke="${ACCENT}" stroke-width="3"/>`;
  STEPS.forEach((s, i) => {
    const cx = 60 + w * (i + 0.5);
    if (i < current) out += badge(cx, y, 'tick', ACCENT, 11);
    else if (i === current)
      out += `<circle cx="${cx}" cy="${y}" r="14" fill="${ACCENT}"/><circle cx="${cx}" cy="${y}" r="19" fill="none" stroke="${ACCENT}" stroke-opacity="0.35" stroke-width="4"/>${t(String(i + 1), cx, y + 5, 14, WHITE, 'bold', 'middle')}`;
    else
      out += `<circle cx="${cx}" cy="${y}" r="11" fill="${STAGE}" stroke="#3B5A8A" stroke-width="2"/>${t(String(i + 1), cx, y + 4, 11, SOFT, 'bold', 'middle')}`;
    out += t(
      s,
      cx,
      y + 34,
      13,
      i === current ? WHITE : SOFT,
      i === current ? 'bold' : 'normal',
      'middle',
    );
  });
  return out;
}

function stage(body: string, step?: number, caption?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><radialGradient id="bg" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="${STAGE2}"/><stop offset="1" stop-color="${STAGE}"/></radialGradient>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.35"/></filter></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${step !== undefined ? stepBar(step) : ''}${body}
${t('SlideCraft', W - 24, H - (caption ? 62 : 20), 13, SOFT, 'bold', 'end')}
${caption ? `<rect x="0" y="${H - 50}" width="${W}" height="50" fill="#07152B"/><rect x="0" y="${H - 50}" width="${W}" height="3" fill="${ACCENT}"/>${t(caption, W / 2, H - 18, 19, WHITE, 'bold', 'middle')}` : ''}
</svg>`;
}

interface Asset {
  w: number;
  h: number;
  /** Vector slide: the inner markup of its SVG (drawn with the stage's fonts). */
  inner?: string;
  uri?: string;
}
let resolve: (p: string) => Asset = () => {
  throw new Error('no assets');
};

/** The asset drawn into a box; `view` crops it (fractions of the asset). */
function place(
  p: string,
  x: number,
  y: number,
  w: number,
  h: number,
  view = { x: 0, y: 0, w: 1, h: 1 },
): string {
  const a = resolve(p);
  if (a.inner !== undefined) {
    // ids inside each embedded slide must be unique on the stage
    const pre = `s${uid++}_`;
    const inner = a.inner
      .replace(/\bid="([^"]+)"/g, `id="${pre}$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#${pre}$1)`)
      .replace(/href="#([^"]+)"/g, `href="#${pre}$1"`);
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${view.x * a.w} ${view.y * a.h} ${view.w * a.w} ${view.h * a.h}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  }
  const s = w / (view.w * a.w);
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}"><image x="${-view.x * a.w * s}" y="${-view.y * a.h * s}" width="${a.w * s}" height="${a.h * s}" href="${a.uri}"/></svg>`;
}

/** A slide with rounded corners and a soft shadow; optional coloured ring. */
function slideImg(
  src: string,
  x: number,
  y: number,
  w: number,
  ring?: string,
  h = (w * 9) / 16,
): string {
  const id = `c${uid++}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/></clipPath>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#fff" filter="url(#sh)"/>
<g clip-path="url(#${id})">${place(src, x, y, w, h)}</g>
${ring ? `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="11" fill="none" stroke="${ring}" stroke-width="4"/>` : ''}`;
}

/** Part of a slide, enlarged into a box (a magnifier). */
function zoom(
  src: string,
  crop: { x: number; y: number; w: number; h: number },
  box: { x: number; y: number; w: number },
): string {
  const a = resolve(src);
  const id = `z${uid++}`;
  const h = (box.w * crop.h * a.h) / (crop.w * a.w);
  return `<clipPath id="${id}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${h}" rx="10"/></clipPath>
<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${h}" rx="10" fill="#fff" filter="url(#sh)"/>
<g clip-path="url(#${id})">${place(src, box.x, box.y, box.w, h, crop)}</g>`;
}

/** A pill label pinned next to the element it explains. */
function pin(label: string, x: number, y: number, color = ACCENT): string {
  const w = label.length * 7.6 + 26;
  return `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="26" rx="13" fill="${color}"/></g>${t(label, x + 13, y + 18, 13.5, WHITE, 'bold')}`;
}

export interface StoryInput {
  root: string;
  prompt: string[];
  titles: string[];
  covers: string[];
  recommended: number;
  why: string;
  slides: string[];
  /** The slide with the planted wrong total, and where the total row and wrong cell are (fractions). */
  totalSlide: string;
  totalRow: { x: number; y: number; w: number; h: number };
  wrongCell: { x: number; w: number };
  chartSlide: string;
  notes: string[];
}

function blend(a: Uint8Array, b: Uint8Array, k: number): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = Math.round(a[i]! * (1 - k) + b[i]! * k);
  return out;
}

/** Pixel size of an image asset (SVG width/height attributes, else the PNG header). */
function assetSize(data: Buffer, isSvg: boolean): { w: number; h: number } {
  if (isSvg) {
    const svg = data.toString('utf8', 0, 400);
    return {
      w: Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? 1600),
      h: Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 900),
    };
  }
  return { w: data.readUInt32BE(16), h: data.readUInt32BE(20) };
}

export async function storyFrames(s: StoryInput, scale = 4 / 3): Promise<Frame[]> {
  // slides as vector SVG stay sharp at any size; PNG works too
  const cache = new Map<string, Asset>();
  resolve = (p: string) => {
    let a = cache.get(p);
    if (!a) {
      const data = readFileSync(join(s.root, p));
      if (p.endsWith('.svg')) {
        const text = data.toString('utf8');
        const { w, h } = assetSize(data, true);
        a = { w, h, inner: text.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '') };
      } else {
        const { w, h } = assetSize(data, false);
        a = { w, h, uri: `data:image/png;base64,${data.toString('base64')}` };
      }
      cache.set(p, a);
    }
    return a;
  };
  const png = (p: string) => p;
  const frames: Frame[] = [];
  let scene = 0;
  let lastSceneFirst = -1;
  const add = async (svg: string, delay: number, newScene = true) => {
    uid = 0;
    const p = await rasterPixels(svg, Math.round(W * scale));
    const f = { width: p.width, height: p.height, rgba: p.pixels, delay };
    // cross-fade from the previous scene
    if (newScene && frames.length && scene > 0) {
      const prev = frames[frames.length - 1]!;
      for (const k of [0.35, 0.7])
        frames.push({
          width: f.width,
          height: f.height,
          rgba: blend(prev.rgba, f.rgba, k),
          delay: 70,
        });
    }
    if (newScene) {
      scene++;
      lastSceneFirst = frames.length;
    }
    frames.push(f);
  };
  void lastSceneFirst;

  // 0 · the problem
  const bad = `<g filter="url(#sh)"><rect x="60" y="110" width="400" height="225" rx="8" fill="#FFFFFF"/></g>${t('AI Agents Overview', 82, 145, 19, INK, 'bold')}${[
    '• LLMs are large language models trained on data',
    '• Agents can use tools and APIs to do things',
    '• RAG improves answers with retrieval of documents',
    '• Fine-tuning vs prompting has trade-offs',
    '• Hallucinations can happen and should be managed',
    '• Evaluation, guardrails, cost and latency matter',
    '• Many vendors offer models with different prices',
    '• Context windows are getting larger every year',
    '• Agents may need memory and planning abilities',
  ]
    .map((l, i) => t(l, 82, 172 + i * 17, 11, '#555'))
    .join('')}`;
  const issues: [string, string?][] = [
    ['Title is a topic, not a claim'],
    ['A wall of bullets, no exhibit'],
    ['No source for any statement'],
    ['Often a picture or a web page —', 'not a PowerPoint you can edit'],
  ];
  await add(
    stage(
      `${t('AI makes slides fast —', 60, 78, 34, WHITE, 'bold')}${t('and usually wrong', 455, 78, 34, RED, 'bold')}${bad}${issues
        .map(
          ([a, b], i) =>
            `${badge(512, 150 + i * 46, 'cross', RED)}${t(a, 534, 156 + i * 46, 19, WHITE, 'bold')}${b ? t(b, 534, 180 + i * 46, 17, SOFT) : ''}`,
        )
        .join('')}`,
      undefined,
      'SlideCraft gives your AI assistant a consulting method',
    ),
    3400,
  );

  // 1 · one prompt
  const card = (n: number) =>
    `${t('Paste one prompt', 60, 112, 26, WHITE, 'bold')}<g filter="url(#sh)"><rect x="60" y="132" width="840" height="${54 + s.prompt.length * 36}" rx="18" fill="#FFFFFF"/></g>${s.prompt
      .slice(0, n)
      .map((l, i) => t(l, 90, 174 + i * 36, 20, i === 0 ? INK : MUTED, i === 0 ? 'bold' : 'normal'))
      .join(
        '',
      )}${n < s.prompt.length ? `<rect x="90" y="${158 + n * 36}" width="2" height="22" fill="${ACCENT}"/>` : ''}`;
  await add(stage(card(1), 0, 'In Codex, Claude Code or any assistant that runs code'), 800);
  await add(stage(card(2), 0, 'In Codex, Claude Code or any assistant that runs code'), 700, false);
  await add(
    stage(card(s.prompt.length), 0, 'In Codex, Claude Code or any assistant that runs code'),
    2400,
    false,
  );

  // 2 · storyline: titles reveal, the newest highlighted
  const chain = (n: number) =>
    `${t('The argument first — one claim per slide', 60, 112, 24, WHITE, 'bold')}${s.titles
      .slice(0, n)
      .map((x, i) => {
        const y = 140 + i * 28;
        const on = i === n - 1;
        const label = `${x.length > 84 ? `${x.slice(0, 82)}…` : x}`;
        return `${on ? `<rect x="54" y="${y - 2}" width="852" height="25" rx="6" fill="${ACCENT}" fill-opacity="0.22"/>` : ''}${t(String(i + 1).padStart(2, '0'), 66, y + 16, 14, on ? ACCENT : '#6F86A8', 'bold')}${t(label, 98, y + 16, 15, on ? WHITE : SOFT, on ? 'bold' : 'normal')}`;
      })
      .join('')}`;
  const cap2 = 'You approve the action titles before any slide is built';
  await add(stage(chain(4), 1, cap2), 800);
  await add(stage(chain(8), 1, cap2), 800, false);
  await add(stage(chain(s.titles.length), 1, cap2), 2600, false);

  // 3 · cover options with the recommendation
  const n = s.covers.length;
  const cw = n === 2 ? 380 : 270;
  const gap = 40;
  const x0 = (W - (n * cw + (n - 1) * gap)) / 2;
  const ch = (cw * 9) / 16;
  await add(
    stage(
      `${t('2–3 covers — compared, then you choose', 60, 112, 24, WHITE, 'bold')}${s.covers
        .map((c, i) => {
          const x = x0 + i * (cw + gap);
          const on = i === s.recommended;
          return `${slideImg(png(c), x, 140, cw, on ? GREEN : undefined)}${t(`Option ${String.fromCharCode(65 + i)}`, x, 140 + ch + 32, 17, on ? WHITE : SOFT, 'bold')}${on ? `${badge(x + cw - 124, 140 + ch + 27, 'tick', GREEN, 10)}${t('Recommended', x + cw, 140 + ch + 32, 15, GREEN, 'bold', 'end')}` : ''}`;
        })
        .join('')}${t(s.why, W / 2, 140 + ch + 70, 16, SOFT, 'normal', 'middle')}`,
      2,
      'Nothing is defaulted — the cover says what the deck is about',
    ),
    2800,
  );

  // 4 · build: the deck fills in
  const gw = 196;
  const gh = gw * 0.5625;
  const gx = (W - (4 * gw + 3 * 16)) / 2;
  const grid = (k: number) =>
    s.slides
      .slice(0, k)
      .map((p, i) =>
        slideImg(png(p), gx + (i % 4) * (gw + 16), 88 + Math.floor(i / 4) * (gh + 14), gw),
      )
      .join('');
  const cap4 = `${LAYOUTS.length} measured layouts — text fits, nothing is shrunk`;
  await add(stage(grid(4), 3, cap4), 650);
  await add(stage(grid(8), 3, cap4), 650, false);
  await add(stage(grid(s.slides.length), 3, cap4), 2400, false);

  // 5 · checks: the wrong total, magnified
  const ts = s.totalSlide;
  const { w: IW, h: IH } = resolve(ts);
  const row = s.totalRow;
  const zx = 60;
  const zy = 252;
  const zw = 540;
  const zh = (row.h * IH * zw) / (row.w * IW);
  const cellX = zx + ((s.wrongCell.x - row.x) / row.w) * zw;
  const cellW = (s.wrongCell.w / row.w) * zw;
  await add(
    stage(
      `${slideImg(png(ts), 60, 92, 260)}${zoom(png(ts), row, { x: zx, y: zy, w: zw })}<rect x="${cellX - 4}" y="${zy - 4}" width="${cellW + 8}" height="${zh + 8}" rx="6" fill="none" stroke="${RED}" stroke-width="3"/>${pin('Items add up to $67k, not $69k', cellX - 40, zy + zh + 14, RED)}${[
        ['tick', 'Every number has a source'],
        ['tick', 'One metric, one value everywhere'],
        ['bang', 'Totals that do not add up: caught'],
        ['tick', 'A reviewer model checks every slide'],
      ]
        .map(
          ([k, l], i) =>
            `${badge(624, 126 + i * 44, k as 'tick', k === 'bang' ? RED : GREEN)}${t(l!, 646, 132 + i * 44, 17, WHITE, 'bold')}`,
        )
        .join(
          '',
        )}${t('Shown before you see the deck,', 624, 330, 16, SOFT)}${t('with a report of what needs you', 624, 352, 16, SOFT)}`,
      4,
      'Checked before you see it',
    ),
    3400,
  );

  // 6 · editable
  const ex = 60;
  const ey = 86;
  const ew = 560;
  const eh = ew * 0.5625;
  await add(
    stage(
      `${slideImg(png(s.chartSlide), ex, ey, ew)}${pin('Action title = the claim', ex + ew * 0.5, ey - 14)}${pin('Native chart — edit the numbers', ex + ew * 0.16, ey + eh * 0.66)}${pin('Editable text', ex + ew * 0.74, ey + eh * 0.72)}<g filter="url(#sh)"><rect x="${ex}" y="${ey + eh + 14}" width="${ew}" height="${H - 50 - (ey + eh + 14) - 12}" rx="8" fill="#FFFFFF"/></g>${t('Speaker notes', ex + 14, ey + eh + 36, 12, MUTED, 'bold')}${s.notes
        .slice(0, 2)
        .map((l, i) =>
          t(
            l.length > 70 ? `${l.slice(0, 68)}…` : l,
            ex + 14,
            ey + eh + 56 + i * 18,
            13,
            i === 0 ? ACCENT : INK,
            i === 0 ? 'bold' : 'normal',
          ),
        )
        .join('')}${[
        ['A real .pptx file', 'not an image, not a web page'],
        ['Native text, tables, charts', 'icons and shapes'],
        ['Sources in the notes', 'for every slide'],
        ['Also PDF and HTML', 'from the same source'],
      ]
        .map(
          ([a, b], i) =>
            `${badge(664, 112 + i * 62, 'tick', GREEN)}${t(a!, 686, 118 + i * 62, 17, WHITE, 'bold')}${t(b!, 686, 140 + i * 62, 14, SOFT)}`,
        )
        .join('')}`,
      5,
      'Open it in PowerPoint and keep working',
    ),
    3600,
  );

  // 7 · the result
  const hero = s.slides.slice(0, 3);
  await add(
    stage(
      `${t('One prompt →', W / 2, 110, 40, WHITE, 'bold', 'middle')}${t('an editable PowerPoint your team can use', W / 2, 160, 28, ACCENT, 'bold', 'middle')}${hero
        .map((p, i) => slideImg(png(p), 100 + i * 260, 205, 240))
        .join(
          '',
        )}${t('github.com/eiler2005/slidecraft', W / 2, 405, 26, WHITE, 'bold', 'middle')}${t('npx @eiler2005/slidecraft', W / 2, 438, 17, SOFT, 'normal', 'middle')}`,
      undefined,
      'SlideCraft — consulting-grade, editable decks from one prompt',
    ),
    3600,
  );
  return frames;
}
