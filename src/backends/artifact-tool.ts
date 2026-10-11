/**
 * Optional adapter for the Codex runtime package `@oai/artifact-tool`.
 *
 * LICENSE: @oai/artifact-tool is proprietary (OpenAI) — "internal evaluation and testing
 * only". SlideCraft never copies, vendors or bundles it. This adapter only *calls* a copy
 * the user already has (Codex runtime), located at runtime. If it is missing, the engine
 * reports itself unavailable and `auto` falls back to pptxgenjs.
 *
 * Units: artifact-tool uses CSS px at 96 DPI (inches × 96, points × 4/3).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chartAlt } from '../engine/alt.ts';
import type {
  ChartNode,
  Master,
  Paragraph,
  Scene,
  SceneNode,
  Stroke,
  TextNode,
} from '../engine/scene.ts';
import { shapeName } from './pptx-a11y.ts';
import { normalizeZip } from './pptxgenjs.ts';
import { rasterize } from './resvg.ts';
import type { Engine } from './types.ts';

// biome-ignore lint/suspicious/noExplicitAny: external, untyped API
type Any = any;

const MIN_VERSION = [2, 7, 3];
const PX = 96;
// artifact-tool geometry is int32 px; rounding at 96 DPI moves edges by < 0.5 px.
const px = (inch: number) => Math.round(inch * PX);
const ptpx = (pt: number) => Math.max(1, Math.round((pt * 4) / 3));

export function artifactToolDir(): string | undefined {
  const env = process.env.SLIDECRAFT_ARTIFACT_TOOL;
  const candidates = [
    env,
    join(
      homedir(),
      '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool',
    ),
  ].filter((p): p is string => !!p);
  return candidates.find(
    (p) => existsSync(join(p, 'package.json')) && existsSync(join(p, 'dist/artifact_tool.mjs')),
  );
}

function versionOf(dir: string): string | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  } catch {
    return undefined;
  }
}

function atLeast(v: string, min: number[]): boolean {
  const parts = v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < min.length; i++) {
    if ((parts[i] ?? 0) > min[i]!) return true;
    if ((parts[i] ?? 0) < min[i]!) return false;
  }
  return true;
}

let mod: Any;
async function load(): Promise<Any> {
  if (mod) return mod;
  const dir = artifactToolDir();
  if (!dir)
    throw new Error(
      'artifact-tool not found (set SLIDECRAFT_ARTIFACT_TOOL or install the Codex runtime)',
    );
  mod = await import(pathToFileURL(join(dir, 'dist/artifact_tool.mjs')).href);
  return mod;
}

const line = (s?: Stroke) =>
  s
    ? {
        style: s.dash === 'dash' ? 'dashed' : s.dash === 'dot' ? 'dotted' : 'solid',
        fill: s.color,
        width: ptpx(s.width),
      }
    : { style: 'solid', fill: 'none', width: 0 };

function paragraphs(t: TextNode, ps: Paragraph[]): Any[] {
  return ps.map((p, i) => {
    const runs = p.runs.map((r) => ({
      run: r.text,
      textStyle: {
        bold: r.bold ?? t.style.bold ?? false,
        italic: r.italic ?? t.style.italic ?? false,
        color: r.color ?? t.style.color,
        typeface: t.style.family,
        fontSize: `${t.style.size}pt`,
      },
    }));
    const out: Any = { runs };
    // The runtime writes these numbers into the OOXML unchanged: margins in EMU, spacing in
    // hundredths of a point — convert here, or bullets lose their hanging indent.
    if (p.bullet) {
      out.bulletCharacter = '•';
      out.marginLeft = Math.round(t.bulletIndent * 12700);
      out.indent = -Math.round(t.bulletIndent * 12700);
    }
    if (i > 0 && p.spaceBefore) out.spaceBefore = Math.round(p.spaceBefore * 100);
    return out;
  });
}

function addText(slide: Any, t: TextNode, slideId?: string) {
  const name = shapeName(t, slideId);
  const shape = slide.shapes.add({
    geometry: 'textbox',
    ...(name ? { name } : {}),
    position: { left: px(t.box.x), top: px(t.box.y), width: px(t.box.w), height: px(t.box.h) },
    fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text.style = {
    typeface: t.style.family,
    fontSizePt: t.style.size,
    color: t.style.color,
    alignment: t.style.align,
    verticalAlignment: t.style.valign,
    autoFit: 'none',
    wrap: 'square',
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    // exact spacing expressed as a multiple of the font's single line (~1.15 × size)
    lineSpacing: +(t.style.lineSpacing / (t.style.size * 1.15)).toFixed(3),
  };
  // paragraphs after the shape-level style, so bullets and spacing are not reset
  shape.text.set(paragraphs(t, t.paragraphs));
}

function pathShape(
  slide: Any,
  pts: [number, number][],
  close: boolean,
  fill: string | undefined,
  stroke?: Stroke,
  name?: string,
) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(0.01, Math.max(...xs) - x);
  const h = Math.max(0.01, Math.max(...ys) - y);
  const commands: Any[] = pts.map(([px0, py0], i) =>
    i === 0
      ? { moveTo: { x: px(px0 - x), y: px(py0 - y) } }
      : { lineTo: { x: px(px0 - x), y: px(py0 - y) } },
  );
  if (close) commands.push({ close: {} });
  slide.shapes.add({
    geometry: 'custom',
    ...(name ? { name } : {}),
    position: { left: px(x), top: px(y), width: px(w), height: px(h) },
    fill: fill ?? 'none',
    line: line(stroke),
    customPaths: [{ width: px(w), height: px(h), commands }],
  });
}

async function addNode(slide: Any, n: SceneNode, slideId?: string): Promise<void> {
  const name = shapeName(n, slideId);
  switch (n.kind) {
    case 'text':
      return addText(slide, n, slideId);
    case 'rect': {
      const cfg: Any = {
        geometry: n.radius ? 'roundRect' : 'rect',
        ...(name ? { name } : {}),
        position: { left: px(n.box.x), top: px(n.box.y), width: px(n.box.w), height: px(n.box.h) },
        fill: n.fill ?? 'none',
        line: line(n.stroke),
      };
      if (n.radius) cfg.borderRadius = px(n.radius);
      slide.shapes.add(cfg);
      return;
    }
    case 'ellipse':
      slide.shapes.add({
        geometry: 'ellipse',
        ...(name ? { name } : {}),
        position: { left: px(n.box.x), top: px(n.box.y), width: px(n.box.w), height: px(n.box.h) },
        fill: n.fill ?? 'none',
        line: line(n.stroke),
      });
      return;
    case 'polygon':
      return pathShape(slide, n.points, true, n.fill, n.stroke, name);
    case 'line': {
      pathShape(
        slide,
        [
          [n.x1, n.y1],
          [n.x2, n.y2],
        ],
        false,
        undefined,
        n.stroke,
        name,
      );
      if (n.arrowEnd) {
        const ang = Math.atan2(n.y2 - n.y1, n.x2 - n.x1);
        const L = 0.1;
        pathShape(
          slide,
          [
            [n.x2, n.y2],
            [n.x2 + L * Math.cos(ang + Math.PI * 0.85), n.y2 + L * Math.sin(ang + Math.PI * 0.85)],
            [n.x2 + L * Math.cos(ang - Math.PI * 0.85), n.y2 + L * Math.sin(ang - Math.PI * 0.85)],
          ],
          true,
          n.stroke.color,
        );
      }
      return;
    }
    case 'image': {
      const position = {
        left: px(n.box.x),
        top: px(n.box.y),
        width: px(n.box.w),
        height: px(n.box.h),
      };
      let bytes: Buffer | undefined;
      let contentType = 'image/png';
      if (n.svg) bytes = await rasterize(n.svg, Math.min(2400, n.box.w * 180));
      else if (n.path) {
        bytes = readFileSync(n.path);
        contentType = /\.jpe?g$/i.test(n.path) ? 'image/jpeg' : 'image/png';
      } else if (n.data) {
        bytes = Buffer.from(n.data.base64, 'base64');
        contentType = n.data.mime;
      }
      if (!bytes) {
        const ph = slide.shapes.add({
          geometry: 'rect',
          position,
          fill: '#E9ECF0',
          line: { style: 'dashed', fill: '#AEB6C1', width: 1 },
        });
        ph.text = n.placeholderLabel ?? 'Image';
        ph.text.style = {
          fontSizePt: 10,
          color: '#6B7480',
          alignment: 'center',
          verticalAlignment: 'middle',
        };
        return;
      }
      const blob = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      slide.images.add({ blob, contentType, alt: n.alt, fit: n.fit, position });
      return;
    }
    case 'table': {
      const values = n.cells.map((row) => row.map((c) => paragraphs(c.text, c.text.paragraphs)));
      const table = slide.tables.add({
        rows: n.rowH.length,
        columns: n.colW.length,
        left: px(n.box.x),
        top: px(n.box.y),
        width: px(n.box.w),
        height: px(n.rowH.reduce((a, b) => a + b, 0)),
        columnWidths: n.colW.map(px),
        values,
      });
      try {
        n.rowH.forEach((h, i) => {
          table.rows[i].height = px(h);
        });
        table.borders.assign({ style: 'solid', fill: 'none', width: 0 });
      } catch {
        // older runtimes: keep defaults
      }
      n.cells.forEach((row, r) =>
        row.forEach((c, col) => {
          try {
            const cfg: Any = {
              textStyle: {
                bold: c.text.style.bold ?? false,
                color: c.text.style.color,
                fontSize: ptpx(c.text.style.size),
              },
              margins: {
                top: px(n.pad.t),
                right: px(n.pad.r),
                bottom: px(n.pad.b),
                left: px(n.pad.l),
              },
            };
            if (c.fill) cfg.fill = c.fill;
            if (c.borderBottom) cfg.borders = { bottom: line(c.borderBottom) };
            table.cells.block({ row: r, column: col, rowCount: 1, columnCount: 1 }).assign(cfg);
          } catch {
            // styling is best-effort; content is already in place
          }
        }),
      );
      return;
    }
    case 'chart':
      return addChart(slide, n);
  }
}

function addChart(slide: Any, n: ChartNode) {
  const isBar = n.barDir === 'bar';
  // Horizontal bars: PowerPoint draws the first category at the bottom; reverse so it reads top-down.
  const order = n.categories.map((_, i) => i);
  if (isBar) order.reverse();
  const pick = <T>(xs: T[]) => order.map((i) => xs[i]!);
  const valueAxis = {
    visible: false,
    tickLabelPosition: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
    min: n.axis.min,
    max: n.axis.max,
    majorUnit: n.axis.major,
    numberFormatCode: n.axis.format,
    majorGridlines: null,
  };
  const catAxis = {
    // labels at the bottom of the plot when bars cross zero (waterfalls with negative ends)
    tickLabelPosition: n.axis.min < 0 ? 'low' : 'nextTo',
    textStyle: { fill: n.catLabels.color, fontSize: ptpx(n.catLabels.size) },
    line: { style: 'solid', fill: '#C9D2DE', width: 1 },
    majorGridlines: null,
  };
  const labelStyle = { fill: n.labels.color, fontSize: ptpx(n.labels.size) };
  const highlightTrick = n.series.length === 2 && n.series[1]!.name.endsWith('(other)');
  let series: Any[];
  let dataLabels: Any;
  if (highlightTrick) {
    // one native series with per-point fills instead of the two-series stacking trick
    const [hi, other] = n.series as [ChartNode['series'][0], ChartNode['series'][0]];
    const values = pick(hi.values.map((v, i) => v + (other.values[i] ?? 0)));
    const points = pick(hi.values.map((v) => (v !== 0 ? hi.color : other.color))).map(
      (fill, idx) => ({ idx, fill }),
    );
    series = [{ name: hi.name, values, fill: other.color, points }];
    dataLabels = { showValue: true, position: 'outEnd', textStyle: labelStyle };
  } else if (n.type === 'waterfall') {
    // labels via per-point overrides: one carrier segment per bar shows the formatted delta
    const labels = n.primitives
      .filter((p) => (p as { role?: string }).role === 'chart-label' && p.kind === 'text')
      .map((p) => (p as TextNode).paragraphs[0]?.runs.map((r) => r.text).join('') ?? '');
    const visible = n.series.map((s, k) => ({ s, k })).filter((x) => !x.s.invisible);
    const carrier = n.categories.map(
      (_, i) =>
        visible.reduce(
          (best, x) => (Math.abs(x.s.values[i] ?? 0) > Math.abs(best.s.values[i] ?? 0) ? x : best),
          visible[0]!,
        ).k,
    );
    series = n.series.map((s, k) => ({
      name: s.name,
      values: pick(s.values),
      fill: s.invisible ? 'none' : s.color,
      dataLabelOverrides: pick(s.values.map((v, i) => ({ v, i }))).map(({ v, i }, idx) =>
        !s.invisible && v !== 0 && carrier[i] === k
          ? {
              idx,
              text: labels[i] ?? '',
              showValue: true,
              textStyle: { ...labelStyle, fill: '#FFFFFF' },
            }
          : { idx, showValue: false },
      ),
    }));
    dataLabels = { showValue: true, position: 'center', textStyle: labelStyle };
  } else {
    series = n.series.map((s) =>
      n.type === 'line'
        ? {
            name: s.name,
            values: pick(s.values),
            line: { style: 'solid', fill: s.color, width: 3 },
          }
        : { name: s.name, values: pick(s.values), fill: s.color },
    );
    dataLabels = {
      showValue: true,
      position: n.grouping === 'stacked' ? 'center' : 'outEnd',
      textStyle: { ...labelStyle, fill: n.grouping === 'stacked' ? '#FFFFFF' : n.labels.color },
    };
  }
  const cfg: Any = {
    position: { left: px(n.box.x), top: px(n.box.y), width: px(n.box.w), height: px(n.box.h) },
    categories: pick(n.categories),
    series,
    hasLegend: n.legend,
    ...(n.legend
      ? {
          legend: {
            position: 'top',
            overlay: false,
            textStyle: { fontSize: ptpx(n.catLabels.size), fill: n.catLabels.color },
          },
        }
      : {}),
    dataLabels,
    xAxis: catAxis,
    yAxis: valueAxis,
  };
  if (n.type !== 'line') {
    cfg.barOptions = {
      direction: isBar ? 'bar' : 'column',
      grouping: highlightTrick ? 'clustered' : n.grouping,
      gapWidth: n.gapWidth,
      ...(n.grouping === 'stacked' && !highlightTrick ? { overlap: 100 } : {}),
    };
  }
  slide.charts.add(n.type === 'line' ? 'line' : 'bar', cfg);
  // The runtime has no plot-area API; the manual layout is written into the chart XML after
  // export (pinPlotAreas), so overlays computed by the engine line up with the bars.
  const b = n.box;
  plots.push({
    family: n.font.family,
    line: n.type === 'line',
    alt: chartAlt(n),
    x: (n.plot.x - b.x) / b.w,
    y: (n.plot.y - b.y) / b.h,
    w: n.plot.w / b.w,
    h: n.plot.h / b.h,
  });
  for (const p of n.primitives) {
    const role = (p as { role?: string }).role;
    if (role === 'chart-total') addText(slide, p as TextNode);
    else if (role === 'chart-connector') void addNode(slide, p);
  }
}

/** Inner plot boxes (fractions of the chart frame) in the order charts were added. */
let plots: {
  family: string;
  line: boolean;
  alt: string;
  x: number;
  y: number;
  w: number;
  h: number;
}[] = [];

/** Write each chart's manual inner plot layout, matching charts to parts in slide order. */
async function pinPlotAreas(buf: Buffer, list: typeof plots): Promise<Buffer> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);
  for (const name of Object.keys(zip.files).filter((n) =>
    /slideLayouts\/slideLayout\d+\.xml$/.test(n),
  )) {
    const xml = await zip.file(name)!.async('string');
    if (!xml.includes(SLIDE_NUMBER_MARK)) continue;
    zip.file(
      name,
      xml.replace(
        new RegExp(
          `<a:r>(<a:rPr[^>]*/>|<a:rPr[^>]*>[\\s\\S]*?</a:rPr>)?<a:t>${SLIDE_NUMBER_MARK}</a:t></a:r>`,
          'g',
        ),
        `<a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum">$1<a:t>${SLIDE_NUMBER_MARK}</a:t></a:fld>`,
      ),
    );
  }
  const pres = (await zip.file('ppt/presentation.xml')!.async('string')) ?? '';
  const presRels = (await zip.file('ppt/_rels/presentation.xml.rels')!.async('string')) ?? '';
  const target = (rels: string, id: string) =>
    new RegExp(
      `<Relationship [^>]*(?:Id="${id}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${id}")`,
    ).exec(rels);
  const norm = (base: string, t: string) =>
    t.startsWith('/') ? t.slice(1) : join(base, t).replace(/\\/g, '/');
  const slideParts = [...pres.matchAll(/<p:sldId [^>]*r:id="([^"]+)"/g)].map((m) => {
    const t = target(presRels, m[1]!);
    return norm('ppt', t?.[1] ?? t?.[2] ?? '');
  });
  let k = 0;
  for (const part of slideParts) {
    const xml = (await zip.file(part)?.async('string')) ?? '';
    const relsPath = part.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const rels = (await zip.file(relsPath)?.async('string')) ?? '';
    // chart alt text (the runtime has no option for it), in the order charts were added
    let j = k;
    const withAlt = xml.replace(/<p:graphicFrame>([\s\S]*?)<\/p:graphicFrame>/g, (g) => {
      if (!g.includes('<c:chart')) return g;
      const alt = list[j++]?.alt ?? '';
      const esc = alt.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return g.replace(
        /<p:cNvPr ([^>]*?)(\/?)>/,
        (_m, attrs: string, sc: string) =>
          `<p:cNvPr ${attrs.replace(/\s*descr="[^"]*"/, '').trimEnd()} descr="${esc}"${sc}>`,
      );
    });
    if (withAlt !== xml) zip.file(part, withAlt);
    for (const m of xml.matchAll(/<c:chart [^>]*r:id="([^"]+)"/g)) {
      const t = target(rels, m[1]!);
      const chartPart = norm('ppt/slides', t?.[1] ?? t?.[2] ?? '');
      const p = list[k++];
      const cx = await zip.file(chartPart)?.async('string');
      if (!p || !cx) continue;
      const layout = `<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="${p.x.toFixed(4)}"/><c:y val="${p.y.toFixed(4)}"/><c:w val="${p.w.toFixed(4)}"/><c:h val="${p.h.toFixed(4)}"/></c:manualLayout></c:layout>`;
      let fixed = cx
        // chart text style has no typeface: set the theme family on every run default
        .replace(
          /<a:defRPr([^>]*?)\s*\/>/g,
          `<a:defRPr$1><a:latin typeface="${p.family}"/></a:defRPr>`,
        )
        .replace(/<a:defRPr([^>]*)>(?!<a:latin)/g, `<a:defRPr$1><a:latin typeface="${p.family}"/>`);
      // line charts: labels above the points, not on the line
      if (p.line)
        fixed = fixed
          .replace(/<c:dLblPos val="[^"]*"\s*\/>/g, '')
          .replace(/<c:showLegendKey/g, '<c:dLblPos val="t"/><c:showLegendKey');
      zip.file(
        chartPart,
        fixed.replace(
          /<c:plotArea>(\s*<c:layout\s*\/>|\s*<c:layout>[\s\S]*?<\/c:layout>)?/,
          `<c:plotArea>${layout}`,
        ),
      );
    }
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** Scene masters become real slide layouts (one master): decor, footer and logo live there once. */
async function buildLayouts(p: Any, scene: Scene): Promise<Record<string, Any>> {
  const master = p.masters.add('SlideCraft');
  const out: Record<string, Any> = {};
  for (const [id, m] of Object.entries(scene.masters)) {
    const layout = p.layouts.add(`SlideCraft ${id}`);
    layout.setParentLayoutId(master.id);
    layout.background.fill = m.background;
    for (const n of m.nodes) await addNode(layout, n);
    // '‹#›' becomes a slide-number field in post-processing, so every slide shows its own number
    if (m.slideNumber) drawSlideNumber(layout, m, SLIDE_NUMBER_MARK);
    out[id] = layout;
  }
  return out;
}

/** Slide number text box (on layouts, with the field mark). */
const SLIDE_NUMBER_MARK = '‹#›';

function drawSlideNumber(slide: Any, m: Master, slideNo: number | string) {
  if (m.slideNumber) {
    const s = m.slideNumber;
    const t = slide.shapes.add({
      geometry: 'textbox',
      position: { left: px(s.box.x), top: px(s.box.y), width: px(s.box.w), height: px(s.box.h) },
      fill: 'none',
      line: { style: 'solid', fill: 'none', width: 0 },
    });
    t.text.style = {
      alignment: s.style.align,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    // font size is honoured on runs only
    t.text.set([
      {
        runs: [
          {
            run: String(slideNo),
            textStyle: {
              typeface: s.style.family,
              fontSize: `${s.style.size}pt`,
              color: s.style.color,
            },
          },
        ],
      },
    ]);
  }
}

export const artifactToolEngine: Engine = {
  id: 'artifact-tool',
  kind: 'pptx',
  label: 'PowerPoint via the Codex artifact-tool runtime',
  license: 'Proprietary (OpenAI) — internal evaluation and testing only; never bundled',
  proprietary: true,
  capabilities: {
    editable: true,
    nativeCharts: true,
    speakerNotes: true,
    fidelity: 'native',
    install: 'Codex runtime (@oai/artifact-tool ≥ 2.7.3)',
    ci: false,
  },
  async detect() {
    try {
      const dir = artifactToolDir();
      if (!dir)
        return {
          available: false,
          detail: 'Codex runtime package @oai/artifact-tool not found',
          install: 'Install Codex, or set SLIDECRAFT_ARTIFACT_TOOL to the package directory',
        };
      const v = versionOf(dir);
      if (!v || !atLeast(v, MIN_VERSION))
        return {
          available: false,
          detail: `found ${v ?? 'unknown'} at ${dir}; need ≥ ${MIN_VERSION.join('.')}`,
        };
      return { available: true, version: v, detail: dir };
    } catch (e) {
      return { available: false, detail: String(e) };
    }
  },
  async render(scene: Scene, opts) {
    const at = await load();
    const p = at.Presentation.create({
      slideSize: { width: px(scene.format.w), height: px(scene.format.h) },
    });
    plots = [];
    const layouts = await buildLayouts(p, scene);
    for (const s of scene.slides) {
      const slide = p.slides.add();
      slide.setLayout(layouts[s.master]);
      if (s.background) slide.background.fill = s.background;
      for (const n of s.nodes) await addNode(slide, n, s.id);
      if (s.notes) slide.speakerNotes.textFrame.setText(s.notes);
    }
    mkdirSync(opts.outDir, { recursive: true });
    const out = join(opts.outDir, `${opts.baseName}.pptx`);
    const file = await at.PresentationFile.exportPptx(p);
    const tmp = `${out}.tmp`;
    await file.save(tmp);
    const pinned = await pinPlotAreas(readFileSync(tmp), plots);
    writeFileSync(
      out,
      await normalizeZip(
        pinned,
        opts.epoch,
        scene.officeTheme ? { officeTheme: scene.officeTheme } : {},
      ),
    );
    for (const f of readdirSync(opts.outDir))
      if (f.startsWith(`${opts.baseName}.pptx.tmp`)) rmSync(join(opts.outDir, f), { force: true });
    return {
      files: [{ path: out, kind: 'pptx', engine: 'artifact-tool' }],
      diagnostics: [],
      limitations: [
        'Built with the proprietary Codex artifact-tool runtime (internal evaluation and testing only).',
        'Decor, footer, logo and the slide-number field sit on slide layouts; chart plot areas are pinned to SlideCraft geometry.',
      ],
    };
  },
};
