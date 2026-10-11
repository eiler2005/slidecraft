/**
 * Post-build PPTX checks (ported from client-ai-agents' verify_text and image_quality):
 *  - every visible scene string is present in the written slide XML;
 *  - placed raster images have enough effective resolution;
 *  - accessibility: a title placeholder read first, alt text or a decorative mark on pictures and charts.
 */
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import JSZip from 'jszip';
import { shapeName } from '../backends/pptx-a11y.ts';
import type { Scene, SceneNode } from '../engine/scene.ts';
import { checkChrome } from './chrome.ts';
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
  const out: Diagnostic[] = checkChrome(scene);
  const xmlOf = async (part: string) => (await zip.file(part)?.async('string')) ?? '';
  const linkedPart = async (part: string, type: string): Promise<string | undefined> => {
    const rels = await xmlOf(
      posix.join(posix.dirname(part), '_rels', `${posix.basename(part)}.rels`),
    );
    for (const relationship of rels.matchAll(/<Relationship\b[^>]*\/>/g)) {
      const tag = relationship[0];
      if (!new RegExp(`Type="[^"]*/${type}"`).test(tag)) continue;
      const target = /Target="([^"]+)"/.exec(tag)?.[1];
      if (target)
        return target.startsWith('/')
          ? target.slice(1)
          : posix.normalize(posix.join(posix.dirname(part), target));
    }
    return undefined;
  };
  const visibleText = (xml: string) =>
    norm([...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(''));
  let checked = 0;
  for (const s of scene.slides) {
    const xml = await zip.file(`ppt/slides/slide${s.index + 1}.xml`)?.async('string');
    if (!xml) {
      out.push(diag('SC-PPTX-001', `Slide ${s.index + 1} XML missing`, { slide: s.id }));
      continue;
    }
    const hay = norm([...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(''));
    const part = `ppt/slides/slide${s.index + 1}.xml`;
    // Check engine-independent chrome and explicitly authored bridge objects by identity.
    for (const node of s.nodes) {
      if (!node.role?.startsWith('chrome-') && !node.role?.startsWith('ppt:')) continue;
      const name = shapeName(node, s.id);
      if (name && !xml.includes(`name="${name}"`))
        out.push(diag('SC-PPTX-002', `Named editable element missing: ${name}`, { slide: s.id }));
    }
    // Verify the physical contract as well as text presence. A named object can
    // survive export yet be tiny, displaced or rendered at the wrong font size.
    const shapes = [...xml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].map((m) => m[0]);
    for (const node of s.nodes) {
      const name = shapeName(node, s.id);
      if (!name || !('box' in node)) continue;
      const shape = shapes.find((shape) => shape.includes(`name="${name}"`));
      if (!shape) continue; // object-presence checks report this separately
      const transform = /<a:xfrm[^>]*>([\s\S]*?)<\/a:xfrm>/.exec(shape)?.[1] ?? '';
      const off = /<a:off\s[^>]*x="(-?\d+)"[^>]*y="(-?\d+)"/.exec(transform);
      const ext = /<a:ext\s[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(transform);
      if (off && ext) {
        const actual = [Number(off[1]), Number(off[2]), Number(ext[1]), Number(ext[2])].map(
          (n) => n / 914400,
        );
        const box = node.kind === 'text' ? (node.textFrame?.box ?? node.box) : node.box;
        const expected = [box.x, box.y, box.w, box.h];
        if (actual.some((n, i) => Math.abs(n - expected[i]!) > 0.002))
          out.push(
            diag('SC-PPTX-003', `Geometry changed for ${name}`, {
              slide: s.id,
              measured: actual.join(', '),
              limit: expected.join(', '),
            }),
          );
      }
      if (node.kind === 'text') {
        const sizes = [...shape.matchAll(/<a:rPr\s[^>]*\bsz="(\d+)"/g)].map(
          (m) => Number(m[1]) / 100,
        );
        if (sizes.some((size) => Math.abs(size - node.style.size) > 0.02))
          out.push(
            diag('SC-PPTX-003', `Font size changed for ${name}`, {
              slide: s.id,
              measured: sizes.join(', '),
              limit: `${node.style.size}pt`,
            }),
          );
      }
    }
    const layoutPart = await linkedPart(part, 'slideLayout');
    const masterPart = layoutPart ? await linkedPart(layoutPart, 'slideMaster') : undefined;
    const inherited = `${layoutPart ? await xmlOf(layoutPart) : ''}${masterPart ? await xmlOf(masterPart) : ''}`;
    const masterText: string[] = [];
    const master = scene.masters[s.master];
    master?.nodes.forEach((node) => texts(node, masterText));
    for (const value of masterText)
      if (norm(value) && !visibleText(xml + inherited).includes(norm(value)))
        out.push(
          diag('SC-PPTX-002', `Master text missing: ${value.slice(0, 60)}`, { slide: s.id }),
        );
    if (master?.slideNumber && !/type="slidenum"/.test(xml + inherited))
      out.push(
        diag('SC-PPTX-002', 'Page-number field missing from slide/layout/master', { slide: s.id }),
      );
    if (s.notes) {
      const notesPart = await linkedPart(part, 'notesSlide');
      if (!notesPart || !visibleText(await xmlOf(notesPart)).includes(norm(s.notes)))
        out.push(
          diag('SC-PPTX-002', 'Speaker notes missing or incomplete after export', { slide: s.id }),
        );
    }
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
