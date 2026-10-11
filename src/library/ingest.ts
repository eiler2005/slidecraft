/**
 * Client material in (v0.5): PDFs, Word, PowerPoint, Excel, CSV and text become
 * `materials/<id>.md` with page / section / slide / sheet markers, and a source in
 * deck.yaml. Slides then cite the exact place — `sources: [annual-report#p14]` — and
 * `slidecraft find` returns those references for any phrase.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML, { isMap, isSeq } from 'yaml';
import { ROOT } from '../paths.ts';
import { readSheets } from './sheets.ts';

export interface Section {
  /** Where this text is: "p14", "slide3", "sheet:Plan", or a heading. */
  ref: string;
  label: string;
  text: string;
}

export interface Ingested {
  id: string;
  title: string;
  kind: string;
  file: string;
  materials: string;
  sections: number;
  added: boolean;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'source';

async function loadPdf(): Promise<
  (d: Uint8Array) => Promise<{ pages: string[]; title?: string; date?: string }>
> {
  const bundled = join(ROOT, 'dist', 'pdf-text.mjs');
  // from the bundle: the separate pdf.js module; from sources: the TypeScript module
  const mod =
    import.meta.url.includes('/dist/') && existsSync(bundled)
      ? await import(pathToFileURL(bundled).href)
      : await import(['.', 'pdf-text.ts'].join('/'));
  return mod.pdfPages;
}

async function zipText(path: string) {
  const JSZip = (await import('jszip')).default;
  return JSZip.loadAsync(readFileSync(path));
}

async function sectionsOf(
  path: string,
): Promise<{ kind: string; title?: string; date?: string; sections: Section[] }> {
  const ext = extname(path).toLowerCase();
  if (ext === '.pdf') {
    const r = await (await loadPdf())(new Uint8Array(readFileSync(path)));
    return {
      kind: 'pdf',
      ...(r.title ? { title: r.title } : {}),
      ...(r.date ? { date: r.date } : {}),
      sections: r.pages.map((text, i) => ({ ref: `p${i + 1}`, label: `p. ${i + 1}`, text })),
    };
  }
  if (ext === '.docx') {
    const zip = await zipText(path);
    const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    const sections: Section[] = [];
    let cur: Section = { ref: 'start', label: 'Start', text: '' };
    for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
      const p = m[0];
      const text = decode(
        [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(''),
      ).trim();
      if (!text) continue;
      if (/<w:pStyle w:val="(Heading|Title)\w*"/i.test(p)) {
        if (cur.text) sections.push(cur);
        cur = { ref: `s:${text.slice(0, 40)}`, label: text, text: '' };
      } else cur.text += `${text}\n`;
    }
    if (cur.text) sections.push(cur);
    const core = (await zip.file('docProps/core.xml')?.async('string')) ?? '';
    const title = /<dc:title>([^<]+)<\/dc:title>/.exec(core)?.[1];
    return { kind: 'docx', ...(title ? { title: decode(title) } : {}), sections };
  }
  if (ext === '.pptx') {
    const zip = await zipText(path);
    const names = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
    const sections: Section[] = [];
    for (const [i, n] of names.entries()) {
      const xml = await zip.file(n)!.async('string');
      const text = [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)]
        .map((p) => decode([...p[1]!.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join('')))
        .filter((t) => t.trim())
        .join('\n');
      sections.push({ ref: `slide${i + 1}`, label: `slide ${i + 1}`, text });
    }
    return { kind: 'pptx', sections };
  }
  if (ext === '.xlsx' || ext === '.csv') {
    const sections = readSheets(path).map((s) => {
      const rows = s.rows
        .slice(0, 40)
        .map(
          (r, ri) => `| ${ri + 1} | ${r.map((c) => (c === null ? '' : String(c))).join(' | ')} |`,
        );
      return { ref: `sheet:${s.name}`, label: `sheet ${s.name}`, text: rows.join('\n') };
    });
    return { kind: ext.slice(1), sections };
  }
  if (ext === '.md' || ext === '.txt') {
    return {
      kind: ext.slice(1),
      sections: [{ ref: 'text', label: 'text', text: readFileSync(path, 'utf8') }],
    };
  }
  throw new Error(`Cannot ingest ${basename(path)}: use PDF, DOCX, PPTX, XLSX, CSV, MD or TXT`);
}

export async function ingest(
  files: string[],
  opts: { deck: string; dir?: string },
): Promise<Ingested[]> {
  const deckPath = resolve(opts.deck);
  const deckDir = dirname(deckPath);
  const outDir = resolve(opts.dir ?? join(deckDir, 'materials'));
  mkdirSync(outDir, { recursive: true });
  const doc = YAML.parseDocument(readFileSync(deckPath, 'utf8'));
  let sources = doc.get('sources', true);
  if (!isSeq(sources)) {
    doc.set('sources', doc.createNode([]));
    sources = doc.get('sources', true);
  }
  const seq = sources as YAML.YAMLSeq;
  const have = new Set(seq.items.filter(isMap).map((m) => String(m.get('id'))));
  const out: Ingested[] = [];
  for (const f of files) {
    const path = resolve(f);
    const r = await sectionsOf(path);
    const id = slug(basename(path));
    const title = (r.title?.trim() || basename(path, extname(path)).replace(/[-_]+/g, ' ')).slice(
      0,
      140,
    );
    const md = [
      `# ${title}`,
      '',
      `> Source id \`${id}\` · ${r.kind.toUpperCase()} · ${relative(outDir, path)} · sha256 ${createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16)}`,
      `> Cite a place as \`${id}#${r.sections[0]?.ref ?? 'p1'}\` in a slide's \`sources:\`.`,
      '',
      ...r.sections.flatMap((s) => [`## ${s.label} {#${s.ref}}`, '', s.text, '']),
    ].join('\n');
    const mdPath = join(outDir, `${id}.md`);
    writeFileSync(mdPath, md);
    const added = !have.has(id);
    if (added) {
      seq.add(
        doc.createNode({
          id,
          title,
          ...(r.date ? { date: r.date } : {}),
          file: relative(deckDir, path),
          ...(r.kind === 'pdf' ? { pages: r.sections.length } : {}),
        }),
      );
      have.add(id);
    }
    out.push({
      id,
      title,
      kind: r.kind,
      file: path,
      materials: mdPath,
      sections: r.sections.length,
      added,
    });
  }
  writeFileSync(deckPath, doc.toString({ lineWidth: 0 }));
  return out;
}

export interface Hit {
  ref: string;
  source: string;
  where: string;
  snippet: string;
}

/** Find a phrase in ingested materials; every hit carries the citation to use. */
export function findInMaterials(query: string, dir: string, limit = 20): Hit[] {
  if (!existsSync(dir)) return [];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits: (Hit & { score: number })[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    const id = f.replace(/\.md$/, '');
    const text = readFileSync(join(dir, f), 'utf8');
    for (const part of text.split(/^## /m).slice(1)) {
      const head = part.split('\n')[0] ?? '';
      const ref = /\{#([^}]+)\}/.exec(head)?.[1] ?? '';
      const where = head.replace(/\s*\{#[^}]+\}\s*$/, '');
      const body = part.slice(head.length);
      const lower = body.toLowerCase();
      // words present, plus a bonus when the whole phrase appears
      const score =
        words.filter((w) => lower.includes(w)).length +
        (lower.replace(/\s+/g, ' ').includes(words.join(' ')) ? words.length : 0);
      if (score < Math.ceil(words.length / 2)) continue;
      const at = Math.max(0, lower.indexOf(words.find((w) => lower.includes(w))!) - 80);
      hits.push({
        ref: `${id}#${ref}`,
        source: id,
        where,
        snippet: body
          .slice(at, at + 220)
          .replace(/\s+/g, ' ')
          .trim(),
        score,
      });
    }
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...h }) => h);
}
