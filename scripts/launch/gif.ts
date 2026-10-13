/**
 * Minimal animated GIF encoder (GIF89a, LZW, one local palette per frame, looping).
 * Frames are RGBA; each is quantised to 256 colours by popularity of 5-bit buckets,
 * which keeps flat slide colours exact and photos acceptable.
 */

export interface Frame {
  width: number;
  height: number;
  rgba: Uint8Array;
  /** Display time in milliseconds. */
  delay: number;
}

function quantise(rgba: Uint8Array): { palette: number[][]; index: Uint8Array } {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < rgba.length; i += 4) {
    const k = ((rgba[i]! >> 3) << 10) | ((rgba[i + 1]! >> 3) << 5) | (rgba[i + 2]! >> 3);
    const e = counts.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += rgba[i]!;
    e.g += rgba[i + 1]!;
    e.b += rgba[i + 2]!;
    counts.set(k, e);
  }
  const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 256);
  const palette = top.map(([, e]) => [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round));
  const lookup = new Map<number, number>(top.map(([k], i) => [k, i]));
  const nearest = (r: number, g: number, b: number) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i]!;
      const d = (p[0]! - r) ** 2 + (p[1]! - g) ** 2 + (p[2]! - b) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const index = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const k = ((rgba[i]! >> 3) << 10) | ((rgba[i + 1]! >> 3) << 5) | (rgba[i + 2]! >> 3);
    let v = lookup.get(k);
    if (v === undefined) {
      v = nearest(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
      lookup.set(k, v);
    }
    index[j] = v;
  }
  while (palette.length < 256) palette.push([0, 0, 0]);
  return { palette, index };
}

/** LZW-compress indices with an 8-bit minimum code size, into 255-byte sub-blocks. */
function lzw(index: Uint8Array): number[] {
  const minCode = 8;
  const clear = 1 << minCode;
  const end = clear + 1;
  let size = minCode + 1;
  let next = end + 1;
  let dict = new Map<number, number>();
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  const emit = (code: number) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.push(acc & 0xff);
      acc >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  // w is always a code: a single index (< 256) or a dictionary entry
  let w = index[0]!;
  for (let i = 1; i < index.length; i++) {
    const k = index[i]!;
    const key = w * 256 + k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      w = hit;
      continue;
    }
    emit(w);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(clear);
      dict = new Map();
      size = minCode + 1;
      next = end + 1;
    }
    w = k;
  }
  emit(w);
  emit(end);
  if (bits > 0) out.push(acc & 0xff);
  const blocks: number[] = [];
  for (let i = 0; i < out.length; i += 255) {
    const n = Math.min(255, out.length - i);
    blocks.push(n);
    for (let j = 0; j < n; j++) blocks.push(out[i + j]!);
  }
  blocks.push(0);
  return blocks;
}

export function encodeGif(frames: Frame[]): Uint8Array {
  const { width: W, height: H } = frames[0]!;
  const bytes: number[] = [];
  const u16 = (v: number) => bytes.push(v & 0xff, (v >> 8) & 0xff);
  bytes.push(...Buffer.from('GIF89a'));
  u16(W);
  u16(H);
  bytes.push(0x00, 0, 0); // no global colour table
  // loop forever
  bytes.push(0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0'), 0x03, 0x01, 0x00, 0x00, 0x00);
  for (const f of frames) {
    const { palette, index } = quantise(f.rgba);
    bytes.push(0x21, 0xf9, 0x04, 0x00);
    u16(Math.round(f.delay / 10));
    bytes.push(0x00, 0x00);
    bytes.push(0x2c);
    u16(0);
    u16(0);
    u16(W);
    u16(H);
    bytes.push(0x87); // local colour table, 256 entries
    for (const p of palette) bytes.push(p[0]!, p[1]!, p[2]!);
    bytes.push(8);
    for (const b of lzw(index)) bytes.push(b);
  }
  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}
