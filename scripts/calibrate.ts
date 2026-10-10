/**
 * Calibration: does our measurer break lines the way PowerPoint does?
 *
 *   npx tsx scripts/calibrate.ts build     # writes tests/.output/calibration/calibration.pptx + expected.json
 *   (export calibration.pptx to calibration.powerpoint.pdf with PowerPoint — `slidecraft build --pdf-engine pptx-convert` does this)
 *   npx tsx scripts/calibrate.ts compare   # compares line counts using `pdftotext -bbox-layout`
 *
 * Go/no-go target (ADR 0005): identical line count for ≥95% of strings and zero cases
 * where PowerPoint needs MORE lines than we measured (that would overflow).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderPptx } from '../src/backends/pptxgenjs.ts';
import type { Scene, SceneSlide, TextStyle } from '../src/engine/scene.ts';
import { layoutText, makeTextNode, para } from '../src/engine/text.ts';
import type { MeasureFont } from '../src/spec/theme.ts';

const OUT = join(process.cwd(), 'tests/.output/calibration');

const EN = [
  'Enterprise and mid-market hold 78% of profit on 41% of revenue',
  'Two well-funded competitors are preparing German launches in 2027, and switching costs make early share sticky.',
  'Our UK mid-market business grew 18% a year since 2022 and now funds itself; the product is proven in a regulated market.',
  'Approve a €6M phase-1 budget and the partner shortlist at this meeting',
  'Partners cut time-to-first-revenue from 18 to 7 months across four comparable entries',
  'Churn is concentrated in the first 90 days, where onboarding fails',
  'We price 12 to 18 percent below competitors in every tier, leaving margin on the table.',
  'Retention, not acquisition, drives the curve',
  'Stop if fewer than 15 signed clients by Q4 2027; review gates every quarter with the steering committee.',
  'Phase 1 is self-limiting: €6M at risk, exit gates every quarter',
  'The German mid-market is 3× our UK base and under-served by incumbent vendors',
  'Customer acquisition cost fell 22% after we moved budget from paid search into partner co-marketing programmes.',
];
const RU = [
  'Выход на рынок Германии в 2027 году даёт окно в €40 млн до прихода двух конкурентов',
  'Два крупных сегмента приносят 78% прибыли при 41% выручки',
  'Партнёрская модель сокращает время до первой выручки с 18 до 7 месяцев',
  'Утвердить бюджет первого этапа €6 млн и короткий список партнёров на этом заседании',
  'Отток сосредоточен в первые 90 дней, когда не срабатывает онбординг клиентов',
  'Мы держим цены на 12–18% ниже конкурентов во всех тарифах и недополучаем маржу.',
];

interface Case {
  id: string;
  slide: number;
  measure: MeasureFont;
  family: string;
  size: number;
  bold: boolean;
  w: number;
  text: string;
  box: { x: number; y: number; w: number; h: number };
  lines: number;
}

function build() {
  mkdirSync(OUT, { recursive: true });
  const fonts: [MeasureFont, string][] = [
    ['liberation-sans', 'Arial'],
    ['gelasio', 'Georgia'],
    ['liberation-serif', 'Times New Roman'],
  ];
  const widths = [2.6, 3.8, 5.6];
  const sizes = [11, 14, 20];
  const cases: Case[] = [];
  const slides: SceneSlide[] = [];
  let n = 0;
  for (const [measure, family] of fonts) {
    const texts = measure === 'gelasio' ? EN : [...EN, ...RU];
    for (const size of sizes) {
      for (const bold of [false, true]) {
        // one slide per font/size/weight; 3 columns × k rows of boxes
        const nodes: SceneSlide['nodes'] = [];
        let col = 0;
        const yCol = [0.3, 0.3, 0.3];
        texts.slice(0, 6 + (size === 11 ? 6 : 0)).forEach((text, ti) => {
          col = ti % 3;
          const w = widths[col]!;
          const style: TextStyle = {
            family,
            measure,
            size,
            lineSpacing: +(size * 1.2).toFixed(2),
            color: '#111111',
            bold,
            align: 'left',
            valign: 'top',
          };
          const ps = [para(text)];
          const laid = layoutText(ps, style, w);
          const h = laid.contentHeight + 0.05;
          const x = [0.3, 3.3, 7.4][col]!;
          const y = yCol[col]!;
          if (y + h > 7.3) return;
          yCol[col] = y + h + 0.18;
          const box = { x, y, w, h };
          nodes.push(makeTextNode(ps, box, style, laid));
          nodes.push({ kind: 'rect', box, stroke: { color: '#DDDDDD', width: 0.25 } });
          cases.push({
            id: `c${n++}`,
            slide: slides.length,
            measure,
            family,
            size,
            bold,
            w,
            text,
            box,
            lines: laid.lines.length,
          });
        });
        slides.push({
          id: `s${slides.length}`,
          index: slides.length,
          layout: 'calibration',
          master: 'plain',
          nodes,
          title: `${family} ${size}${bold ? ' bold' : ''}`,
        });
      }
    }
  }
  const scene: Scene = {
    deckId: 'calibration',
    title: 'SlideCraft calibration',
    language: 'en',
    format: { id: 'wide-16x9', w: 13.333, h: 7.5 },
    themeId: 'none',
    masters: { plain: { id: 'plain', background: '#FFFFFF', nodes: [] } },
    slides,
  };
  return renderPptx(scene, new Date(Date.UTC(2026, 0, 1))).then((buf) => {
    writeFileSync(join(OUT, 'calibration.pptx'), buf);
    writeFileSync(join(OUT, 'expected.json'), JSON.stringify(cases, null, 2));
    console.log(
      `wrote ${cases.length} cases on ${slides.length} slides → ${join(OUT, 'calibration.pptx')}`,
    );
  });
}

function compare() {
  const cases: Case[] = JSON.parse(readFileSync(join(OUT, 'expected.json'), 'utf8'));
  const html = execFileSync(
    'pdftotext',
    ['-bbox-layout', join(OUT, 'calibration.powerpoint.pdf'), '-'],
    { encoding: 'utf8', maxBuffer: 64 << 20 },
  );
  const pages = html.split(/<page /).slice(1);
  let same = 0;
  let more = 0;
  let fewer = 0;
  const rows: string[] = [];
  for (const c of cases) {
    const page = pages[c.slide]!;
    const w = Number(/width="([\d.]+)"/.exec(page)![1]);
    const scale = w / 13.333; // pt per inch in pdf units
    const lines = [
      ...page.matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">/g),
    ].map((m) => ({
      x: Number(m[1]) / scale,
      y: (Number(m[2]) + Number(m[4])) / 2 / scale,
    }));
    const inBox = lines.filter(
      (l) =>
        l.x >= c.box.x - 0.05 &&
        l.x <= c.box.x + c.box.w &&
        l.y >= c.box.y &&
        l.y <= c.box.y + c.box.h + 0.04,
    );
    // merge pdftotext lines that share a baseline
    const ys = [...new Set(inBox.map((l) => Math.round(l.y * 20)))];
    const pp = ys.length;
    if (pp === c.lines) same++;
    else if (pp > c.lines) more++;
    else fewer++;
    if (pp !== c.lines)
      rows.push(
        `${pp > c.lines ? 'MORE ' : 'fewer'} pp=${pp} ours=${c.lines} ${c.family} ${c.size}${c.bold ? 'b' : ''} w=${c.w} "${c.text.slice(0, 50)}"`,
      );
  }
  const total = cases.length;
  console.log(rows.join('\n'));
  console.log(
    `\n${total} strings · identical ${same} (${((same / total) * 100).toFixed(1)}%) · PowerPoint needs more lines ${more} · fewer ${fewer}`,
  );
  const go = same / total >= 0.95 && more === 0;
  console.log(
    go ? 'GO — measurer is safe and matches PowerPoint' : 'NO-GO — adjust slack or metrics',
  );
  writeFileSync(
    join(OUT, 'report.json'),
    JSON.stringify({ total, same, more, fewer, go, mismatches: rows }, null, 2),
  );
  process.exitCode = go ? 0 : 1;
}

if (process.argv[2] === 'compare') compare();
else await build();
