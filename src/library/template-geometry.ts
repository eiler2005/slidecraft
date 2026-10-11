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
export interface TemplateGeometry {
  size: { w: number; h: number };
  title?: Rect;
  footer?: Rect;
  cover: TemplatePicture[];
  content: TemplatePicture[];
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

export async function readTemplateGeometry(zip: JSZip): Promise<TemplateGeometry> {
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
  const geo: TemplateGeometry = {
    size,
    cover: await forLayout(cover),
    content: await forLayout(content),
  };
  const title = (content && placeholder(content.xml, 'title')) ?? placeholder(masterXml, 'title');
  const footer = (content && placeholder(content.xml, 'ftr')) ?? placeholder(masterXml, 'ftr');
  if (title) geo.title = title;
  if (footer) geo.footer = footer;
  return geo;
}
