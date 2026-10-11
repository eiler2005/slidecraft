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
import type { HtmlNode, ImageNode, Scene, SceneNode, TextStyle } from '../engine/scene.ts';
import { layoutText, makeTextNode, para } from '../engine/text.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import { findChrome, fontFaceCss, runChrome } from './html.ts';
import { rasterize } from './resvg.ts';

const PX = 96;
const SCALE = 2;

type NativeItem =
  | {
      kind: 'rect';
      slide: string;
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      opacity?: number;
      stroke?: string;
      strokeWidth?: number;
      radius?: number;
    }
  | {
      kind: 'text';
      slide: string;
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      color: string;
      size: number;
      bold: boolean;
      italic: boolean;
      align: 'left' | 'center' | 'right';
      lineHeight: number;
    };

/**
 * Browser layout extraction for the editable subset of freeform CSS.  Coordinates come
 * from Chrome after grid/flex/layout resolution rather than attempting to reimplement CSS.
 * This is deliberately conservative: gradients, shadows and pseudo-elements
 * are reported instead of being silently approximated as an image.
 */
const NATIVE_SCRIPT = `<script>
(()=>{const out={items:[],unsupported:[]},rgb=v=>{let m=v.match(/^rgba?\\(([^)]+)\\)/);if(!m)return null;let a=m[1].split(',').map(x=>x.trim());let h=n=>Math.max(0,Math.min(255,Math.round(+n))).toString(16).padStart(2,'0');return {hex:'#'+h(a[0])+h(a[1])+h(a[2]),alpha:a[3]===undefined?1:+a[3]};},add=(o)=>out.items.push(o);for(const root of document.querySelectorAll('.sc-ff')){let rr=root.getBoundingClientRect(), id=root.id;for(const e of [root,...root.querySelectorAll('*')]){let s=getComputedStyle(e),r=e.getBoundingClientRect();if(!r.width||!r.height)continue;if(s.boxShadow!=='none'||s.backgroundImage!=='none'||s.clipPath!=='none'||s.filter!=='none')out.unsupported.push({id,feature:'shadow, gradient/image, clip-path or filter'});let bg=rgb(s.backgroundColor), bs=[s.borderTop,s.borderRight,s.borderBottom,s.borderLeft].map((_,i)=>({w:parseFloat([s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth][i]),c:rgb([s.borderTopColor,s.borderRightColor,s.borderBottomColor,s.borderLeftColor][i])}));let same=bs.every(b=>b.w===bs[0].w&&b.c&&bs[0].c&&b.c.hex===bs[0].c.hex&&b.c.alpha===bs[0].c.alpha);if((bg&&bg.alpha>0)||bs.some(b=>b.w>0)){add({kind:'rect',slide:id,x:r.left-rr.left,y:r.top-rr.top,w:r.width,h:r.height,fill:bg&&bg.alpha?bg.hex:undefined,opacity:bg?bg.alpha:undefined,stroke:same&&bs[0].w?bs[0].c.hex:undefined,strokeWidth:same&&bs[0].w?bs[0].w*.75:undefined,radius:parseFloat(s.borderTopLeftRadius)||0});if(!same)bs.forEach((b,i)=>{if(!b.w||!b.c)return;let q=i===0?[r.left,r.top,r.width,b.w]:i===1?[r.right-b.w,r.top,b.w,r.height]:i===2?[r.left,r.bottom-b.w,r.width,b.w]:[r.left,r.top,b.w,r.height];add({kind:'rect',slide:id,x:q[0]-rr.left,y:q[1]-rr.top,w:q[2],h:q[3],fill:b.c.hex,opacity:b.c.alpha});});}}
let walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let n; n=walker.nextNode();){let raw=n.textContent||'';if(!raw.trim())continue;let p=n.parentElement,s=getComputedStyle(p),col=rgb(s.color)||{hex:'#000000',alpha:1},groups=new Map();for(let i=0;i<raw.length;i++){let range=document.createRange();range.setStart(n,i);range.setEnd(n,i+1);let r=range.getBoundingClientRect();if(!r.width&&!/\\s/.test(raw[i]))continue;let k=Math.round(r.top*2)/2;let g=groups.get(k);if(!g){g={x:r.left,y:r.top,right:r.right,h:r.height,text:''};groups.set(k,g)}g.x=Math.min(g.x,r.left);g.right=Math.max(g.right,r.right);g.h=Math.max(g.h,r.height);g.text+=raw[i];}for(const g of groups.values()){let text=g.text.replace(/\\s+/g,' ').trim();if(!text)continue;add({kind:'text',slide:id,x:g.x-rr.left,y:g.y-rr.top,w:Math.max(2,g.right-g.x+3),h:Math.max(g.h+4,parseFloat(s.fontSize)*1.35),text,color:col.hex,size:parseFloat(s.fontSize)*.75,bold:+s.fontWeight>=600,italic:s.fontStyle.includes('italic'),align:s.textAlign==='center'?'center':s.textAlign==='right'||s.textAlign==='end'?'right':'left',lineHeight:parseFloat(s.lineHeight)/parseFloat(s.fontSize)||1.2});}}if(getComputedStyle(root,'::before').content!=='none'||getComputedStyle(root,'::after').content!=='none')out.unsupported.push({id,feature:'pseudo-element'});}document.body.setAttribute('data-sc-native',JSON.stringify(out));})();</script>`;

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

/** Convert supported HTML/CSS freeform blocks into individual native scene primitives. */
export async function nativeFreeform(
  scene: Scene,
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
  const bin = findChrome();
  if (!bin) {
    diagnostics.push(
      diag('SC-EDIT-002', 'Chrome is required to calculate editable freeform geometry.', {
        severity: 'error',
      }),
    );
    return { scene, diagnostics };
  }
  const width = Math.ceil(Math.max(...placed.map((p) => p.node.box.w)) * PX);
  const height = Math.max(1, top);
  const blocks = placed
    .map(
      (p) =>
        `<div style="position:absolute;left:0;top:${p.top}px">${freeformMarkup(p.node, p.id)}</div>`,
    )
    .join('');
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss(blocks)}html,body{margin:0;padding:0;background:transparent;width:${width}px;height:${height}px;overflow:hidden}</style></head><body>${blocks}${NATIVE_SCRIPT}</body></html>`;
  const tmp = mkdtempSync(join(tmpdir(), 'slidecraft-native-freeform-'));
  const nodes = new Map<HtmlNode, SceneNode[]>();
  try {
    const file = join(tmp, 'native.html');
    writeFileSync(file, page);
    const dom = await dumpDom(bin, [
      ...chromeArgs(tmp),
      '--virtual-time-budget=3000',
      '--dump-dom',
      pathToFileURL(file).href,
    ]);
    const attr = /data-sc-native="([^"]*)"/.exec(dom)?.[1];
    if (!attr) throw new Error('Chrome did not return editable freeform geometry');
    const extracted = JSON.parse(attr.replace(/&quot;/g, '"').replace(/&amp;/g, '&')) as {
      items: NativeItem[];
      unsupported: { id: string; feature: string }[];
    };
    const unsupported = new Map(extracted.unsupported.map((x) => [x.id, x.feature]));
    for (const p of placed) {
      const feature = unsupported.get(p.id);
      if (feature) {
        diagnostics.push(
          diag('SC-EDIT-002', `Freeform ${p.id} uses unsupported editable CSS: ${feature}.`, {
            slide: p.slide,
          }),
        );
        continue;
      }
      const font = scene.fonts?.body ?? { family: 'Arial', measure: 'liberation-sans' as const };
      const slideTitle = scene.slides.find((s) => s.id === p.slide)?.title;
      const list: SceneNode[] = [];
      for (const item of extracted.items.filter((x) => x.slide === p.id)) {
        const x = p.node.box.x + item.x / PX;
        const y = p.node.box.y + item.y / PX;
        if (item.kind === 'rect') {
          list.push({
            kind: 'rect',
            box: { x, y, w: item.w / PX, h: item.h / PX },
            ...(item.fill ? { fill: item.fill, fillOpacity: item.opacity } : {}),
            ...(item.stroke
              ? { stroke: { color: item.stroke, width: item.strokeWidth ?? 0.75 } }
              : {}),
            ...(item.radius ? { radius: item.radius / PX } : {}),
            role: 'freeform-native-shape',
          });
        } else {
          const style: TextStyle = {
            family: font.family,
            measure: font.measure,
            size: item.size,
            lineSpacing: item.size * item.lineHeight,
            color: item.color,
            bold: item.bold,
            italic: item.italic,
            align: item.align,
            valign: 'top',
          };
          const box = { x, y, w: item.w / PX, h: item.h / PX };
          const ps = [para(item.text)];
          list.push(
            makeTextNode(ps, box, style, layoutText(ps, style, box.w), {
              role: item.text === slideTitle ? 'title' : 'freeform-native-text',
            }),
          );
        }
      }
      nodes.set(p.node, list);
    }
  } catch (e) {
    diagnostics.push(
      diag('SC-EDIT-002', `Editable freeform conversion failed: ${(e as Error).message}`, {
        severity: 'error',
      }),
    );
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {}
  }
  return {
    scene: {
      ...scene,
      slides: scene.slides.map((s) => ({
        ...s,
        nodes: s.nodes.flatMap((n) => (n.kind === 'html' ? (nodes.get(n) ?? [n]) : [n])),
      })),
    },
    diagnostics,
  };
}
