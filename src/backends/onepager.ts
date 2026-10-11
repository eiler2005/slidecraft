/**
 * One-pager: the deck's argument on an A4 portrait page — title, then every slide as a
 * vector thumbnail captioned with its action title, in reading order. The title chain
 * is the story, so a reader who never opens the deck still gets the logic.
 * More slides than fit spill onto further pages; the cover is the page header.
 */
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import type { Scene } from '../engine/scene.ts';
import { drawSlide, fontName, registerFonts } from './native-pdf.ts';
import type { Engine } from './types.ts';

const P = 72;
const PAGE = { w: 8.268, h: 11.693 };
const M = 0.6;
const COLS = 3;
const GAP = 0.22;
const CAPTION = 0.62;

export async function renderOnePager(scene: Scene, path: string, epoch: Date): Promise<void> {
  const pal = scene.palette ?? {
    background: '#FFFFFF',
    ink: '#111111',
    muted: '#666666',
    accent: '#1F4E9E',
    rule: '#D0D5DD',
    surface: '#F2F4F7',
  };
  const heading = scene.fonts?.heading.measure ?? 'liberation-sans';
  const body = scene.fonts?.body.measure ?? 'liberation-sans';
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: [PAGE.w * P, PAGE.h * P],
    margin: 0,
    info: {
      Title: `${scene.title} — one-page summary`,
      Author: scene.author ?? '',
      Creator: 'SlideCraft',
      Producer: 'SlideCraft (pdfkit)',
      CreationDate: epoch,
      ModDate: epoch,
    },
    lang: scene.language,
    displayTitle: true,
  });
  registerFonts(doc);
  const stream = createWriteStream(path);
  doc.pipe(stream);

  const cover = scene.slides[0]?.layout === 'title' ? scene.slides[0] : undefined;
  // cover is the header; a closing slide adds nothing to the argument
  const slides = scene.slides.filter((s) => s.layout !== 'title');
  const tw = (PAGE.w - 2 * M - GAP * (COLS - 1)) / COLS;
  const th = tw * (scene.format.h / scene.format.w);
  const rowH = th + CAPTION + GAP;

  let y = 0;
  let page = 0;
  const newPage = () => {
    doc.addPage({ size: [PAGE.w * P, PAGE.h * P], margin: 0 });
    doc
      .rect(0, 0, PAGE.w * P, PAGE.h * P)
      .fillColor('#FFFFFF')
      .fill();
    page++;
    y = M;
    if (page === 1) {
      doc.font(fontName(body, 'bold')).fontSize(8).fillColor(pal.accent);
      doc.text('ONE-PAGE SUMMARY', M * P, y * P, { lineBreak: false, characterSpacing: 0.6 });
      y += 0.25;
      doc.font(fontName(heading, 'bold')).fontSize(19).fillColor(pal.ink);
      doc.text(cover?.title ?? scene.title, M * P, y * P, { width: (PAGE.w - 2 * M) * P });
      y = doc.y / P + 0.06;
      const sub = scene.meta?.subtitle;
      if (sub) {
        doc.font(fontName(body, 'regular')).fontSize(10.5).fillColor(pal.muted);
        doc.text(sub, M * P, y * P, { width: (PAGE.w - 2 * M) * P });
        y = doc.y / P;
      }
      const by = [scene.author, scene.meta?.organization, scene.meta?.date]
        .filter(Boolean)
        .join(' · ');
      if (by) {
        doc.font(fontName(body, 'regular')).fontSize(8.5).fillColor(pal.muted);
        doc.text(by, M * P, (y + 0.06) * P, { lineBreak: false });
        y += 0.24;
      }
      y += 0.14;
      doc
        .moveTo(M * P, y * P)
        .lineTo((PAGE.w - M) * P, y * P)
        .lineWidth(0.75)
        .strokeColor(pal.rule)
        .stroke();
      y += 0.22;
    }
    footer();
  };
  const footer = () => {
    doc.font(fontName(body, 'regular')).fontSize(7.5).fillColor(pal.muted);
    doc.text(
      `${scene.title} · ${scene.slides.length} slides · page ${page}`,
      M * P,
      (PAGE.h - M + 0.2) * P,
      { lineBreak: false },
    );
  };

  newPage();
  for (const [i, s] of slides.entries()) {
    const col = i % COLS;
    if (col === 0 && i > 0) y += rowH;
    if (col === 0 && y + rowH > PAGE.h - M) newPage();
    const x = M + col * (tw + GAP);
    // thumbnail: the slide drawn as vectors, scaled into the cell
    doc.save();
    doc.translate(x * P, y * P);
    doc.scale(tw / scene.format.w);
    doc.rect(0, 0, scene.format.w * P, scene.format.h * P).clip();
    await drawSlide(doc, scene, s);
    doc.restore();
    doc
      .rect(x * P, y * P, tw * P, th * P)
      .lineWidth(0.5)
      .strokeColor(pal.rule)
      .stroke();
    // caption: number + action title
    doc.font(fontName(body, 'bold')).fontSize(8).fillColor(pal.accent);
    doc.text(String(s.index + 1).padStart(2, '0'), x * P, (y + th + 0.08) * P, {
      lineBreak: false,
    });
    doc.font(fontName(body, 'regular')).fontSize(8).fillColor(pal.ink);
    doc.text(s.title, (x + 0.24) * P, (y + th + 0.08) * P, {
      width: (tw - 0.24) * P,
      height: (CAPTION - 0.1) * P,
      ellipsis: true,
      lineGap: 0.5,
    });
  }
  doc.end();
  await new Promise<void>((res, rej) => {
    stream.on('finish', () => res());
    stream.on('error', rej);
  });
}

export const onePagerEngine: Engine = {
  id: 'onepager',
  kind: 'onepager',
  label: 'One-page summary PDF (pdfkit)',
  license: 'MIT',
  capabilities: {
    editable: false,
    nativeCharts: false,
    speakerNotes: false,
    fidelity: 'same-layout',
    install: 'bundled',
    ci: true,
  },
  async detect() {
    return { available: true, detail: 'bundled' };
  },
  async render(scene, opts) {
    mkdirSync(opts.outDir, { recursive: true });
    const p = join(opts.outDir, `${opts.baseName}-onepager.pdf`);
    await renderOnePager(scene, p, opts.epoch);
    return {
      files: [{ path: p, kind: 'onepager', engine: 'onepager' }],
      diagnostics: [],
      limitations: ['One-pager captions are clipped with an ellipsis after four lines.'],
    };
  },
};
