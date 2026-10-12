/**
 * PPTX engine on pptxgenjs (MIT). Everything content-bearing is native and editable:
 * text boxes (zero insets, exact line spacing, no autofit), tables, charts and
 * speaker notes. Decor is a rasterised background image on the slide master.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import pptxgenModule from 'pptxgenjs';
import { chartAlt } from '../engine/alt.ts';
import { niceStep } from '../engine/charts.ts';
import { culture } from '../engine/i18n.ts';
import type {
  ChartNode,
  Master,
  Scene,
  SceneNode,
  Stroke,
  TextNode,
  TextStyle,
} from '../engine/scene.ts';
import { in2pt } from '../engine/scene.ts';
import { spacingMultiple } from '../engine/text.ts';
import { VERSION } from '../paths.ts';
import { pngSize } from '../qa/pptx-verify.ts';
import { markDecorative, markTitle, shapeName, titleFirst } from './pptx-a11y.ts';
import { applyTemplate } from './pptx-template.ts';
import { rasterize } from './resvg.ts';
import type { Engine } from './types.ts';

// biome-ignore lint/suspicious/noExplicitAny: pptxgenjs option bags are loosely typed
type Any = any;
// pptxgenjs ships CJS + ESM builds with different default-export shapes; normalise.
const PptxGenJS: new () => Any = (pptxgenModule as Any).default ?? pptxgenModule;
type Pptx = Any;
type Slide = Any;

const hex = (c: string) => c.replace('#', '').toUpperCase();

/** Automatic stays automatic, multiples stay multiples; see spacingMultiple(). */
function lineSpacingOptions(style: TextStyle) {
  if (style.lineSpacingAuto) return {};
  const multiple = spacingMultiple(style);
  return multiple !== undefined
    ? { lineSpacingMultiple: multiple }
    : { lineSpacing: style.lineSpacing };
}

/** PowerPoint writes a preset line with a 1-EMU slope ("cx 1 l"), so renderers anti-alias
 * it across 2-3 device pixels while native table borders stay crisp. An axis-aligned line
 * without arrowheads becomes a one-segment freeform with the same box: still an editable
 * vector line, drawn exactly horizontal or vertical. */
export function crispAxisLines(xml: string): string {
  return xml.replace(
    /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<a:prstGeom prst="line">[\s\S]*?<\/p:sp>/g,
    (sp) => {
      if (/<a:(?:headEnd|tailEnd)\b/.test(sp)) return sp;
      const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp);
      if (!ext) return sp;
      const [w, h] = [ext[1]!, ext[2]!];
      if (w !== '0' && h !== '0') return sp;
      const geom = `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${w}" h="${h}" fill="none"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="${w}" y="${h}"/></a:lnTo></a:path></a:pathLst></a:custGeom>`;
      return sp.replace(/<a:prstGeom prst="line">[\s\S]*?<\/a:prstGeom>/, geom);
    },
  );
}

/** PowerPoint sizes a line with its paragraph mark too. pptxgenjs writes the mark without
 * the run's typeface/weight, so the theme font could push a baseline down by ~1 pt. Give
 * every mark the properties of the paragraph's last run (minus its hyperlink). */
export function endMarkLikeLastRun(xml: string): string {
  return xml.replace(/<a:p>[\s\S]*?<\/a:p>/g, (p) => {
    const runs = [...p.matchAll(/<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/g)];
    const last = runs.at(-1)?.[0];
    if (!last || !/<a:endParaRPr\b/.test(p)) return p;
    const mark = last
      .replace(/<a:hlinkClick\b[^>]*?(?:\/>|>[\s\S]*?<\/a:hlinkClick>)/g, '')
      .replace(/^<a:rPr\b/, '<a:endParaRPr')
      .replace(/<\/a:rPr>$/, '</a:endParaRPr>');
    return p.replace(/<a:endParaRPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:endParaRPr>)/, mark);
  });
}

// pptxgenjs' fixed axis ids
const SECONDARY_VAL_AXIS = '2094734553';
const SERIES_AXIS = '2094734556';

/** Name of freeforms drawn with round caps and joins (icons). */
export const ROUND_SHAPE = 'Icon';

/** Give icon freeforms round caps and joins, as their SVG source draws them. */
export function roundIconStrokes(xml: string): string {
  if (!xml.includes(`name="${ROUND_SHAPE}"`)) return xml;
  return xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (sp) =>
    sp.includes(`name="${ROUND_SHAPE}"`)
      ? sp.replace(
          /<a:ln\b([^>]*)>([\s\S]*?)<\/a:ln>/,
          (_, attrs: string, body: string) =>
            `<a:ln${attrs.replace(/\s+cap="[^"]*"/, '')} cap="rnd">${body.replace(/<a:(?:round|miter|bevel)\b[^>]*\/>/g, '')}<a:round/></a:ln>`,
        )
      : sp,
  );
}

/** pptxgenjs writes multi-line notes as one run with raw line feeds; PowerPoint wants one
 * paragraph per line, so the notes pane shows the [Sources] block line by line. */
export function notesParagraphs(xml: string): string {
  return xml.replace(
    /<a:p><a:r>(<a:rPr\b[^>]*\/>)<a:t>([^<]*\n[^<]*)<\/a:t><\/a:r>(<a:endParaRPr\b[^>]*\/>)?<\/a:p>/g,
    (_, rPr: string, text: string, end = '') =>
      text
        .split(/\r?\n/)
        .map((line) =>
          line
            ? `<a:p><a:r>${rPr}<a:t>${line}</a:t></a:r>${end}</a:p>`
            : `<a:p>${end || rPr.replace(/^<a:rPr\b/, '<a:endParaRPr')}</a:p>`,
        )
        .join(''),
  );
}

/** pptxgenjs marks every run en-US, so PowerPoint would spell-check a Russian deck as
 * English and underline every word. Text, notes and charts take the deck's culture
 * (Latin, East Asian and complex-script runs alike); `altLang` stays as written. */
export function proofingLanguage(xml: string, culture: string): string {
  if (culture === 'en-US') return xml;
  return xml.replace(
    /(<a:(?:rPr|endParaRPr|defRPr)\b[^>]*?\s)lang="en-US"/g,
    `$1lang="${culture}"`,
  );
}

/**
 * Resolve CSS-only generic aliases. A named family such as Apple's `System Font`
 * is not an alias: preserve it rather than silently changing the reference font.
 * Font availability on the viewing machine still needs an Office render check.
 */
export function pptFontFace(family: string): string {
  return /^(system-ui|-apple-system|blinkmacsystemfont)$/i.test(family.trim()) ? 'Arial' : family;
}

function lineProps(s?: Stroke): Any {
  if (!s) return { type: 'none' };
  return {
    color: hex(s.color),
    width: s.width,
    dashType: s.dash === 'dash' ? 'dash' : s.dash === 'dot' ? 'sysDot' : 'solid',
  };
}

export function textRuns(t: TextNode): Any[] {
  const out: Any[] = [];
  t.paragraphs.forEach((p, pi) => {
    const last = pi === t.paragraphs.length - 1;
    const runs = p.runs.length ? p.runs : [{ text: '' }];
    runs.forEach((r, ri) => {
      const o: Any = {
        bold: r.bold ?? t.style.bold ?? false,
        italic: r.italic ?? t.style.italic ?? false,
        ...(r.underline !== undefined ? { underline: r.underline } : {}),
        color: hex(r.color ?? t.style.color),
        // pptxgenjs starts a new paragraph whenever `align` changes between runs,
        // so every run carries the same value; `bullet` only on the first run.
        align: t.style.align,
      };
      if (r.link) o.hyperlink = { url: r.link, tooltip: r.link };
      if (ri === 0) {
        if (p.bullet) o.bullet = { indent: t.bulletIndent };
        if (pi > 0 && p.spaceBefore) o.paraSpaceBefore = p.spaceBefore;
      }
      if (ri === runs.length - 1 && !last) o.breakLine = true;
      out.push({ text: r.text, options: o });
    });
  });
  return out;
}

function textOpts(t: TextNode, slideId?: string): Any {
  const name = shapeName(t, slideId);
  const box = t.textFrame?.box ?? t.box;
  const pad = t.textFrame?.insets;
  return {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    // pptxgenjs shape text uses [left, right, bottom, top], unlike its tables.
    margin: pad ? [pad.l * 72, pad.r * 72, pad.b * 72, pad.t * 72] : 0,
    fontFace: pptFontFace(t.style.family),
    fontSize: t.style.size,
    color: hex(t.style.color),
    ...lineSpacingOptions(t.style),
    valign: t.textFrame?.valign ?? t.style.valign,
    align: t.style.align,
    fit: 'none',
    wrap: true,
    isTextBox: t.textFrame?.isTextBox ?? true,
    // the action title becomes the slide's title placeholder in post-processing;
    // field text boxes are named after their field so `slidecraft sync` can map edits back
    ...(name ? { objectName: name } : {}),
  };
}

function addText(slide: Slide, t: TextNode, slideId?: string) {
  slide.addText(textRuns(t), textOpts(t, slideId));
}

function chartType(pptx: Pptx, n: ChartNode): Any {
  return n.type === 'line' ? pptx.ChartType.line : pptx.ChartType.bar;
}

function addChart(pptx: Pptx, slide: Slide, n: ChartNode) {
  const data = n.series.map((s) => ({ name: s.name, labels: n.categories, values: s.values }));
  const b = n.box;
  const opts: Any = {
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    altText: chartAlt(n),
    layout: {
      x: (n.plot.x - b.x) / b.w,
      y: (n.plot.y - b.y) / b.h,
      w: n.plot.w / b.w,
      h: n.plot.h / b.h,
    },
    chartColors: n.series.map((s) => hex(s.color)),
    valAxisHidden: true,
    valGridLine: { style: 'none' },
    valAxisMinVal: n.axis.min,
    valAxisMaxVal: n.axis.max,
    valAxisMajorUnit: n.axis.major,
    valAxisLineShow: false,
    catAxisLabelFontSize: n.catLabels.size,
    catAxisLabelColor: hex(n.catLabels.color),
    catAxisLabelFontFace: pptFontFace(n.font.family),
    catAxisLineShow: true,
    catAxisLineColor: 'C9D2DE',
    catGridLine: { style: 'none' },
    catAxisMajorTickMark: 'none',
    catAxisMinorTickMark: 'none',
    valAxisMajorTickMark: 'none',
    showLegend: n.legend,
    legendPos: 't',
    legendFontSize: n.catLabels.size,
    legendFontFace: pptFontFace(n.font.family),
    showValue: n.nativeLabels,
    dataLabelFormatCode: n.labels.format,
    dataLabelFontSize: n.labels.size,
    dataLabelFontFace: n.font.family,
    dataLabelColor: hex(n.labels.color),
    showTitle: false,
  };
  if (n.type === 'line') {
    Object.assign(opts, {
      lineSize: 2.25,
      lineDataSymbol: 'circle',
      lineDataSymbolSize: 6,
      dataLabelPosition: 't',
    });
  } else {
    Object.assign(opts, {
      barDir: n.barDir,
      barGrouping: n.grouping,
      barGapWidthPct: n.gapWidth,
      dataLabelPosition: n.grouping === 'stacked' ? 'ctr' : 'outEnd',
    });
    if (n.barDir === 'bar') opts.catAxisOrientation = 'maxMin';
    if (n.grouping === 'stacked') {
      opts.barOverlap = 100;
      // segment labels on dark fills read better in white
      if (n.type === 'stacked-column' || n.type === 'stacked-bar') opts.dataLabelColor = 'FFFFFF';
    }
  }
  if (n.type === 'combo' && n.lineAxis) {
    // bars on the primary axis, the line on a secondary one; both hidden, labels overlaid
    const [bars, line] = n.series as [ChartNode['series'][0], ChartNode['series'][0]];
    const hiddenVal = (min: number, max: number) => ({
      valAxisHidden: true,
      valAxisMinVal: min,
      valAxisMaxVal: max,
      valAxisMajorUnit: niceStep(max - min),
      valGridLine: { style: 'none' },
      valAxisLineShow: false,
      valAxisMajorTickMark: 'none',
    });
    Object.assign(opts, {
      showValue: false,
      showLegend: false,
      // PowerPoint plots a series against a deleted value axis as if it were the other
      // axis: keep both axes, invisible (no labels, line or ticks).
      valAxes: [
        { ...hiddenVal(n.axis.min, n.axis.max), valAxisHidden: false, valAxisLabelPos: 'none' },
        {
          ...hiddenVal(n.lineAxis.min, n.lineAxis.max),
          valAxisHidden: false,
          valAxisLabelPos: 'none',
        },
      ],
      catAxes: [{}, { catAxisHidden: true }],
    });
    slide.addChart(
      [
        {
          type: pptx.ChartType.bar,
          data: [{ name: bars.name, labels: n.categories, values: bars.values }],
          options: {
            barDir: 'col',
            barGrouping: 'clustered',
            barGapWidthPct: n.gapWidth,
            dataLabelPosition: 'outEnd',
            chartColors: [hex(bars.color)],
          },
        },
        {
          type: pptx.ChartType.line,
          data: [{ name: line.name, labels: n.categories, values: line.values }],
          options: {
            chartColors: [hex(line.color)],
            lineSize: 2.25,
            lineDataSymbol: 'circle',
            lineDataSymbolSize: 6,
            // line charts accept t/b/l/r/ctr only; outEnd (inherited from bars) corrupts the chart
            dataLabelPosition: 't',
            secondaryValAxis: true,
            secondaryCatAxis: true,
          },
        },
      ] as Any,
      opts,
    );
  } else slide.addChart(chartType(pptx, n), data, opts);
  // Overlays computed by the engine where native charts cannot express them.
  for (const p of n.primitives) {
    const role = (p as { role?: string }).role;
    const overlay =
      (!n.nativeLabels && (role === 'chart-label' || role === 'chart-connector')) ||
      role === 'chart-total' ||
      (n.type === 'combo' && role === 'chart-legend');
    if (overlay) addNode(pptx, slide, p);
  }
}

async function addImage(slide: Slide, n: Extract<SceneNode, { kind: 'image' }>) {
  const { x, y, w, h } = n.box;
  if (n.svg) {
    const png = await rasterize(n.svg, Math.min(2400, w * 180));
    slide.addImage({
      data: `image/png;base64,${png.toString('base64')}`,
      x,
      y,
      w,
      h,
      altText: n.alt,
    });
    return;
  }
  if (n.path) {
    // pptxgenjs crops from the aspect of `w`/`h`, not of the file: give it the picture's own
    // proportions so cover/contain crop exactly like the HTML and PDF engines (otherwise the
    // photo is stretched to the box).
    const px = pngSize(readFileSync(n.path));
    const ih = px ? (w * px.h) / px.w : h;
    slide.addImage({
      path: n.path,
      x,
      y,
      w,
      h: ih,
      altText: n.alt,
      sizing: { type: n.fit === 'cover' ? 'cover' : 'contain', w, h },
    });
    return;
  }
  if (n.data) {
    slide.addImage({ data: `${n.data.mime};base64,${n.data.base64}`, x, y, w, h, altText: n.alt });
    return;
  }
  slide.addText(n.placeholderLabel ?? 'Image', {
    x,
    y,
    w,
    h,
    shape: 'rect',
    fill: { color: 'E9ECF0' },
    line: { color: 'AEB6C1', width: 0.75, dashType: 'dash' },
    fontFace: 'Arial',
    fontSize: 10,
    color: '6B7480',
    align: 'center',
    valign: 'middle',
    margin: 0,
  } as Any);
}

function addNode(pptx: Pptx, slide: Slide, n: SceneNode, slideId?: string): Promise<void> | void {
  switch (n.kind) {
    case 'text':
      return addText(slide, n, slideId);
    case 'rect': {
      const shape = n.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
      const o: Any = { x: n.box.x, y: n.box.y, w: n.box.w, h: n.box.h, line: lineProps(n.stroke) };
      const name = shapeName(n, slideId);
      if (name) o.objectName = name;
      o.fill = n.fill
        ? {
            color: hex(n.fill),
            transparency: n.fillOpacity !== undefined ? Math.round((1 - n.fillOpacity) * 100) : 0,
          }
        : { type: 'none' };
      // pptxgenjs expects inches, not a normalised fraction of the shape size.
      if (n.radius) o.rectRadius = Math.min(n.radius, Math.min(n.box.w, n.box.h) / 2);
      slide.addShape(shape, o);
      return;
    }
    case 'ellipse': {
      const o: Any = { x: n.box.x, y: n.box.y, w: n.box.w, h: n.box.h, line: lineProps(n.stroke) };
      const name = shapeName(n, slideId);
      if (name) o.objectName = name;
      o.fill = n.fill
        ? {
            color: hex(n.fill),
            transparency: n.fillOpacity !== undefined ? Math.round((1 - n.fillOpacity) * 100) : 0,
          }
        : { type: 'none' };
      slide.addShape(pptx.ShapeType.ellipse, o);
      return;
    }
    case 'polygon': {
      const { x, y, w, h } = n.box;
      const points: Any[] = n.points.map(([px, py], i) =>
        i === 0 ? { x: px - x, y: py - y, moveTo: true } : { x: px - x, y: py - y },
      );
      points.push({ close: true });
      const o: Any = {
        x,
        y,
        w: Math.max(0.001, w),
        h: Math.max(0.001, h),
        points,
        line: lineProps(n.stroke),
      };
      const name = shapeName(n, slideId);
      if (name) o.objectName = name;
      o.fill = n.fill
        ? {
            color: hex(n.fill),
            transparency: n.fillOpacity !== undefined ? Math.round((1 - n.fillOpacity) * 100) : 0,
          }
        : { type: 'none' };
      slide.addShape(pptx.ShapeType.custGeom, o);
      return;
    }
    case 'path': {
      const { x, y, w, h } = n.box;
      const points: Any[] = [];
      for (const g of n.segments) {
        if (g.op === 'Z') points.push({ close: true });
        else if (g.op === 'C')
          points.push({
            x: g.x - x,
            y: g.y - y,
            curve: { type: 'cubic', x1: g.x1 - x, y1: g.y1 - y, x2: g.x2 - x, y2: g.y2 - y },
          });
        else points.push({ x: g.x - x, y: g.y - y, ...(g.op === 'M' ? { moveTo: true } : {}) });
      }
      const o: Any = {
        x,
        y,
        w: Math.max(0.001, w),
        h: Math.max(0.001, h),
        points,
        line: lineProps(n.stroke),
        // round caps and joins are added in post-processing (pptxgenjs has no option)
        objectName: shapeName(n, slideId) ?? (n.round ? ROUND_SHAPE : 'Freeform'),
      };
      o.fill = n.fill ? { color: hex(n.fill) } : { type: 'none' };
      slide.addShape(pptx.ShapeType.custGeom, o);
      return;
    }
    case 'line': {
      const x = Math.min(n.x1, n.x2);
      const y = Math.min(n.y1, n.y2);
      const o: Any = {
        x,
        y,
        w: Math.abs(n.x2 - n.x1),
        h: Math.abs(n.y2 - n.y1),
        line: { ...lineProps(n.stroke), ...(n.arrowEnd ? { endArrowType: 'triangle' } : {}) },
      };
      const name = shapeName(n, slideId);
      if (name) o.objectName = name;
      // A preset line runs from the box's top-left to bottom-right; flips set its direction,
      // which decides where an arrowhead (tail end) goes.
      if (n.x2 < n.x1) o.flipH = true;
      if (n.y2 < n.y1) o.flipV = true;
      slide.addShape(pptx.ShapeType.line, o);
      return;
    }
    case 'image':
      return addImage(slide, n);
    case 'table': {
      const rows = n.cells.map((row) =>
        row.map((cell) => {
          const t = cell.text;
          const none = { type: 'none' };
          const b = (s?: Stroke) =>
            s ? { type: 'solid', pt: s.width, color: hex(s.color) } : none;
          return {
            text: textRuns(t),
            options: {
              fontFace: pptFontFace(t.style.family),
              fontSize: t.style.size,
              color: hex(t.style.color),
              bold: t.style.bold ?? false,
              align: t.style.align,
              valign: 'top',
              ...lineSpacingOptions(t.style),
              margin: [in2pt(n.pad.t), in2pt(n.pad.r), in2pt(n.pad.b), in2pt(n.pad.l)],
              fill: cell.fill ? { color: hex(cell.fill) } : { type: 'none' },
              border: [b(cell.borderTop), none, b(cell.borderBottom), none],
            },
          };
        }),
      );
      slide.addTable(
        rows as Any,
        { x: n.box.x, y: n.box.y, w: n.box.w, colW: n.colW, rowH: n.rowH, autoPage: false } as Any,
      );
      return;
    }
    case 'chart':
      return addChart(pptx, slide, n);
  }
}

async function defineMaster(pptx: Pptx, m: Master, scene: Scene) {
  const objects: Any[] = [];
  for (const n of m.nodes) {
    if (n.kind === 'image' && n.svg) {
      const png = await rasterize(n.svg, 2400);
      objects.push({
        image: {
          data: `image/png;base64,${png.toString('base64')}`,
          x: 0,
          y: 0,
          w: scene.format.w,
          h: scene.format.h,
        },
      });
    } else if (n.kind === 'image' && n.path) {
      objects.push({
        image: { path: n.path, x: n.box.x, y: n.box.y, w: n.box.w, h: n.box.h, altText: n.alt },
      });
    } else if (n.kind === 'text') {
      objects.push({
        text: {
          text: n.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n'),
          options: textOpts(n),
        },
      });
    } else if (n.kind === 'rect') {
      objects.push({
        rect: {
          x: n.box.x,
          y: n.box.y,
          w: n.box.w,
          h: n.box.h,
          fill: n.fill ? { color: hex(n.fill) } : { type: 'none' },
          line: lineProps(n.stroke),
        },
      });
    } else if (n.kind === 'ellipse') {
      objects.push({
        text: {
          text: '',
          options: {
            shape: 'ellipse',
            x: n.box.x,
            y: n.box.y,
            w: n.box.w,
            h: n.box.h,
            fill: n.fill ? { color: hex(n.fill) } : { type: 'none' },
            line: lineProps(n.stroke),
          },
        },
      });
    } else if (n.kind === 'line') {
      objects.push({
        line: {
          x: Math.min(n.x1, n.x2),
          y: Math.min(n.y1, n.y2),
          w: Math.abs(n.x2 - n.x1),
          h: Math.abs(n.y2 - n.y1),
          line: lineProps(n.stroke),
        },
      });
    }
  }
  const props: Any = { title: m.id, background: { color: hex(m.background) }, objects };
  if (m.slideNumber) {
    const s = m.slideNumber;
    props.slideNumber = {
      x: s.box.x,
      y: s.box.y,
      w: s.box.w,
      h: s.box.h,
      fontFace: pptFontFace(s.style.family),
      fontSize: s.style.size,
      color: hex(s.style.color),
      align: s.style.align,
      margin: 0,
    };
  }
  pptx.defineSlideMaster(props);
}

/** Re-zip with fixed timestamps and fixed docProps dates so builds are byte-reproducible. */
export async function normalizeZip(
  buf: Buffer,
  epoch: Date,
  opts: { officeTheme?: string; scene?: Scene } = {},
): Promise<Buffer> {
  const zin = await JSZip.loadAsync(buf);
  const zout = new JSZip();
  const iso = epoch.toISOString().replace(/\.\d{3}Z$/, 'Z');
  // pptxgenjs numbers charts with a process-global counter; renumber from 1 so the
  // output does not depend on how many decks this process built before.
  const renames = new Map<string, string>();
  for (const [re, fmt] of [
    [/^ppt\/charts\/chart(\d+)\.xml$/, (n: number) => `chart${n}.xml`],
    [
      /^ppt\/embeddings\/Microsoft_Excel_Worksheet(\d+)\.xlsx$/,
      (n: number) => `Microsoft_Excel_Worksheet${n}.xlsx`,
    ],
  ] as const) {
    const nums = Object.keys(zin.files)
      .map((n) => re.exec(n)?.[1])
      .filter((x): x is string => !!x)
      .map(Number)
      .sort((a, b) => a - b);
    nums.forEach((old, i) => {
      if (old !== i + 1) renames.set(fmt(old), fmt(i + 1));
    });
  }
  const rename = (s: string) => {
    if (!renames.size) return s;
    let out = s;
    for (const [from] of renames) out = out.split(from).join(`\u0000${from}\u0000`);
    for (const [from, to] of renames) out = out.split(`\u0000${from}\u0000`).join(to);
    return out;
  };
  const entries = Object.keys(zin.files)
    .map((o) => [o, rename(o)] as const)
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  for (const [original, name] of entries) {
    const f = zin.files[original]!;
    if (f.dir) continue;
    let data: string | Uint8Array = await f.async('uint8array');
    if (renames.size && /\.(xml|rels)$/.test(name))
      data = rename(Buffer.from(data).toString('utf8'));
    if (name.endsWith('.xlsx')) data = await normalizeZip(Buffer.from(data), epoch);
    if (/^ppt\/(slideLayouts|slideMasters)\/[^/]+\.xml$/.test(name))
      data = markDecorative(Buffer.from(data).toString('utf8'));
    if (/^ppt\/notesSlides\/[^/]+\.xml$/.test(name))
      data = notesParagraphs(Buffer.from(data).toString('utf8'));
    const lang = culture(opts.scene?.language);
    if (
      lang !== 'en-US' &&
      /^ppt\/(slides|notesSlides|charts|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(name)
    )
      data = proofingLanguage(
        typeof data === 'string' ? data : Buffer.from(data).toString('utf8'),
        lang,
      );
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
      let xml = Buffer.from(data).toString('utf8');
      const slideIndex = Number(/slide(\d+)\.xml$/.exec(name)?.[1]) - 1;
      const sourceSlide = opts.scene?.slides[slideIndex];
      if (sourceSlide) {
        const kerned = new Set(
          sourceSlide.nodes
            .filter((n): n is TextNode => n.kind === 'text' && n.style.kerning === true)
            .map((n) => shapeName(n, sourceSlide.id)),
        );
        xml = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (shape) => {
          const objectName = /<p:cNvPr[^>]* name="([^"]*)"/.exec(shape)?.[1];
          const threshold = objectName && kerned.has(objectName) ? 100 : 400000;
          // DrawingML kern is a minimum font-size threshold, NOT a boolean.
          // Office treats zero specially as disabled. Use 1pt for enabled,
          // and a high threshold for disabled; never inherit a master default.
          return shape.replace(/<a:(?:rPr|defRPr|endParaRPr)\b[^>]*>/g, (tag) =>
            tag.replace(/\s+kern="[^"]*"/g, '').replace(/(\/?>)$/, ` kern="${threshold}"$1`),
          );
        });
      }
      xml = roundIconStrokes(crispAxisLines(endMarkLikeLastRun(xml)));
      // The action title is the slide's title placeholder, read first; pictures without
      // alt text are decorative (pptxgenjs would otherwise write the file path as descr).
      xml = markDecorative(titleFirst(markTitle(xml)));
      // Hyperlinks keep the run's colour (Office 2019+) instead of the theme's blue.
      if (xml.includes('<a:hlinkClick'))
        xml = xml.replace(
          /<a:hlinkClick (r:id="rId\d+"[^>]*?)\/>/g,
          '<a:hlinkClick $1><a:extLst><a:ext uri="{A12FA001-AC4F-418D-AE19-62706E023703}"><ahyp:hlinkClr xmlns:ahyp="http://schemas.microsoft.com/office/drawing/2018/hyperlinkcolor" val="tx"/></a:ext></a:extLst></a:hlinkClick>',
        );
      data = xml;
    }
    // Combo charts: pptxgenjs gives every 2D chart a third (series) axis id, which makes
    // PowerPoint bind the line to the primary axis; 2D charts take exactly two.
    if (/^ppt\/charts\/chart\d+\.xml$/.test(name)) {
      const xml = Buffer.from(data).toString('utf8');
      if (xml.includes(`<c:axId val="${SECONDARY_VAL_AXIS}"/>`) && !xml.includes('<c:serAx>'))
        data = xml.replaceAll(`<c:axId val="${SERIES_AXIS}"/>`, '');
    }
    // Brand theme part: Design tab, theme colours and fonts follow the customer's template.
    if (opts.officeTheme && name === 'ppt/theme/theme1.xml') data = readFileSync(opts.officeTheme);
    if (name.endsWith('docProps/core.xml')) {
      data = Buffer.from(data)
        .toString('utf8')
        .replace(/(<dcterms:created[^>]*>)[^<]*(<\/dcterms:created>)/, `$1${iso}$2`)
        .replace(/(<dcterms:modified[^>]*>)[^<]*(<\/dcterms:modified>)/, `$1${iso}$2`);
    }
    zout.file(name, data, { date: epoch, createFolders: false });
  }
  return zout.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'UNIX',
  });
}

export async function renderPptx(scene: Scene, epoch: Date): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SLIDECRAFT', width: scene.format.w, height: scene.format.h });
  pptx.layout = 'SLIDECRAFT';
  pptx.title = scene.title;
  pptx.author = scene.author ?? 'SlideCraft';
  pptx.company = '';
  pptx.subject = `Generated by SlideCraft ${VERSION}`;
  pptx.theme = {
    headFontFace: scene.fonts?.heading.family ?? 'Arial',
    bodyFontFace: scene.fonts?.body.family ?? 'Arial',
    lang: scene.language,
  };
  for (const m of Object.values(scene.masters)) await defineMaster(pptx, m, scene);
  for (const s of scene.slides) {
    const slide = pptx.addSlide({ masterName: s.master });
    if (s.background) slide.background = { color: hex(s.background) };
    for (const n of s.nodes) await addNode(pptx, slide, n, s.id);
    if (s.notes) slide.addNotes(s.notes);
  }
  let raw = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  // brand template: slides move onto the template's own masters and layouts
  if (scene.template) {
    raw = (
      await applyTemplate(
        raw,
        readFileSync(scene.template.path),
        scene.template.footer ? { footer: scene.template.footer } : {},
      )
    ).buf;
    return normalizeZip(raw, epoch, { scene });
  }
  return normalizeZip(raw, epoch, {
    scene,
    ...(scene.officeTheme ? { officeTheme: scene.officeTheme } : {}),
  });
}

export const pptxgenjsEngine: Engine = {
  id: 'pptxgenjs',
  kind: 'pptx',
  label: 'Editable PowerPoint (pptxgenjs)',
  license: 'MIT',
  capabilities: {
    editable: true,
    nativeCharts: true,
    speakerNotes: true,
    fidelity: 'native',
    install: 'bundled',
    ci: true,
  },
  async detect() {
    return { available: true, version: '4.0.1', detail: 'bundled' };
  },
  async render(scene, opts) {
    mkdirSync(opts.outDir, { recursive: true });
    const p = join(opts.outDir, `${opts.baseName}.pptx`);
    writeFileSync(p, await renderPptx(scene, opts.epoch));
    return {
      files: [{ path: p, kind: 'pptx', engine: 'pptxgenjs' }],
      diagnostics: [],
      limitations: [
        'Waterfall labels and stacked totals are text boxes placed over the native chart; edit them if you change the data.',
      ],
    };
  },
};
