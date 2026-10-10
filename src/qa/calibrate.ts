/**
 * Calibration: do our line breaks match PowerPoint for a theme's fonts?
 * Builds a PPTX of test strings in several widths and sizes, has PowerPoint/LibreOffice
 * render it to PDF (pptx-convert), and compares line counts using `pdftotext -bbox-layout`.
 * Go/no-go (ADR 0005): ≥ 95% identical and zero cases where PowerPoint needs more lines.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pptxConvertEngine } from '../backends/pptx-convert.ts';
import { renderPptx } from '../backends/pptxgenjs.ts';
import type { Scene, SceneSlide, TextStyle } from '../engine/scene.ts';
import { layoutText, makeTextNode, para } from '../engine/text.ts';
import type { FontSpec } from '../spec/theme.ts';

export const CALIBRATION_STRINGS = [
  'Enterprise and mid-market hold 78% of profit on 41% of revenue',
  'Two well-funded competitors are preparing German launches in 2027, and switching costs make early share sticky.',
  'Our UK mid-market business grew 18% a year since 2022 and now funds itself; the product is proven in a regulated market.',
  'Approve a €6M phase-1 budget and the partner shortlist at this meeting',
  'Partners cut time-to-first-revenue from 18 to 7 months across four comparable entries',
  'Churn is concentrated in the first 90 days, where onboarding fails',
  'We price 12 to 18 percent below competitors in every tier, leaving margin on the table.',
  'Retention, not acquisition, drives the curve',
  'Stop if fewer than 15 signed clients by Q4 2027; review gates every quarter with the steering committee.',
  'Customer acquisition cost fell 22% after we moved budget from paid search into partner co-marketing programmes.',
  'Выход на рынок Германии в 2027 году даёт окно в €40 млн до прихода двух конкурентов',
  'Отток сосредоточен в первые 90 дней, когда не срабатывает онбординг клиентов',
];

interface Case {
  slide: number;
  family: string;
  size: number;
  bold: boolean;
  w: number;
  text: string;
  box: { x: number; y: number; w: number; h: number };
  lines: number;
}

export interface CalibrationReport {
  total: number;
  same: number;
  more: number;
  fewer: number;
  go: boolean;
  mismatches: string[];
  pptx: string;
  pdf?: string;
  skipped?: string;
}

export function buildCalibrationScene(
  fonts: FontSpec[],
  strings = CALIBRATION_STRINGS,
): { scene: Scene; cases: Case[] } {
  const widths = [2.6, 3.8, 5.6];
  const cases: Case[] = [];
  const slides: SceneSlide[] = [];
  const seen = new Set<string>();
  for (const f of fonts) {
    if (seen.has(f.measure)) continue;
    seen.add(f.measure);
    for (const size of [11, 14, 20]) {
      for (const bold of [false, true]) {
        const nodes: SceneSlide['nodes'] = [];
        const yCol = [0.3, 0.3, 0.3];
        strings.slice(0, size === 11 ? 12 : 6).forEach((text, ti) => {
          const col = ti % 3;
          const w = widths[col]!;
          const style: TextStyle = {
            family: f.family,
            measure: f.measure,
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
          cases.push({
            slide: slides.length,
            family: f.family,
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
          title: `${f.family} ${size}${bold ? ' bold' : ''}`,
        });
      }
    }
  }
  const scene: Scene = {
    deckId: 'calibration',
    title: 'SlideCraft calibration',
    language: 'en',
    format: { id: 'wide-16x9', w: 13.333, h: 7.5 },
    themeId: 'calibration',
    masters: { plain: { id: 'plain', background: '#FFFFFF', nodes: [] } },
    slides,
  };
  return { scene, cases };
}

export function compareCalibration(
  cases: Case[],
  pdf: string,
): Omit<CalibrationReport, 'pptx' | 'pdf'> {
  const html = execFileSync('pdftotext', ['-bbox-layout', pdf, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  });
  const pages = html.split(/<page /).slice(1);
  let same = 0;
  let more = 0;
  let fewer = 0;
  const mismatches: string[] = [];
  for (const c of cases) {
    const page = pages[c.slide]!;
    const scale = Number(/width="([\d.]+)"/.exec(page)![1]) / 13.333;
    const lines = [
      ...page.matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">/g),
    ].map((m) => ({ x: Number(m[1]) / scale, y: (Number(m[2]) + Number(m[4])) / 2 / scale }));
    const inBox = lines.filter(
      (l) =>
        l.x >= c.box.x - 0.05 &&
        l.x <= c.box.x + c.box.w &&
        l.y >= c.box.y &&
        l.y <= c.box.y + c.box.h + 0.04,
    );
    const pp = new Set(inBox.map((l) => Math.round(l.y * 20))).size;
    if (pp === c.lines) same++;
    else if (pp > c.lines) more++;
    else fewer++;
    if (pp !== c.lines)
      mismatches.push(
        `${pp > c.lines ? 'MORE ' : 'fewer'} powerpoint=${pp} slidecraft=${c.lines} · ${c.family} ${c.size}${c.bold ? 'b' : ''} w=${c.w} · "${c.text.slice(0, 48)}"`,
      );
  }
  const total = cases.length;
  return {
    total,
    same,
    more,
    fewer,
    go: total > 0 && same / total >= 0.95 && more === 0,
    mismatches,
  };
}

export async function runCalibration(
  fonts: FontSpec[],
  outDir: string,
): Promise<CalibrationReport> {
  mkdirSync(outDir, { recursive: true });
  const { scene, cases } = buildCalibrationScene(fonts);
  const pptx = join(outDir, 'calibration.pptx');
  writeFileSync(pptx, await renderPptx(scene, new Date(Date.UTC(2026, 0, 1))));
  writeFileSync(join(outDir, 'expected.json'), JSON.stringify(cases, null, 2));
  const d = await pptxConvertEngine.detect();
  if (!d.available)
    return {
      total: cases.length,
      same: 0,
      more: 0,
      fewer: 0,
      go: false,
      mismatches: [],
      pptx,
      skipped: `no converter: ${d.detail}`,
    };
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  } catch {
    return {
      total: cases.length,
      same: 0,
      more: 0,
      fewer: 0,
      go: false,
      mismatches: [],
      pptx,
      skipped: 'pdftotext (poppler) not installed — brew install poppler',
    };
  }
  await pptxConvertEngine.render(scene, {
    outDir,
    baseName: 'calibration',
    deckDir: outDir,
    epoch: new Date(),
    pptxPath: pptx,
  });
  const pdf = join(outDir, 'calibration.pdf');
  const r = compareCalibration(cases, pdf);
  const report = { ...r, pptx, pdf };
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}

export function readExpected(outDir: string): Case[] {
  return JSON.parse(readFileSync(join(outDir, 'expected.json'), 'utf8'));
}
