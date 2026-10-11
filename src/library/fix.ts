/**
 * Fit-fix loop (M6): find every text that does not fit, say exactly how long it may be,
 * and apply rewrites by JSON pointer straight into the YAML that holds the slide.
 *
 *   slidecraft fix deck.yaml --json            → tasks: pointer, file, text, length, budget
 *   slidecraft fix deck.yaml --apply fixes.json → writes, re-checks, lists what is left
 *
 * The rewriting is done by a person or an agent (copy-fitter); SlideCraft never truncates.
 * Budgets come from re-composing the slide with shorter text until the diagnostic clears.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import YAML, { type Document, isMap, isSeq } from 'yaml';
import { checkDeck } from '../build.ts';
import { composeDeck } from '../engine/compose.ts';
import type { Diagnostic } from '../qa/codes.ts';
import { checkScene } from '../qa/scene-checks.ts';
import { loadDeck } from './load.ts';

export interface FitTask {
  code: string;
  slide?: string;
  pointer: string;
  /** YAML file that holds the field (deck.yaml or an included section file). */
  file: string;
  text: string;
  length: number;
  /** Longest length that fits, by measurement (or the contract limit). */
  budget?: number;
  message: string;
  hint?: string;
}

interface Loc {
  file: string;
  /** Path of the slide map inside that file's document. */
  path: (string | number)[];
}

/** Where each expanded slide lives: deck.yaml itself or an included file. */
function slideLocations(deckPath: string): Loc[] {
  const file = resolve(deckPath);
  const doc = YAML.parse(readFileSync(file, 'utf8')) as { slides?: unknown[] };
  const out: Loc[] = [];
  (doc.slides ?? []).forEach((s, i) => {
    if (s && typeof s === 'object' && 'include' in (s as object)) {
      const inc = resolve(dirname(file), String((s as { include: string }).include));
      const list = YAML.parse(readFileSync(inc, 'utf8'));
      if (Array.isArray(list)) list.forEach((_, k) => out.push({ file: inc, path: [k] }));
    } else out.push({ file, path: ['slides', i] });
  });
  return out;
}

function parsePointer(p: string): { slide: number; rest: (string | number)[] } | undefined {
  const m = /^\/slides\/(\d+)(\/.*)?$/.exec(p);
  if (!m) return undefined;
  const rest = (m[2] ?? '')
    .split('/')
    .filter(Boolean)
    .map((k) => k.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map((k) => (/^\d+$/.test(k) ? Number(k) : k));
  return { slide: Number(m[1]), rest };
}

function getIn(obj: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>(
    (o, k) => (o == null ? undefined : (o as Record<string | number, unknown>)[k]),
    obj,
  );
}

function setIn(obj: unknown, path: (string | number)[], v: unknown) {
  const last = path[path.length - 1]!;
  const parent = getIn(obj, path.slice(0, -1)) as Record<string | number, unknown>;
  parent[last] = v;
}

const isFit = (d: Diagnostic) =>
  !!d.pointer &&
  (d.code === 'SC-FIT-001' ||
    d.code === 'SC-FIT-003' ||
    (d.code.startsWith('SC-SPEC') && /too big|<=\s*\d+ characters/i.test(d.message)));

/** Longest prefix (at a word boundary) for which the fit diagnostic on `pointer` clears. */
function measureBudget(
  deckPath: string,
  pointer: string,
  code: string,
  text: string,
): number | undefined {
  const loaded = loadDeck(deckPath);
  const ptr = parsePointer(pointer);
  if (!ptr || !loaded.slides[ptr.slide]) return undefined;
  const clears = (len: number) => {
    const cut = text.slice(0, len).replace(/\s+\S*$/, '') || text.slice(0, len);
    const slides = loaded.slides.map((s, i) => (i === ptr.slide ? structuredClone(s) : s));
    setIn(slides[ptr.slide], ptr.rest, cut);
    const { scene, diagnostics } = composeDeck({ ...loaded, slides });
    return ![...diagnostics, ...checkScene(scene)].some(
      (d) => d.pointer === pointer && d.code === code,
    );
  };
  if (!clears(1)) return undefined; // something other than length is wrong (e.g. a long word)
  let lo = 1;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (clears(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function fitTasks(deckPath: string): FitTask[] {
  const { loaded, diagnostics } = checkDeck(deckPath);
  const locs = slideLocations(deckPath);
  const tasks: FitTask[] = [];
  const seen = new Set<string>();
  for (const d of diagnostics.filter(isFit)) {
    if (seen.has(`${d.code}${d.pointer}`)) continue;
    seen.add(`${d.code}${d.pointer}`);
    const ptr = parsePointer(d.pointer!);
    const loc = ptr ? locs[ptr.slide] : undefined;
    if (!ptr || !loc) continue;
    // parsed slide when it validated; otherwise the raw YAML (contract errors)
    const raw =
      getIn(loaded.slides[ptr.slide], ptr.rest) ??
      getIn(getIn(YAML.parse(readFileSync(loc.file, 'utf8')), loc.path), ptr.rest);
    const text = Array.isArray(raw) ? raw.join('\n') : typeof raw === 'string' ? raw : '';
    if (!text) continue;
    const contract = /<=\s*(\d+)/.exec(d.message)?.[1];
    const budget = d.code.startsWith('SC-SPEC')
      ? Number(contract)
      : Array.isArray(raw)
        ? undefined
        : measureBudget(deckPath, d.pointer!, d.code, text);
    tasks.push({
      code: d.code,
      ...(d.slide ? { slide: d.slide } : {}),
      pointer: d.pointer!,
      file: loc.file,
      text,
      length: text.length,
      ...(budget !== undefined ? { budget } : {}),
      message: d.message,
      ...(d.hint ? { hint: d.hint } : {}),
    });
  }
  return tasks;
}

/** The value a slide field pointer holds in the YAML as written (before facts are filled in). */
export function readField(deckPath: string, pointer: string): unknown {
  const ptr = parsePointer(pointer);
  const loc = ptr ? slideLocations(deckPath)[ptr.slide] : undefined;
  if (!ptr || !loc) return undefined;
  const doc = YAML.parseDocument(readFileSync(loc.file, 'utf8'));
  const v = doc.getIn([...loc.path, ...ptr.rest]);
  return v && typeof v === 'object' && 'toJSON' in v ? (v as { toJSON(): unknown }).toJSON() : v;
}

export interface Fix {
  pointer: string;
  /** New text; for list fields, an array of strings. */
  text: string | string[];
}

/** Write rewrites into the YAML files (comments and formatting kept), then report what is left. */
export function applyFixes(
  deckPath: string,
  fixes: Fix[],
): { applied: number; errors: string[]; remaining: FitTask[] } {
  const locs = slideLocations(deckPath);
  const docs = new Map<string, Document>();
  const errors: string[] = [];
  let applied = 0;
  for (const f of fixes) {
    const ptr = parsePointer(f.pointer);
    const loc = ptr ? locs[ptr.slide] : undefined;
    if (!ptr || !loc || !ptr.rest.length) {
      errors.push(`${f.pointer}: not a slide field pointer`);
      continue;
    }
    let doc = docs.get(loc.file);
    if (!doc) {
      doc = YAML.parseDocument(readFileSync(loc.file, 'utf8'));
      docs.set(loc.file, doc);
    }
    const full = [...loc.path, ...ptr.rest];
    const parent = doc.getIn(full.slice(0, -1), true);
    if (!isMap(parent) && !isSeq(parent)) {
      errors.push(`${f.pointer}: field not found in ${loc.file}`);
      continue;
    }
    doc.setIn(full, f.text);
    applied++;
  }
  for (const [file, doc] of docs)
    writeFileSync(file, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));
  return { applied, errors, remaining: fitTasks(deckPath) };
}
