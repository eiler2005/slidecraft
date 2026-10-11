/**
 * Edits flow back (v0.5): read a PPTX that someone edited in PowerPoint, Keynote or Google
 * Slides and write the changed text into deck.yaml, so the next build keeps the edits.
 *
 *   slidecraft sync deck.yaml edited.pptx           → what changed, field by field
 *   slidecraft sync deck.yaml edited.pptx --apply   → writes it (comments kept), then re-checks
 *
 * Every text box SlideCraft writes is named after its field ("sc:<slide id>/<field>"), so a
 * change maps to one field even when slides were reordered. Text the deck derives (labels in
 * capitals, {{facts}}) is reported, never overwritten. Tables, charts and new shapes are
 * listed for the author to carry over by hand.
 */
import { readFileSync } from 'node:fs';
import { checkDeck } from '../build.ts';
import type { SceneSlide, TableNode, TextNode } from '../engine/scene.ts';
import { applyFixes, type FitTask, type Fix, readField } from './fix.ts';
import { decode, unzip } from './sheets.ts';

const TITLE = 'SlideCraft Title';

interface PptxShape {
  name: string;
  paragraphs: string[];
  /** Placeholder type (title, sldNum, ftr, dt…), if any. */
  ph?: string;
  /** Top-left corner, inches (for files whose shape names were lost). */
  x?: number;
  y?: number;
}

interface PptxSlide {
  /** 1-based position in the edited file. */
  n: number;
  /** Slide id recovered from shape names. */
  id?: string;
  shapes: PptxShape[];
  notes?: string[];
  /** Cell texts of each table, row by row. */
  tables: string[][];
}

function paragraphs(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>|<a:p\s*\/>/g)) {
    const body = m[1] ?? '';
    const text = [...body.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\s*\/>/g)]
      .map((t) => (t[0].startsWith('<a:br') ? ' ' : decode(t[1] ?? '')))
      .join('');
    out.push(text);
  }
  return out;
}

const norm = (s: string) => s.replace(/[\s ]+/g, ' ').trim();
const clean = (ps: string[]) => {
  const out = ps.map(norm);
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
};
const same = (a: string[], b: string[]) => {
  const x = clean(a);
  const y = clean(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/** Slides of a .pptx in presentation order, with named text shapes and notes. */
export function readPptx(path: string): PptxSlide[] {
  const zip = unzip(readFileSync(path));
  const text = (name: string) => zip.get(name)?.toString('utf8') ?? '';
  const rels = (file: string) => {
    const dir = file.slice(0, file.lastIndexOf('/'));
    const relFile = `${dir}/_rels/${file.slice(dir.length + 1)}.rels`;
    const map = new Map<string, string>();
    for (const m of text(relFile).matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
      const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
      if (id && target) {
        const parts = `${dir}/${target}`.split('/');
        const stack: string[] = [];
        for (const p of parts) p === '..' ? stack.pop() : stack.push(p);
        map.set(id, stack.join('/'));
      }
    }
    return map;
  };
  const presRels = rels('ppt/presentation.xml');
  const order = [...text('ppt/presentation.xml').matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)]
    .map((m) => presRels.get(m[1]!))
    .filter((f): f is string => !!f);
  return order.map((file, k) => {
    const xml = text(file);
    const shapes: PptxShape[] = [];
    for (const m of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
      const name = decode(/<p:cNvPr\b[^>]*\bname="([^"]*)"/.exec(m[1]!)?.[1] ?? '');
      const body = /<p:txBody>([\s\S]*?)<\/p:txBody>/.exec(m[1]!)?.[1];
      const off = /<a:off\b[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"/.exec(m[1]!);
      const ph = /<p:ph\b[^>]*\btype="([^"]+)"/.exec(m[1]!)?.[1];
      if (body !== undefined)
        shapes.push({
          name,
          paragraphs: paragraphs(body),
          ...(ph ? { ph } : {}),
          ...(off ? { x: Number(off[1]) / 914400, y: Number(off[2]) / 914400 } : {}),
        });
    }
    const ids = shapes
      .map((s) => /(?:^|\s)sc:([^/\s]+)\//.exec(s.name)?.[1])
      .filter((x): x is string => !!x);
    const notesFile = [...rels(file).values()].find((t) => /notesSlides\/[^/]+\.xml$/.test(t));
    let notes: string[] | undefined;
    if (notesFile) {
      const nx = text(notesFile);
      for (const m of nx.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g))
        if (/<p:ph\b[^>]*type="body"/.test(m[1]!)) {
          const body = /<p:txBody>([\s\S]*?)<\/p:txBody>/.exec(m[1]!)?.[1] ?? '';
          notes = paragraphs(body);
        }
    }
    return {
      n: k + 1,
      ...(ids[0] ? { id: ids[0] } : {}),
      shapes,
      ...(notes ? { notes } : {}),
      tables: [...xml.matchAll(/<a:tbl>([\s\S]*?)<\/a:tbl>/g)].map((t) =>
        [...t[1]!.matchAll(/<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g)].map((c) =>
          norm(paragraphs(c[1]!).join(' ')),
        ),
      ),
    };
  });
}

export interface SyncChange {
  slide: string;
  pointer: string;
  before: string | string[];
  after: string | string[];
}

export interface SyncReport {
  changes: SyncChange[];
  /** Edits that could not be written back, with the reason. */
  skipped: { slide: string; pointer?: string; reason: string; text?: string }[];
  /** Things to carry over by hand: deleted, added or reordered slides, tables, new boxes. */
  notes: string[];
  applied?: number;
  remaining?: FitTask[];
}

/** Rendered paragraphs of one field on one slide (first text node with that pointer). */
function rendered(slide: SceneSlide, pointer: string): TextNode | undefined {
  return slide.nodes.find((n): n is TextNode => n.kind === 'text' && n.pointer === pointer);
}

export function syncPptx(
  deckPath: string,
  pptxPath: string,
  opts: { apply?: boolean } = {},
): SyncReport {
  const { loaded, scene } = checkDeck(deckPath);
  if (!scene) throw new Error('The deck has errors; run `slidecraft check` first');
  const edited = readPptx(pptxPath);
  const report: SyncReport = { changes: [], skipped: [], notes: [] };
  const index = new Map(loaded.slides.map((s, i) => [s.id, i]));
  const fixes: Fix[] = [];

  const write = (slide: string, pointer: string, before: string | string[], ps: string[]) => {
    const raw = readField(deckPath, pointer);
    const kept = clean(ps).filter(Boolean);
    if (typeof raw === 'string') {
      if (raw.includes('{{'))
        return report.skipped.push({
          slide,
          pointer,
          reason: 'the text uses {{facts}} — change the fact or the text in deck.yaml',
          text: kept.join(' '),
        });
      if (!same(raw.split(/\n{2,}/), Array.isArray(before) ? before : [before]))
        return report.skipped.push({
          slide,
          pointer,
          reason:
            'the slide shows this text transformed (e.g. in capitals) — edit deck.yaml by hand',
          text: kept.join(' '),
        });
      const after = kept.join('\n\n');
      report.changes.push({ slide, pointer, before: raw, after });
      fixes.push({ pointer, text: after });
    } else if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) {
      if (!same(raw as string[], Array.isArray(before) ? before : [before]))
        return report.skipped.push({
          slide,
          pointer,
          reason: 'list shown differently on the slide',
          text: kept.join(' | '),
        });
      report.changes.push({ slide, pointer, before: raw as string[], after: kept });
      fixes.push({ pointer, text: kept });
    } else
      report.skipped.push({
        slide,
        pointer,
        reason: 'not a text field in deck.yaml',
        text: kept.join(' '),
      });
  };

  // Keynote and Google Slides may drop shape names on export: match slides by order and
  // text boxes by position instead, and say so
  const byPosition = edited.every((e) => !e.id) && edited.length === loaded.slides.length;
  if (byPosition) {
    edited.forEach((e, k) => {
      e.id = loaded.slides[k]!.id;
    });
    report.notes.push(
      'The PPTX has no SlideCraft shape names (exported from Keynote or Google Slides?) — slides matched by order and text boxes by position; check the changes before --apply.',
    );
  }
  const seen = new Set<string>();
  for (const es of edited) {
    if (!es.id) {
      if (es.shapes.some((s) => clean(s.paragraphs).some(Boolean)))
        report.notes.push(
          `Slide ${es.n} in the PPTX is not from this deck (added in PowerPoint?) — copy its content by hand.`,
        );
      continue;
    }
    const i = index.get(es.id);
    if (i === undefined) {
      report.notes.push(`Slide "${es.id}" is in the PPTX but no longer in deck.yaml — ignored.`);
      continue;
    }
    seen.add(es.id);
    const ref = scene.slides[i]!;
    const named = new Set<string>();
    // text SlideCraft drew without a field (step numbers, value labels, fixed captions)
    const drawn = new Set(
      ref.nodes
        .filter((n): n is TextNode => n.kind === 'text')
        .map((n) => norm(n.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join(' '))),
    );
    for (const sh of es.shapes) {
      let m = /(?:^|\s)sc:([^/\s]+)(\/\S+)$/.exec(sh.name) as (string | undefined)[] | null;
      if (!m && byPosition && sh.x !== undefined && sh.y !== undefined) {
        const node = ref.nodes.find(
          (n): n is TextNode =>
            n.kind === 'text' &&
            !!n.pointer &&
            Math.abs(n.box.x - sh.x!) < 0.06 &&
            Math.abs(n.box.y - sh.y!) < 0.06,
        );
        if (node) m = ['', es.id, node.pointer!.replace(/^\/slides\/\d+/, '')];
      }
      if (!m) {
        const txt = clean(sh.paragraphs).join(' ');
        const chrome = sh.ph === 'sldNum' || sh.ph === 'ftr' || sh.ph === 'dt';
        if (
          txt &&
          !chrome &&
          !drawn.has(txt) &&
          !/^[−+-]?[€$£¥]?\d[\d,.]*\s?[%xkKMB]*$/.test(txt) &&
          !sh.name.startsWith(TITLE)
        )
          report.notes.push(
            `Slide "${es.id}": a text box added in PowerPoint ("${clean(sh.paragraphs).join(' ').slice(0, 50)}") is not synced.`,
          );
        continue;
      }
      const alternative = /^\/ppt\/([a-z][a-z0-9-]*)$/.exec(m[2] ?? '');
      if (alternative) {
        const html = ref.nodes.find((n) => n.kind === 'html' && n.ppt?.length);
        const items = html?.kind === 'html' ? html.ppt : undefined;
        const at = items?.findIndex((item) => item.id === alternative[1]) ?? -1;
        const item = items?.[at];
        if (item?.kind === 'text' && !same([item.text], sh.paragraphs)) {
          write(es.id, `/slides/${i}/ppt/${at}/text`, item.text, sh.paragraphs);
          report.notes.push(
            `Slide "${es.id}": PPT alternative text changed; review its HTML reference separately.`,
          );
        }
        continue;
      }
      const pointer = `/slides/${i}${m[2]}`;
      named.add(pointer);
      const node = rendered(ref, pointer);
      if (!node) continue;
      const before = node.paragraphs.map((p) => p.runs.map((r) => r.text).join(''));
      if (same(before, sh.paragraphs)) continue;
      write(es.id, pointer, before, sh.paragraphs);
    }
    // a field box deleted in PowerPoint is left alone in the deck
    for (const n of ref.nodes)
      if (
        n.kind === 'text' &&
        n.pointer &&
        n.role !== 'source' &&
        !named.has(n.pointer) &&
        n.pointer.startsWith(`/slides/${i}/`)
      )
        report.notes.push(
          `Slide "${es.id}": ${n.pointer.replace(/^\/slides\/\d+\//, '')} was deleted in the PPTX — kept in deck.yaml.`,
        );
    // speaker notes
    const flat = (x: string | string[]) => norm(Array.isArray(x) ? x.join(' ') : x);
    const had = ref.notes ?? '';
    if (es.notes && flat(had) !== flat(es.notes)) {
      const pointer = `/slides/${i}/notes`;
      const raw = readField(deckPath, pointer);
      // notes the deck already had (as written), or notes added in PowerPoint
      if ((typeof raw === 'string' && flat(raw) === flat(had)) || (raw === undefined && !had)) {
        const after = clean(es.notes).filter(Boolean).join('\n');
        report.changes.push({
          slide: es.id,
          pointer,
          before: typeof raw === 'string' ? raw : '',
          after,
        });
        fixes.push({ pointer, text: after });
      }
    }
    // tables: not written back yet, but say exactly which cells changed
    const refTables = ref.nodes.filter((n): n is TableNode => n.kind === 'table');
    es.tables.forEach((cells, t) => {
      const node = refTables[t];
      if (!node) return;
      const before = node.cells
        .flat()
        .map((c) =>
          norm(c.text.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join(' ')),
        );
      const diff = cells
        .map((after, k) => ({ k, after, was: before[k] ?? '' }))
        .filter((d) => d.after !== d.was);
      if (diff.length || cells.length !== before.length)
        report.notes.push(
          `Slide "${es.id}": table cells edited — copy into deck.yaml by hand: ${diff
            .slice(0, 6)
            .map((d) => `"${d.was}" → "${d.after}"`)
            .join('; ')}${diff.length > 6 ? ' …' : ''}`,
        );
    });
  }
  const ids = edited.map((e) => e.id).filter((x): x is string => !!x && index.has(x));
  for (const s of loaded.slides)
    if (!seen.has(s.id))
      report.notes.push(
        `Slide "${s.id}" was deleted in the PPTX — kept in deck.yaml; remove it there if intended.`,
      );
  const deckOrder = loaded.slides.map((s) => s.id).filter((id) => ids.includes(id));
  if (deckOrder.join() !== ids.join())
    report.notes.push(
      `Slides were reordered in the PPTX: ${ids.join(', ')}. Reorder deck.yaml if intended.`,
    );

  if (opts.apply && fixes.length) {
    const r = applyFixes(deckPath, fixes);
    report.applied = r.applied;
    report.remaining = r.remaining;
    for (const e of r.errors) report.skipped.push({ slide: '', reason: e });
  }
  return report;
}
