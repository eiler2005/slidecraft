import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { allFontPaths, fontRegistryVersion } from '../engine/fonts.ts';
import type { Scene } from '../engine/scene.ts';
import { resvgWasmPath } from '../paths.ts';
import { slideSvg } from './svg.ts';
import type { Engine } from './types.ts';

let ready: Promise<void> | undefined;
let fontBuffers: Uint8Array[] | undefined;
let fontsAt = -1;

export async function ensureResvg(): Promise<void> {
  if (!ready) ready = initWasm(readFileSync(resvgWasmPath()));
  await ready;
  if (!fontBuffers || fontsAt !== fontRegistryVersion()) {
    fontBuffers = allFontPaths().map((f) => new Uint8Array(readFileSync(f.path)));
    fontsAt = fontRegistryVersion();
  }
}

/** Rasterise an SVG string to PNG at a given pixel width. */
export async function rasterize(svg: string, width: number): Promise<Buffer> {
  await ensureResvg();
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.round(width) },
    font: {
      fontBuffers: fontBuffers!,
      loadSystemFonts: false,
      defaultFontFamily: 'Liberation Sans',
    },
    shapeRendering: 2,
    textRendering: 1,
  });
  const png = r.render().asPng();
  return Buffer.from(png);
}

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/**
 * Rasterise an opaque SVG to an RGB PNG (no alpha channel). pdfkit splits alpha channels
 * asynchronously, which can reorder objects between runs; opaque RGB embeds synchronously,
 * so PDFs stay byte-reproducible.
 */
export async function rasterizeOpaque(svg: string, width: number): Promise<Buffer> {
  await ensureResvg();
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.round(width) },
    font: {
      fontBuffers: fontBuffers!,
      loadSystemFonts: false,
      defaultFontFamily: 'Liberation Sans',
    },
    shapeRendering: 2,
    textRendering: 1,
  });
  const img = r.render();
  const { width: w, height: h, pixels } = img;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = pixels[i]!;
      raw[o + 1] = pixels[i + 1]!;
      raw[o + 2] = pixels[i + 2]!;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function previewName(i: number, id: string): string {
  return `${String(i + 1).padStart(2, '0')}-${id}.png`;
}

export const resvgEngine: Engine = {
  id: 'resvg',
  kind: 'png',
  label: 'PNG previews (resvg)',
  license: 'MPL-2.0 (resvg), MIT (SlideCraft)',
  capabilities: {
    editable: false,
    nativeCharts: false,
    speakerNotes: false,
    fidelity: 'preview',
    install: 'bundled (wasm)',
    ci: true,
  },
  async detect() {
    return { available: true, detail: 'bundled WebAssembly renderer' };
  },
  async render(scene: Scene, opts) {
    const dir = join(opts.outDir, 'previews');
    mkdirSync(dir, { recursive: true });
    const files = [];
    for (const slide of scene.slides) {
      const png = await rasterize(slideSvg(scene, slide), opts.previewWidth ?? 1600);
      const p = join(dir, previewName(slide.index, slide.id));
      writeFileSync(p, png);
      files.push({ path: p, kind: 'png' as const, engine: 'resvg' });
    }
    return {
      files,
      diagnostics: [],
      limitations: [
        'Previews use bundled metric-compatible fonts; PowerPoint renders with Arial/Georgia.',
      ],
    };
  },
};
