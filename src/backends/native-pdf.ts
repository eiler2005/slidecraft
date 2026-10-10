/**
 * Native PDF engine: pdfkit draws the Scene IR directly. Vector output, embedded
 * subset fonts, selectable text, deterministic with a fixed epoch.
 */
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { type Face, faceOf, fontPath } from '../engine/fonts.ts';
import type { Master, Scene, SceneNode, Stroke, TextNode } from '../engine/scene.ts';
import type { MeasureFont } from '../spec/theme.ts';
import { rasterize } from './resvg.ts';
import type { Engine } from './types.ts';

const P = 72; // pt per inch

type Doc = InstanceType<typeof PDFDocument>;
const imageCache = new WeakMap<Doc, Map<string, unknown>>();

function fontName(m: MeasureFont, f: Face) {
  return `${m}-${f}`;
}

function registerFonts(doc: Doc) {
  for (const m of ['liberation-sans', 'liberation-serif', 'gelasio'] as MeasureFont[]) {
    for (const f of ['regular', 'bold', 'italic', 'boldItalic'] as Face[])
      doc.registerFont(fontName(m, f), fontPath(m, f));
  }
}

function applyStroke(doc: Doc, s: Stroke) {
  doc.lineWidth(s.width).strokeColor(s.color);
  if (s.dash === 'dash') doc.dash(s.width * 4, { space: s.width * 3 });
  else if (s.dash === 'dot') doc.dash(s.width, { space: s.width * 2 });
  else doc.undash();
}

function drawText(doc: Doc, t: TextNode) {
  for (const line of t.lines) {
    const y = (t.box.y + line.baseline) * P;
    if (line.bulletX !== undefined) {
      doc
        .font(fontName(t.style.measure, 'regular'))
        .fontSize(t.style.size)
        .fillColor(line.segments[0]?.color ?? t.style.color);
      doc.text('•', (t.box.x + line.bulletX) * P, y, { lineBreak: false, baseline: 'alphabetic' });
    }
    for (const s of line.segments) {
      doc
        .font(fontName(t.style.measure, faceOf(s.bold, s.italic)))
        .fontSize(t.style.size)
        .fillColor(s.color);
      doc.text(s.text, (t.box.x + s.x) * P, y, {
        lineBreak: false,
        baseline: 'alphabetic',
        features: [] as never,
      });
    }
  }
}

async function drawNode(doc: Doc, n: SceneNode): Promise<void> {
  switch (n.kind) {
    case 'text':
      drawText(doc, n);
      return;
    case 'rect': {
      const { x, y, w, h } = n.box;
      doc.save();
      if (n.radius) doc.roundedRect(x * P, y * P, w * P, h * P, n.radius * P);
      else doc.rect(x * P, y * P, w * P, h * P);
      if (n.fill) doc.fillOpacity(n.fillOpacity ?? 1).fillColor(n.fill);
      if (n.stroke) applyStroke(doc, n.stroke);
      if (n.fill && n.stroke) doc.fillAndStroke();
      else if (n.fill) doc.fill();
      else if (n.stroke) doc.stroke();
      doc.restore();
      return;
    }
    case 'ellipse': {
      const { x, y, w, h } = n.box;
      doc.save();
      doc.ellipse((x + w / 2) * P, (y + h / 2) * P, (w / 2) * P, (h / 2) * P);
      if (n.fill) doc.fillOpacity(n.fillOpacity ?? 1).fillColor(n.fill);
      if (n.stroke) applyStroke(doc, n.stroke);
      if (n.fill && n.stroke) doc.fillAndStroke();
      else if (n.fill) doc.fill();
      else if (n.stroke) doc.stroke();
      doc.restore();
      return;
    }
    case 'polygon': {
      doc.save();
      doc.polygon(...n.points.map(([x, y]) => [x * P, y * P] as [number, number]));
      if (n.fill) doc.fillOpacity(n.fillOpacity ?? 1).fillColor(n.fill);
      if (n.stroke) applyStroke(doc, n.stroke);
      if (n.fill && n.stroke) doc.fillAndStroke();
      else if (n.fill) doc.fill();
      else if (n.stroke) doc.stroke();
      doc.restore();
      return;
    }
    case 'line': {
      doc.save();
      applyStroke(doc, n.stroke);
      doc
        .moveTo(n.x1 * P, n.y1 * P)
        .lineTo(n.x2 * P, n.y2 * P)
        .stroke();
      if (n.arrowEnd) {
        const ang = Math.atan2(n.y2 - n.y1, n.x2 - n.x1);
        const L = 0.1 * P;
        doc.undash();
        doc
          .polygon(
            [n.x2 * P, n.y2 * P],
            [
              n.x2 * P + L * Math.cos(ang + Math.PI * 0.85),
              n.y2 * P + L * Math.sin(ang + Math.PI * 0.85),
            ],
            [
              n.x2 * P + L * Math.cos(ang - Math.PI * 0.85),
              n.y2 * P + L * Math.sin(ang - Math.PI * 0.85),
            ],
          )
          .fillColor(n.stroke.color)
          .fill();
      }
      doc.restore();
      return;
    }
    case 'image': {
      const { x, y, w, h } = n.box;
      // One image object per distinct source per document: pdfkit decodes PNGs
      // asynchronously, and embedding the same bytes twice is not byte-stable.
      const key = n.svg
        ? `svg:${n.svg}`
        : n.path
          ? `path:${n.path}`
          : n.data
            ? `data:${n.data.base64.slice(0, 64)}${n.data.base64.length}`
            : '';
      const cache = imageCache.get(doc) ?? new Map<string, unknown>();
      imageCache.set(doc, cache);
      let buf: unknown = key ? cache.get(key) : undefined;
      if (!buf && key) {
        let bytes: Buffer | undefined;
        if (n.svg) bytes = await rasterize(n.svg, Math.min(2400, w * 180));
        else if (n.path) bytes = readFileSync(n.path);
        else if (n.data) bytes = Buffer.from(n.data.base64, 'base64');
        if (bytes) {
          buf = (doc as unknown as { openImage(b: Buffer): unknown }).openImage(bytes);
          cache.set(key, buf);
        }
      }
      if (!buf) {
        doc.save();
        doc
          .rect(x * P, y * P, w * P, h * P)
          .fillColor('#E9ECF0')
          .fill();
        doc
          .rect(x * P, y * P, w * P, h * P)
          .lineWidth(0.75)
          .strokeColor('#AEB6C1')
          .dash(4, { space: 3 })
          .stroke();
        doc.undash();
        doc.font(fontName('liberation-sans', 'regular')).fontSize(10).fillColor('#6B7480');
        doc.text(n.placeholderLabel ?? 'Image', x * P, (y + h / 2) * P - 5, {
          width: w * P,
          align: 'center',
          lineBreak: false,
        });
        doc.restore();
        return;
      }
      doc.save();
      doc.rect(x * P, y * P, w * P, h * P).clip();
      if (n.fit === 'cover')
        doc.image(buf as Buffer, x * P, y * P, {
          cover: [w * P, h * P],
          align: 'center',
          valign: 'center',
        });
      else
        doc.image(buf as Buffer, x * P, y * P, {
          fit: [w * P, h * P],
          align: 'center',
          valign: 'center',
        });
      doc.restore();
      return;
    }
    case 'table': {
      let yy = n.box.y;
      n.cells.forEach((row, ri) => {
        let xx = n.box.x;
        const h = n.rowH[ri]!;
        row.forEach((cell, ci) => {
          const w = n.colW[ci]!;
          if (cell.fill)
            doc
              .save()
              .rect(xx * P, yy * P, w * P, h * P)
              .fillColor(cell.fill)
              .fill()
              .restore();
          if (cell.borderTop) {
            doc.save();
            applyStroke(doc, cell.borderTop);
            doc
              .moveTo(xx * P, yy * P)
              .lineTo((xx + w) * P, yy * P)
              .stroke()
              .restore();
          }
          if (cell.borderBottom) {
            doc.save();
            applyStroke(doc, cell.borderBottom);
            doc
              .moveTo(xx * P, (yy + h) * P)
              .lineTo((xx + w) * P, (yy + h) * P)
              .stroke()
              .restore();
          }
          drawText(doc, cell.text);
          xx += w;
        });
        yy += h;
      });
      return;
    }
    case 'chart':
      for (const p of n.primitives) await drawNode(doc, p);
      return;
  }
}

/** Flatten decor onto the master background: opaque PNG, no alpha mask (pdfkit's alpha split is not byte-stable). */
function onBackground(svg: string, bg: string): string {
  return svg.replace(/(<svg[^>]*>)/, `$1<rect width="100%" height="100%" fill="${bg}"/>`);
}

async function drawMaster(doc: Doc, m: Master, slideNo: number) {
  for (const n of m.nodes) {
    if (n.kind === 'image' && n.svg && n.decorative)
      await drawNode(doc, { ...n, svg: onBackground(n.svg, m.background) });
    else await drawNode(doc, n);
  }
  if (m.slideNumber) {
    const s = m.slideNumber;
    doc.font(fontName(s.style.measure, 'regular')).fontSize(s.style.size).fillColor(s.style.color);
    doc.text(String(slideNo), s.box.x * P, s.box.y * P, {
      width: s.box.w * P,
      align: s.style.align,
      lineBreak: false,
    });
  }
}

export async function renderPdf(scene: Scene, path: string, epoch: Date): Promise<void> {
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: [scene.format.w * P, scene.format.h * P],
    margin: 0,
    info: {
      Title: scene.title,
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
  for (const slide of scene.slides) {
    doc.addPage({ size: [scene.format.w * P, scene.format.h * P], margin: 0 });
    const m = scene.masters[slide.master]!;
    doc
      .rect(0, 0, scene.format.w * P, scene.format.h * P)
      .fillColor(slide.background ?? m.background)
      .fill();
    await drawMaster(doc, m, slide.index + 1);
    for (const n of slide.nodes) await drawNode(doc, n);
  }
  doc.end();
  await new Promise<void>((res, rej) => {
    stream.on('finish', () => res());
    stream.on('error', rej);
  });
}

export const nativePdfEngine: Engine = {
  id: 'native',
  kind: 'pdf',
  label: 'Native vector PDF (pdfkit)',
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
    const p = join(opts.outDir, `${opts.baseName}.pdf`);
    await renderPdf(scene, p, opts.epoch);
    return {
      files: [{ path: p, kind: 'pdf', engine: 'native' }],
      diagnostics: [],
      limitations: [
        'Same layout as the PPTX; glyph rendering uses bundled metric-compatible fonts, not Arial/Georgia.',
      ],
    };
  },
};
