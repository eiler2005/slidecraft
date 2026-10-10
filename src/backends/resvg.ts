import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { allFontPaths } from '../engine/fonts.ts';
import type { Scene } from '../engine/scene.ts';
import { resvgWasmPath } from '../paths.ts';
import { slideSvg } from './svg.ts';
import type { Engine } from './types.ts';

let ready: Promise<void> | undefined;
let fontBuffers: Uint8Array[] | undefined;

export async function ensureResvg(): Promise<void> {
  if (!ready) ready = initWasm(readFileSync(resvgWasmPath()));
  await ready;
  if (!fontBuffers) fontBuffers = allFontPaths().map((f) => new Uint8Array(readFileSync(f.path)));
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
