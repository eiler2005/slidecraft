/** Bounded semantic import. Labels/URLs/directives are inert data, never executed. */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import YAML from 'yaml';
import { Slide } from '../spec/deck.ts';

const MAX_BYTES = 1024 * 1024;
type Node = { id: string; label: string; shape?: 'process' | 'decision' | 'terminal' | 'state' };
type Edge = { from: string; to: string; label?: string; dashed?: boolean };
export interface DiagramImport {
  slide: Record<string, unknown>;
  ledger: { preserved: string[]; merged: string[]; omitted: string[]; unsupported: string[] };
}
const plain = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const attrs = (s: string) =>
  Object.fromEntries(
    [...s.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => [
      m[1]!,
      decode(m[2] ?? m[3] ?? ''),
    ]),
  );

function graphSlide(nodes: Node[], edges: Edge[], kind = 'flowchart'): Record<string, unknown> {
  if (nodes.length < 2 || nodes.length > 12 || edges.length > 16)
    throw new Error('Imported graph needs 2–12 nodes and at most 16 edges; split the source');
  if (
    new Set(nodes.map((n) => n.id)).size !== nodes.length ||
    edges.some((e) => !nodes.some((n) => n.id === e.from) || !nodes.some((n) => n.id === e.to))
  )
    throw new Error('Imported graph has duplicate identities or unknown endpoints');
  const rank = new Map(nodes.map((n) => [n.id, 0])),
    indegree = new Map(nodes.map((n) => [n.id, edges.filter((e) => e.to === n.id).length])),
    queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited++;
    for (const e of edges.filter((e) => e.from === id)) {
      rank.set(e.to, Math.max(rank.get(e.to)!, rank.get(id)! + 1));
      indegree.set(e.to, indegree.get(e.to)! - 1);
      if (indegree.get(e.to) === 0) queue.push(e.to);
    }
  }
  const acyclic = visited === nodes.length && Math.max(...rank.values()) <= 3;
  const rows = new Map<number, number>();
  return {
    layout: kind,
    nodes: nodes.map((n, i) => {
      const column = acyclic ? rank.get(n.id)! : i % 3,
        row = acyclic ? (rows.get(column) ?? 0) : Math.floor(i / 3);
      rows.set(column, row + 1);
      if (row > 5) throw new Error('Imported graph exceeds the row budget; split the source');
      return { ...n, column, row };
    }),
    edges: edges.map((e, i) => ({ ...e, id: `edge-${i}` })),
  };
}

/** Supported statements are explicit; unknown syntax is a finding, never a guessed diagram. */
export function parseDiagram(
  text: string,
  format: 'mermaid' | 'drawio' | 'excalidraw',
): DiagramImport {
  if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('Diagram input exceeds 1 MiB');
  const ledger: DiagramImport['ledger'] = {
    preserved: [],
    merged: [],
    omitted: [],
    unsupported: [],
  };
  let content: Record<string, unknown>;
  const nodes: Node[] = [],
    edges: Edge[] = [],
    ids = new Map<string, string>();
  const idFor = (id: string) => {
    let mapped = ids.get(id);
    if (!mapped) {
      mapped = `node-${ids.size}`;
      ids.set(id, mapped);
    }
    return mapped;
  };
  const add = (sourceId: string, label: string, shape: Node['shape'] = 'process') => {
    const id = idFor(sourceId),
      old = nodes.find((n) => n.id === id);
    if (old) {
      if (label !== sourceId) old.label = label;
      if (shape !== 'process') old.shape = shape;
    } else nodes.push({ id, label, shape });
    return id;
  };
  if (format === 'mermaid') {
    const blocks = [...text.matchAll(/```mermaid\s*\n([\s\S]*?)```/gi)];
    if (blocks.length > 1) throw new Error('Select one Mermaid diagram per import');
    const source = blocks[0]?.[1] ?? text;
    const lines = source
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('%%'));
    const header = lines.shift() ?? '';
    const statements = lines
      .flatMap((line) => line.split(/;\s*(?=[A-Za-z_])/))
      .map((s) => s.trim())
      .filter(Boolean);
    if (/^(flowchart|graph)\b/.test(header)) {
      const node = (expression: string) => {
        const m = /^([A-Za-z_][\w-]*)(.*)$/.exec(expression.trim());
        if (!m) throw new Error(`Unsupported Mermaid node: ${expression}`);
        const tail = m[2]!.trim();
        let label = m[1]!,
          shape: Node['shape'] = 'process';
        if (tail) {
          if (tail.startsWith('[') && tail.endsWith(']')) label = tail.slice(1, -1);
          else if (tail.startsWith('{') && tail.endsWith('}')) {
            label = tail.slice(1, -1);
            shape = 'decision';
          } else if (tail.startsWith('(') && tail.endsWith(')')) {
            label = tail.replace(/^\(+|\)+$/g, '');
            shape = 'terminal';
          } else throw new Error(`Unsupported Mermaid node shape: ${expression}`);
        }
        return add(m[1]!, plain(label.replace(/^"|"$/g, '')), shape);
      };
      for (const line of statements) {
        if (/^(style|classDef|class|linkStyle|click)\s/.test(line)) {
          ledger.omitted.push(`Styling or action: ${line}`);
          continue;
        }
        if (/^(subgraph|end)\b/.test(line)) {
          ledger.omitted.push(`Container grouping: ${line}`);
          continue;
        }
        const m = /^(.+?)\s*(-->|-\.->|==>|---)\s*(?:\|([^|]*)\|\s*)?(.+)$/.exec(line);
        if (m) {
          if (/-->|-\.->|==>/.test(m[4]!))
            throw new Error('Expand chained Mermaid edges into one edge per line');
          edges.push({
            from: node(m[1]!),
            to: node(m[4]!),
            ...(m[3] ? { label: plain(m[3]) } : {}),
            ...(m[2] === '-.->' ? { dashed: true } : {}),
          });
        } else node(line);
      }
      content = graphSlide(nodes, edges);
    } else if (/^sequenceDiagram\b/.test(header)) {
      const participants: { id: string; label: string }[] = [],
        messages: { from: string; to: string; label: string; kind: string }[] = [];
      const participant = (name: string, label = name) => {
        const id = idFor(name);
        if (!participants.some((p) => p.id === id)) participants.push({ id, label: plain(label) });
        return id;
      };
      for (const line of statements) {
        const p = /^(?:participant|actor)\s+(\w+)(?:\s+as\s+(.+))?$/.exec(line);
        if (p) {
          participant(p[1]!, p[2] ?? p[1]!);
          continue;
        }
        const m = /^(\w+)\s*(--?>>|--?>)\s*(\w+)\s*:\s*(.+)$/.exec(line);
        if (!m)
          throw new Error(
            `Unsupported sequence statement (fragments/notes are not imported): ${line}`,
          );
        messages.push({
          from: participant(m[1]!),
          to: participant(m[3]!),
          label: plain(m[4]!),
          kind: m[2]!.startsWith('--') ? 'return' : 'call',
        });
      }
      content = { layout: 'sequence', participants, messages };
    } else if (/^stateDiagram-v2\b/.test(header)) {
      let initial: string | undefined;
      const terminal: string[] = [];
      for (const line of statements) {
        const m =
          /^(\[\*\]|[A-Za-z_][\w-]*)\s*-->\s*(\[\*\]|[A-Za-z_][\w-]*)(?:\s*:\s*(.+))?$/.exec(line);
        if (!m) throw new Error(`Unsupported state statement: ${line}`);
        if (m[1] === '[*]') {
          if (initial) throw new Error('Only one initial state is supported');
          initial = add(m[2]!, m[2]!, 'state');
          continue;
        }
        const from = add(m[1]!, m[1]!, 'state'),
          to = m[2] === '[*]' ? add('__terminal__', '[*]', 'terminal') : add(m[2]!, m[2]!, 'state');
        if (m[2] === '[*]' && !terminal.includes(to)) terminal.push(to);
        edges.push({ from, to, ...(m[3] ? { label: plain(m[3]) } : {}) });
      }
      if (!initial || !terminal.length)
        throw new Error('State import needs explicit initial and terminal transitions');
      content = { ...graphSlide(nodes, edges, 'state-machine'), initial, terminal };
    } else if (/^erDiagram\b/.test(header)) {
      const entities: {
          id: string;
          label: string;
          fields: { id: string; label: string; type: string; key?: string }[];
        }[] = [],
        relationships: { from: { entity: string }; to: { entity: string }; kind: string }[] = [];
      let current: (typeof entities)[number] | undefined;
      const entity = (name: string) => {
        let e = entities.find((v) => v.label === name);
        if (!e) {
          e = { id: idFor(name), label: name, fields: [] };
          entities.push(e);
        }
        return e;
      };
      for (const line of statements) {
        const open = /^(\w+)\s*\{$/.exec(line);
        if (open) {
          current = entity(open[1]!);
          continue;
        }
        if (line === '}') {
          current = undefined;
          continue;
        }
        if (current) {
          const f = /^(\S+)\s+(\w+)(?:\s+(PK|FK|UK))?(?:\s+"[^"]*")?$/.exec(line);
          if (!f) throw new Error(`Unsupported ER attribute: ${line}`);
          current.fields.push({
            id: `field-${current.fields.length}`,
            label: f[2]!,
            type: f[1]!,
            ...(f[3] === 'PK' || f[3] === 'FK' ? { key: f[3] } : {}),
          });
          if (f[3] === 'UK') ledger.omitted.push(`Unique constraint: ${current.label}.${f[2]}`);
          continue;
        }
        const r = /^(\w+)\s+([|o}{]+)--([|o}{]+)\s+(\w+)\s*:\s*(.+)$/.exec(line);
        if (!r) throw new Error(`Unsupported ER relationship: ${line}`);
        const leftMany = /[{}]/.test(r[2]!),
          rightMany = /[{}]/.test(r[3]!);
        const left = entity(r[1]!).id,
          right = entity(r[4]!).id;
        relationships.push({
          from: { entity: leftMany && !rightMany ? right : left },
          to: { entity: leftMany && !rightMany ? left : right },
          kind:
            leftMany && rightMany ? 'many-many' : leftMany || rightMany ? 'one-many' : 'one-one',
        });
        ledger.omitted.push(`ER relationship wording/optionality: ${r[5]}`);
      }
      if (entities.some((e) => !e.fields.length))
        throw new Error('ER entities need explicit attributes for the native entity contract');
      content = { layout: 'er-diagram', entities, relationships };
    } else
      throw new Error(
        'Supported Mermaid kinds: flowchart/graph, sequenceDiagram, stateDiagram-v2, erDiagram',
      );
  } else if (format === 'drawio') {
    if (/<!DOCTYPE|<!ENTITY/i.test(text))
      throw new Error('Draw.io DTD/entity declarations are not supported');
    let xml = text;
    if (!/<mxGraphModel\b/.test(xml)) {
      const pages = [...xml.matchAll(/<diagram\b[^>]*>([\s\S]*?)<\/diagram>/g)];
      if (pages.length !== 1) throw new Error('Select one draw.io page per import');
      const body = pages[0]![1]!.trim();
      xml = body.startsWith('&lt;')
        ? decode(body)
        : decodeURIComponent(
            inflateRawSync(Buffer.from(body, 'base64'), { maxOutputLength: MAX_BYTES }).toString(
              'utf8',
            ),
          );
    }
    const cells = [...xml.matchAll(/<mxCell\b([^>]*)>/g)].map((m) => attrs(m[1]!));
    for (const cell of cells)
      if (cell.vertex === '1') {
        if (!cell.id) throw new Error('Draw.io vertices require stable identities');
        add(
          cell.id!,
          plain(cell.value ?? cell.id ?? ''),
          (cell.style ?? '').includes('rhombus')
            ? 'decision'
            : (cell.style ?? '').includes('ellipse')
              ? 'terminal'
              : 'process',
        );
      }
    for (const cell of cells)
      if (cell.edge === '1') {
        if (!cell.source || !cell.target || !ids.has(cell.source) || !ids.has(cell.target))
          throw new Error('Draw.io connectors require bound known endpoints');
        edges.push({
          from: ids.get(cell.source)!,
          to: ids.get(cell.target)!,
          ...(cell.value ? { label: plain(cell.value) } : {}),
        });
      }
    for (const cell of cells)
      if (cell.vertex === '1' && cell.parent && cell.parent !== '1' && ids.has(cell.parent))
        ledger.omitted.push(`Container grouping: ${cell.parent} → ${cell.id}`);
    content = graphSlide(nodes, edges);
    ledger.omitted.push(
      'Source coordinates, styles and connector routes replaced by native editorial layout',
    );
  } else {
    const doc = JSON.parse(text) as {
      elements?: {
        id: string;
        type: string;
        text?: string;
        isDeleted?: boolean;
        containerId?: string;
        startBinding?: { elementId: string };
        endBinding?: { elementId: string };
        groupIds?: string[];
      }[];
    };
    if (!Array.isArray(doc.elements)) throw new Error('Excalidraw needs an elements array');
    const elements = doc.elements.filter((e) => !e.isDeleted);
    for (const e of elements)
      if (['rectangle', 'diamond', 'ellipse'].includes(e.type)) {
        const t = elements.find((v) => v.type === 'text' && v.containerId === e.id);
        add(
          e.id,
          plain(t?.text ?? e.id),
          e.type === 'diamond' ? 'decision' : e.type === 'ellipse' ? 'terminal' : 'process',
        );
      }
    for (const e of elements) {
      if (e.type === 'arrow') {
        const from = ids.get(e.startBinding?.elementId ?? ''),
          to = ids.get(e.endBinding?.elementId ?? '');
        if (!from || !to) throw new Error('Excalidraw arrows require bound known endpoints');
        const t = elements.find((v) => v.type === 'text' && v.containerId === e.id);
        edges.push({ from, to, ...(t?.text ? { label: plain(t.text) } : {}) });
      } else if (!['rectangle', 'diamond', 'ellipse', 'text'].includes(e.type))
        ledger.omitted.push(`Unsupported decorative element: ${e.id} (${e.type})`);
      else if (e.type === 'text' && !e.containerId)
        ledger.omitted.push(`Unbound annotation: ${e.text ?? e.id}`);
      if (e.groupIds?.length) ledger.omitted.push(`Source grouping: ${e.id}`);
    }
    content = graphSlide(nodes, edges);
    ledger.omitted.push(
      'Source coordinates, styles and connector routes replaced by native editorial layout',
    );
  }
  const raw = {
    id: 'imported-diagram',
    title: 'The imported diagram preserves the declared components and relationships',
    status: 'draft',
    sources: ['diagram-source'],
    ...content,
  };
  // Validate budgets and content before producing files; never truncate source labels.
  Slide.parse(raw);
  ledger.preserved.push(...[...ids.entries()].map(([source, id]) => `${source} → ${id}`));
  return { slide: raw, ledger };
}

export function importDiagram(file: string, out: string) {
  const source = resolve(file);
  if (statSync(source).size > MAX_BYTES) throw new Error('Diagram input exceeds 1 MiB');
  const suffix = extname(source).toLowerCase(),
    format =
      suffix === '.drawio' || suffix === '.xml'
        ? 'drawio'
        : suffix === '.excalidraw' || suffix === '.json'
          ? 'excalidraw'
          : 'mermaid';
  const result = parseDiagram(readFileSync(source, 'utf8'), format),
    folder = resolve(out),
    deckPath = join(folder, 'deck.yaml');
  if (existsSync(deckPath))
    throw new Error(`Refusing to overwrite ${deckPath}; choose a new output folder`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    deckPath,
    YAML.stringify({
      schemaVersion: 1,
      id: 'imported-diagram',
      title: basename(source),
      theme: 'consulting-classic',
      status: 'draft',
      sources: [{ id: 'diagram-source', title: basename(source), file: source }],
      slides: [result.slide],
    }),
  );
  const ledgerPath = join(folder, 'import-ledger.json');
  writeFileSync(ledgerPath, `${JSON.stringify(result.ledger, null, 2)}\n`);
  return { ok: true, deck: deckPath, ledger: ledgerPath, report: result.ledger };
}
