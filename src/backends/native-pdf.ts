/**
 * Native PDF engine: pdfkit draws the Scene IR directly. Vector output, embedded
 * subset fonts, selectable text, deterministic with a fixed epoch.
 */

import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { chartAlt } from '../engine/alt.ts';
import { type Face, faceOf, fontPath, measureFontIds } from '../engine/fonts.ts';
import {
  coverPlacement,
  type Master,
  type Scene,
  type SceneNode,
  type Stroke,
  type TextNode,
} from '../engine/scene.ts';
import { pathData } from '../engine/svg-path.ts';
import type { MeasureFont } from '../spec/theme.ts';
import { rasterize, rasterizeOpaque } from './resvg.ts';
import type { Engine } from './types.ts';

const P = 72; // pt per inch

type Doc = InstanceType<typeof PDFDocument>;
const imageCache = new WeakMap<Doc, Map<string, unknown>>();

export function fontName(m: MeasureFont, f: Face) {
  return `${m}-${f}`;
}

export function registerFonts(doc: Doc) {
  for (const m of measureFontIds()) {
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
        features: { kern: t.style.kerning === true, liga: false, clig: false } as never,
        // PowerPoint always underlines hyperlinks: so does every other engine
        ...(s.underline || s.link ? { underline: true } : {}),
      });
      if (s.link)
        doc.link(
          (t.box.x + s.x) * P,
          y - t.style.size * 0.85,
          s.width * P,
          t.style.size * 1.1,
          s.link,
        );
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
    case 'path': {
      doc.save();
      doc.path(pathData(n.segments, P));
      if (n.fill) doc.fillColor(n.fill);
      if (n.stroke) applyStroke(doc, n.stroke);
      if (n.round) doc.lineCap('round').lineJoin('round');
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
        // decor is flattened onto the background: opaque RGB keeps pdfkit synchronous
        if (n.svg)
          bytes = n.decorative
            ? await rasterizeOpaque(n.svg, Math.min(2400, w * 180))
            : await rasterize(n.svg, Math.min(2400, w * 180));
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
      const img = buf as { width?: number; height?: number };
      if (n.fit === 'cover' && n.focus && img.width && img.height) {
        const p = coverPlacement({ w: img.width, h: img.height }, n.box, n.focus);
        doc.image(buf as Buffer, p.x * P, p.y * P, { width: p.w * P, height: p.h * P });
      } else if (n.fit === 'cover')
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

/** Draw one slide untagged (thumbnails in the one-pager). */
export async function drawSlide(doc: Doc, scene: Scene, slide: Scene['slides'][number]) {
  const m = scene.masters[slide.master]!;
  doc
    .rect(0, 0, scene.format.w * P, scene.format.h * P)
    .fillColor(slide.background ?? m.background)
    .fill();
  await drawMaster(doc, m, slide.index + 1);
  for (const n of slide.nodes) await drawNode(doc, n);
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

/** Structure tag for a node in reading order; undefined = layout artifact (not read aloud). */
function tagOf(n: SceneNode): string | undefined {
  switch (n.kind) {
    case 'text':
      if (n.role === 'title') return 'H1';
      if (n.role === 'decor' || n.role === 'quote-mark' || n.role === 'chart-label')
        return undefined;
      return 'P';
    case 'image':
      return n.decorative || (!n.path && !n.data) ? undefined : 'Figure';
    case 'chart':
      return 'Figure';
    case 'table':
      return 'Table';
    default:
      return undefined;
  }
}

function altOf(n: SceneNode): string {
  if (n.kind === 'image') return n.alt;
  if (n.kind === 'chart') return chartAlt(n);
  return '';
}

type Struct = ReturnType<Doc['struct']>;

async function tagged(
  doc: Doc,
  parent: Struct,
  tag: string,
  draw: () => Promise<void> | void,
  alt?: string,
) {
  const el = doc.struct(tag, alt ? { alt } : {});
  parent.add(el);
  const c = doc.markStructureContent(tag);
  await draw();
  doc.endMarkedContent();
  el.add(c);
  el.end();
}

async function artifact(doc: Doc, draw: () => Promise<void> | void) {
  doc.markContent('Artifact', { type: 'Layout' });
  await draw();
  doc.endMarkedContent();
}

/** Tables: Table › TR › TH/TD with cell backgrounds and rules as artifacts. */
async function drawTableTagged(doc: Doc, sect: Struct, n: Extract<SceneNode, { kind: 'table' }>) {
  const table = doc.struct('Table');
  sect.add(table);
  await artifact(doc, () =>
    drawNode(doc, {
      ...n,
      cells: n.cells.map((r) => r.map((c) => ({ ...c, text: { ...c.text, lines: [] } }))),
    }),
  );
  for (const [ri, row] of n.cells.entries()) {
    const tr = doc.struct('TR');
    table.add(tr);
    for (const cell of row)
      await tagged(doc, tr, ri === 0 ? 'TH' : 'TD', () => drawText(doc, cell.text));
    tr.end();
  }
  table.end();
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
    // Tagged PDF: reading order, headings, figure alt text, tables; decoration as artifacts.
    tagged: true,
    pdfVersion: '1.7',
  });
  registerFonts(doc);
  const stream = createWriteStream(path);
  doc.pipe(stream);
  for (const slide of scene.slides) {
    doc.addPage({ size: [scene.format.w * P, scene.format.h * P], margin: 0 });
    const m = scene.masters[slide.master]!;
    await artifact(doc, async () => {
      doc
        .rect(0, 0, scene.format.w * P, scene.format.h * P)
        .fillColor(slide.background ?? m.background)
        .fill();
      await drawMaster(doc, m, slide.index + 1);
    });
    const sect = doc.struct('Sect', { title: slide.title });
    doc.addStructure(sect);
    for (const n of slide.nodes) {
      const tag = tagOf(n);
      if (!tag) await artifact(doc, () => drawNode(doc, n));
      else if (n.kind === 'table') await drawTableTagged(doc, sect, n);
      else await tagged(doc, sect, tag, () => drawNode(doc, n), altOf(n) || undefined);
    }
    sect.end();
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
