import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { renderPptx } from '../src/backends/pptxgenjs.ts';
import { nodeSvg } from '../src/backends/svg.ts';
import { checkDeck } from '../src/build.ts';
import { coverPlacement } from '../src/engine/scene.ts';

describe('image focus (which part of a cropped picture stays in view)', () => {
  it('places the picture so the focus point decides the crop', () => {
    const box = { x: 1, y: 0, w: 4, h: 6 };
    // 3:2 picture on a 4×6 panel: drawn 9×6, 5 in of width cropped away
    expect(coverPlacement({ w: 1500, h: 1000 }, box)).toEqual({ x: -1.5, y: 0, w: 9, h: 6 });
    expect(coverPlacement({ w: 1500, h: 1000 }, box, { x: 0, y: 0.5 }).x).toBe(1);
    expect(coverPlacement({ w: 1500, h: 1000 }, box, { x: 1, y: 0.5 }).x).toBe(-4);
  });

  it('crops the same window in the PPTX and the SVG', async () => {
    const { scene } = checkDeck('examples/fde-engineer-en-v2/deck.yaml');
    const cover = scene!.slides[0]!;
    const img = cover.nodes.find((n) => n.kind === 'image' && n.path)!;
    expect(img.kind === 'image' && img.focus).toEqual({ x: 0, y: 0.5 });

    // PowerPoint: an explicit source rectangle starting at the left edge
    const zip = await JSZip.loadAsync(
      await renderPptx({ ...scene!, slides: [cover] }, new Date(0)),
    );
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const rect = /<a:srcRect l="(-?\d+)" r="(-?\d+)" t="(-?\d+)" b="(-?\d+)"\/>/.exec(xml)!;
    expect(Number(rect[1])).toBe(0);
    expect(Number(rect[2])).toBeGreaterThan(50_000);
    expect(Math.abs(Number(rect[3]))).toBeLessThan(10);

    // browser: the whole picture in its own clipping viewport, aligned left
    const svg = nodeSvg(img);
    expect(svg).toMatch(
      /<svg x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" overflow="hidden"><image x="0" /,
    );
  });
});
