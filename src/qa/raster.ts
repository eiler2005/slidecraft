/**
 * Raster comparison shared by visual QA, calibration and regression scripts: Poppler PPM
 * input, the worst-region fidelity score, a dependency-free PNG encoder and a diff overlay.
 */
import { deflateSync } from 'node:zlib';

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

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 8-bit RGB PNG, no filtering: small enough for review packs, no image dependency. */
export function encodePng(r: Raster): Buffer {
  const row = r.width * 3 + 1;
  const raw = Buffer.alloc(row * r.height);
  for (let y = 0; y < r.height; y++)
    Buffer.from(r.rgb.buffer, r.rgb.byteOffset + y * r.width * 3, r.width * 3).copy(
      raw,
      y * row + 1,
    );
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(r.width, 0);
  ihdr.writeUInt32BE(r.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Grey where both agree; red where only `a` has ink, cyan where only `b` has ink. */
export function diffOverlay(a: Raster, b: Raster): Raster {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Raster dimensions differ');
  const rgb = new Uint8Array(a.rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    const la = (a.rgb[i]! + a.rgb[i + 1]! + a.rgb[i + 2]!) / 3;
    const lb = (b.rgb[i]! + b.rgb[i + 1]! + b.rgb[i + 2]!) / 3;
    if (Math.abs(la - lb) < 10) {
      rgb[i] = rgb[i + 1] = rgb[i + 2] = Math.min(la, lb) * 0.6 + 100;
    } else {
      rgb[i] = lb;
      rgb[i + 1] = la;
      rgb[i + 2] = la;
    }
  }
  return { width: a.width, height: a.height, rgb };
}
