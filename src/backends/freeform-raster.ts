/**
 * Freeform HTML for engines that cannot draw HTML (PPTX, native PDF, PNG, DOCX, one-pager):
 * one headless Chrome run measures every freeform block (overflow, smallest text), a second
 * takes one screenshot of all of them, and resvg crops each block into a PNG. The HTML
 * engines keep the live HTML.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { freeformId, freeformMarkup, MEASURE_SCRIPT } from '../engine/freeform.ts';
import type { HtmlNode, ImageNode, Scene } from '../engine/scene.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import { findChrome, fontFaceCss, runChrome } from './html.ts';
import { rasterize } from './resvg.ts';

const PX = 96;
const SCALE = 2;

function chromeArgs(tmp: string): string[] {
  return [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    `--user-data-dir=${join(tmp, 'profile')}`,
    ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
  ];
}

function dumpDom(bin: string, args: string[], timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const done = (err?: Error) => {
      clearTimeout(timer);
      if (child.exitCode === null) child.kill('SIGKILL');
      err ? reject(err) : resolve(out);
    };
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
      if (out.includes('</html>')) done();
    });
    child.stderr.on('data', () => {});
    child.on('error', (e) => done(e));
    child.on('exit', () => done());
    const timer = setTimeout(
      () => done(new Error('Chrome timed out measuring freeform slides')),
      timeoutMs,
    );
  });
}

interface Placed {
  slide: string;
  node: HtmlNode;
  id: string;
  top: number;
}

const placeholder = (n: HtmlNode): ImageNode => ({
  kind: 'image',
  box: n.box,
  alt: n.alt,
  fit: 'contain',
  placeholderLabel: 'Freeform HTML — needs Chrome to render here',
  role: 'freeform',
});

export async function flattenFreeform(
  scene: Scene,
  minPt: number,
): Promise<{ scene: Scene; diagnostics: Diagnostic[] }> {
  const placed: Placed[] = [];
  let top = 0;
  for (const s of scene.slides)
    for (const n of s.nodes)
      if (n.kind === 'html') {
        placed.push({ slide: s.id, node: n, id: freeformId(n), top });
        top += Math.ceil(n.box.h * PX) + 8;
      }
  if (!placed.length) return { scene, diagnostics: [] };
  const diagnostics: Diagnostic[] = [];
  const images = new Map<HtmlNode, ImageNode>();
  const bin = findChrome();
  if (!bin) {
    diagnostics.push(
      diag(
        'SC-ENGINE-001',
        'Chrome not found: freeform slides are placeholders in PPTX, PDF and PNG (the HTML deck shows them)',
        {
          severity: 'warning',
        },
      ),
    );
  } else {
    const width = Math.ceil(Math.max(...placed.map((p) => p.node.box.w)) * PX);
    const height = Math.max(1, top);
    const blocks = placed
      .map(
        (p) =>
          `<div style="position:absolute;left:0;top:${p.top}px">${freeformMarkup(p.node, p.id)}</div>`,
      )
      .join('');
    const page = (extra = '') =>
      `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss(blocks)}html,body{margin:0;padding:0;background:transparent;width:${width}px;height:${height}px;overflow:hidden}</style></head><body>${blocks}${extra}</body></html>`;
    const tmp = mkdtempSync(join(tmpdir(), 'slidecraft-freeform-'));
    try {
      const measureHtml = join(tmp, 'measure.html');
      writeFileSync(measureHtml, page(MEASURE_SCRIPT));
      const dom = await dumpDom(bin, [
        ...chromeArgs(tmp),
        '--virtual-time-budget=3000',
        '--dump-dom',
        pathToFileURL(measureHtml).href,
      ]);
      const attr = /data-sc="([^"]*)"/.exec(dom)?.[1] ?? '{}';
      const results = JSON.parse(attr.replace(/&quot;/g, '"').replace(/&amp;/g, '&')) as Record<
        string,
        { over: boolean; minPt: number | null }
      >;
      for (const p of placed) {
        const r = results[p.id];
        if (r?.over)
          diagnostics.push(
            diag('SC-FIT-004', 'Freeform HTML is larger than the slide body', {
              slide: p.slide,
              ...(p.node.pointer ? { pointer: p.node.pointer } : {}),
            }),
          );
        if (r?.minPt != null && r.minPt < minPt - 0.01)
          diagnostics.push(
            diag(
              'SC-FIT-005',
              `Freeform text at ${r.minPt.toFixed(1)}pt is below the ${minPt}pt minimum`,
              {
                slide: p.slide,
                ...(p.node.pointer ? { pointer: p.node.pointer } : {}),
              },
            ),
          );
      }
      const shotHtml = join(tmp, 'shot.html');
      const png = join(tmp, 'shot.png');
      writeFileSync(shotHtml, page());
      await runChrome(
        bin,
        [
          ...chromeArgs(tmp),
          `--window-size=${width},${height}`,
          `--force-device-scale-factor=${SCALE}`,
          // transparent page: the slide background shows between freeform elements
          '--default-background-color=00000000',
          '--virtual-time-budget=3000',
          `--screenshot=${png}`,
          pathToFileURL(shotHtml).href,
        ],
        90_000,
        png,
      );
      if (existsSync(png)) {
        const b64 = readFileSync(png).toString('base64');
        for (const p of placed) {
          const w = p.node.box.w * PX;
          const h = p.node.box.h * PX;
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 ${p.top} ${w} ${h}"><image x="0" y="0" width="${width}" height="${height}" xlink:href="data:image/png;base64,${b64}"/></svg>`;
          const crop = await rasterize(svg, w * SCALE);
          images.set(p.node, {
            kind: 'image',
            box: p.node.box,
            data: { mime: 'image/png', base64: crop.toString('base64') },
            alt: p.node.alt,
            fit: 'contain',
            role: 'freeform',
          });
        }
      }
    } catch (e) {
      diagnostics.push(
        diag('SC-ENGINE-001', `Freeform rendering failed: ${(e as Error).message}`, {
          severity: 'warning',
        }),
      );
    } finally {
      try {
        rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // a lingering Chrome helper may still hold the profile
      }
    }
  }
  const flat: Scene = {
    ...scene,
    slides: scene.slides.map((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.kind === 'html' ? (images.get(n) ?? placeholder(n)) : n)),
    })),
  };
  return { scene: flat, diagnostics };
}
