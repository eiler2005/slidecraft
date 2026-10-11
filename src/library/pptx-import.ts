/**
 * Import an existing PowerPoint into deck.yaml (M5).
 *
 * Reads slides in presentation order and maps each to the closest layout:
 *   cover-like first slide → title · chart → chart-takeaway · table → data-table ·
 *   picture + text → text-image · otherwise → text (bullets).
 * Text that exceeds a layout's limit is shortened with a visible marker and the full
 * original goes to speaker notes, so nothing is lost and `check` stays green.
 * The result is a draft to restyle: pick a storyline and theme, rewrite titles as claims.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, posix, resolve } from 'node:path';
import JSZip from 'jszip';
import YAML from 'yaml';

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

interface Para {
  text: string;
  level: number;
  /** Font size in pt if the runs declare one. */
  size: number;
}

function paragraphs(xml: string): Para[] {
  const out: Para[] = [];
  for (const m of xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p ([^>]*)>([\s\S]*?)<\/a:p>/g)) {
    const inner = m[1] ?? m[3] ?? '';
    const lvl = Number(/<a:pPr[^>]*lvl="(\d)"/.exec(inner)?.[1] ?? 0);
    const text = decode(
      [...inner.matchAll(/<a:t>([^<]*)<\/a:t>|<a:t [^>]*>([^<]*)<\/a:t>/g)]
        .map((t) => t[1] ?? t[2] ?? '')
        .join(''),
    ).trim();
    const sz = Number(/<a:rPr[^>]*sz="(\d+)"/.exec(inner)?.[1] ?? 0) / 100;
    if (text) out.push({ text, level: lvl, size: sz });
  }
  return out;
}

async function rels(zip: JSZip, part: string): Promise<Map<string, string>> {
  const dir = posix.dirname(part);
  const relPath = `${dir}/_rels/${posix.basename(part)}.rels`;
  const xml = (await zip.file(relPath)?.async('string')) ?? '';
  const map = new Map<string, string>();
  for (const m of xml.matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    map.set(
      m[1]!,
      m[2]!.startsWith('/') ? m[2]!.slice(1) : posix.normalize(posix.join(dir, m[2]!)),
    );
  }
  for (const m of xml.matchAll(/<Relationship [^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g)) {
    if (!map.has(m[2]!))
      map.set(
        m[2]!,
        m[1]!.startsWith('/') ? m[1]!.slice(1) : posix.normalize(posix.join(dir, m[1]!)),
      );
  }
  return map;
}

async function chartData(zip: JSZip, part: string) {
  const xml = (await zip.file(part)?.async('string')) ?? '';
  const type = /<c:lineChart>/.test(xml)
    ? 'line'
    : /<c:barDir val="bar"\/>/.test(xml)
      ? 'bar'
      : /<c:grouping val="(stacked|percentStacked)"\/>/.test(xml)
        ? 'stacked'
        : 'column';
  const series: { name: string; values: number[] }[] = [];
  let categories: string[] = [];
  for (const s of xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)) {
    const body = s[1]!;
    const name = decode(
      /<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/.exec(body)?.[1] ?? `Series ${series.length + 1}`,
    );
    const cat = /<c:cat>([\s\S]*?)<\/c:cat>/.exec(body)?.[1] ?? '';
    const cats = [...cat.matchAll(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>/g)].map((m) =>
      decode(m[2]!),
    );
    if (cats.length > categories.length) categories = cats;
    const val = /<c:val>([\s\S]*?)<\/c:val>/.exec(body)?.[1] ?? '';
    const values = [...val.matchAll(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>/g)].map((m) =>
      Number(m[2]),
    );
    series.push({ name: name.slice(0, 30), values });
  }
  return { type, categories, series };
}

export interface ImportedDeck {
  deckPath: string;
  slides: number;
  layouts: Record<string, number>;
  shortened: number;
}

export async function importPptx(
  file: string,
  opts: { out?: string; id?: string; theme?: string } = {},
): Promise<ImportedDeck> {
  const zip = await JSZip.loadAsync(readFileSync(file));
  const pres = (await zip.file('ppt/presentation.xml')?.async('string')) ?? '';
  const presRels = await rels(zip, 'ppt/presentation.xml');
  const order = [...pres.matchAll(/<p:sldId [^>]*r:id="([^"]+)"/g)]
    .map((m) => presRels.get(m[1]!))
    .filter((p): p is string => !!p);
  const id =
    opts.id ??
    (basename(file, extname(file))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
      'imported');
  const outDir = resolve(opts.out ?? join('slidecraft', id));
  mkdirSync(join(outDir, 'assets'), { recursive: true });
  let shortened = 0;
  const notesExtra: string[] = [];
  const clip = (s: string, max: number) => {
    if (s.length <= max) return s;
    shortened++;
    notesExtra.push(s);
    return `${s.slice(0, Math.max(0, max - 2)).replace(/\s+\S*$/, '')} …`;
  };
  const slides: Record<string, unknown>[] = [];
  const counts: Record<string, number> = {};

  for (const [i, part] of order.entries()) {
    notesExtra.length = 0;
    const xml = (await zip.file(part)?.async('string')) ?? '';
    const r = await rels(zip, part);
    let title = '';
    let subtitle = '';
    const texts: Para[] = [];
    for (const sp of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
      const body = sp[1]!;
      const ph = /<p:ph[^>]*type="(\w+)"/.exec(body)?.[1];
      const ps = paragraphs(body);
      if (!ps.length) continue;
      if ((ph === 'title' || ph === 'ctrTitle') && !title) title = ps.map((p) => p.text).join(' ');
      else if (ph === 'subTitle') subtitle = ps.map((p) => p.text).join(' ');
      else if (ph === 'sldNum' || ph === 'ftr' || ph === 'dt') continue;
      else texts.push(...ps);
    }
    if (!title && texts.length) {
      // no title placeholder: the largest text on the slide is the title
      const big = texts.reduce((b, t, k) => (t.size > texts[b]!.size ? k : b), 0);
      title = texts.splice(big, 1)[0]!.text;
    }
    const table = /<a:tbl>([\s\S]*?)<\/a:tbl>/.exec(xml)?.[1];
    const chartRid = /<c:chart [^>]*r:id="([^"]+)"/.exec(xml)?.[1];
    const picRid = /<p:pic>[\s\S]*?r:embed="([^"]+)"/.exec(xml)?.[1];
    const notesPart = [...r.values()].find((p) => /notesSlides\/notesSlide\d+\.xml$/.test(p));
    let notes = '';
    if (notesPart) {
      const nx = (await zip.file(notesPart)?.async('string')) ?? '';
      notes = paragraphs(nx)
        .map((p) => p.text)
        .filter((t) => !/^\d+$/.test(t))
        .join('\n');
    }
    const slide: Record<string, unknown> = {
      id: `s${String(i + 1).padStart(2, '0')}`,
      title: clip(title || `Slide ${i + 1}`, 140),
    };
    const cover = i === 0 && (/ctrTitle/.test(xml) || (!table && !chartRid && texts.length <= 2));
    if (cover) {
      slide.layout = 'title';
      const sub = subtitle || texts.map((t) => t.text).join(' ');
      if (sub) slide.subtitle = clip(sub, 170);
    } else if (chartRid && r.get(chartRid)) {
      const cd = await chartData(zip, r.get(chartRid)!);
      slide.layout = 'chart-takeaway';
      slide.variant = cd.type;
      const n = Math.min(12, cd.categories.length);
      slide.chart = {
        categories: cd.categories.slice(0, n).map((c) => clip(c, 28)),
        series: cd.series.slice(0, 4).map((s) => ({ name: s.name, values: s.values.slice(0, n) })),
      };
      slide.takeaway = {
        headline: clip(texts[0]?.text ?? 'TODO: the so-what of this chart', 90),
        points: texts.slice(1, 4).map((t) => clip(t.text, 150)),
      };
    } else if (table) {
      const rows = [...table.matchAll(/<a:tr[^>]*>([\s\S]*?)<\/a:tr>/g)].map((tr) =>
        [...tr[1]!.matchAll(/<a:tc[^>]*>([\s\S]*?)<\/a:tc>/g)].map((tc) =>
          paragraphs(tc[1]!)
            .map((p) => p.text)
            .join(' '),
        ),
      );
      const width = Math.min(6, Math.max(2, ...rows.map((x) => x.length)));
      const norm = rows.map((x) => Array.from({ length: width }, (_, k) => x[k] ?? ''));
      slide.layout = 'data-table';
      slide.header = norm[0]!.map((h) => clip(h || '—', 28));
      slide.rows = norm.slice(1, 11).map((row) => row.map((c) => clip(c, 80)));
      if ((slide.rows as unknown[]).length < 2)
        (slide.rows as string[][]).push(Array.from({ length: width }, () => ''));
      if (rows.length > 11) notesExtra.push(`${rows.length - 11} more table rows in the original`);
    } else if (picRid && r.get(picRid) && texts.length) {
      const media = r.get(picRid)!;
      const data = await zip.file(media)?.async('uint8array');
      if (data && /\.(png|jpe?g)$/i.test(media)) {
        const name = `${slide.id}${extname(media).toLowerCase()}`;
        writeFileSync(join(outDir, 'assets', name), data);
        slide.image = `assets/${name}`;
      }
      slide.layout = 'text-image';
      slide.variant = 'image-right';
      slide.body = texts.slice(0, 4).map((t) => clip(t.text, 260));
      slide.alt = clip(`Image from the original slide ${i + 1}`, 140);
    } else {
      slide.layout = 'text';
      slide.variant = 'bullets';
      slide.items = (texts.length ? texts : [{ text: 'TODO: content', level: 0, size: 0 }])
        .slice(0, 8)
        .map((t) => clip(t.text, 240));
      if (texts.length > 8) notesExtra.push(...texts.slice(8).map((t) => t.text));
    }
    counts[slide.layout as string] = (counts[slide.layout as string] ?? 0) + 1;
    const allNotes = [
      notes,
      notesExtra.length ? `IMPORT — original text that did not fit:\n${notesExtra.join('\n')}` : '',
      `Imported from slide ${i + 1} of ${basename(file)}.`,
    ]
      .filter(Boolean)
      .join('\n\n');
    slide.notes = allNotes.slice(0, 3000);
    slides.push(slide);
  }

  const deck = {
    schemaVersion: 1,
    id,
    title: (slides[0]?.title as string) ?? id,
    theme: opts.theme ?? 'consulting-classic',
    status: 'draft',
    sources: [],
    slides,
  };
  const deckPath = join(outDir, 'deck.yaml');
  writeFileSync(
    deckPath,
    `# SlideCraft deck imported from ${basename(file)} — a draft to restyle.\n# Next: pick a storyline/theme, rewrite titles as action titles, replace text slides with exhibits.\n${YAML.stringify(deck, { lineWidth: 0 })}`,
  );
  return { deckPath, slides: slides.length, layouts: counts, shortened };
}
