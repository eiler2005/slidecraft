/**
 * Review log: every change made while checking a deck — fit-fix rewrites, visual-QA rounds
 * and the source edits between them — appended to `review-log.jsonl` next to deck.yaml and
 * rendered as `REVIEW-LOG.md`, so a person can see exactly what the checks changed and why.
 */
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import YAML from 'yaml';

export interface FieldChange {
  file: string;
  pointer?: string;
  before?: unknown;
  after?: unknown;
}
export interface FileDiff {
  file: string;
  added: number;
  removed: number;
  /** Unified-style lines: ' ' context, '-' removed, '+' added, '@' hunk header. */
  lines: string[];
}
export interface ReviewLogEntry {
  at: string;
  stage: 'fit-fix' | 'visual-qa' | 'visual-qa-round' | 'note';
  actor?: string;
  summary: string;
  changes?: FieldChange[];
  diffs?: FileDiff[];
  data?: Record<string, unknown>;
}

const logFile = (deckPath: string) => join(dirname(resolve(deckPath)), 'review-log.jsonl');

export function readReviewLog(deckPath: string): ReviewLogEntry[] {
  const f = logFile(deckPath);
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as ReviewLogEntry);
}

export function appendReviewLog(
  deckPath: string,
  entry: Omit<ReviewLogEntry, 'at'> & { at?: string },
) {
  const full: ReviewLogEntry = { at: entry.at ?? new Date().toISOString(), ...entry };
  appendFileSync(logFile(deckPath), `${JSON.stringify(full)}\n`);
  writeFileSync(
    join(dirname(resolve(deckPath)), 'REVIEW-LOG.md'),
    reviewLogMarkdown(readReviewLog(deckPath)),
  );
  return full;
}

/** deck.yaml plus the section files it includes — the sources reviewers may edit. */
export function deckSourceFiles(deckPath: string): string[] {
  const abs = resolve(deckPath);
  const files = [abs];
  try {
    const doc = YAML.parse(readFileSync(abs, 'utf8')) as { slides?: unknown[] };
    for (const s of doc?.slides ?? [])
      if (s && typeof s === 'object' && 'include' in s) {
        const inc = resolve(dirname(abs), String((s as { include: string }).include));
        if (existsSync(inc)) files.push(inc);
      }
  } catch {
    // an unparsable deck is reported by validation; log what exists
  }
  return files;
}

/** Copy the current sources aside so a later round can show what changed. */
export function snapshotSources(deckPath: string, dir: string): string[] {
  rmSync(dir, { recursive: true, force: true });
  const base = dirname(resolve(deckPath));
  const files = deckSourceFiles(deckPath);
  for (const f of files) {
    const target = join(dir, relative(base, f));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(f, target);
  }
  return files.map((f) => relative(base, f));
}

/** Line diff (LCS) with one line of context; enough for YAML sources. */
export function diffLines(file: string, before: string, after: string): FileDiff | undefined {
  if (before === after) return undefined;
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const ops: { op: ' ' | '-' | '+'; text: string; ai: number; bi: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) ops.push({ op: ' ', text: a[i]!, ai: i++, bi: j++ });
    else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!))
      ops.push({ op: '-', text: a[i]!, ai: i++, bi: j });
    else ops.push({ op: '+', text: b[j]!, ai: i, bi: j++ });
  }
  const keep = new Set<number>();
  ops.forEach((o, k) => {
    if (o.op !== ' ') for (let d = -1; d <= 1; d++) if (ops[k + d]) keep.add(k + d);
  });
  const lines: string[] = [];
  let last = -2;
  ops.forEach((o, k) => {
    if (!keep.has(k)) return;
    if (k !== last + 1) lines.push(`@ line ${o.ai + 1}`);
    lines.push(`${o.op} ${o.text}`);
    last = k;
  });
  return {
    file,
    added: ops.filter((o) => o.op === '+').length,
    removed: ops.filter((o) => o.op === '-').length,
    lines,
  };
}

/** Diff the current sources against a snapshot taken by snapshotSources(). */
export function diffAgainstSnapshot(deckPath: string, dir: string): FileDiff[] {
  const base = dirname(resolve(deckPath));
  const out: FileDiff[] = [];
  for (const f of deckSourceFiles(deckPath)) {
    const rel = relative(base, f);
    const snap = join(dir, rel);
    const d = diffLines(
      rel,
      existsSync(snap) ? readFileSync(snap, 'utf8') : '',
      readFileSync(f, 'utf8'),
    );
    if (d) out.push(d);
  }
  return out;
}

export function reviewLogMarkdown(entries: ReviewLogEntry[]): string {
  const out = [
    '# Review log',
    '',
    'Every change made while checking this deck, newest last. Machine-readable: `review-log.jsonl`.',
    '',
  ];
  for (const e of entries) {
    out.push(
      `## ${e.at.replace('T', ' ').slice(0, 19)} · ${e.stage}${e.actor ? ` · ${e.actor}` : ''}`,
      '',
      e.summary,
      '',
    );
    for (const c of e.changes ?? [])
      out.push(
        `- \`${c.file}\`${c.pointer ? ` ${c.pointer}` : ''}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`,
      );
    if (e.changes?.length) out.push('');
    for (const d of e.diffs ?? [])
      out.push(
        `\`${d.file}\` (+${d.added} −${d.removed})`,
        '',
        '```diff',
        ...d.lines.map((l) => (l.startsWith('@') ? `@@ ${l.slice(2)} @@` : l)),
        '```',
        '',
      );
  }
  return `${out.join('\n')}\n`;
}
