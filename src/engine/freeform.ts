/**
 * Freeform HTML slides (M6): an author or agent writes HTML/CSS for the slide body; the
 * frame (action title, tracker, source line) stays SlideCraft's. Fragments are sanitised,
 * see theme tokens as CSS variables, and are checked for overflow and minimum text size
 * in Chrome — the same checklist as measured text.
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, resolve } from 'node:path';
import type { HtmlNode } from './scene.ts';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

/** Strip scripts, handlers, frames and remote URLs; inline local images as data URIs. */
export function sanitizeHtml(html: string, baseDir: string): { html: string; removed: string[] } {
  const removed: string[] = [];
  const note = (what: string) => {
    if (!removed.includes(what)) removed.push(what);
  };
  /** Replacer that records what it removed. */
  const drop =
    (what: string | ((...m: string[]) => string)) =>
    (...m: string[]) => {
      note(typeof what === 'string' ? what : what(...m));
      return '';
    };
  let out = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, drop('script'))
    .replace(
      /<(iframe|object|embed|frame|frameset|applet|base|meta|link)\b[^>]*>(?:[\s\S]*?<\/\1\s*>)?/gi,
      drop((_m, t) => String(t).toLowerCase()),
    )
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, drop('event handler'))
    .replace(/(href|src|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, drop('javascript: URL'));
  out = out.replace(
    /(src|href|xlink:href)\s*=\s*("|')([^"']+)\2/gi,
    (m, attr: string, q: string, url: string) => {
      if (/^data:/i.test(url) || url.startsWith('#')) return m;
      if (/^(https?:)?\/\//i.test(url)) {
        note('remote URL');
        return '';
      }
      const p = isAbsolute(url) ? url : resolve(baseDir, url);
      const mime = MIME[extname(p).toLowerCase()];
      if (!mime || !existsSync(p)) {
        note(`missing file ${url}`);
        return '';
      }
      return `${attr}=${q}data:${mime};base64,${readFileSync(p).toString('base64')}${q}`;
    },
  );
  out = out.replace(/url\(\s*(['"]?)(https?:)?\/\/[^)]*\1\s*\)/gi, () => {
    note('remote URL');
    return 'none';
  });
  return { html: out, removed };
}

export function sanitizeCss(css: string): { css: string; removed: string[] } {
  const removed: string[] = [];
  const out = css
    .replace(/@import[^;]*;?/gi, () => {
      removed.push('@import');
      return '';
    })
    .replace(/url\(\s*(['"]?)(https?:)?\/\/[^)]*\1\s*\)/gi, () => {
      removed.push('remote URL');
      return 'none';
    })
    .replace(/<\/?style[^>]*>/gi, '');
  return { css: out, removed };
}

const PX = 96;

/** Stable id for scoping CSS. */
export function freeformId(n: HtmlNode): string {
  let h = 2166136261;
  for (const ch of `${n.pointer ?? ''}${n.html}${n.css ?? ''}`)
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `ff-${(h >>> 0).toString(36)}`;
}

/** The fragment wrapped in a sized, scoped container (XHTML-safe for foreignObject). */
export function freeformMarkup(n: HtmlNode, id = freeformId(n)): string {
  const vars = Object.entries(n.vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  const base = `#${id}{${vars};box-sizing:border-box;width:${(n.box.w * PX).toFixed(2)}px;height:${(n.box.h * PX).toFixed(2)}px;overflow:hidden;font-family:var(--font-body);font-size:var(--size-body);line-height:1.25;color:var(--ink)}#${id} *{box-sizing:border-box}`;
  const scoped = n.css ? `#${id}{${n.css}}` : '';
  return `<div xmlns="http://www.w3.org/1999/xhtml" id="${id}" class="sc-ff"><style>${base}${scoped}</style>${n.html}</div>`;
}

/** Script appended to the measuring page: overflow and the smallest text size per node. */
export const MEASURE_SCRIPT = `<script>
const out = {};
for (const el of document.querySelectorAll('.sc-ff')) {
  const r = el.getBoundingClientRect();
  let over = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  let minPt = Infinity;
  for (const d of el.querySelectorAll('*')) {
    const b = d.getBoundingClientRect();
    if (b.width && (b.right > r.right + 1 || b.bottom > r.bottom + 1 || b.left < r.left - 1 || b.top < r.top - 1)) over = true;
    if ([...d.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))
      minPt = Math.min(minPt, parseFloat(getComputedStyle(d).fontSize) * 0.75);
  }
  if ([...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))
    minPt = Math.min(minPt, parseFloat(getComputedStyle(el).fontSize) * 0.75);
  out[el.id] = { over, minPt: minPt === Infinity ? null : minPt };
}
document.body.setAttribute('data-sc', JSON.stringify(out));
</script>`;
