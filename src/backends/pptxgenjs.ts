/**
 * PPTX engine on pptxgenjs (MIT). Everything content-bearing is native and editable:
 * text boxes (zero insets, exact line spacing, no autofit), tables, charts and
 * speaker notes. Decor is a rasterised background image on the slide master.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import pptxgenModule from 'pptxgenjs';
import type { ChartNode, Master, Scene, SceneNode, Stroke, TextNode } from '../engine/scene.ts';
import { in2pt } from '../engine/scene.ts';
import { VERSION } from '../paths.ts';
import { rasterize } from './resvg.ts';
import type { Engine } from './types.ts';

// biome-ignore lint/suspicious/noExplicitAny: pptxgenjs option bags are loosely typed
type Any = any;
// pptxgenjs ships CJS + ESM builds with different default-export shapes; normalise.
const PptxGenJS: new () => Any = (pptxgenModule as Any).default ?? pptxgenModule;
type Pptx = Any;
type Slide = Any;

const hex = (c: string) => c.replace('#', '').toUpperCase();

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

function textOpts(t: TextNode): Any {
  return {
    x: t.box.x,
    y: t.box.y,
    w: t.box.w,
    h: t.box.h,
    margin: 0,
    fontFace: t.style.family,
    fontSize: t.style.size,
    color: hex(t.style.color),
    lineSpacing: t.style.lineSpacing,
    valign: t.style.valign,
    align: t.style.align,
    fit: 'none',
    wrap: true,
    isTextBox: true,
  };
}

function addText(slide: Slide, t: TextNode) {
  slide.addText(textRuns(t), textOpts(t));
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
    catAxisLabelFontFace: n.font.family,
    catAxisLineShow: true,
    catAxisLineColor: 'C9D2DE',
    catGridLine: { style: 'none' },
    catAxisMajorTickMark: 'none',
    catAxisMinorTickMark: 'none',
    valAxisMajorTickMark: 'none',
    showLegend: n.legend,
    legendPos: 't',
    legendFontSize: n.catLabels.size,
    legendFontFace: n.font.family,
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
  slide.addChart(chartType(pptx, n), data, opts);
  // Overlays computed by the engine where native charts cannot express them.
  for (const p of n.primitives) {
    const role = (p as { role?: string }).role;
    const overlay =
      (!n.nativeLabels && (role === 'chart-label' || role === 'chart-connector')) ||
      role === 'chart-total';
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
    slide.addImage({
      path: n.path,
      x,
      y,
      w,
      h,
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

function addNode(pptx: Pptx, slide: Slide, n: SceneNode): Promise<void> | void {
  switch (n.kind) {
    case 'text':
      return addText(slide, n);
    case 'rect': {
      const shape = n.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
      const o: Any = { x: n.box.x, y: n.box.y, w: n.box.w, h: n.box.h, line: lineProps(n.stroke) };
      o.fill = n.fill
        ? {
            color: hex(n.fill),
            transparency: n.fillOpacity !== undefined ? Math.round((1 - n.fillOpacity) * 100) : 0,
          }
        : { type: 'none' };
      if (n.radius) o.rectRadius = Math.min(1, n.radius / (Math.min(n.box.w, n.box.h) / 2));
      slide.addShape(shape, o);
      return;
    }
    case 'ellipse': {
      const o: Any = { x: n.box.x, y: n.box.y, w: n.box.w, h: n.box.h, line: lineProps(n.stroke) };
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
      o.fill = n.fill
        ? {
            color: hex(n.fill),
            transparency: n.fillOpacity !== undefined ? Math.round((1 - n.fillOpacity) * 100) : 0,
          }
        : { type: 'none' };
      slide.addShape(pptx.ShapeType.custGeom, o);
      return;
    }
    case 'line': {
      const x = Math.min(n.x1, n.x2);
      const y = Math.min(n.y1, n.y2);
      const o: Any = {
        x,
        y,
        w: Math.max(0.0001, Math.abs(n.x2 - n.x1)),
        h: Math.max(0.0001, Math.abs(n.y2 - n.y1)),
        line: { ...lineProps(n.stroke), ...(n.arrowEnd ? { endArrowType: 'triangle' } : {}) },
      };
      if (n.x2 < n.x1 !== n.y2 < n.y1 && n.x1 !== n.x2 && n.y1 !== n.y2) o.flipV = true;
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
              fontFace: t.style.family,
              fontSize: t.style.size,
              color: hex(t.style.color),
              bold: t.style.bold ?? false,
              align: t.style.align,
              valign: 'top',
              lineSpacing: t.style.lineSpacing,
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
      fontFace: s.style.family,
      fontSize: s.style.size,
      color: hex(s.style.color),
      align: s.style.align,
      margin: 0,
    };
  }
  pptx.defineSlideMaster(props);
}

/** Re-zip with fixed timestamps and fixed docProps dates so builds are byte-reproducible. */
export async function normalizeZip(buf: Buffer, epoch: Date): Promise<Buffer> {
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
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
      const xml = Buffer.from(data).toString('utf8');
      // Hyperlinks keep the run's colour (Office 2019+) instead of the theme's blue.
      if (xml.includes('<a:hlinkClick'))
        data = xml.replace(
          /<a:hlinkClick (r:id="rId\d+"[^>]*?)\/>/g,
          '<a:hlinkClick $1><a:extLst><a:ext uri="{A12FA001-AC4F-418D-AE19-62706E023703}"><ahyp:hlinkClr xmlns:ahyp="http://schemas.microsoft.com/office/drawing/2018/hyperlinkcolor" val="tx"/></a:ext></a:extLst></a:hlinkClick>',
        );
    }
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
  pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
  for (const m of Object.values(scene.masters)) await defineMaster(pptx, m, scene);
  for (const s of scene.slides) {
    const slide = pptx.addSlide({ masterName: s.master });
    if (s.background) slide.background = { color: hex(s.background) };
    for (const n of s.nodes) await addNode(pptx, slide, n);
    if (s.notes) slide.addNotes(s.notes);
  }
  const raw = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return normalizeZip(raw, epoch);
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
