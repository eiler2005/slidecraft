/**
 * Surgical YAML edits: change one value, add one key or append one list item by rewriting
 * only those characters, so a person's file keeps its comments, spacing, quoting and flow
 * style (`[a, b]`, `{ a: 1 }`) everywhere else. Used by `fix --apply`, `sync --apply`,
 * `ingest` and `images`. When an edit has no safe in-place form, the document is
 * re-serialised as a fallback.
 */
import YAML, {
  isMap,
  isScalar,
  isSeq,
  type Node,
  type Pair,
  type YAMLMap,
  type YAMLSeq,
} from 'yaml';

export interface YamlEdit {
  path: (string | number)[];
  value: unknown;
}

const col = (text: string, at: number) => at - text.lastIndexOf('\n', at - 1) - 1;

/** A scalar in YAML syntax: plain when safe, else a double-quoted JSON string. */
function scalar(v: unknown, flow: boolean): string {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (s === '' || s.includes('\n') || (flow && /[,[\]{}]/.test(s))) return JSON.stringify(s);
  const y = YAML.stringify(s, { lineWidth: 0 }).trimEnd();
  return y.includes('\n') ? JSON.stringify(s) : y;
}

/** A value placed after "key: " or "- " at `indent` (block style for maps and lists). */
function block(v: unknown, indent: number): string {
  const pad = ' '.repeat(indent);
  if (Array.isArray(v))
    return v.length ? v.map((x) => `\n${pad}- ${item(x, indent + 2)}`).join('') : ' []';
  if (v && typeof v === 'object') {
    const e = Object.entries(v as Record<string, unknown>);
    return e.map(([k, x]) => `\n${pad}${k}:${blockOrInline(x, indent + 2)}`).join('');
  }
  return ` ${scalar(v, false)}`;
}
const blockOrInline = (v: unknown, indent: number) =>
  v !== null && typeof v === 'object' ? block(v, indent) : ` ${scalar(v, false)}`;

/** One list item written after "- ": a map's first key stays on the dash line. */
function item(v: unknown, indent: number): string {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const e = Object.entries(v as Record<string, unknown>);
    const pad = ' '.repeat(indent);
    return e
      .map(([k, x], i) => `${i ? `\n${pad}` : ''}${k}:${blockOrInline(x, indent + 2)}`)
      .join('');
  }
  return scalar(v, false);
}

/** End of a node's own text (before trailing whitespace and comments it may span). */
function contentEnd(text: string, node: Node): number {
  let end = node.range![1];
  while (end > node.range![0] && /\s/.test(text[end - 1]!)) end--;
  return end;
}

function splice(text: string, from: number, to: number, s: string): string {
  return text.slice(0, from) + s + text.slice(to);
}

/** Apply one edit in place, or return undefined when there is no safe in-place form. */
function inPlace(text: string, e: YamlEdit): string | undefined {
  const doc = YAML.parseDocument(text);
  const node = doc.getIn(e.path, true) as Node | undefined;
  const parent = (e.path.length > 1 ? doc.getIn(e.path.slice(0, -1), true) : doc.contents) as
    | YAMLMap
    | YAMLSeq
    | undefined;
  const flowParent = !!(parent && (isMap(parent) || isSeq(parent)) && parent.flow);

  if (node?.range) {
    const [from] = node.range;
    const to = contentEnd(text, node);
    if (isScalar(node) && (e.value === null || typeof e.value !== 'object'))
      return splice(text, from, to, scalar(e.value, flowParent));
    if (isSeq(node) && Array.isArray(e.value) && e.value.every((x) => typeof x !== 'object')) {
      if (node.flow || flowParent) {
        const padded = text[from + 1] === ' ';
        const body = e.value.map((x) => scalar(x, true)).join(', ');
        return splice(text, from, to, padded && body ? `[ ${body} ]` : `[${body}]`);
      }
      if (!e.value.length) return undefined;
      const dash = col(text, from);
      return splice(text, from, to, block(e.value, dash).trimStart());
    }
    return undefined;
  }

  // a new key at the end of a block map
  if (isMap(parent) && !parent.flow && typeof e.path.at(-1) === 'string' && parent.items.length) {
    const first = parent.items[0] as Pair<Node, Node>;
    const last = parent.items.at(-1) as Pair<Node, Node>;
    const end = last.value?.range ? contentEnd(text, last.value) : contentEnd(text, last.key);
    const indent = col(text, first.key.range![0]);
    return splice(
      text,
      end,
      end,
      `\n${' '.repeat(indent)}${e.path.at(-1)}:${blockOrInline(e.value, indent + 2)}`,
    );
  }
  // a new item at the end of a list
  if (isSeq(parent) && e.path.at(-1) === parent.items.length && parent.range) {
    if (!parent.flow && parent.items.length) {
      const lastItem = parent.items.at(-1) as Node;
      const end = contentEnd(text, lastItem);
      const dash = text.lastIndexOf('-', lastItem.range![0]);
      const indent = col(text, dash);
      return splice(text, end, end, `\n${' '.repeat(indent)}- ${item(e.value, indent + 2)}`);
    }
    if (
      parent.flow &&
      !parent.items.length &&
      text.slice(parent.range[0], parent.range[0] + 2) === '[]'
    ) {
      // `sources: []` becomes a block list under its key
      const lineStart = text.lastIndexOf('\n', parent.range[0] - 1) + 1;
      const keyIndent = /^ */.exec(text.slice(lineStart))![0].length;
      const at = parent.range[0];
      const before = text[at - 1] === ' ' ? at - 1 : at;
      return splice(
        text,
        before,
        at + 2,
        `\n${' '.repeat(keyIndent + 2)}- ${item(e.value, keyIndent + 4)}`,
      );
    }
  }
  return undefined;
}

/** Apply edits one after another; each keeps the rest of the file byte for byte when it can. */
export function editYaml(text: string, edits: YamlEdit[]): string {
  let out = text;
  for (const e of edits) {
    const next = inPlace(out, e);
    if (next !== undefined) {
      // keep the in-place edit only if it parses and holds exactly the intended value
      const check = YAML.parseDocument(next);
      const got = check.getIn(e.path);
      const json = (v: unknown) =>
        JSON.stringify(
          v && typeof v === 'object' && 'toJSON' in v ? (v as { toJSON(): unknown }).toJSON() : v,
        );
      if (!check.errors.length && json(got) === JSON.stringify(e.value)) {
        out = next;
        continue;
      }
    }
    const doc = YAML.parseDocument(out);
    doc.setIn(e.path, e.value);
    out = doc.toString({ lineWidth: 0 });
  }
  return out;
}
