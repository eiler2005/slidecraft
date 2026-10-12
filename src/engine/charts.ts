/**
 * Chart geometry. One computation feeds both outputs:
 *  - native PPTX chart parameters (series, explicit axis, plot area), and
 *  - vector primitives for SVG/PDF/HTML (bars, labels, connectors).
 * Consulting conventions: no value axis, direct data labels, one highlight color,
 * everything else recedes.
 */
import type { ChartSpec } from '../layouts/types.ts';
import type { FontSpec, Theme } from '../spec/theme.ts';
import { mix } from './color.ts';
import { culture } from './i18n.ts';
import type { Box, ChartNode, ChartSeries, SceneNode, TextStyle } from './scene.ts';
import { layoutText, makeTextNode, para } from './text.ts';

export function niceStep(range: number, targetTicks = 5): number {
  if (range <= 0) return 1;
  const rough = range / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const n = rough / mag;
  const nice = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return nice * mag;
}

export function niceAxis(lo: number, hi: number): { min: number; max: number; major: number } {
  const min0 = Math.min(0, lo);
  const max0 = Math.max(0, hi);
  const step = niceStep(max0 - min0 || 1);
  const min = min0 < 0 ? Math.floor((min0 * 1.12) / step) * step : 0;
  // headroom so labels above bars stay inside the plot
  const max = max0 > 0 ? Math.ceil((max0 * 1.12) / step) * step : 0;
  return { min, max: max === min ? min + step : max, major: step };
}

/** Number in the deck language's convention ("1,234.5" in English, "1 234,5" in Russian). */
export function formatNumber(
  v: number,
  decimals = 0,
  unit = '',
  signed = false,
  language?: string,
): string {
  const abs = Math.abs(v);
  const s = abs.toLocaleString(culture(language), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = v < 0 ? '−' : signed && v > 0 ? '+' : '';
  return `${sign}${unit && /^[$€£¥]/.test(unit) ? unit : ''}${s}${unit && !/^[$€£¥]/.test(unit) ? unit : ''}`;
}

/** Excel number format code matching formatNumber; third section hides zeros. */
export function formatCode(decimals = 0, unit = ''): string {
  const d = decimals > 0 ? `.${'0'.repeat(decimals)}` : '';
  const pre = unit && /^[$€£¥]/.test(unit) ? `"${unit}"` : '';
  const post = unit && !/^[$€£¥]/.test(unit) ? `"${unit}"` : '';
  const base = `${pre}#,##0${d}${post}`;
  return `${base};-${base};;`;
}

interface Ctx {
  theme: Theme;
  font: FontSpec;
  language?: string;
}

function label(
  ctx: Ctx,
  text: string,
  box: Box,
  opts: {
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    color?: string;
    size?: number;
    bold?: boolean;
    role?: string;
  },
): SceneNode {
  const size = opts.size ?? ctx.theme.type.small;
  const style: TextStyle = {
    family: ctx.font.family,
    measure: ctx.font.measure,
    size,
    lineSpacing: +(size * 1.15).toFixed(2),
    color: opts.color ?? ctx.theme.colors.ink,
    bold: opts.bold ?? false,
    align: opts.align ?? 'center',
    valign: opts.valign ?? 'top',
  };
  const ps = [para(text)];
  const laid = layoutText(ps, style, box.w);
  return makeTextNode(ps, box, style, laid, { role: opts.role ?? 'chart-label' });
}

export function buildChart(spec: ChartSpec, box: Box, ctx: Ctx): ChartNode {
  const t = ctx.theme;
  const c = t.colors;
  const muted = mix(c.muted, c.background, 0.45);
  const small = t.type.small;
  const decimals = spec.decimals ?? 0;
  const unit = spec.unit ?? '';
  const num = (v: number, d: number, u: string, signed = false) =>
    formatNumber(v, d, u, signed, ctx.language);
  const n = spec.categories.length;
  const prims: SceneNode[] = [];
  const multi = spec.series.length > 1;
  const isBar = spec.type === 'bar' || spec.type === 'stacked-bar';
  const stacked = spec.type === 'stacked-column' || spec.type === 'stacked-bar';
  const legend = multi && spec.type !== 'waterfall';
  const legendH = legend ? 0.32 : 0;
  const catLabelH = isBar ? 0 : 0.42;
  const catLabelW = isBar ? Math.min(2.6, box.w * 0.28) : 0;
  const plot: Box = {
    x: box.x + catLabelW,
    y: box.y + legendH + 0.05,
    w: box.w - catLabelW - (isBar ? 0.6 : 0),
    h: box.h - legendH - catLabelH - 0.05,
  };

  // ---- series and value range ------------------------------------------------
  let series: ChartSeries[] = [];
  let lo = 0;
  let hi = 0;
  type Bar = {
    cat: number;
    lo: number;
    hi: number;
    color: string;
    label?: string;
    labelAt: 'top' | 'bottom' | 'inside';
  };
  const bars: Bar[] = [];
  const connectors: { cat: number; v: number }[] = [];

  if (spec.type === 'waterfall') {
    const deltas = spec.series[0]?.values ?? [];
    const totals = new Set(spec.highlight ?? []); // for waterfall, `highlight` lists total bars
    const base: number[] = [];
    const inc: number[] = [];
    const incNeg: number[] = [];
    const dec: number[] = [];
    const decNeg: number[] = [];
    const tot: number[] = [];
    let run = 0;
    deltas.forEach((d, i) => {
      let a: number;
      let b: number;
      if (totals.has(i)) {
        a = 0;
        b = d;
        run = d;
      } else {
        a = run;
        b = run + d;
        run = b;
      }
      const [l, h] = a < b ? [a, b] : [b, a];
      lo = Math.min(lo, l);
      hi = Math.max(hi, h);
      const isTot = totals.has(i);
      // stacked decomposition: positive stack from 0 up, negative stack from 0 down
      let bs = 0;
      let pos = 0;
      let neg = 0;
      if (l >= 0) {
        bs = l;
        pos = h - l;
      } else if (h <= 0) {
        bs = h;
        neg = l - h;
      } else {
        pos = h;
        neg = l;
      }
      base.push(isTot ? 0 : bs);
      tot.push(isTot ? pos + neg : 0);
      if (isTot) {
        inc.push(0);
        incNeg.push(0);
        dec.push(0);
        decNeg.push(0);
      } else if (d >= 0) {
        inc.push(pos);
        incNeg.push(neg);
        dec.push(0);
        decNeg.push(0);
      } else {
        inc.push(0);
        incNeg.push(0);
        dec.push(pos);
        decNeg.push(neg);
      }
      const color = isTot ? c.ink : d >= 0 ? c.positive : c.negative;
      bars.push({
        cat: i,
        lo: l,
        hi: h,
        color: isTot ? c.accent : color,
        label: num(d, decimals, unit, !isTot),
        labelAt: b >= a ? 'top' : 'bottom',
      });
      if (i < deltas.length - 1) connectors.push({ cat: i, v: run });
    });
    series = [
      { name: 'Base', values: base, color: c.background, invisible: true },
      { name: 'Increase', values: inc, color: c.positive },
      { name: 'Increase (below zero)', values: incNeg, color: c.positive },
      { name: 'Decrease', values: dec, color: c.negative },
      { name: 'Decrease (below zero)', values: decNeg, color: c.negative },
      { name: 'Total', values: tot, color: c.accent },
    ];
  } else if (!multi && spec.highlight?.length && spec.type !== 'line') {
    // One series with highlighted categories → two stacked series so native charts can color per point.
    const vals = spec.series[0]!.values;
    const hl = new Set(spec.highlight);
    series = [
      {
        name: `${spec.series[0]!.name}`,
        values: vals.map((v, i) => (hl.has(i) ? v : 0)),
        color: c.accent,
      },
      {
        name: `${spec.series[0]!.name} (other)`,
        values: vals.map((v, i) => (hl.has(i) ? 0 : v)),
        color: muted,
      },
    ];
    vals.forEach((v, i) => {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      bars.push({
        cat: i,
        lo: Math.min(0, v),
        hi: Math.max(0, v),
        color: hl.has(i) ? c.accent : muted,
        label: num(v, decimals, unit),
        labelAt: v >= 0 ? 'top' : 'bottom',
      });
    });
  } else {
    const palette = multi ? t.chart : [c.accent];
    series = spec.series.map((s, i) => ({
      name: s.name,
      values: s.values,
      color: palette[i % palette.length]!,
    }));
    if (stacked) {
      for (let i = 0; i < n; i++) {
        let p = 0;
        let q = 0;
        spec.series.forEach((s, si) => {
          const v = s.values[i] ?? 0;
          const [a, b] = v >= 0 ? [p, p + v] : [q + v, q];
          if (v >= 0) p += v;
          else q += v;
          bars.push({
            cat: i,
            lo: a,
            hi: b,
            color: series[si]!.color,
            label: num(v, decimals, unit),
            labelAt: 'inside',
          });
        });
        lo = Math.min(lo, q);
        hi = Math.max(hi, p);
      }
    } else {
      spec.series.forEach((s) => {
        s.values.forEach((v) => {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        });
      });
    }
  }

  const axis = niceAxis(lo, hi);
  const span = axis.max - axis.min || 1;

  // ---- vector primitives -----------------------------------------------------------
  const vy = (v: number) => plot.y + (plot.h * (axis.max - v)) / span;
  const vx = (v: number) => plot.x + (plot.w * (v - axis.min)) / span;
  const slot = (isBar ? plot.h : plot.w) / Math.max(1, n);
  const gap = spec.type === 'line' ? 0 : n > 8 ? 60 : 80;
  const groups =
    multi && !stacked && spec.type !== 'waterfall' && spec.type !== 'line' ? spec.series.length : 1;
  const thick = slot / (groups + gap / 100);

  if (spec.type === 'line') {
    spec.series.forEach((s, si) => {
      const color = series[si]!.color;
      const pts = s.values.map((v, i) => ({ x: plot.x + slot * (i + 0.5), y: vy(v), v }));
      for (let i = 1; i < pts.length; i++) {
        prims.push({
          kind: 'line',
          x1: pts[i - 1]!.x,
          y1: pts[i - 1]!.y,
          x2: pts[i]!.x,
          y2: pts[i]!.y,
          stroke: { color, width: 2.25 },
          role: 'chart-mark',
        });
      }
      pts.forEach((p, i) => {
        prims.push({
          kind: 'ellipse',
          box: { x: p.x - 0.045, y: p.y - 0.045, w: 0.09, h: 0.09 },
          fill: color,
          role: 'chart-mark',
        });
        const isLast = i === pts.length - 1;
        if (!multi || isLast) {
          prims.push(
            label(
              ctx,
              num(p.v, decimals, unit),
              { x: p.x - 0.5, y: p.y - 0.3, w: 1, h: 0.24 },
              { color: si === 0 ? c.ink : c.muted, size: small, bold: isLast },
            ),
          );
        }
      });
    });
  } else if (spec.type === 'waterfall' || stacked || !multi || spec.highlight?.length) {
    const list = bars.length
      ? bars
      : (spec.series[0]?.values ?? []).map((v, i) => ({
          cat: i,
          lo: Math.min(0, v),
          hi: Math.max(0, v),
          color: series[0]!.color,
          label: num(v, decimals, unit),
          labelAt: (v >= 0 ? 'top' : 'bottom') as Bar['labelAt'],
        }));
    list.forEach((b) => {
      if (isBar) {
        const y = plot.y + slot * b.cat + (slot - thick) / 2;
        const x1 = vx(b.lo);
        const x2 = vx(b.hi);
        prims.push({
          kind: 'rect',
          box: { x: x1, y, w: Math.max(0.005, x2 - x1), h: thick },
          fill: b.color,
          role: 'chart-mark',
        });
        if (b.labelAt === 'inside') {
          if (x2 - x1 > 0.45)
            prims.push(
              label(
                ctx,
                b.label!,
                { x: x1, y: y + thick / 2 - 0.12, w: x2 - x1, h: 0.24 },
                { color: mix(b.color, '#FFFFFF', 0.9), size: small },
              ),
            );
        } else if (b.label) {
          prims.push(
            label(
              ctx,
              b.label,
              { x: x2 + 0.06, y: y + thick / 2 - 0.12, w: 0.9, h: 0.24 },
              { align: 'left', size: small, bold: b.color === c.accent },
            ),
          );
        }
      } else {
        const x = plot.x + slot * b.cat + (slot - thick) / 2;
        const y1 = vy(b.hi);
        const y2 = vy(b.lo);
        prims.push({
          kind: 'rect',
          box: { x, y: y1, w: thick, h: Math.max(0.005, y2 - y1) },
          fill: b.color,
          role: 'chart-mark',
        });
        if (b.labelAt === 'inside') {
          if (y2 - y1 > 0.28)
            prims.push(
              label(
                ctx,
                b.label!,
                { x, y: (y1 + y2) / 2 - 0.12, w: thick, h: 0.24 },
                { color: '#FFFFFF', size: small },
              ),
            );
        } else if (b.label) {
          const ly = b.labelAt === 'top' ? y1 - 0.27 : y2 + 0.03;
          prims.push(
            label(
              ctx,
              b.label,
              { x: x - 0.2, y: ly, w: thick + 0.4, h: 0.24 },
              { size: small, bold: b.color === c.accent },
            ),
          );
        }
      }
    });
    if (stacked) {
      for (let i = 0; i < n; i++) {
        const total = spec.series.reduce((a, s) => a + (s.values[i] ?? 0), 0);
        const top = Math.max(0, ...bars.filter((b) => b.cat === i).map((b) => b.hi));
        if (isBar) {
          const y = plot.y + slot * i + slot / 2 - 0.12;
          prims.push(
            label(
              ctx,
              num(total, decimals, unit),
              { x: vx(top) + 0.06, y, w: 0.9, h: 0.24 },
              { align: 'left', size: small, bold: true, role: 'chart-total' },
            ),
          );
        } else {
          const x = plot.x + slot * i + (slot - thick) / 2;
          prims.push(
            label(
              ctx,
              num(total, decimals, unit),
              { x: x - 0.2, y: vy(top) - 0.27, w: thick + 0.4, h: 0.24 },
              { size: small, bold: true, role: 'chart-total' },
            ),
          );
        }
      }
    }
    connectors.forEach((k) => {
      const x1 = plot.x + slot * k.cat + (slot + thick) / 2;
      const x2 = plot.x + slot * (k.cat + 1) + (slot - thick) / 2;
      prims.push({
        kind: 'line',
        x1,
        y1: vy(k.v),
        x2,
        y2: vy(k.v),
        stroke: { color: c.muted, width: 0.75, dash: 'dash' },
        role: 'chart-connector',
      });
    });
  } else {
    // clustered multi-series
    spec.series.forEach((s, si) => {
      s.values.forEach((v, i) => {
        const color = series[si]!.color;
        if (isBar) {
          const y = plot.y + slot * i + (slot - thick * groups) / 2 + thick * si;
          const x1 = vx(Math.min(0, v));
          const x2 = vx(Math.max(0, v));
          prims.push({
            kind: 'rect',
            box: { x: x1, y, w: Math.max(0.005, x2 - x1), h: thick * 0.92 },
            fill: color,
            role: 'chart-mark',
          });
          prims.push(
            label(
              ctx,
              num(v, decimals, unit),
              { x: x2 + 0.05, y: y + thick / 2 - 0.12, w: 0.9, h: 0.24 },
              { align: 'left', size: small },
            ),
          );
        } else {
          const x = plot.x + slot * i + (slot - thick * groups) / 2 + thick * si;
          const y1 = vy(Math.max(0, v));
          const y2 = vy(Math.min(0, v));
          prims.push({
            kind: 'rect',
            box: { x, y: y1, w: thick * 0.92, h: Math.max(0.005, y2 - y1) },
            fill: color,
            role: 'chart-mark',
          });
          prims.push(
            label(
              ctx,
              num(v, decimals, unit),
              { x: x - 0.25, y: y1 - 0.27, w: thick + 0.5, h: 0.24 },
              { size: small },
            ),
          );
        }
      });
    });
  }

  // baseline at zero
  if (isBar) {
    const x0 = vx(0);
    prims.push({
      kind: 'line',
      x1: x0,
      y1: plot.y,
      x2: x0,
      y2: plot.y + plot.h,
      stroke: { color: c.rule, width: 0.75 },
      role: 'chart-axis',
    });
  } else {
    const y0 = vy(0);
    prims.push({
      kind: 'line',
      x1: plot.x,
      y1: y0,
      x2: plot.x + plot.w,
      y2: y0,
      stroke: { color: c.rule, width: 0.75 },
      role: 'chart-axis',
    });
  }

  // category labels
  spec.categories.forEach((cat, i) => {
    if (isBar) {
      const y = plot.y + slot * i;
      prims.push(
        label(
          ctx,
          cat,
          { x: box.x, y: y + slot / 2 - 0.17, w: catLabelW - 0.12, h: 0.34 },
          { align: 'right', valign: 'middle', color: c.ink, size: small, role: 'chart-cat' },
        ),
      );
    } else {
      prims.push(
        label(
          ctx,
          cat,
          { x: plot.x + slot * i, y: plot.y + plot.h + 0.06, w: slot, h: catLabelH - 0.06 },
          { color: c.muted, size: small, role: 'chart-cat' },
        ),
      );
    }
  });

  // legend
  if (legend) {
    let x = box.x + catLabelW;
    series.forEach((s) => {
      prims.push({
        kind: 'rect',
        box: { x, y: box.y + 0.08, w: 0.14, h: 0.14 },
        fill: s.color,
        role: 'chart-legend',
      });
      const w = 0.18 + s.name.length * 0.075;
      prims.push(
        label(
          ctx,
          s.name,
          { x: x + 0.2, y: box.y + 0.03, w, h: 0.24 },
          { align: 'left', color: c.muted, size: small, role: 'chart-legend' },
        ),
      );
      x += w + 0.45;
    });
  }

  return {
    kind: 'chart',
    box,
    type: spec.type,
    categories: spec.categories,
    series,
    axis: {
      min: axis.min,
      max: axis.max,
      major: axis.major,
      format: formatCode(decimals, unit),
      hidden: true,
    },
    labels: { show: true, format: formatCode(decimals, unit), size: small, color: c.ink },
    catLabels: { size: small, color: isBar ? c.ink : c.muted },
    font: ctx.font,
    gapWidth: gap,
    legend,
    plot,
    // Stacked tricks (waterfall, per-category highlight) cannot place labels outside bars natively.
    nativeLabels:
      spec.type !== 'waterfall' && !(!multi && !!spec.highlight?.length && spec.type !== 'line'),
    nativeCatLabels: true,
    barDir: isBar ? 'bar' : 'col',
    grouping:
      stacked || spec.type === 'waterfall' || (!multi && !!spec.highlight?.length)
        ? 'stacked'
        : 'clustered',
    primitives: prims,
    ...(spec.field ? { pointer: spec.field } : {}),
  };
}
