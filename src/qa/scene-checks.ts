import { contrast } from '../engine/color.ts';
import type { Box, Scene, SceneNode, TextNode } from '../engine/scene.ts';
import { type Diagnostic, diag } from './codes.ts';

const EPS = 0.02;
/** Text roles that are ornaments (oversized glyphs) and may sit close to other text. */
const DECORATIVE_TEXT = new Set(['quote-mark']);

function inside(b: Box, W: number, H: number): boolean {
  return b.x >= -EPS && b.y >= -EPS && b.x + b.w <= W + EPS && b.y + b.h <= H + EPS;
}

/** Ink extent of laid-out text: cap height above the first baseline to descenders below the last. */
function textExtent(t: TextNode): Box {
  if (!t.lines.length) return { x: t.box.x, y: t.box.y, w: 0, h: 0 };
  const em = t.style.size / 72;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const l of t.lines) {
    for (const seg of l.segments) {
      if (!seg.text.trim()) continue;
      minX = Math.min(minX, seg.x);
      maxX = Math.max(maxX, seg.x + seg.width);
    }
  }
  if (!Number.isFinite(minX)) return { x: t.box.x, y: t.box.y, w: 0, h: 0 };
  const top = t.lines[0]!.baseline - em * 0.72;
  const bottom = t.lines[t.lines.length - 1]!.baseline + em * 0.2;
  return { x: t.box.x + minX, y: t.box.y + top, w: maxX - minX, h: bottom - top };
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Background color under a point: topmost filled rect containing it, else slide background. */
function bgAt(nodes: SceneNode[], upto: number, x: number, y: number, fallback: string): string {
  for (let i = upto - 1; i >= 0; i--) {
    const n = nodes[i]!;
    if (n.kind === 'rect' && n.fill && (n.fillOpacity ?? 1) > 0.6) {
      const b = n.box;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return n.fill;
    }
  }
  return fallback;
}

export function checkScene(scene: Scene): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { w: W, h: H } = scene.format;
  for (const s of scene.slides) {
    const bg = s.background ?? scene.masters[s.master]!.background;
    const texts: { t: TextNode; i: number }[] = [];
    s.nodes.forEach((n, i) => {
      const box =
        n.kind === 'line'
          ? {
              x: Math.min(n.x1, n.x2),
              y: Math.min(n.y1, n.y2),
              w: Math.abs(n.x2 - n.x1),
              h: Math.abs(n.y2 - n.y1),
            }
          : n.box;
      if (!inside(box, W, H)) {
        out.push(
          diag(
            'SC-GEOM-001',
            `${n.kind}${'role' in n && n.role ? ` (${n.role})` : ''} extends outside the slide`,
            { slide: s.id },
          ),
        );
      }
      if (n.kind === 'text' && n.lines.length && !DECORATIVE_TEXT.has(n.role ?? ''))
        texts.push({ t: n, i });
    });
    // overlaps between text blocks (ignoring nested decorations)
    for (let a = 0; a < texts.length; a++) {
      for (let b = a + 1; b < texts.length; b++) {
        const A = textExtent(texts[a]!.t);
        const B = textExtent(texts[b]!.t);
        const ov = overlap(A, B);
        if (ov > 0.02 && ov > 0.08 * Math.min(A.w * A.h, B.w * B.h)) {
          out.push(
            diag(
              'SC-GEOM-002',
              `Text "${texts[a]!.t.lines[0]?.segments[0]?.text.slice(0, 30) ?? ''}" overlaps "${texts[b]!.t.lines[0]?.segments[0]?.text.slice(0, 30) ?? ''}"`,
              { slide: s.id },
            ),
          );
        }
      }
    }
    // text that starts inside a filled panel must stay inside it
    for (const { t, i } of texts) {
      const ink = textExtent(t);
      if (ink.w <= 0 || t.role === 'source' || t.role === 'footer') continue;
      for (let j = i - 1; j >= 0; j--) {
        const n = s.nodes[j]!;
        if (n.kind !== 'rect' || !n.fill || n.box.w < 0.6 || n.box.h < 0.4) continue;
        const b = n.box;
        const startsInside =
          t.box.x >= b.x - EPS &&
          t.box.y >= b.y - EPS &&
          t.box.x <= b.x + b.w &&
          t.box.y <= b.y + b.h;
        if (!startsInside) continue;
        if (ink.x + ink.w > b.x + b.w + 0.03 || ink.y + ink.h > b.y + b.h + 0.03) {
          out.push(
            diag(
              'SC-GEOM-003',
              `Text "${t.lines[0]?.segments[0]?.text.slice(0, 30) ?? ''}" runs past its panel`,
              {
                slide: s.id,
                ...(t.pointer ? { pointer: t.pointer } : {}),
              },
            ),
          );
        }
        break;
      }
    }
    // contrast
    for (const { t, i } of texts) {
      const back = bgAt(
        s.nodes,
        i,
        t.box.x + 0.05,
        t.box.y + Math.min(t.contentHeight, t.box.h) / 2,
        bg,
      );
      const fg = t.lines[0]?.segments[0]?.color ?? t.style.color;
      const ratio = contrast(fg, back);
      const large = t.style.size >= 18 || (t.style.size >= 14 && t.style.bold);
      const need = large ? 3 : 4.5;
      if (ratio < need && t.role !== 'source' && t.role !== 'footer') {
        out.push(
          diag(
            'SC-CONTRAST-001',
            `${t.role ?? 'text'} contrast ${ratio.toFixed(2)}:1 (needs ${need}:1)`,
            { slide: s.id, ...(t.pointer ? { pointer: t.pointer } : {}) },
          ),
        );
      }
    }
    // density
    const words = texts
      .filter(({ t }) => t.role !== 'source' && t.role !== 'footer')
      .reduce(
        (a, { t }) =>
          a +
          t.paragraphs.reduce(
            (x, p) =>
              x +
              p.runs
                .map((r) => r.text)
                .join('')
                .split(/\s+/)
                .filter(Boolean).length,
            0,
          ),
        0,
      );
    if (words > 170)
      out.push(
        diag('SC-DENSITY-001', `${words} words on one slide (aim for under 120)`, { slide: s.id }),
      );
  }
  return out;
}
