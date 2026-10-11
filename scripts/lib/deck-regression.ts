import { posix } from 'node:path';
import JSZip from 'jszip';

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_, num, name) =>
    num
      ? String.fromCodePoint(
          Number.parseInt(num.startsWith('x') ? num.slice(1) : num, num.startsWith('x') ? 16 : 10),
        )
      : (entities[String(name).toLowerCase()] ?? ''),
  );
const attr = (s: string, name: string) =>
  decode(new RegExp(`\\b${name}="([^"]*)"`).exec(s)?.[1] ?? '');

export function paragraphs(xml: string): string[] {
  return [...xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)]
    .map((p) =>
      [
        ...p[1]!.matchAll(
          /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\b[^>]*(?:\/>|>[\s\S]*?<\/a:br>)/g,
        ),
      ]
        .map((t) => (t[1] === undefined ? ' ' : decode(t[1])))
        .join(''),
    )
    .filter((s) => s.trim());
}

export interface SlideInventory {
  part: string;
  text: string[];
  notes: string[];
  shapes: number;
  pictures: number;
  charts: number;
  tables: number;
  fonts: string[];
}

/** Read actual presentation order, not ZIP ordering or slide filenames. */
export async function pptxInventory(data: Uint8Array): Promise<SlideInventory[]> {
  const zip = await JSZip.loadAsync(data);
  const read = async (p: string) => {
    const file = zip.file(p);
    if (!file) throw new Error(`Missing PPTX part: ${p}`);
    return file.async('string');
  };
  const rels = async (part: string) => {
    const dir = posix.dirname(part);
    const xml =
      (await zip.file(`${dir}/_rels/${posix.basename(part)}.rels`)?.async('string')) ?? '';
    return [...xml.matchAll(/<Relationship\s[^>]*\/?\s*>/g)]
      .filter((m) => attr(m[0], 'TargetMode') !== 'External')
      .map((m) => {
        const target = attr(m[0], 'Target');
        return {
          id: attr(m[0], 'Id'),
          type: attr(m[0], 'Type'),
          target: target.startsWith('/')
            ? target.slice(1)
            : posix.normalize(posix.join(dir, target)),
        };
      });
  };
  const pres = await read('ppt/presentation.xml');
  const relationships = await rels('ppt/presentation.xml');
  const order = [...pres.matchAll(/<p:sldId\s[^>]*>/g)].map((m) => {
    const target = relationships.find((r) => r.id === attr(m[0], 'r:id'))?.target;
    if (!target) throw new Error('Missing slide relationship');
    return target;
  });
  if (!order.length) throw new Error('Presentation contains no slides');
  return Promise.all(
    order.map(async (part) => {
      const xml = await read(part);
      const links = await rels(part);
      const notesPart = links.find((r) => r.type.endsWith('/notesSlide'))?.target;
      const notesXml = notesPart ? await read(notesPart) : '';
      const notes = [...notesXml.matchAll(/<p:sp(?:\s[^>]*)?>([\s\S]*?)<\/p:sp>/g)]
        .filter((s) => !/<p:ph[^>]*type="(?:sldNum|hdr|ftr|dt|sldImg)"/.test(s[1]!))
        .flatMap((s) => paragraphs(s[1]!));
      const chartText = (
        await Promise.all(
          links
            .filter((r) => r.type.endsWith('/chart'))
            .map(async (r) => {
              const chart = await read(r.target);
              return [...chart.matchAll(/<c:v>([^<]*)<\/c:v>/g)].map((m) => decode(m[1]!));
            }),
        )
      ).flat();
      return {
        part,
        text: [...paragraphs(xml), ...chartText],
        notes,
        shapes: [...xml.matchAll(/<p:sp(?:\s|>)/g)].length,
        pictures: [...xml.matchAll(/<p:pic(?:\s|>)/g)].length,
        charts: links.filter((r) => r.type.endsWith('/chart')).length,
        tables: [...xml.matchAll(/<a:tbl(?:\s|>)/g)].length,
        fonts: [
          ...new Set([...xml.matchAll(/typeface="([^"]+)"/g)].map((m) => decode(m[1]!))),
        ].sort(),
      };
    }),
  );
}

/** Order-insensitive token counts tolerate native text-box and line splitting.
 * Deliberately preserve case, punctuation and repetitions; this is NOT semantic equivalence. */
export function textDelta(reference: string[], actual: string[]) {
  const counts = (values: string[]) => {
    const out = new Map<string, number>();
    for (const word of values.join(' ').normalize('NFC').split(/\s+/u).filter(Boolean))
      out.set(word, (out.get(word) ?? 0) + 1);
    return out;
  };
  const a = counts(reference),
    b = counts(actual);
  const diff = (x: Map<string, number>, y: Map<string, number>) =>
    [...x].flatMap(([token, n]) =>
      n > (y.get(token) ?? 0) ? [{ token, count: n - (y.get(token) ?? 0) }] : [],
    );
  return { missing: diff(a, b), added: diff(b, a) };
}

export interface Raster {
  width: number;
  height: number;
  rgb: Uint8Array;
}

/** Poppler P6 / 8-bit RGB; no PNG dependency or lossy resampling. */
export function readPpm(data: Buffer): Raster {
  let offset = 0;
  const token = () => {
    while (offset < data.length) {
      if (data[offset] === 35) {
        while (offset < data.length && data[offset] !== 10) offset++;
      } else if (/\s/.test(String.fromCharCode(data[offset]!))) offset++;
      else break;
    }
    const start = offset;
    while (offset < data.length && !/\s/.test(String.fromCharCode(data[offset]!))) offset++;
    return data.subarray(start, offset).toString('ascii');
  };
  if (token() !== 'P6') throw new Error('Expected P6 RGB image');
  const width = Number(token()),
    height = Number(token()),
    max = Number(token());
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    max !== 255
  )
    throw new Error('Invalid PPM dimensions or channel depth');
  // Consume precisely the header delimiter: a first pixel may itself be whitespace.
  if (data[offset] === 13 && data[offset + 1] === 10) offset += 2;
  else offset++;
  if (data.length - offset !== width * height * 3) throw new Error('Invalid PPM raster length');
  return { width, height, rgb: data.subarray(offset) };
}

/** Worst-region-aware signal, NOT a calibrated human perception percentage.
 * Compare local high-frequency detail too, so a blank shared background cannot pass. */
export function visualMetrics(a: Raster, b: Raster) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Raster dimensions differ');
  const regions: { column: number; row: number; similarity: number; detailSimilarity: number }[] =
    [];
  for (let row = 0; row < 4; row++)
    for (let column = 0; column < 4; column++) {
      let error = 0,
        count = 0,
        detailError = 0,
        detailCount = 0;
      for (
        let y = Math.floor((row * a.height) / 4);
        y < Math.floor(((row + 1) * a.height) / 4);
        y++
      ) {
        for (
          let x = Math.floor((column * a.width) / 4);
          x < Math.floor(((column + 1) * a.width) / 4);
          x++
        ) {
          const i = (y * a.width + x) * 3;
          let detail = false;
          for (const j of [x + 1 < a.width ? i + 3 : i, y + 1 < a.height ? i + a.width * 3 : i])
            for (let c = 0; c < 3; c++)
              if (
                Math.abs(a.rgb[i + c]! - a.rgb[j + c]!) > 12 ||
                Math.abs(b.rgb[i + c]! - b.rgb[j + c]!) > 12
              )
                detail = true;
          for (let c = 0; c < 3; c++) {
            const delta = Math.abs(a.rgb[i + c]! - b.rgb[i + c]!);
            error += delta;
            count++;
            if (detail) {
              detailError += delta;
              detailCount++;
            }
          }
        }
      }
      const similarity = count ? 1 - error / count / 255 : 1;
      regions.push({
        column,
        row,
        similarity,
        detailSimilarity: detailCount ? 1 - detailError / detailCount / 255 : similarity,
      });
    }
  return {
    mean: regions.reduce((s, r) => s + r.similarity, 0) / regions.length,
    worstRegion: Math.min(...regions.map((r) => Math.min(r.similarity, r.detailSimilarity))),
    regions,
  };
}
