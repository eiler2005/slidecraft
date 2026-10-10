/**
 * HTML engines (two objects, shared code).
 *
 *  - kind 'html' / id 'html': ONE self-contained `<deck>.html`. Fonts are embedded as
 *    base64 @font-face, every slide is an inline SVG from slideSvg(), and a tiny script
 *    adds keyboard navigation, notes, fullscreen and deep links. No network requests.
 *  - kind 'pdf' / id 'html': the same document, printed to PDF by the system
 *    Chrome/Chromium in headless mode (no browser automation library involved).
 */
import { execFile, execFileSync } from 'node:child_process';
import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Face, fontBuffer, VECTOR_FAMILY } from '../engine/fonts.ts';
import type { Scene } from '../engine/scene.ts';
import type { MeasureFont } from '../spec/theme.ts';
import { esc, slideSvg } from './svg.ts';
import type { Detection, Engine } from './types.ts';

const FACE_CSS: Record<Face, { weight: string; style: string }> = {
  regular: { weight: 'normal', style: 'normal' },
  bold: { weight: 'bold', style: 'normal' },
  italic: { weight: 'normal', style: 'italic' },
  boldItalic: { weight: 'bold', style: 'italic' },
};

/** @font-face rules for every bundled family that the slides actually reference. */
function fontFaceCss(usedMarkup: string): string {
  let css = '';
  for (const measure of Object.keys(VECTOR_FAMILY) as MeasureFont[]) {
    const family = VECTOR_FAMILY[measure];
    // Liberation Sans is the fallback of the placeholder/slide-number drawing code.
    if (measure !== 'liberation-sans' && !usedMarkup.includes(family)) continue;
    for (const face of Object.keys(FACE_CSS) as Face[]) {
      const b64 = fontBuffer(measure, face).toString('base64');
      const { weight, style } = FACE_CSS[face];
      css += `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};font-display:block;src:url(data:font/ttf;base64,${b64}) format("truetype")}\n`;
    }
  }
  return css;
}

const STYLE = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:#0d0f12;color:#e8eaed;font-family:"Liberation Sans",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.deck{display:block}
.slide{display:block;position:relative;width:min(100vw,calc(100vh * var(--ar)));aspect-ratio:var(--ar);margin:0 auto 24px;background:#fff}
.slide svg{display:block;width:100%;height:100%}
.notes{display:none}
.chrome{display:none}
.js body{overflow:hidden}
.js .deck{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.js .slide{display:none;margin:0;box-shadow:0 10px 60px rgba(0,0,0,.55)}
.js .slide.active{display:block}
.js .chrome{display:flex}
.js .notes{display:block}
.chrome{position:fixed;left:0;right:0;bottom:0;padding:10px 16px;align-items:center;justify-content:space-between;gap:12px;font-size:13px;color:#aab0b8;background:linear-gradient(transparent,rgba(0,0,0,.55));transition:opacity .25s;pointer-events:none}
.chrome button{pointer-events:auto;appearance:none;border:1px solid rgba(255,255,255,.22);background:rgba(20,22,26,.7);color:#e8eaed;border-radius:6px;min-width:34px;height:30px;font:inherit;cursor:pointer}
.chrome button:hover,.chrome button:focus-visible{background:rgba(60,64,72,.9);outline:2px solid #6ea8fe;outline-offset:1px}
.chrome .grp{display:flex;gap:8px;align-items:center}
.chrome .hint{opacity:.8}
.idle .chrome{opacity:0}
.idle{cursor:none}
.notes{position:fixed;left:50%;bottom:56px;transform:translateX(-50%);width:min(900px,calc(100vw - 32px));max-height:40vh;overflow:auto;padding:14px 18px;border-radius:10px;background:rgba(10,12,16,.92);border:1px solid rgba(255,255,255,.18);color:#f1f3f5;font-size:16px;line-height:1.45;white-space:pre-wrap;visibility:hidden}
.show-notes .slide.active .notes{visibility:visible}
.notes[data-empty]::before{content:"No presenter notes for this slide.";opacity:.6}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:640px){.chrome .hint{display:none}}
@media print{
  @page{size:var(--pw) var(--ph);margin:0}
  html,body{background:#fff!important;width:var(--pw);height:auto;overflow:visible!important}
  .chrome,.notes{display:none!important}
  .deck,.js .deck{position:static!important;display:block!important}
  .slide,.js .slide{display:block!important;width:var(--pw)!important;height:var(--ph)!important;aspect-ratio:auto!important;margin:0!important;box-shadow:none!important;overflow:hidden;break-after:page;page-break-after:always;break-inside:avoid}
  .slide:last-of-type{break-after:auto;page-break-after:auto}
}
`;

const SCRIPT = `
(function(){
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  var n=slides.length, cur=0, counter=document.getElementById('counter');
  function clamp(i){return Math.max(0,Math.min(n-1,i));}
  function show(i,fromHash){
    cur=clamp(i);
    slides.forEach(function(s,k){
      var on=k===cur;
      s.classList.toggle('active',on);
      if(on){s.removeAttribute('aria-hidden');}else{s.setAttribute('aria-hidden','true');}
    });
    if(counter)counter.textContent=(cur+1)+' / '+n;
    if(!fromHash){
      try{history.replaceState(null,'','#'+(cur+1));}catch(e){location.hash='#'+(cur+1);}
    }
    document.title=slides[cur].getAttribute('aria-label')+' \\u00b7 '+baseTitle;
  }
  var baseTitle=document.title;
  function fromHash(){
    var m=/^#(\\d+)$/.exec(location.hash);
    show(m?parseInt(m[1],10)-1:0,true);
  }
  function toggleNotes(){document.documentElement.classList.toggle('show-notes');}
  function toggleFull(){
    var d=document;
    if(d.fullscreenElement){d.exitFullscreen&&d.exitFullscreen();}
    else if(d.documentElement.requestFullscreen){d.documentElement.requestFullscreen().catch(function(){});}
  }
  document.addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    var k=e.key;
    if(k==='ArrowRight'||k==='ArrowDown'||k==='PageDown'||k===' '||k==='Enter'){e.preventDefault();show(cur+1);}
    else if(k==='ArrowLeft'||k==='ArrowUp'||k==='PageUp'||k==='Backspace'){e.preventDefault();show(cur-1);}
    else if(k==='Home'){e.preventDefault();show(0);}
    else if(k==='End'){e.preventDefault();show(n-1);}
    else if(k==='n'||k==='N'){toggleNotes();}
    else if(k==='f'||k==='F'){toggleFull();}
  });
  window.addEventListener('hashchange',fromHash);
  [['prev',function(){show(cur-1);}],['next',function(){show(cur+1);}],['notes',toggleNotes],['full',toggleFull]].forEach(function(p){
    var b=document.getElementById('btn-'+p[0]);if(b)b.addEventListener('click',function(e){p[1]();b.blur();});
  });
  var sx=null;
  document.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
  document.addEventListener('touchend',function(e){
    if(sx===null)return;var dx=e.changedTouches[0].clientX-sx;sx=null;
    if(Math.abs(dx)>40)show(cur+(dx<0?1:-1));
  },{passive:true});
  var idle;
  function wake(){document.documentElement.classList.remove('idle');clearTimeout(idle);idle=setTimeout(function(){document.documentElement.classList.add('idle');},3000);}
  ['mousemove','keydown','touchstart'].forEach(function(t){document.addEventListener(t,wake,{passive:true});});
  wake();
  fromHash();
})();
`;

/** The complete self-contained HTML document for a scene. */
export function buildHtml(scene: Scene): string {
  const { w, h } = scene.format;
  const sections = scene.slides.map((s, i) => {
    const label = `Slide ${i + 1}: ${s.title}`;
    const notes = s.notes?.trim();
    return (
      `<section class="slide${i === 0 ? ' active' : ''}" id="slide-${i + 1}" aria-label="${esc(label)}" data-slide="${i + 1}">` +
      `${slideSvg(scene, s)}` +
      `<div class="notes" role="note" aria-label="Presenter notes"${notes ? '' : ' data-empty'}>${notes ? esc(notes) : ''}</div>` +
      `</section>`
    );
  });
  const body = sections.join('\n');
  const css = fontFaceCss(body);
  const lang = esc(scene.language || 'en');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="SlideCraft">
<title>${esc(scene.title)}</title>
<script>document.documentElement.classList.add('js')</script>
<style>
${css}:root{--ar:${(w / h).toFixed(5)}}${STYLE.replaceAll('var(--pw)', `${w}in`).replaceAll('var(--ph)', `${h}in`)}</style>
</head>
<body>
<main class="deck" aria-label="${esc(scene.title)}">
${body}
</main>
<div class="chrome" role="toolbar" aria-label="Slide controls">
<div class="grp"><button id="btn-prev" type="button" aria-label="Previous slide">&#8592;</button><button id="btn-next" type="button" aria-label="Next slide">&#8594;</button><span id="counter" aria-live="polite">1 / ${scene.slides.length}</span></div>
<span class="hint">&#8592; &#8594; navigate &middot; N notes &middot; F fullscreen</span>
<div class="grp"><button id="btn-notes" type="button" aria-label="Toggle presenter notes">N</button><button id="btn-full" type="button" aria-label="Toggle fullscreen">F</button></div>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

export const htmlEngine: Engine = {
  id: 'html',
  kind: 'html',
  label: 'Self-contained HTML deck',
  license: 'MIT',
  capabilities: {
    editable: false,
    nativeCharts: false,
    speakerNotes: true,
    fidelity: 'same-layout',
    install: 'bundled',
    ci: true,
  },
  async detect() {
    return { available: true, detail: 'bundled' };
  },
  async render(scene, opts) {
    mkdirSync(opts.outDir, { recursive: true });
    const p = join(opts.outDir, `${opts.baseName}.html`);
    writeFileSync(p, buildHtml(scene));
    return {
      files: [{ path: p, kind: 'html', engine: 'html' }],
      diagnostics: [],
      limitations: [
        'HTML slides are inline SVG drawn with embedded metric-compatible fonts (Liberation/Gelasio), not editable text boxes.',
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// System Chrome / Chromium → PDF
// ---------------------------------------------------------------------------

function isExecutable(p: string): boolean {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function onPath(names: string[]): string | undefined {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  for (const n of names) {
    for (const d of dirs) {
      const p = join(d, n);
      if (isExecutable(p)) return p;
    }
  }
  return undefined;
}

/** Locate a Chrome/Chromium/Edge binary. Order: $CHROME_PATH, macOS apps, PATH, Windows. */
export function findChrome(): string | undefined {
  const env = process.env.CHROME_PATH;
  if (env && isExecutable(env)) return env;
  const candidates: string[] = [];
  if (process.platform === 'darwin') {
    for (const base of ['/Applications', join(homedir(), 'Applications')]) {
      candidates.push(
        `${base}/Google Chrome.app/Contents/MacOS/Google Chrome`,
        `${base}/Chromium.app/Contents/MacOS/Chromium`,
        `${base}/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`,
      );
    }
  }
  for (const c of candidates) if (isExecutable(c)) return c;
  const onP = onPath(
    process.platform === 'win32'
      ? ['chrome.exe', 'msedge.exe']
      : [
          'google-chrome',
          'google-chrome-stable',
          'chromium',
          'chromium-browser',
          'microsoft-edge',
          'microsoft-edge-stable',
        ],
  );
  if (onP) return onP;
  if (process.platform === 'win32') {
    const roots = [
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)'],
      process.env.LOCALAPPDATA,
    ].filter((x): x is string => !!x);
    for (const r of roots) {
      for (const rel of [
        'Google\\Chrome\\Application\\chrome.exe',
        'Chromium\\Application\\chrome.exe',
        'Microsoft\\Edge\\Application\\msedge.exe',
      ]) {
        const p = join(r, rel);
        if (isExecutable(p)) return p;
      }
    }
  }
  return undefined;
}

let chromeDetection: Detection | undefined;
function detectChrome(): Detection {
  if (chromeDetection) return chromeDetection;
  const bin = findChrome();
  if (!bin) {
    chromeDetection = {
      available: false,
      detail: 'no Chrome, Chromium or Edge found (set CHROME_PATH to override)',
      install: 'Install Google Chrome or Chromium, or set CHROME_PATH',
    };
    return chromeDetection;
  }
  let version: string | undefined;
  try {
    const out = execFileSync(bin, ['--version'], {
      timeout: 5000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    version = /(\d+(?:\.\d+)+)/.exec(out)?.[1];
  } catch {
    // version is best-effort
  }
  chromeDetection = { available: true, detail: bin, ...(version ? { version } : {}) };
  return chromeDetection;
}

function runChrome(bin: string, args: string[], timeoutMs: number): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, _out, stderr) => {
        if (err) {
          const e = err as NodeJS.ErrnoException & { killed?: boolean };
          const why = e.killed
            ? `timed out after ${Math.round(timeoutMs / 1000)}s`
            : `exited with ${e.code ?? 'error'}`;
          reject(
            new Error(`Chrome ${why}: ${String(stderr).trim().split('\n').slice(-3).join(' | ')}`),
          );
        } else resolve({ stderr: String(stderr) });
      },
    );
  });
}

export const htmlPdfEngine: Engine = {
  id: 'html',
  kind: 'pdf',
  label: 'PDF via system Chrome (HTML print)',
  license: 'MIT (SlideCraft); uses your installed Chrome/Chromium',
  capabilities: {
    editable: false,
    nativeCharts: false,
    speakerNotes: false,
    fidelity: 'same-layout',
    install: 'system Chrome or Chromium',
    ci: false,
  },
  async detect() {
    return detectChrome();
  },
  async render(scene, opts) {
    const bin = findChrome();
    if (!bin) throw new Error('Chrome/Chromium not found; set CHROME_PATH or install Chrome');
    mkdirSync(opts.outDir, { recursive: true });
    const tmp = mkdtempSync(join(tmpdir(), 'slidecraft-chrome-'));
    try {
      const htmlPath = join(tmp, 'deck.html');
      const tmpPdf = join(tmp, 'deck.pdf');
      writeFileSync(htmlPath, buildHtml(scene));
      await runChrome(
        bin,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-extensions',
          '--hide-scrollbars',
          '--no-pdf-header-footer',
          `--user-data-dir=${join(tmp, 'profile')}`,
          ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
          `--print-to-pdf=${tmpPdf}`,
          '--virtual-time-budget=5000',
          pathToFileURL(htmlPath).href,
        ],
        120_000,
      );
      if (!existsSync(tmpPdf) || statSync(tmpPdf).size === 0)
        throw new Error('Chrome finished but wrote no PDF');
      const out = join(opts.outDir, `${opts.baseName}.pdf`);
      copyFileSync(tmpPdf, out);
      return {
        files: [{ path: out, kind: 'pdf', engine: 'html' }],
        diagnostics: [],
        limitations: [
          'PDF was printed by Chrome from the HTML deck: same layout and bundled fonts as the other vector outputs, but timestamps are not reproducible.',
        ],
      };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  },
};
