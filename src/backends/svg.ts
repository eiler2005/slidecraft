/**
 * Scene → SVG. Shared by the PNG (resvg) and HTML engines. Text is drawn line by
 * line from the measurer's breaks using the bundled metric-compatible families.
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { vectorFamily } from '../engine/fonts.ts';
import { freeformMarkup } from '../engine/freeform.ts';
import type { Master, Scene, SceneNode, SceneSlide, Stroke, TextNode } from '../engine/scene.ts';

export const PX_PER_IN = 96;
const px = (inch: number) => +(inch * PX_PER_IN).toFixed(2);
const ptpx = (pt: number) => +((pt * PX_PER_IN) / 72).toFixed(2);

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function strokeAttrs(s?: Stroke): string {
  if (!s) return 'stroke="none"';
  const dash =
    s.dash === 'dash'
      ? ` stroke-dasharray="${ptpx(s.width * 4)} ${ptpx(s.width * 3)}"`
      : s.dash === 'dot'
        ? ` stroke-dasharray="${ptpx(s.width)} ${ptpx(s.width * 2)}"`
        : '';
  return `stroke="${s.color}" stroke-width="${ptpx(s.width)}"${dash}`;
}

const imgCache = new Map<string, string>();
function dataUri(path: string): string {
  let v = imgCache.get(path);
  if (!v) {
    const ext = extname(path).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
    v = `data:${mime};base64,${readFileSync(path).toString('base64')}`;
    imgCache.set(path, v);
  }
  return v;
}

export function textSvg(t: TextNode): string {
  const fam = vectorFamily(t.style.measure);
  const size = ptpx(t.style.size);
  let out = '';
  for (const line of t.lines) {
    const y = px(t.box.y + line.baseline);
    if (line.bulletX !== undefined) {
      out += `<text x="${px(t.box.x + line.bulletX)}" y="${y}" font-family="${fam}" font-size="${size}" fill="${line.segments[0]?.color ?? t.style.color}">•</text>`;
    }
    for (const s of line.segments) {
      if (s.link) out += `<a href="${esc(s.link)}" target="_blank">`;
      out += `<text x="${px(t.box.x + s.x)}" y="${y}" font-family="${fam}" font-size="${size}"${s.bold ? ' font-weight="bold"' : ''}${s.italic ? ' font-style="italic"' : ''}${s.underline ? ' text-decoration="underline"' : ''} fill="${s.color}" xml:space="preserve">${esc(s.text)}</text>`;
      if (s.link) out += '</a>';
    }
  }
  // Browser defaults must not silently apply different shaping than the measurer.
  return `<g font-kerning="${t.style.kerning ? 'normal' : 'none'}" font-variant-ligatures="none">${out}</g>`;
}

function nestedSvg(svg: string, x: number, y: number, w: number, h: number): string {
  return svg.replace(
    /^<svg([^>]*?)width="[^"]*" height="[^"]*"/,
    `<svg$1x="${px(x)}" y="${px(y)}" width="${px(w)}" height="${px(h)}" preserveAspectRatio="none"`,
  );
}

export function nodeSvg(n: SceneNode): string {
  const markup = nodeBodySvg(n);
  const pointer = 'pointer' in n && n.pointer ? ` data-sc-pointer="${esc(n.pointer)}"` : '';
  return n.role || pointer
    ? `<g${n.role ? ` data-sc-role="${esc(n.role)}"` : ''}${pointer}>${markup}</g>`
    : markup;
}

function nodeBodySvg(n: SceneNode): string {
  switch (n.kind) {
    case 'html':
      // native in browsers (HTML deck, Chrome PDF); other engines get a rasterised image
      return `<foreignObject x="${px(n.box.x)}" y="${px(n.box.y)}" width="${px(n.box.w)}" height="${px(n.box.h)}">${freeformMarkup(n)}</foreignObject>`;
    case 'text':
      return textSvg(n);
    case 'rect': {
      const r = n.radius ? ` rx="${px(n.radius)}"` : '';
      const fill = n.fill
        ? `fill="${n.fill}"${n.fillOpacity !== undefined ? ` fill-opacity="${n.fillOpacity}"` : ''}`
        : 'fill="none"';
      return `<rect x="${px(n.box.x)}" y="${px(n.box.y)}" width="${px(n.box.w)}" height="${px(n.box.h)}"${r} ${fill} ${strokeAttrs(n.stroke)}/>`;
    }
    case 'ellipse': {
      const fill = n.fill
        ? `fill="${n.fill}"${n.fillOpacity !== undefined ? ` fill-opacity="${n.fillOpacity}"` : ''}`
        : 'fill="none"';
      return `<ellipse cx="${px(n.box.x + n.box.w / 2)}" cy="${px(n.box.y + n.box.h / 2)}" rx="${px(n.box.w / 2)}" ry="${px(n.box.h / 2)}" ${fill} ${strokeAttrs(n.stroke)}/>`;
    }
    case 'polygon': {
      const fill = n.fill
        ? `fill="${n.fill}"${n.fillOpacity !== undefined ? ` fill-opacity="${n.fillOpacity}"` : ''}`
        : 'fill="none"';
      const pts = n.points.map(([x, y]) => `${px(x)},${px(y)}`).join(' ');
      return `<polygon points="${pts}" ${fill} ${strokeAttrs(n.stroke)}/>`;
    }
    case 'line': {
      let out = `<line x1="${px(n.x1)}" y1="${px(n.y1)}" x2="${px(n.x2)}" y2="${px(n.y2)}" ${strokeAttrs(n.stroke)}/>`;
      if (n.arrowEnd) {
        const ang = Math.atan2(n.y2 - n.y1, n.x2 - n.x1);
        const L = 0.1;
        const a1 = ang + Math.PI * 0.85;
        const a2 = ang - Math.PI * 0.85;
        out += `<polygon points="${px(n.x2)},${px(n.y2)} ${px(n.x2 + L * Math.cos(a1))},${px(n.y2 + L * Math.sin(a1))} ${px(n.x2 + L * Math.cos(a2))},${px(n.y2 + L * Math.sin(a2))}" fill="${n.stroke.color}"/>`;
      }
      return out;
    }
    case 'image': {
      const { x, y, w, h } = n.box;
      if (n.svg) return nestedSvg(n.svg, x, y, w, h);
      const href = n.path
        ? dataUri(n.path)
        : n.data
          ? `data:${n.data.mime};base64,${n.data.base64}`
          : undefined;
      if (href) {
        const par = n.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
        return `<image x="${px(x)}" y="${px(y)}" width="${px(w)}" height="${px(h)}" preserveAspectRatio="${par}" href="${href}"/>`;
      }
      return placeholderSvg(n.box, n.placeholderLabel ?? 'Image');
    }
    case 'table': {
      let out = '';
      let yy = n.box.y;
      n.cells.forEach((row, ri) => {
        let xx = n.box.x;
        const h = n.rowH[ri]!;
        row.forEach((cell, ci) => {
          const w = n.colW[ci]!;
          if (cell.fill)
            out += `<rect x="${px(xx)}" y="${px(yy)}" width="${px(w)}" height="${px(h)}" fill="${cell.fill}"/>`;
          if (cell.borderTop)
            out += `<line x1="${px(xx)}" y1="${px(yy)}" x2="${px(xx + w)}" y2="${px(yy)}" ${strokeAttrs(cell.borderTop)}/>`;
          if (cell.borderBottom)
            out += `<line x1="${px(xx)}" y1="${px(yy + h)}" x2="${px(xx + w)}" y2="${px(yy + h)}" ${strokeAttrs(cell.borderBottom)}/>`;
          out += textSvg(cell.text);
          xx += w;
        });
        yy += h;
      });
      return out;
    }
    case 'chart':
      return n.primitives.map(nodeSvg).join('');
  }
}

export function placeholderSvg(
  b: { x: number; y: number; w: number; h: number },
  label: string,
): string {
  return (
    `<rect x="${px(b.x)}" y="${px(b.y)}" width="${px(b.w)}" height="${px(b.h)}" fill="#E9ECF0" stroke="#AEB6C1" stroke-width="1" stroke-dasharray="6 4"/>` +
    `<line x1="${px(b.x)}" y1="${px(b.y)}" x2="${px(b.x + b.w)}" y2="${px(b.y + b.h)}" stroke="#C5CBD3" stroke-width="1"/>` +
    `<line x1="${px(b.x + b.w)}" y1="${px(b.y)}" x2="${px(b.x)}" y2="${px(b.y + b.h)}" stroke="#C5CBD3" stroke-width="1"/>` +
    `<text x="${px(b.x + b.w / 2)}" y="${px(b.y + b.h / 2) + 5}" text-anchor="middle" font-family="Liberation Sans" font-size="14" fill="#6B7480">${esc(label)}</text>`
  );
}

export function masterSvg(m: Master, slideNo: number): string {
  let out = m.nodes.map(nodeSvg).join('');
  if (m.slideNumber) {
    const s = m.slideNumber;
    const fam = vectorFamily(s.style.measure);
    const x = s.style.align === 'right' ? px(s.box.x + s.box.w) : px(s.box.x);
    const anchor = s.style.align === 'right' ? ' text-anchor="end"' : '';
    out += `<text data-sc-role="page-number" x="${x}" y="${px(s.box.y + s.box.h * 0.8)}"${anchor} font-family="${fam}" font-size="${ptpx(s.style.size)}" fill="${s.style.color}">${slideNo}</text>`;
  }
  return out;
}

export function slideSvg(scene: Scene, slide: SceneSlide): string {
  const W = px(scene.format.w);
  const H = px(scene.format.h);
  const m = scene.masters[slide.master]!;
  const bg = slide.background ?? m.background;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${masterSvg(m, slide.index + 1)}${slide.nodes.map(nodeSvg).join('')}</svg>`;
}
