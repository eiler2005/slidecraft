/**
 * Read a PowerPoint template's geometry (M3): slide size, the title and footer placeholder
 * positions, and the pictures placed on the master and on the cover and content layouts.
 * `theme import` turns this into a brand format (frame follows the template's title band)
 * and background art drawn on SlideCraft masters in every engine.
 */
import { posix } from 'node:path';
import type JSZip from 'jszip';

const EMU = 914400;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface TemplatePicture extends Rect {
  /** Zip path of the image part. */
  part: string;
}
export interface TemplateShape extends Rect {
  kind: 'rect' | 'ellipse' | 'line';
  fill?: string;
  stroke?: { color: string; width: number };
  radius?: number;
}
export interface TemplateGeometry {
  size: { w: number; h: number };
  title?: Rect;
  footer?: Rect;
  cover: TemplatePicture[];
  content: TemplatePicture[];
  /** Simple vector decoration (rectangles, ellipses, lines) on the same parts. */
  coverShapes: TemplateShape[];
  contentShapes: TemplateShape[];
}

const SCHEME: Record<string, string> = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };

function colorOf(xml: string, colors: Record<string, string>): string | undefined {
  const srgb = /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(xml)?.[1];
  if (srgb) return `#${srgb.toUpperCase()}`;
  const scheme = /<a:schemeClr val="(\w+)"/.exec(xml)?.[1];
  return scheme ? colors[SCHEME[scheme] ?? scheme] : undefined;
}

/** Non-placeholder rectangles, ellipses and lines with a solid fill or line. */
async function shapes(
  zip: JSZip,
  part: string,
  colors: Record<string, string>,
): Promise<TemplateShape[]> {
  const xml = (await zip.file(part)?.async('string')) ?? '';
  const out: TemplateShape[] = [];
  for (const m of xml.matchAll(/<p:(sp|cxnSp)>([\s\S]*?)<\/p:\1>/g)) {
    const body = m[2]!;
    if (/<p:ph\b/.test(body) || /<a:t>[^<]*\S/.test(body)) continue; // placeholders and text are not decoration
    const geom = /<a:prstGeom prst="(\w+)"/.exec(body)?.[1];
    const kind =
      geom === 'rect' || geom === 'roundRect'
        ? 'rect'
        : geom === 'ellipse'
          ? 'ellipse'
          : geom === 'line' || m[1] === 'cxnSp'
            ? 'line'
            : undefined;
    const box = xfrm(body);
    if (!kind || !box) continue;
    const spPr = /<p:spPr>([\s\S]*?)<\/p:spPr>/.exec(body)?.[1] ?? '';
    const fillXml = /<a:solidFill>([\s\S]*?)<\/a:solidFill>/.exec(
      spPr.replace(/<a:ln\b[\s\S]*?<\/a:ln>/, ''),
    )?.[1];
    const ln = /<a:ln\b([^>]*)>([\s\S]*?)<\/a:ln>/.exec(spPr);
    const lnColor = ln && !/<a:noFill\s*\/>/.test(ln[2]!) ? colorOf(ln[2]!, colors) : undefined;
    const fill = fillXml ? colorOf(fillXml, colors) : undefined;
    if (!fill && !lnColor) continue;
    const shape: TemplateShape = { kind, ...box };
    if (fill && kind !== 'line') shape.fill = fill;
    if (lnColor)
      shape.stroke = { color: lnColor, width: +(/w="(\d+)"/.exec(ln![1]!)?.[1] ?? 12700) / 12700 };
    if (geom === 'roundRect') shape.radius = Math.min(box.w, box.h) * 0.1;
    out.push(shape);
  }
  return out;
}

const xfrm = (xml: string): Rect | undefined => {
  const off = /<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>/.exec(xml);
  const ext = /<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/.exec(xml);
  if (!off || !ext) return undefined;
  return { x: +off[1]! / EMU, y: +off[2]! / EMU, w: +ext[1]! / EMU, h: +ext[2]! / EMU };
};

async function rels(zip: JSZip, part: string): Promise<Map<string, string>> {
  const dir = posix.dirname(part);
  const xml = (await zip.file(`${dir}/_rels/${posix.basename(part)}.rels`)?.async('string')) ?? '';
  const out = new Map<string, string>();
  for (const m of xml.matchAll(/<Relationship ([^>]*)\/?>/g)) {
    const id = /Id="([^"]+)"/.exec(m[1]!)?.[1];
    const t = /Target="([^"]+)"/.exec(m[1]!)?.[1];
    if (id && t) out.set(id, t.startsWith('/') ? t.slice(1) : posix.normalize(posix.join(dir, t)));
  }
  return out;
}

async function pictures(zip: JSZip, part: string): Promise<TemplatePicture[]> {
  const xml = (await zip.file(part)?.async('string')) ?? '';
  const r = await rels(zip, part);
  const out: TemplatePicture[] = [];
  for (const m of xml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)) {
    const rid = /r:embed="([^"]+)"/.exec(m[1]!)?.[1];
    const box = xfrm(m[1]!);
    const target = rid ? r.get(rid) : undefined;
    if (box && target && /\.(png|jpe?g)$/i.test(target)) out.push({ ...box, part: target });
  }
  return out;
}

function placeholder(xml: string, type: string): Rect | undefined {
  for (const m of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g))
    if (new RegExp(`<p:ph\\s[^>]*type="${type}"`).test(m[1]!)) return xfrm(m[1]!);
  return undefined;
}

export async function readTemplateGeometry(
  zip: JSZip,
  colors: Record<string, string> = {},
): Promise<TemplateGeometry> {
  const pres = (await zip.file('ppt/presentation.xml')?.async('string')) ?? '';
  const sz = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(pres);
  const size = sz ? { w: +sz[1]! / EMU, h: +sz[2]! / EMU } : { w: 13.333, h: 7.5 };
  const master = 'ppt/slideMasters/slideMaster1.xml';
  const masterXml = (await zip.file(master)?.async('string')) ?? '';
  const layouts: { part: string; type: string; xml: string }[] = [];
  for (const name of Object.keys(zip.files)
    .filter((n) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n))
    .sort((a, b) => +/(\d+)\.xml$/.exec(a)![1]! - +/(\d+)\.xml$/.exec(b)![1]!)) {
    const xml = await zip.file(name)!.async('string');
    layouts.push({ part: name, type: /<p:sldLayout [^>]*type="(\w+)"/.exec(xml)?.[1] ?? '', xml });
  }
  const cover = layouts.find((l) => l.type === 'title');
  const content =
    layouts.find((l) => l.type === 'obj') ??
    layouts.find((l) => l.type === 'titleOnly') ??
    layouts[1] ??
    layouts[0];
  const masterPics = await pictures(zip, master);
  const forLayout = async (l?: (typeof layouts)[number]) => {
    if (!l) return masterPics;
    const own = await pictures(zip, l.part);
    return /showMasterSp="0"/.test(l.xml) ? own : [...masterPics, ...own];
  };
  const masterShapes = await shapes(zip, master, colors);
  const shapesFor = async (l?: (typeof layouts)[number]) => {
    if (!l) return masterShapes;
    const own = await shapes(zip, l.part, colors);
    return /showMasterSp="0"/.test(l.xml) ? own : [...masterShapes, ...own];
  };
  const geo: TemplateGeometry = {
    size,
    cover: await forLayout(cover),
    content: await forLayout(content),
    coverShapes: await shapesFor(cover),
    contentShapes: await shapesFor(content),
  };
  const title = (content && placeholder(content.xml, 'title')) ?? placeholder(masterXml, 'title');
  const footer = (content && placeholder(content.xml, 'ftr')) ?? placeholder(masterXml, 'ftr');
  if (title) geo.title = title;
  if (footer) geo.footer = footer;
  return geo;
}
