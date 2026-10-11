/**
 * Post-build PPTX checks (ported from client-ai-agents' verify_text and image_quality):
 *  - every visible scene string is present in the written slide XML;
 *  - placed raster images have enough effective resolution;
 *  - accessibility: a title placeholder read first, alt text or a decorative mark on pictures and charts.
 */
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import type { Scene, SceneNode } from '../engine/scene.ts';
import { type Diagnostic, diag } from './codes.ts';

const norm = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, '');

function texts(n: SceneNode, out: string[]): void {
  if (n.kind === 'text')
    out.push(n.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join(''));
  if (n.kind === 'table') n.cells.forEach((r) => r.forEach((c) => texts(c.text, out)));
  if (n.kind === 'chart')
    n.primitives.forEach((p) => (p as { role?: string }).role === 'chart-total' && texts(p, out));
}

export function pngSize(buf: Uint8Array): { w: number; h: number } | undefined {
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return { w: v.getUint32(16), h: v.getUint32(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return undefined;
      const marker = buf[i + 1]!;
      const len = (buf[i + 2]! << 8) + buf[i + 3]!;
      if (marker >= 0xc0 && marker <= 0xc3)
        return { h: (buf[i + 5]! << 8) + buf[i + 6]!, w: (buf[i + 7]! << 8) + buf[i + 8]! };
      i += 2 + len;
    }
  }
  return undefined;
}

export async function verifyPptx(
  path: string,
  scene: Scene,
): Promise<{ diagnostics: Diagnostic[]; checked: number }> {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const out: Diagnostic[] = [];
  let checked = 0;
  for (const s of scene.slides) {
    const xml = await zip.file(`ppt/slides/slide${s.index + 1}.xml`)?.async('string');
    if (!xml) {
      out.push(diag('SC-PPTX-001', `Slide ${s.index + 1} XML missing`, { slide: s.id }));
      continue;
    }
    const hay = norm([...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(''));
    const want: string[] = [];
    s.nodes.forEach((n) => texts(n, want));
    for (const w of want) {
      const k = norm(w);
      if (!k) continue;
      checked++;
      if (!hay.includes(k))
        out.push(
          diag('SC-PPTX-001', `Text not found in PPTX: "${w.slice(0, 60)}"`, { slide: s.id }),
        );
    }
    // accessibility: titles, reading order, alt text
    if (!/<p:ph type="(title|ctrTitle)"/.test(xml))
      out.push(
        diag('SC-A11Y-003', `Slide ${s.index + 1} has no title placeholder`, { slide: s.id }),
      );
    else {
      const first =
        /<\/p:grpSpPr>\s*(<p:(sp|pic|graphicFrame|grpSp|cxnSp)>[\s\S]*?<\/p:nvPr>)/.exec(
          xml,
        )?.[1] ?? '';
      if (!/<p:ph type="(title|ctrTitle)"/.test(first))
        out.push(
          diag('SC-A11Y-002', `Slide ${s.index + 1}: the title is not read first`, { slide: s.id }),
        );
    }
    for (const m of xml.matchAll(/<p:(pic|graphicFrame)>([\s\S]*?)<\/p:\1>/g)) {
      const nv = /<p:cNvPr [^>]*?(\/>|>[\s\S]*?<\/p:cNvPr>)/.exec(m[2]!)?.[0] ?? '';
      const descr = /descr="([^"]*)"/.exec(nv)?.[1] ?? '';
      const isTable = m[1] === 'graphicFrame' && m[2]!.includes('<a:tbl>');
      if (!descr.trim() && !nv.includes('adec:decorative') && !isTable)
        out.push(
          diag(
            'SC-A11Y-001',
            `Slide ${s.index + 1}: ${m[1] === 'pic' ? 'picture' : 'chart'} without alt text`,
            { slide: s.id },
          ),
        );
    }
    // image ppi
    for (const n of s.nodes) {
      if (n.kind !== 'image' || !n.path) continue;
      const size = pngSize(readFileSync(n.path));
      if (!size) continue;
      const ppi = Math.min(size.w / n.box.w, size.h / n.box.h);
      if (ppi < 144)
        out.push(
          diag(
            'SC-IMG-001',
            `Image ${n.path.split('/').pop()} is ${Math.round(ppi)} ppi at placed size`,
            { slide: s.id, measured: `${Math.round(ppi)} ppi`, limit: '144 ppi' },
          ),
        );
    }
  }
  return { diagnostics: out, checked };
}
