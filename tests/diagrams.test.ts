import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { buildDeck, checkDeck } from '../src/build.ts';
import { contrast, ensureContrast } from '../src/engine/color.ts';
import { createContext } from '../src/engine/context.ts';
import { extent, ribbon, scale, spreadLabels, squarify } from '../src/engine/diagram-geometry.ts';
import { routeOrthogonal, segmentHitsBox } from '../src/engine/diagram-routing.ts';
import { WIDE_16X9 } from '../src/engine/format.ts';
import { topologyChanges } from '../src/layouts/graph-diagrams.ts';
import { getLayout, LAYOUTS } from '../src/layouts/index.ts';
import { importDiagram, parseDiagram } from '../src/library/diagram-import.ts';
import { getTheme } from '../src/library/load.ts';
import { checkDiagrams } from '../src/qa/diagram-checks.ts';

function draw(id: string, content?: Record<string, unknown>) {
  const def = getLayout(id)!,
    theme = getTheme('consulting-classic')!;
  const ctx = createContext({
    theme,
    format: WIDE_16X9,
    fonts: theme.fonts,
    slideId: 'diagram',
    slideIndex: 0,
    variant: def.variants[0],
    slide: { title: 'A generic diagram supports a verifiable claim' },
    body: WIDE_16X9.bodyNoLead,
    baseDir: '/tmp',
  });
  def.compose(ctx, def.schema.parse(content ?? def.examples[0]!.content));
  return ctx;
}

describe('data-preserving native geometry', () => {
  it('chooses a reachable contrasting colour on mid-tone fills', () => {
    for (const background of ['#808B99', '#6E7A8A'])
      expect(contrast(ensureContrast('#0B1F3A', background, 5), background)).toBeGreaterThanOrEqual(
        4.5,
      );
  });
  it('preserves relative treemap areas including tiny and zero parts', () => {
    const items = [
        { id: 'a', value: 1000 },
        { id: 'b', value: 3 },
        { id: 'c', value: 0.1 },
        { id: 'd', value: 0 },
      ],
      a = { x: 1, y: 2, w: 9, h: 4 },
      boxes = squarify(items, a),
      sum = items.reduce((s, v) => s + v.value, 0);
    for (const item of items.filter((v) => v.value > 0)) {
      const b = boxes.get(item.id)!;
      expect((b.w * b.h) / (a.w * a.h)).toBeCloseTo(item.value / sum, 10);
      expect(b.x + b.w).toBeLessThanOrEqual(a.x + a.w + 1e-8);
    }
    expect(boxes.has('d')).toBe(false);
    expect([...squarify(items, a)]).toEqual([...boxes]);
  });
  it('rejects invalid totals, duplicate identities and nonfinite geometry', () => {
    for (const items of [
      [{ id: 'a', value: 0 }],
      [{ id: 'a', value: -1 }],
      [{ id: 'a', value: Infinity }],
      [
        { id: 'a', value: 1 },
        { id: 'a', value: 2 },
      ],
    ])
      expect(() => squarify(items, { x: 0, y: 0, w: 4, h: 3 })).toThrow();
    expect(() => extent([Infinity])).toThrow();
    expect(() => scale([1, 1], 0, 1)).toThrow();
  });
  it('spreads labels without changing observed positions', () => {
    const positions = [1, 1, 1.01, 1.05],
      copy = [...positions],
      labels = spreadLabels(positions, 0, 2, 0.3);
    expect(positions).toEqual(copy);
    for (let i = 1; i < labels.length; i++)
      expect(labels[i]! - labels[i - 1]!).toBeGreaterThanOrEqual(0.3 - 1e-9);
    expect(() => spreadLabels(positions, 0, 0.5, 0.3)).toThrow();
  });
  it('routes around an obstacle with only orthogonal segments', () => {
    const block = { x: 2, y: 1, w: 2, h: 2 },
      path = routeOrthogonal([1, 2], [5, 2], [block], { x: 0, y: 0, w: 6, h: 4 });
    expect(path[0]).toEqual([1, 2]);
    expect(path.at(-1)).toEqual([5, 2]);
    path.slice(1).forEach((p, i) => {
      expect(p[0] === path[i]![0] || p[1] === path[i]![1]).toBe(true);
      expect(segmentHitsBox(path[i]!, p, block)).toBe(false);
    });
  });
  it('rejects blocked routing rather than dropping the relationship', () =>
    expect(() =>
      routeOrthogonal([0.5, 1], [3.5, 1], [{ x: 1, y: 0, w: 2, h: 2 }], { x: 0, y: 0, w: 4, h: 2 }),
    ).toThrow());
  it('detects a corrupted ribbon even when it still renders', () => {
    const ctx = draw('sankey'),
      mark = ctx.nodes.find((n) => n.kind === 'path' && n.encoding?.dimension === 'ribbon')!;
    expect(checkDiagrams(ctx.nodes, 'diagram')).toEqual([]);
    if (mark.kind === 'path') {
      const bottom = mark.segments[2]!;
      if (bottom.op === 'L') bottom.y += 0.1;
    }
    expect(checkDiagrams(ctx.nodes, 'diagram').some((d) => d.message.includes('quantity'))).toBe(
      true,
    );
  });
  it('detects a wrong treemap area independently of its label', () => {
    const ctx = draw('treemap'),
      mark = ctx.nodes.find((n) => n.kind === 'rect' && n.encoding?.dimension === 'area')!;
    if (mark.kind === 'rect') mark.box.w *= 0.8;
    expect(checkDiagrams(ctx.nodes, 'diagram').some((d) => d.message.includes('quantity'))).toBe(
      true,
    );
  });
  it('checks metadata endpoints and rejects transit through unrelated nodes', () => {
    const ctx = draw('dependency-graph'),
      edge = ctx.nodes.find((n) => n.kind === 'path' && n.diagram?.kind === 'edge')!;
    if (edge.kind === 'path') edge.diagram!.to = 'missing';
    expect(checkDiagrams(ctx.nodes, 'diagram').some((d) => d.message.includes('endpoint'))).toBe(
      true,
    );
  });
  it('retains an exact conserved ribbon thickness', () => {
    const path = ribbon(0, 2, 5, 4, 0.375),
      top = path[1]!,
      bottom = path[2]!,
      back = path[3]!;
    if (top.op === 'C' && bottom.op === 'L' && back.op === 'C') {
      expect(bottom.y - top.y).toBe(0.375);
      expect(back.y - 2).toBe(0.375);
      expect(top.x2).toBe(2.5);
    }
  });
});

describe('semantic contracts', () => {
  it('raises presentation type without mutating a shared theme', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'sc-readability-')),
      file = join(tmp, 'deck.yaml'),
      themeBefore = structuredClone(getTheme('consulting-classic')!),
      def = getLayout('layer-stack')!,
      ex = def.examples[0]!;
    const raw = {
      schemaVersion: 1,
      id: 'readability',
      title: 'Readability policy',
      slides: [
        {
          id: 'layers',
          layout: def.id,
          title: ex.title,
          source: 'Illustrative example',
          ...ex.content,
        },
      ],
    };
    writeFileSync(file, YAML.stringify(raw));
    const report = checkDeck(file).scene!.slides[0]!.nodes;
    writeFileSync(file, YAML.stringify({ ...raw, readability: 'present' }));
    const present = checkDeck(file).scene!.slides[0]!.nodes;
    const titleSize = (nodes: typeof report) =>
      nodes.find((n) => n.kind === 'text' && n.role === 'title');
    const title = titleSize(present),
      previous = titleSize(report);
    expect(title?.kind === 'text' && title.style.size).toBeGreaterThanOrEqual(28);
    expect(previous?.kind === 'text' && previous.style.size).toBe(themeBefore.type.title);
    expect(getTheme('consulting-classic')).toEqual(themeBefore);
  });
  it.each([
    'heatmap',
    'treemap',
    'fishbone',
    'sankey',
    'architecture-delta',
    'swimlane',
    'flowchart',
    'state-machine',
    'sequence',
    'service-blueprint',
    'user-journey',
    'security-matrix',
    'er-diagram',
    'database-schema',
    'uml-class',
    'nested',
    'venn',
    'wardley-map',
    'kanban',
    'story-map',
    'radar',
    'polar',
    'loop',
    'layer-stack',
    'exploded-axonometric',
    'axonometric-plan',
    'dependency-graph',
  ])('%s is a registered native body exhibit', (id) => {
    const def = getLayout(id)!;
    expect(def.tags).toContain('diagram');
    const ctx = draw(id);
    expect(ctx.nodes.length).toBeGreaterThan(0);
    expect(ctx.nodes.some((n) => n.kind === 'html' || n.kind === 'image')).toBe(false);
    expect(ctx.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });
  it('rejects a nonconserved flow', () => {
    const c = structuredClone(getLayout('sankey')!.examples[0]!.content) as {
      flows: { value: number }[];
    };
    c.flows[2]!.value += 1;
    expect(draw('sankey', c).diagnostics.some((d) => d.code === 'SC-DIAGRAM-001')).toBe(true);
  });
  it('keeps null distinct from zero and refuses mismatched heatmap dimensions', () => {
    const c = {
      rows: ['A', 'B'],
      columns: ['X', 'Y'],
      values: [
        [0, null],
        [1, 2],
      ],
    };
    const ctx = draw('heatmap', c);
    expect(
      ctx.nodes
        .filter((n) => n.kind === 'text')
        .flatMap((n) =>
          n.kind === 'text' ? n.paragraphs.flatMap((p) => p.runs.map((r) => r.text)) : [],
        ),
    ).toContain('N/A');
    expect(
      draw('heatmap', {
        ...c,
        values: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
      }).diagnostics.some((d) => d.code === 'SC-DIAGRAM-001'),
    ).toBe(true);
  });
  it('checks terminal semantics and required visibility layers', () => {
    const state = structuredClone(getLayout('state-machine')!.examples[0]!.content) as {
      edges: { from: string; to: string }[];
    };
    state.edges.push({ from: 'done', to: 'new' });
    expect(draw('state-machine', state).diagnostics.some((d) => d.code === 'SC-DIAGRAM-001')).toBe(
      true,
    );
    expect(
      draw('service-blueprint', {
        stages: ['A', 'B', 'C'],
        layers: [
          { kind: 'customer', label: 'Customer', actions: ['A', 'B', 'C'] },
          { kind: 'frontstage', label: 'Visible', actions: ['A', 'B', 'C'] },
          { kind: 'support', label: 'Support', actions: ['A', 'B', 'C'] },
        ],
      }).diagnostics.some((d) => d.code === 'SC-DIAGRAM-001'),
    ).toBe(true);
  });
  it('computes topology changes from stable identities, not styling', () => {
    const a = {
      nodes: [
        { id: 'a', label: 'A', column: 0, row: 0 },
        { id: 'b', label: 'B', column: 1, row: 0 },
      ],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
    };
    expect(
      topologyChanges(a, { ...a, nodes: a.nodes.map((n) => ({ ...n, highlight: true })) }),
    ).toEqual([]);
    expect(
      topologyChanges(a, { ...a, nodes: [a.nodes[0]!, { ...a.nodes[1]!, row: 1 }] }),
    ).toContain('MOVED · B');
  });
});

describe('bounded semantic imports', () => {
  it('preserves flow identities and labels while reporting omitted actions', () => {
    const r = parseDiagram(
      'flowchart LR\nA[Receive] --> B{Approve?}\nB -->|Yes| C[Ship]\nB -->|No| D[Review]\nclick A "https://example.invalid"',
      'mermaid',
    );
    expect(r.slide.layout).toBe('flowchart');
    expect((r.slide.nodes as unknown[]).length).toBe(4);
    expect(r.ledger.omitted).toHaveLength(1);
    expect(r.ledger.preserved).toHaveLength(4);
  });
  it('imports sequence returns and state terminal semantics', () => {
    const s = parseDiagram(
      'sequenceDiagram\nparticipant A as Customer\nA->>B: Request\nB-->>A: Reply',
      'mermaid',
    );
    expect(s.slide.layout).toBe('sequence');
    expect((s.slide.messages as { kind: string }[])[1]!.kind).toBe('return');
    const state = parseDiagram(
      'stateDiagram-v2\n[*] --> Ready\nReady --> Done\nDone --> [*]',
      'mermaid',
    );
    expect(state.slide.layout).toBe('state-machine');
    expect(state.slide.terminal).toHaveLength(1);
  });
  it('imports explicit ER attributes and cardinalities', () => {
    const r = parseDiagram(
      'erDiagram\nCUSTOMER {\n uuid id PK\n}\nORDER {\n uuid id PK\n uuid customer_id FK\n}\nCUSTOMER ||--o{ ORDER : places',
      'mermaid',
    );
    expect(r.slide.layout).toBe('er-diagram');
    expect(r.slide.entities).toHaveLength(2);
    expect(r.ledger.omitted.length).toBeGreaterThan(0);
    const reversed = parseDiagram(
      'erDiagram\nCUSTOMER {\n uuid id PK\n}\nORDER {\n uuid id PK\n}\nORDER }o--|| CUSTOMER : belongs',
      'mermaid',
    );
    const entities = reversed.slide.entities as { id: string; label: string }[];
    expect(reversed.slide.relationships).toEqual([
      {
        from: { entity: entities.find((e) => e.label === 'CUSTOMER')!.id },
        to: { entity: entities.find((e) => e.label === 'ORDER')!.id },
        kind: 'one-many',
      },
    ]);
  });
  it('imports uncompressed draw.io and reports replaced geometry', () => {
    const r = parseDiagram(
      '<mxGraphModel><root><mxCell id="a" value="Receive" vertex="1"/><mxCell id="b" value="Ship" vertex="1"/><mxCell id="e" source="a" target="b" edge="1"/></root></mxGraphModel>',
      'drawio',
    );
    expect(r.slide.nodes).toHaveLength(2);
    expect(r.slide.edges).toHaveLength(1);
    expect(r.ledger.omitted.some((v) => v.includes('coordinates'))).toBe(true);
  });
  it('imports bound Excalidraw text and arrows', () => {
    const r = parseDiagram(
      JSON.stringify({
        elements: [
          { id: 'a', type: 'rectangle' },
          { id: 'b', type: 'rectangle' },
          { id: 'ta', type: 'text', text: 'Receive', containerId: 'a' },
          { id: 'tb', type: 'text', text: 'Ship', containerId: 'b' },
          {
            id: 'e',
            type: 'arrow',
            startBinding: { elementId: 'a' },
            endBinding: { elementId: 'b' },
          },
        ],
      }),
      'excalidraw',
    );
    expect(r.slide.nodes).toHaveLength(2);
    expect(r.slide.edges).toHaveLength(1);
  });
  it('fails explicitly on unsupported grammar, oversized input and unbound connectors', () => {
    expect(() => parseDiagram('pie\n"A": 4', 'mermaid')).toThrow('Supported');
    expect(() => parseDiagram('x'.repeat(1024 * 1024 + 1), 'mermaid')).toThrow('1 MiB');
    expect(() => parseDiagram('sequenceDiagram\nloop retry\nA->>B: Call\nend', 'mermaid')).toThrow(
      'Unsupported',
    );
    expect(() => parseDiagram('<!DOCTYPE xml><mxGraphModel/>', 'drawio')).toThrow();
    expect(() =>
      parseDiagram(JSON.stringify({ elements: [{ id: 'e', type: 'arrow' }] }), 'excalidraw'),
    ).toThrow('bound');
  });
  it('writes a reviewable deck and ledger and refuses overwriting', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'sc-diagram-import-')),
      file = join(tmp, 'input.mmd');
    writeFileSync(file, 'flowchart LR\nA[Receive] --> B[Ship]');
    const result = importDiagram(file, join(tmp, 'deck'));
    expect(readFileSync(result.ledger, 'utf8')).toContain('preserved');
    expect(() => importDiagram(file, join(tmp, 'deck'))).toThrow('overwrite');
  });
});

it('exports native cubic paths, opacity and separate editable text into PPTX', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sc-native-diagrams-')),
    def = getLayout('sankey')!,
    ex = def.examples[0]!,
    file = join(tmp, 'deck.yaml');
  writeFileSync(
    file,
    YAML.stringify({
      schemaVersion: 1,
      id: 'export-check',
      title: 'Native quantity export',
      sources: [{ id: 'illustrative', title: 'Illustrative data', illustrative: true }],
      slides: [
        { id: 'flow', layout: def.id, title: ex.title, sources: ['illustrative'], ...ex.content },
      ],
    }),
  );
  const result = await buildDeck(file, {
    formats: ['pptx', 'html', 'pdf'],
    outDir: join(tmp, 'dist'),
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const zip = await JSZip.loadAsync(
      readFileSync(result.files.find((f) => f.kind === 'pptx')!.path),
    ),
    xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  expect(xml).toContain('<a:cubicBezTo>');
  expect(xml).toContain('<a:alpha val="30000"');
  expect(xml).toContain('Service effort');
  expect(xml).not.toContain('<p:pic>');
  const html = readFileSync(result.files.find((f) => f.kind === 'html')!.path, 'utf8');
  expect(html).toContain('fill-opacity="0.3"');
});

it('gives every native diagram a bounded public content contract', () => {
  for (const def of LAYOUTS.filter((l) => l.tags?.includes('diagram'))) {
    expect(def.schema.safeParse(def.examples[0]!.content).success).toBe(true);
    expect(def.purpose.startsWith('Use for')).toBe(true);
  }
});
