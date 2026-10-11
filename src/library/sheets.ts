/**
 * Read spreadsheet data for decks: .xlsx (values, including cached formula results) and
 * .csv. No dependency: an .xlsx is a zip of XML parts, read with JSZip.
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { inflateRawSync } from 'node:zlib';

export type Cell = string | number | null;
export interface Sheet {
  name: string;
  /** rows[r][c], 0-based. */
  rows: Cell[][];
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** "B4" → { r: 3, c: 1 }. */
export function cellRef(ref: string): { r: number; c: number } {
  const m = /^\$?([A-Z]+)\$?(\d+)$/i.exec(ref.trim());
  if (!m) throw new Error(`Not a cell reference: ${ref}`);
  let c = 0;
  for (const ch of m[1]!.toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: Number(m[2]) - 1, c: c - 1 };
}

function parseCsv(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  const delim =
    (text.split('\n')[0] ?? '').split(';').length > (text.split('\n')[0] ?? '').split(',').length
      ? ';'
      : ',';
  const push = () => {
    const t = field.trim();
    row.push(t === '' ? null : /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t);
    field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) push();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      push();
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) {
    push();
    rows.push(row);
  }
  return rows;
}

/** Minimal synchronous zip reader (stored and deflated entries), enough for .xlsx. */
function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    out.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function parseXlsx(buf: Buffer): Sheet[] {
  const files = unzip(buf);
  const zip = {
    file: (n: string) =>
      files.has(n) ? { text: () => files.get(n)!.toString('utf8') } : undefined,
  };
  const shared: string[] = [];
  const ss = zip.file('xl/sharedStrings.xml')?.text();
  if (ss)
    for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g))
      shared.push(decode([...m[1]!.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join('')));
  const wb = zip.file('xl/workbook.xml')?.text() ?? '';
  const rels = zip.file('xl/_rels/workbook.xml.rels')?.text() ?? '';
  const relMap = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1]!)?.[1];
    const t = /\bTarget="([^"]+)"/.exec(m[1]!)?.[1];
    if (id && t) relMap.set(id, t);
  }
  const target = (rid: string) => relMap.get(rid);
  const sheets: Sheet[] = [];
  for (const m of wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const t = target(m[2]!);
    if (!t) continue;
    const part = t.startsWith('/') ? t.slice(1) : `xl/${t.replace(/^\.\//, '')}`;
    const xml = zip.file(part)?.text() ?? '';
    const rows: Cell[][] = [];
    for (const c of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const { r, c: col } = cellRef(c[1]!);
      const type = /t="(\w+)"/.exec(c[2]!)?.[1];
      const inner = c[3] ?? '';
      const v = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
      let value: Cell = null;
      if (type === 's' && v !== undefined) value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr')
        value = decode([...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join(''));
      else if (type === 'str' || type === 'e') value = v === undefined ? null : decode(v);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) value = Number(v);
      if (!rows[r]) rows[r] = [];
      rows[r]![col] = value;
    }
    sheets.push({
      name: decode(m[1]!),
      rows: Array.from(rows, (row) => Array.from(row ?? [], (x) => x ?? null)),
    });
  }
  return sheets;
}

/** All sheets of a workbook or CSV (a CSV is one sheet named "csv"). Read fresh each build. */
export function readSheets(path: string): Sheet[] {
  const buf = readFileSync(path);
  return extname(path).toLowerCase() === '.csv'
    ? [{ name: 'csv', rows: parseCsv(buf.toString('utf8')) }]
    : parseXlsx(buf);
}

export function pickSheet(sheets: Sheet[], name?: string): Sheet {
  const s = name ? sheets.find((x) => x.name === name) : sheets[0];
  if (!s)
    throw new Error(
      name
        ? `Sheet "${name}" not found (have: ${sheets.map((x) => x.name).join(', ')})`
        : 'Workbook has no sheets',
    );
  return s;
}

/** Cells of "A1:C4" (or a single cell) as a 2-D array. */
export function range(sheet: Sheet, ref: string): Cell[][] {
  const [a, b] = ref.split(':');
  const from = cellRef(a!);
  const to = cellRef(b ?? a!);
  const out: Cell[][] = [];
  for (let r = from.r; r <= to.r; r++) {
    const row: Cell[] = [];
    for (let c = from.c; c <= to.c; c++) row.push(sheet.rows[r]?.[c] ?? null);
    out.push(row);
  }
  return out;
}
