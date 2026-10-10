/**
 * Procedural decor: original SVG artwork generated from theme colors.
 * Vector engines embed the SVG; PPTX and PDF receive a rasterised PNG as a
 * decorative background image (content itself always stays native/editable).
 */
import type { Theme } from '../spec/theme.ts';
import { mix } from './color.ts';

export type DecorPlacement = 'cover' | 'content' | 'divider';

const PX = 160; // px per inch in the SVG coordinate space

export function decorSvg(
  theme: Theme,
  placement: DecorPlacement,
  w: number,
  h: number,
): string | undefined {
  const d = theme.decor;
  if (d.kind === 'none') return undefined;
  if (placement === 'content' && !d.onContent) return undefined;
  const W = Math.round(w * PX);
  const H = Math.round(h * PX);
  const c = theme.colors;
  const pal = d.colors.length ? d.colors : [c.accent, c.accentSoft];
  const a = pal[0]!;
  const b = pal[1] ?? mix(a, c.background, 0.6);
  const k = d.intensity;
  const sub = placement === 'content' ? 0.45 : 1; // content slides get a quieter version
  const op = (v: number) => (v * k * sub).toFixed(3);
  let body = '';
  let defs = '';

  switch (d.kind) {
    case 'rule': {
      const bandH = placement === 'cover' ? H * 0.012 : H * 0.008;
      body = `<rect x="0" y="0" width="${W}" height="${bandH}" fill="${a}"/>`;
      break;
    }
    case 'wave': {
      defs = `<linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
      const x0 = placement === 'content' ? W * 0.9 : W * 0.66;
      for (let i = 0; i < 7; i++) {
        const dx = i * W * 0.018;
        body += `<path d="M ${x0 + dx} ${-H * 0.05} C ${x0 + W * 0.28 + dx} ${H * 0.3}, ${x0 - W * 0.12 + dx} ${H * 0.62}, ${x0 + W * 0.22 + dx} ${H * 1.05}" stroke="url(#wg)" stroke-width="${W * (0.006 + i * 0.0035)}" fill="none" opacity="${op(0.9 - i * 0.1)}" stroke-linecap="round"/>`;
      }
      break;
    }
    case 'glow': {
      defs = `<radialGradient id="gg" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${a}" stop-opacity="1"/><stop offset="0.45" stop-color="${b}" stop-opacity="0.55"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>`;
      const cy = placement === 'content' ? H * 1.35 : H * 1.12;
      body = `<ellipse cx="${W * 0.5}" cy="${cy}" rx="${W * 0.7}" ry="${H * 0.55}" fill="url(#gg)" opacity="${op(0.95)}"/>`;
      body += `<ellipse cx="${W * 0.92}" cy="${-H * 0.15}" rx="${W * 0.22}" ry="${H * 0.25}" fill="url(#gg)" opacity="${op(0.35)}"/>`;
      break;
    }
    case 'geo': {
      const s = placement === 'content' ? 0.6 : 1;
      body = `<circle cx="${W * 0.93}" cy="${H * 0.1}" r="${H * 0.32 * s}" fill="${a}" opacity="${op(0.85)}"/>`;
      body += `<rect x="${W * 0.8}" y="${H * 0.62}" width="${H * 0.42 * s}" height="${H * 0.42 * s}" fill="${b}" opacity="${op(0.9)}" transform="rotate(12 ${W * 0.85} ${H * 0.8})"/>`;
      body += `<circle cx="${W * 0.74}" cy="${H * 0.36}" r="${H * 0.05 * s}" fill="${a}" opacity="${op(1)}"/>`;
      break;
    }
    case 'gradient': {
      defs = `<linearGradient id="lg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${a}" stop-opacity="${op(0.75)}"/><stop offset="0.55" stop-color="${b}" stop-opacity="${op(0.35)}"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></linearGradient>`;
      const bars = 18;
      for (let i = 0; i < bars; i++) {
        const x = (W / bars) * i;
        const hh = H * (0.35 + 0.5 * Math.abs(Math.sin(i * 0.7)));
        body += `<rect x="${x}" y="${H - hh}" width="${W / bars - 2}" height="${hh}" fill="url(#lg)"/>`;
      }
      if (placement === 'content') body = `<g opacity="0.35">${body}</g>`;
      break;
    }
    case 'paper': {
      // Content slides use a wider frame so it clears the footer and page number.
      const f =
        placement === 'content'
          ? { x: 0.02, y: 0.03, w: 0.96, h: 0.94 }
          : { x: 0.035, y: 0.05, w: 0.93, h: 0.9 };
      body = `<rect x="${W * f.x}" y="${H * f.y}" width="${W * f.w}" height="${H * f.h}" fill="none" stroke="${a}" stroke-width="${W * 0.0012}" opacity="${op(0.9)}"/>`;
      if (placement !== 'content')
        body += `<rect x="${W * 0.035}" y="${H * 0.05}" width="${W * 0.012}" height="${H * 0.9}" fill="${a}" opacity="${op(1)}"/>`;
      break;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;
}
