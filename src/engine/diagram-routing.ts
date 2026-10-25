/** Bounded orthogonal routing with obstacle clearance; never removes an edge to fit. */

import type { Point } from './diagram-geometry.ts';
import type { Box } from './scene.ts';
import type { PathSeg } from './svg-path.ts';

const EPS = 1e-7;
export function segmentHitsBox(a: Point, b: Point, box: Box): boolean {
  if (Math.abs(a[0] - b[0]) < EPS)
    return (
      a[0] > box.x + EPS &&
      a[0] < box.x + box.w - EPS &&
      Math.max(a[1], b[1]) > box.y + EPS &&
      Math.min(a[1], b[1]) < box.y + box.h - EPS
    );
  if (Math.abs(a[1] - b[1]) < EPS)
    return (
      a[1] > box.y + EPS &&
      a[1] < box.y + box.h - EPS &&
      Math.max(a[0], b[0]) > box.x + EPS &&
      Math.min(a[0], b[0]) < box.x + box.w - EPS
    );
  return true;
}

const inflate = (b: Box, d: number): Box => ({
  x: b.x - d,
  y: b.y - d,
  w: b.w + 2 * d,
  h: b.h + 2 * d,
});
const inside = (p: Point, b: Box) =>
  p[0] > b.x + EPS && p[0] < b.x + b.w - EPS && p[1] > b.y + EPS && p[1] < b.y + b.h - EPS;

export function routeOrthogonal(start: Point, end: Point, obstacles: Box[], region: Box): Point[] {
  const blocks = obstacles.map((b) => inflate(b, 0.06));
  const coordinates = (axis: 0 | 1) =>
    [
      ...new Set(
        [
          start[axis],
          end[axis],
          axis === 0 ? region.x + 0.02 : region.y + 0.02,
          axis === 0 ? region.x + region.w - 0.02 : region.y + region.h - 0.02,
          ...blocks.flatMap((b) => (axis === 0 ? [b.x, b.x + b.w] : [b.y, b.y + b.h])),
        ].filter(
          (v) =>
            v >= (axis === 0 ? region.x : region.y) - EPS &&
            v <= (axis === 0 ? region.x + region.w : region.y + region.h) + EPS,
        ),
      ),
    ].sort((a, b) => a - b);
  const xs = coordinates(0),
    ys = coordinates(1);
  const points: Point[] = xs.flatMap((x) => ys.map((y): Point => [x, y]));
  const valid = points.map((p) => !blocks.some((b) => inside(p, b)));
  const index = (p: Point) => xs.indexOf(p[0]) * ys.length + ys.indexOf(p[1]);
  const first = index(start),
    last = index(end);
  const dist = Array(points.length).fill(Infinity) as number[];
  const prev = Array(points.length).fill(-1) as number[];
  const done = new Set<number>();
  dist[first] = 0;
  for (;;) {
    let best = -1;
    for (let i = 0; i < points.length; i++)
      if (valid[i] && !done.has(i) && (best < 0 || dist[i]! < dist[best]!)) best = i;
    if (best < 0 || !Number.isFinite(dist[best]!))
      throw new Error('No clear connector route; enlarge the region or split the diagram');
    if (best === last) break;
    done.add(best);
    const xi = Math.floor(best / ys.length),
      yi = best % ys.length;
    const candidates = [
      xi > 0 ? best - ys.length : -1,
      xi + 1 < xs.length ? best + ys.length : -1,
      yi > 0 ? best - 1 : -1,
      yi + 1 < ys.length ? best + 1 : -1,
    ];
    for (const next of candidates) {
      if (next < 0 || !valid[next] || done.has(next)) continue;
      const a = points[best]!,
        b = points[next]!;
      if (blocks.some((box) => segmentHitsBox(a, b, box))) continue;
      const d = dist[best]! + Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      if (d < dist[next]! - EPS) {
        dist[next] = d;
        prev[next] = best;
      }
    }
  }
  const path: Point[] = [];
  for (let i = last; i >= 0; i = prev[i]!) {
    path.unshift(points[i]!);
    if (i === first) break;
  }
  return path.filter(
    (p, i) =>
      i === 0 ||
      i === path.length - 1 ||
      !(
        (Math.abs(path[i - 1]![0] - p[0]) < EPS && Math.abs(path[i + 1]![0] - p[0]) < EPS) ||
        (Math.abs(path[i - 1]![1] - p[1]) < EPS && Math.abs(path[i + 1]![1] - p[1]) < EPS)
      ),
  );
}

/** Rounded corners are shared by SVG, PDF and editable PowerPoint freeforms. */
export function roundedRoute(points: Point[], radius = 0.06): PathSeg[] {
  const out: PathSeg[] = [{ op: 'M', x: points[0]![0], y: points[0]![1] }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!,
      c = points[i + 1];
    if (!c) {
      out.push({ op: 'L', x: b[0], y: b[1] });
      continue;
    }
    const l0 = Math.hypot(b[0] - a[0], b[1] - a[1]),
      l1 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(radius, l0 / 2, l1 / 2);
    if (!r) continue;
    const p: Point = [b[0] - ((b[0] - a[0]) * r) / l0, b[1] - ((b[1] - a[1]) * r) / l0];
    const q: Point = [b[0] + ((c[0] - b[0]) * r) / l1, b[1] + ((c[1] - b[1]) * r) / l1];
    out.push(
      { op: 'L', x: p[0], y: p[1] },
      { op: 'C', x1: b[0], y1: b[1], x2: b[0], y2: b[1], x: q[0], y: q[1] },
    );
  }
  return out;
}
