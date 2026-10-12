/**
 * SVG path data → absolute move/line/cubic/close segments, the subset every engine can draw:
 * SVG and PDF take it as path data, PowerPoint as a freeform (custGeom) with
 * moveTo/lnTo/cubicBezTo/close. Relative commands, H/V, S/Q/T and elliptical arcs are
 * converted here, once.
 */

export type PathSeg =
  | { op: 'M'; x: number; y: number }
  | { op: 'L'; x: number; y: number }
  | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: 'Z' };

const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokens(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;
  for (const m of d.matchAll(re)) out.push(m[1] ?? Number(m[2]));
  return out;
}

/** Arc flags may be written without separators ("a1 1 0 01-2 0"); split them. */
function arcArgs(list: (string | number)[], i: number): { args: number[]; next: number } {
  const args: number[] = [];
  let k = i;
  while (args.length < 7 && k < list.length && typeof list[k] === 'number') {
    const v = list[k] as number;
    if ((args.length === 3 || args.length === 4) && v > 1) {
      // concatenated flags such as "01" or "11-2"
      const s = String(v);
      args.push(Number(s[0]));
      if (args.length === 4 && s.length > 1) args.push(Number(s[1]));
      if (s.length > 2) args.push(Number(s.slice(2)));
      k++;
      continue;
    }
    args.push(v);
    k++;
  }
  return { args, next: k };
}

/** One elliptical arc as cubic segments (SVG implementation notes, F.6.5). */
function arcToCubics(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  rot: number,
  large: number,
  sweep: number,
  x: number,
  y: number,
): PathSeg[] {
  if (rx === 0 || ry === 0) return [{ op: 'L', x, y }];
  if (x0 === x && y0 === y) return [];
  const phi = (rot * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t: number) => {
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy] as const;
  };
  const deriv = (t: number) => {
    const ex = -rx * Math.sin(t);
    const ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey] as const;
  };
  const out: PathSeg[] = [];
  for (let i = 0; i < n; i++) {
    const a = t1 + i * step;
    const b = a + step;
    const [ax, ay] = point(a);
    const [bx, by] = i === n - 1 ? [x, y] : point(b);
    const [dax, day] = deriv(a);
    const [dbx, dby] = deriv(b);
    out.push({
      op: 'C',
      x1: ax + k * dax,
      y1: ay + k * day,
      x2: bx - k * dbx,
      y2: by - k * dby,
      x: bx,
      y: by,
    });
  }
  return out;
}

/** Parse path data into absolute M/L/C/Z segments. */
export function parsePath(d: string): PathSeg[] {
  const list = tokens(d);
  const out: PathSeg[] = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastC: [number, number] | undefined; // reflected control point for S
  let lastQ: [number, number] | undefined; // for T
  let i = 0;
  let cmd = '';
  while (i < list.length) {
    if (typeof list[i] === 'string') cmd = list[i++] as string;
    else if (!cmd) throw new Error(`path data must start with a command: ${d.slice(0, 20)}`);
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    if (up === 'Z') {
      out.push({ op: 'Z' });
      x = sx;
      y = sy;
      lastC = lastQ = undefined;
      continue;
    }
    let args: number[];
    if (up === 'A') {
      const r = arcArgs(list, i);
      args = r.args;
      i = r.next;
    } else {
      args = list.slice(i, i + ARGS[up]!) as number[];
      i += ARGS[up]!;
    }
    if (args.length < ARGS[up]! || args.some((v) => typeof v !== 'number'))
      throw new Error(`bad arguments for ${cmd} in path`);
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (up) {
      case 'M':
        x = ox + args[0]!;
        y = oy + args[1]!;
        sx = x;
        sy = y;
        out.push({ op: 'M', x, y });
        cmd = rel ? 'l' : 'L'; // further pairs are line-tos
        lastC = lastQ = undefined;
        break;
      case 'L':
        x = ox + args[0]!;
        y = oy + args[1]!;
        out.push({ op: 'L', x, y });
        lastC = lastQ = undefined;
        break;
      case 'H':
        x = (rel ? x : 0) + args[0]!;
        out.push({ op: 'L', x, y });
        lastC = lastQ = undefined;
        break;
      case 'V':
        y = (rel ? y : 0) + args[0]!;
        out.push({ op: 'L', x, y });
        lastC = lastQ = undefined;
        break;
      case 'C': {
        const s: PathSeg = {
          op: 'C',
          x1: ox + args[0]!,
          y1: oy + args[1]!,
          x2: ox + args[2]!,
          y2: oy + args[3]!,
          x: ox + args[4]!,
          y: oy + args[5]!,
        };
        out.push(s);
        lastC = [s.x2, s.y2];
        lastQ = undefined;
        x = s.x;
        y = s.y;
        break;
      }
      case 'S': {
        const [x1, y1] = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
        const s: PathSeg = {
          op: 'C',
          x1,
          y1,
          x2: ox + args[0]!,
          y2: oy + args[1]!,
          x: ox + args[2]!,
          y: oy + args[3]!,
        };
        out.push(s);
        lastC = [s.x2, s.y2];
        lastQ = undefined;
        x = s.x;
        y = s.y;
        break;
      }
      case 'Q':
      case 'T': {
        const [qx, qy] =
          up === 'Q'
            ? [ox + args[0]!, oy + args[1]!]
            : lastQ
              ? [2 * x - lastQ[0], 2 * y - lastQ[1]]
              : [x, y];
        const [ex, ey] =
          up === 'Q' ? [ox + args[2]!, oy + args[3]!] : [ox + args[0]!, oy + args[1]!];
        out.push({
          op: 'C',
          x1: x + (2 / 3) * (qx - x),
          y1: y + (2 / 3) * (qy - y),
          x2: ex + (2 / 3) * (qx - ex),
          y2: ey + (2 / 3) * (qy - ey),
          x: ex,
          y: ey,
        });
        lastQ = [qx, qy];
        lastC = undefined;
        x = ex;
        y = ey;
        break;
      }
      case 'A': {
        const ex = ox + args[5]!;
        const ey = oy + args[6]!;
        out.push(...arcToCubics(x, y, args[0]!, args[1]!, args[2]!, args[3]!, args[4]!, ex, ey));
        x = ex;
        y = ey;
        lastC = lastQ = undefined;
        break;
      }
    }
  }
  return out;
}

/** Scale and move segments: (x, y) → (x·s + dx, y·s + dy). */
export function transformPath(segs: PathSeg[], s: number, dx: number, dy: number): PathSeg[] {
  return segs.map((g) =>
    g.op === 'Z'
      ? g
      : g.op === 'C'
        ? {
            op: 'C',
            x1: g.x1 * s + dx,
            y1: g.y1 * s + dy,
            x2: g.x2 * s + dx,
            y2: g.y2 * s + dy,
            x: g.x * s + dx,
            y: g.y * s + dy,
          }
        : { op: g.op, x: g.x * s + dx, y: g.y * s + dy },
  );
}

/** Path data for SVG and PDF, in the given unit scale (e.g. px per inch). */
export function pathData(segs: PathSeg[], scale = 1): string {
  const f = (v: number) => +(v * scale).toFixed(3);
  return segs
    .map((g) =>
      g.op === 'Z'
        ? 'Z'
        : g.op === 'C'
          ? `C${f(g.x1)} ${f(g.y1)} ${f(g.x2)} ${f(g.y2)} ${f(g.x)} ${f(g.y)}`
          : `${g.op}${f(g.x)} ${f(g.y)}`,
    )
    .join('');
}

/** Bounding box of the end and control points (enough for layout and QA). */
export function pathBounds(segs: PathSeg[]): { x: number; y: number; w: number; h: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const g of segs) {
    if (g.op === 'Z') continue;
    xs.push(g.x);
    ys.push(g.y);
    if (g.op === 'C') {
      xs.push(g.x1, g.x2);
      ys.push(g.y1, g.y2);
    }
  }
  if (!xs.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
