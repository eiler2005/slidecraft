import { segmentHitsBox } from '../engine/diagram-routing.ts';
import type { SceneNode } from '../engine/scene.ts';
import { type Diagnostic, diag } from './codes.ts';

/** Graph-only checks: quantitative curves never inherit the connector grammar. */
export function checkDiagrams(nodes: SceneNode[], slide: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const n of nodes)
    if ((n.kind === 'rect' || n.kind === 'path') && n.encoding) {
      const { dimension, value, scale } = n.encoding,
        expected = value * scale;
      let actual = dimension === 'area' ? n.box.w * n.box.h : n.box.h;
      if (dimension === 'ribbon' && n.kind === 'path') {
        const [a, b, c, d] = n.segments;
        if (
          a?.op !== 'M' ||
          b?.op !== 'C' ||
          c?.op !== 'L' ||
          d?.op !== 'C' ||
          Math.abs(c.y - b.y - (d.y - a.y)) > 1e-7
        )
          actual = NaN;
        else actual = c.y - b.y;
      }
      if (
        !Number.isFinite(expected) ||
        !Number.isFinite(actual) ||
        value < 0 ||
        scale <= 0 ||
        Math.abs(actual - expected) > Math.max(1e-8, Math.abs(expected) * 1e-6)
      )
        out.push(
          diag('SC-DIAGRAM-001', 'Drawn quantity disagrees with its data scale', {
            slide,
            ...('pointer' in n && n.pointer ? { pointer: n.pointer } : {}),
          }),
        );
    }
  const graphNodes = nodes.filter(
    (n) =>
      (n.kind === 'rect' || n.kind === 'polygon' || n.kind === 'ellipse') &&
      n.diagram?.kind === 'node',
  );
  const ids = new Set<string>();
  for (const n of graphNodes)
    if ((n.kind === 'rect' || n.kind === 'polygon' || n.kind === 'ellipse') && n.diagram) {
      if (ids.has(n.diagram.id))
        out.push(diag('SC-DIAGRAM-001', `Duplicate diagram node ${n.diagram.id}`, { slide }));
      ids.add(n.diagram.id);
    }
  for (const n of nodes)
    if (n.kind === 'path' && n.diagram?.kind === 'edge') {
      const e = n.diagram,
        route = e.route ?? [];
      const issue = (message: string) =>
        out.push(
          diag('SC-DIAGRAM-001', message, { slide, ...(n.pointer ? { pointer: n.pointer } : {}) }),
        );
      if (!e.from || !e.to || !ids.has(e.from) || !ids.has(e.to)) {
        issue('Connector has an unknown endpoint');
        continue;
      }
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1]!,
          b = route[i]!;
        if (Math.abs(a[0] - b[0]) > 1e-6 && Math.abs(a[1] - b[1]) > 1e-6)
          issue('Graph connector must use an orthogonal route');
        for (const node of graphNodes)
          if (
            (node.kind === 'rect' || node.kind === 'polygon' || node.kind === 'ellipse') &&
            node.diagram?.id !== e.from &&
            node.diagram?.id !== e.to &&
            segmentHitsBox(a, b, node.box)
          )
            issue('Connector crosses a non-endpoint node; reroute or split the diagram');
      }
    }
  return out;
}
