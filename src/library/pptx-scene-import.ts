/**
 * Geometry-preserving PPTX import. Unlike the editorial import command this does
 * not choose a layout, shorten copy, drop chrome, or replace native shapes with a
 * screenshot. Unsupported DrawingML is reported explicitly for visual review.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, join, posix, resolve } from 'node:path';
import JSZip from 'jszip';
import { type Face, registerMeasureFont, vmetrics } from '../engine/fonts.ts';
import type {
  Box,
  Paragraph,
  Scene,
  SceneNode,
  Stroke,
  TextNode,
  TextStyle,
} from '../engine/scene.ts';
import { layoutText, makeTextNode, plainText } from '../engine/text.ts';

const EMU = 914400;
interface Xml {
  name: string;
  attrs: Record<string, string>;
  children: Xml[];
  text: string;
}
const empty = (): Xml => ({ name: '', attrs: {}, children: [], text: '' });
const child = (n: Xml | undefined, name: string) => n?.children.find((c) => c.name === name);
const children = (n: Xml | undefined, name: string) =>
  n?.children.filter((c) => c.name === name) ?? [];
function descendant(n: Xml | undefined, name: string): Xml | undefined {
  if (!n) return;
  if (n.name === name) return n;
  for (const c of n.children) {
    const found = descendant(c, name);
    if (found) return found;
  }
}
const num = (n: Xml | undefined, key: string, fallback = 0) => Number(n?.attrs[key] ?? fallback);
const decode = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e.startsWith('#'))
      return String.fromCodePoint(
        Number.parseInt(e.slice(e[1] === 'x' ? 2 : 1), e[1] === 'x' ? 16 : 10),
      );
    return (
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[e] ?? ''
    );
  });

/** Small non-validating XML reader: retains nesting/order and never resolves entities. */
function xml(source: string): Xml {
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error('External XML entities are not supported');
  const root = empty();
  const stack = [root];
  for (const m of source.matchAll(
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<[^>]+>|[^<]+/g,
  )) {
    const t = m[0];
    const current = stack[stack.length - 1]!;
    if (t.startsWith('<!--') || t.startsWith('<?')) continue;
    if (t.startsWith('<![CDATA[')) {
      current.text += m[1] ?? '';
      continue;
    }
    if (t.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!t.startsWith('<')) {
      current.text += decode(t);
      continue;
    }
    const tag = /^<([^\s/>]+)/.exec(t)?.[1];
    if (!tag) continue;
    const n: Xml = { name: tag.split(':').pop()!, attrs: {}, children: [], text: '' };
    for (const a of t.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      n.attrs[a[1]!] = decode(a[2] ?? a[3] ?? '');
    current.children.push(n);
    if (!t.endsWith('/>')) stack.push(n);
  }
  return root.children[0] ?? root;
}

interface Relationship {
  target: string;
  type: string;
  external: boolean;
}
async function relationships(zip: JSZip, part: string): Promise<Map<string, Relationship>> {
  const dir = posix.dirname(part);
  const data = await zip.file(`${dir}/_rels/${posix.basename(part)}.rels`)?.async('string');
  const out = new Map<string, Relationship>();
  for (const r of children(data ? xml(data) : undefined, 'Relationship')) {
    const raw = r.attrs.Target ?? '';
    const external = r.attrs.TargetMode === 'External';
    out.set(r.attrs.Id!, {
      target: external
        ? raw
        : raw.startsWith('/')
          ? raw.slice(1)
          : posix.normalize(posix.join(dir, raw)),
      type: r.attrs.Type ?? '',
      external,
    });
  }
  return out;
}

export interface PptxSceneDiagnostic {
  code: string;
  message: string;
  slide?: number;
  shape?: string;
}
export interface PptxSourceShape {
  slide: number;
  part: string;
  id: string;
  name: string;
  type: string;
  /** Indices into SceneSlide.nodes; one source shape may have separate fill/text nodes. */
  nodes: number[];
  box: Box;
}
export interface ImportedPptxScene {
  scene: Scene;
  diagnostics: PptxSceneDiagnostic[];
  source: { path: string; sha256: string };
  shapes: PptxSourceShape[];
}
export interface PptxSceneImportOptions {
  id?: string;
  /** Locally licensed fonts are read in place, never copied into an artifact. */
  fonts?: Record<string, Partial<Record<Face, string>> & { regular: string }>;
  /** Reject unsupported features instead of returning a partial visual representation. */
  strict?: boolean;
}
interface Theme {
  major: string;
  minor: string;
  colors: Record<string, string>;
}
interface Context {
  diagnostics: PptxSceneDiagnostic[];
  options: PptxSceneImportOptions;
  fonts: Map<string, string>;
  theme: Theme;
  slide: number;
  shape: string;
  defaults?: Xml;
  tableStyles?: Xml;
  links?: Map<string, Relationship>;
}
function warn(ctx: Context, code: string, message: string) {
  ctx.diagnostics.push({ code, message, slide: ctx.slide, shape: ctx.shape });
}
function sourceFont(family: string, ctx: Context): string {
  const hit = ctx.fonts.get(family);
  if (hit) return hit;
  let files = ctx.options.fonts?.[family];
  if (!files && /^Calibri(?: Light)?$/i.test(family)) {
    const light = /Light/i.test(family);
    const roots = [
      '/Library/Fonts/Microsoft',
      '/Applications/Microsoft PowerPoint.app/Contents/Resources/DFonts',
    ];
    for (const dir of roots) {
      const regular = join(dir, light ? 'Calibril.ttf' : 'Calibri.ttf');
      const lower = join(dir, light ? 'calibril.ttf' : 'calibri.ttf');
      if (!existsSync(regular) && !existsSync(lower)) continue;
      files = { regular: existsSync(regular) ? regular : lower };
      const candidates = {
        bold: ['Calibri Bold.ttf', 'Calibrib.ttf'],
        italic: light ? ['calibrili.ttf'] : ['Calibri Italic.ttf', 'Calibrii.ttf'],
        boldItalic: ['Calibri Bold Italic.ttf', 'Calibriz.ttf'],
      };
      for (const [face, names] of Object.entries(candidates)) {
        const file = names.map((n) => join(dir, n)).find(existsSync);
        if (file) files[face as Face] = file;
      }
      break;
    }
  }
  let measure = 'liberation-sans';
  if (files) {
    measure = `pptx-${createHash('sha256').update(JSON.stringify({ family, files })).digest('hex').slice(0, 16)}`;
    registerMeasureFont(measure, files, family);
  } else if (/^(Times New Roman|Liberation Serif)$/i.test(family)) measure = 'liberation-serif';
  else if (!/^(Arial|Liberation Sans)$/i.test(family))
    warn(
      ctx,
      'PPTX-FONT-SUBSTITUTION',
      `Font "${family}" is unavailable for measurement; supply options.fonts before claiming visual fidelity.`,
    );
  ctx.fonts.set(family, measure);
  return measure;
}
function themeFrom(root: Xml): Theme {
  const scheme = descendant(root, 'clrScheme');
  const colors: Record<string, string> = {};
  for (const c of scheme?.children ?? []) {
    const v = c.children[0];
    const value =
      v?.attrs.val === 'windowText' || v?.attrs.val === 'window' ? v.attrs.lastClr : v?.attrs.val;
    if (value) colors[c.name] = `#${value}`;
  }
  for (const [alias, key] of Object.entries({ tx1: 'dk1', tx2: 'dk2', bg1: 'lt1', bg2: 'lt2' }))
    colors[alias] = colors[key] ?? '#000000';
  return {
    major: child(descendant(root, 'majorFont'), 'latin')?.attrs.typeface ?? 'Arial',
    minor: child(descendant(root, 'minorFont'), 'latin')?.attrs.typeface ?? 'Arial',
    colors,
  };
}
function color(n: Xml | undefined, ctx: Context): string | undefined {
  const c = n?.children.find((v) => ['srgbClr', 'schemeClr', 'sysClr'].includes(v.name));
  if (!c) return;
  let value =
    c.name === 'schemeClr' ? ctx.theme.colors[c.attrs.val!] : `#${c.attrs.lastClr ?? c.attrs.val}`;
  if (!value || !/^#[\da-f]{6}$/i.test(value)) {
    warn(ctx, 'PPTX-COLOR', `Unresolved color ${c.attrs.val}`);
    return;
  }
  const rgb = [1, 3, 5].map((i) => Number.parseInt(value!.slice(i, i + 2), 16));
  for (const transform of c.children) {
    const v = num(transform, 'val') / 100000;
    if (transform.name === 'alpha') continue;
    if (!['tint', 'shade', 'lumMod', 'lumOff'].includes(transform.name)) {
      warn(ctx, 'PPTX-COLOR-TRANSFORM', `Unsupported color transform ${transform.name}`);
      continue;
    }
    for (let i = 0; i < 3; i++)
      rgb[i] =
        transform.name === 'tint'
          ? rgb[i]! + (255 - rgb[i]!) * v
          : transform.name === 'lumOff'
            ? rgb[i]! + 255 * v
            : rgb[i]! * v;
  }
  value = `#${rgb
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
  return value.toUpperCase();
}
function paint(pr: Xml | undefined, ctx: Context) {
  const fillNode = child(pr, 'solidFill');
  const fill = color(fillNode, ctx);
  const alpha = descendant(fillNode, 'alpha');
  const ln = child(pr, 'ln');
  const strokeColor = color(child(ln, 'solidFill'), ctx);
  const width = num(ln, 'w', 12700) / 12700;
  const dash = child(ln, 'prstDash')?.attrs.val;
  const stroke: Stroke | undefined =
    strokeColor && width > 0
      ? {
          color: strokeColor,
          width,
          dash: dash === 'dash' ? 'dash' : dash === 'dot' || dash === 'sysDot' ? 'dot' : 'solid',
        }
      : undefined;
  if (child(pr, 'gradFill') || child(pr, 'pattFill'))
    warn(ctx, 'PPTX-FILL', 'Gradient/pattern fill needs an explicit renderer.');
  if (child(pr, 'effectLst')?.children.length)
    warn(ctx, 'PPTX-EFFECT', 'Shape effects are not represented in Scene.');
  return {
    ...(fill ? { fill } : {}),
    ...(alpha ? { fillOpacity: num(alpha, 'val') / 100000 } : {}),
    ...(stroke ? { stroke } : {}),
  };
}
function boxOf(xfrm: Xml | undefined): Box {
  const off = child(xfrm, 'off');
  const ext = child(xfrm, 'ext');
  return {
    x: num(off, 'x') / EMU,
    y: num(off, 'y') / EMU,
    w: num(ext, 'cx') / EMU,
    h: num(ext, 'cy') / EMU,
  };
}
function textNodes(
  body: Xml,
  box: Box,
  ctx: Context,
  role: string,
  insets?: { l: number; r: number; t: number; b: number },
): TextNode[] {
  const bp = child(body, 'bodyPr');
  const pad = insets ?? {
    l: num(bp, 'lIns', 91440) / EMU,
    r: num(bp, 'rIns', 91440) / EMU,
    t: num(bp, 'tIns', 45720) / EMU,
    b: num(bp, 'bIns', 45720) / EMU,
  };
  const width = Math.max(0.001, box.w - pad.l - pad.r);
  const result: TextNode[] = [];
  let y = 0;
  for (const p of children(body, 'p')) {
    const pp = child(p, 'pPr');
    const defaultPr = child(pp, 'defRPr') ?? child(ctx.defaults, 'defRPr');
    const firstPr =
      child(
        p.children.find((r) => r.name === 'r' || r.name === 'fld'),
        'rPr',
      ) ?? child(p, 'endParaRPr');
    const attr = (key: string) => firstPr?.attrs[key] ?? defaultPr?.attrs[key];
    let family =
      child(firstPr, 'latin')?.attrs.typeface ??
      child(defaultPr, 'latin')?.attrs.typeface ??
      ctx.theme.minor;
    if (family.startsWith('+mj')) family = ctx.theme.major;
    if (family.startsWith('+mn')) family = ctx.theme.minor;
    const measure = sourceFont(family, ctx);
    const size = Number(attr('sz') ?? 1800) / 100;
    const bold = attr('b') === '1';
    const italic = attr('i') === '1';
    const metrics = vmetrics(
      measure,
      bold ? (italic ? 'boldItalic' : 'bold') : italic ? 'italic' : 'regular',
    );
    // Office uses a 1.2-em automatic line advance for Calibri, distinct from
    // the 1.220703-em glyph ascent/descent box reported by the font file.
    const naturalSpacing = size * (family === 'Calibri' ? 1.2 : metrics.asc + metrics.desc);
    const spacing = child(pp, 'lnSpc');
    const lineSpacing = child(spacing, 'spcPts')
      ? num(child(spacing, 'spcPts'), 'val') / 100
      : (naturalSpacing * num(child(spacing, 'spcPct'), 'val', 100000)) / 100000;
    const style: TextStyle = {
      family,
      measure,
      size,
      lineSpacing,
      lineSpacingAuto: !spacing,
      // Native table cells do not inherit presentation-level kerning. Once
      // converted to text boxes that distinction must be made explicit.
      kerning:
        attr('kern') !== undefined
          ? Number(attr('kern')) > 0 && size >= Number(attr('kern')) / 100
          : !insets && size >= 12,
      ...(!child(spacing, 'spcPts')
        ? { lineSpacingMultiple: num(child(spacing, 'spcPct'), 'val', 100000) / 100000 }
        : {}),
      bold,
      italic,
      color:
        color(child(firstPr, 'solidFill'), ctx) ??
        color(child(defaultPr, 'solidFill'), ctx) ??
        '#000000',
      align: pp?.attrs.algn === 'ctr' ? 'center' : pp?.attrs.algn === 'r' ? 'right' : 'left',
      valign: 'top',
    };
    const paragraph: Paragraph = { runs: [] };
    for (const r of p.children) {
      if (r.name === 'br') {
        paragraph.runs.push({ text: '\n' });
        continue;
      }
      if (r.name !== 'r' && r.name !== 'fld') continue;
      const pr = child(r, 'rPr');
      if (pr?.attrs.sz && num(pr, 'sz') / 100 !== size)
        warn(
          ctx,
          'PPTX-MIXED-SIZE',
          'Mixed font sizes inside one paragraph need separate Scene text runs.',
        );
      const face = child(pr, 'latin')?.attrs.typeface;
      if (face && !face.startsWith('+') && face !== family)
        warn(
          ctx,
          'PPTX-MIXED-FONT',
          'Mixed font families inside one paragraph need separate Scene text runs.',
        );
      const hyperlink = ctx.links?.get(child(pr, 'hlinkClick')?.attrs['r:id'] ?? '');
      const hyperlinkTextColor =
        descendant(child(pr, 'hlinkClick'), 'hlinkClr')?.attrs.val === 'tx';
      const runColor = color(child(pr, 'solidFill'), ctx) ?? style.color;
      const underline = pr?.attrs.u ?? defaultPr?.attrs.u;
      if (underline && underline !== 'none' && underline !== 'sng')
        warn(
          ctx,
          'PPTX-UNDERLINE',
          `Underline style ${underline} requires a richer run decoration.`,
        );
      paragraph.runs.push({
        text: child(r, 't')?.text ?? '',
        bold: pr?.attrs.b !== undefined ? pr.attrs.b === '1' : bold,
        italic: pr?.attrs.i !== undefined ? pr.attrs.i === '1' : italic,
        color: hyperlink && !hyperlinkTextColor ? (ctx.theme.colors.hlink ?? runColor) : runColor,
        ...(hyperlink?.external ? { link: hyperlink.target } : {}),
        ...(underline !== undefined
          ? { underline: underline !== 'none' }
          : hyperlink?.external
            ? { underline: true }
            : {}),
      });
    }
    const bullet = child(pp, 'buChar')?.attrs.char;
    if (bullet) paragraph.runs.unshift({ text: `${bullet} ` });
    const space = (name: string) =>
      child(child(pp, name), 'spcPts')
        ? num(child(child(pp, name), 'spcPts'), 'val') / 7200
        : ((lineSpacing / 72) * num(child(child(pp, name), 'spcPct'), 'val')) / 100000;
    y += space('spcBef');
    const indent = num(pp, 'marL') / EMU;
    const laid = layoutText([paragraph], style, Math.max(0.001, width - indent));
    const b = {
      x: box.x + pad.l + indent,
      y: box.y + pad.t + y,
      w: Math.max(0.001, width - indent),
      h: laid.contentHeight,
    };
    result.push(makeTextNode([paragraph], b, style, laid, { role }));
    y += laid.contentHeight + space('spcAft');
  }
  const available = box.h - pad.t - pad.b;
  const dy =
    bp?.attrs.anchor === 'ctr' ? (available - y) / 2 : bp?.attrs.anchor === 'b' ? available - y : 0;
  // Preserve paragraph flow when the source uses one uniform text box. Splitting
  // each paragraph into a separate shape accumulates Office's fractional-size
  // line rounding and prevents users from editing the text as one coherent box.
  const grouped: TextNode[] = [];
  const structuralStyle = (s: TextStyle) => {
    const { bold: _bold, italic: _italic, color: _color, ...structure } = s;
    const metrics = vmetrics(
      s.measure,
      s.bold ? (s.italic ? 'boldItalic' : 'bold') : s.italic ? 'italic' : 'regular',
    );
    return JSON.stringify({ ...structure, metrics });
  };
  for (const n of result) {
    const previous = grouped[grouped.length - 1];
    if (
      previous &&
      structuralStyle(previous.style) === structuralStyle(n.style) &&
      Math.abs(previous.box.x - n.box.x) < 1e-9 &&
      Math.abs(previous.box.w - n.box.w) < 1e-9
    ) {
      const gap = n.box.y - previous.box.y - previous.contentHeight;
      const p = n.paragraphs[0]!;
      previous.paragraphs.push({ ...p, ...(gap > 1e-9 ? { spaceBefore: gap * 72 } : {}) });
      const laid = layoutText(previous.paragraphs, previous.style, previous.box.w);
      previous.lines = laid.lines;
      previous.contentHeight = laid.contentHeight;
      previous.box.h = laid.contentHeight;
    } else grouped.push(n);
  }
  for (const n of grouped) n.box.y += dy;
  if (grouped.length === 1) {
    grouped[0]!.textFrame = {
      box: { ...box },
      insets: { ...pad },
      valign: bp?.attrs.anchor === 'ctr' ? 'middle' : bp?.attrs.anchor === 'b' ? 'bottom' : 'top',
    };
  }
  if (bp?.attrs.vert && bp.attrs.vert !== 'horz')
    warn(ctx, 'PPTX-VERTICAL-TEXT', 'Vertical text is not represented in Scene.');
  return grouped;
}

function shapeNodes(shape: Xml, ctx: Context): SceneNode[] {
  const pr = child(shape, 'spPr');
  const xfrm = child(pr, 'xfrm') ?? child(shape, 'xfrm');
  const box = boxOf(xfrm);
  const geometry = child(pr, 'prstGeom');
  const preset = geometry?.attrs.prst ?? 'rect';
  const role = descendant(shape, 'cNvPr')?.attrs.name ?? 'imported-shape';
  const nodes: SceneNode[] = [];
  const p = paint(pr, ctx);
  const flipH = xfrm?.attrs.flipH === '1';
  const flipV = xfrm?.attrs.flipV === '1';
  const rotation = num(xfrm, 'rot') / 60000;
  const transform = ([x, y]: [number, number]): [number, number] => {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const dx = (x - cx) * (flipH ? -1 : 1);
    const dy = (y - cy) * (flipV ? -1 : 1);
    const a = (rotation * Math.PI) / 180;
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
  };
  if (/^(line|straightConnector1|bentConnector[2345])$/.test(preset)) {
    const adjustments = children(child(geometry, 'avLst'), 'gd');
    const adjustment = (name: string) =>
      Number(
        (adjustments.find((g) => g.attrs.name === name)?.attrs.fmla ?? 'val 50000')
          .split(' ')
          .pop(),
      ) / 100000;
    const bendX = box.x + box.w * adjustment('adj1');
    const bendY = box.y + box.h * adjustment('adj2');
    const pts: [number, number][] =
      preset === 'bentConnector3'
        ? [
            [box.x, box.y],
            [bendX, box.y],
            [bendX, box.y + box.h],
            [box.x + box.w, box.y + box.h],
          ]
        : preset === 'bentConnector4'
          ? [
              [box.x, box.y],
              [bendX, box.y],
              [bendX, bendY],
              [box.x + box.w, bendY],
              [box.x + box.w, box.y + box.h],
            ]
          : [
              [box.x, box.y],
              [box.x + box.w, box.y + box.h],
            ];
    if (preset === 'bentConnector2' || preset === 'bentConnector5')
      warn(ctx, 'PPTX-CONNECTOR', `Unsupported connector ${preset}`);
    const arrow = child(child(pr, 'ln'), 'tailEnd')?.attrs.type;
    for (let i = 1; i < pts.length; i++) {
      const a = transform(pts[i - 1]!);
      const b = transform(pts[i]!);
      nodes.push({
        kind: 'line',
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        stroke: p.stroke ?? { color: '#000000', width: 0 },
        ...(i === pts.length - 1 && arrow && arrow !== 'none' ? { arrowEnd: true } : {}),
        role,
      });
    }
  } else if (p.fill || p.stroke) {
    if (preset === 'ellipse') nodes.push({ kind: 'ellipse', box, ...p, role });
    else if (preset === 'rightArrow') {
      const adj = children(child(geometry, 'avLst'), 'gd');
      const a1 =
        Number(
          (adj.find((g) => g.attrs.name === 'adj1')?.attrs.fmla ?? 'val 50000').split(' ').pop(),
        ) / 100000;
      const a2 =
        Number(
          (adj.find((g) => g.attrs.name === 'adj2')?.attrs.fmla ?? 'val 50000').split(' ').pop(),
        ) / 100000;
      const head = Math.min(box.w, Math.min(box.w, box.h) * a2);
      const top = box.y + (box.h * (1 - a1)) / 2;
      const bottom = box.y + (box.h * (1 + a1)) / 2;
      const points: [number, number][] = [
        [box.x, top],
        [box.x + box.w - head, top],
        [box.x + box.w - head, box.y],
        [box.x + box.w, box.y + box.h / 2],
        [box.x + box.w - head, box.y + box.h],
        [box.x + box.w - head, bottom],
        [box.x, bottom],
      ];
      nodes.push({ kind: 'polygon', box, points: points.map(transform), ...p, role });
    } else if (preset === 'rect' || preset === 'roundRect') {
      const adj =
        Number(
          (child(child(geometry, 'avLst'), 'gd')?.attrs.fmla ?? 'val 16667').split(' ').pop(),
        ) / 100000;
      nodes.push({
        kind: 'rect',
        box,
        ...p,
        ...(preset === 'roundRect' ? { radius: Math.min(box.w, box.h) * Math.min(0.5, adj) } : {}),
        role,
      });
      if (rotation)
        warn(ctx, 'PPTX-ROTATION', `Rotated ${preset} requires a rotated Scene primitive.`);
    } else warn(ctx, 'PPTX-GEOMETRY', `Unsupported preset shape ${preset}`);
  }
  if (child(pr, 'custGeom'))
    warn(ctx, 'PPTX-CUSTOM-GEOMETRY', 'Custom DrawingML paths are not represented.');
  const text = child(shape, 'txBody');
  if (text) {
    const textObjects = textNodes(text, box, ctx, role);
    for (const n of textObjects) {
      if (n.textFrame)
        n.textFrame.isTextBox = /^(1|true)$/.test(
          child(child(shape, 'nvSpPr'), 'cNvSpPr')?.attrs.txBox ?? '',
        );
    }
    nodes.push(...textObjects);
    if (rotation) warn(ctx, 'PPTX-TEXT-ROTATION', 'Rotated text is not represented.');
  }
  return nodes;
}

function tableNodes(shape: Xml, ctx: Context): SceneNode[] {
  const table = descendant(shape, 'tbl');
  if (!table) {
    warn(ctx, 'PPTX-GRAPHIC', 'Unsupported graphic frame (chart, SmartArt, or embedded object).');
    return [];
  }
  const box = boxOf(child(shape, 'xfrm'));
  const widths = children(child(table, 'tblGrid'), 'gridCol').map((c) => num(c, 'w') / EMU);
  const role = descendant(shape, 'cNvPr')?.attrs.name ?? 'imported-table';
  const nodes: SceneNode[] = [];
  const borders: SceneNode[] = [];
  const rows = children(table, 'tr');
  const tablePr = child(table, 'tblPr');
  const styleId = child(tablePr, 'tableStyleId')?.text;
  const tableStyle = children(ctx.tableStyles, 'tblStyle').find((s) => s.attrs.styleId === styleId);
  if (styleId && !tableStyle)
    warn(
      ctx,
      'PPTX-TABLE-STYLE',
      `Table style ${styleId} is not defined in the package; its built-in style needs a resolver.`,
    );
  const cellStyles = (row: number, col: number) => {
    const regions = ['wholeTbl'];
    if (tablePr?.attrs.bandRow === '1')
      regions.push(
        (row - (tablePr.attrs.firstRow === '1' ? 1 : 0)) % 2 === 0 ? 'band1H' : 'band2H',
      );
    if (tablePr?.attrs.bandCol === '1')
      regions.push(
        (col - (tablePr.attrs.firstCol === '1' ? 1 : 0)) % 2 === 0 ? 'band1V' : 'band2V',
      );
    if (tablePr?.attrs.firstCol === '1' && col === 0) regions.push('firstCol');
    if (tablePr?.attrs.lastCol === '1' && col === widths.length - 1) regions.push('lastCol');
    if (tablePr?.attrs.firstRow === '1' && row === 0) regions.push('firstRow');
    if (tablePr?.attrs.lastRow === '1' && row === rows.length - 1) regions.push('lastRow');
    return regions.map((r) => child(child(tableStyle, r), 'tcStyle')).filter((s): s is Xml => !!s);
  };
  const cellText = (cell: Xml, b: Box, anchor?: string) => {
    const body = child(cell, 'txBody');
    if (!body) return [];
    const pr = child(cell, 'tcPr');
    const bp = child(body, 'bodyPr') ?? { ...empty(), name: 'bodyPr' };
    const cloned = {
      ...body,
      children: [
        {
          ...bp,
          attrs: { ...bp.attrs, anchor: anchor ?? pr?.attrs.anchor ?? bp.attrs.anchor ?? 't' },
        },
        ...body.children.filter((c) => c.name !== 'bodyPr'),
      ],
    };
    return textNodes(cloned, b, ctx, role, {
      l: num(pr, 'marL', 91440) / EMU,
      r: num(pr, 'marR', 91440) / EMU,
      t: num(pr, 'marT', 45720) / EMU,
      b: num(pr, 'marB', 45720) / EMU,
    });
  };
  let y = box.y;
  for (const [rowIndex, row] of rows.entries()) {
    let h = num(row, 'h') / EMU;
    // DrawingML row height is a minimum. Office grows a row to fit the largest
    // cell, then moves every subsequent row; treating it as fixed compresses tables.
    for (const [column, cell] of children(row, 'tc').entries()) {
      const pr = child(cell, 'tcPr');
      const measured = cellText(cell, { x: 0, y: 0, w: widths[column] ?? 0, h }, 't');
      const bottom = measured.reduce((m, n) => Math.max(m, n.box.y + n.contentHeight), 0);
      h = Math.max(h, bottom + num(pr, 'marB', 45720) / EMU);
    }
    let x = box.x;
    let column = 0;
    for (const cell of children(row, 'tc')) {
      const colIndex = column++;
      const w = widths[colIndex] ?? 0;
      if (
        cell.attrs.gridSpan ||
        cell.attrs.rowSpan ||
        cell.attrs.hMerge === '1' ||
        cell.attrs.vMerge === '1'
      )
        warn(ctx, 'PPTX-MERGED-CELL', 'Merged table cells require explicit span handling.');
      const b = { x, y, w, h };
      const pr = child(cell, 'tcPr');
      const styles = cellStyles(rowIndex, colIndex);
      const inheritedFill = [...styles]
        .reverse()
        .map((s) => child(s, 'fill'))
        .find(Boolean);
      const p = paint(
        child(pr, 'solidFill') || child(pr, 'noFill') ? pr : (inheritedFill ?? pr),
        ctx,
      );
      if (p.fill) nodes.push({ kind: 'rect', box: b, ...p, role });
      for (const [edge, points] of Object.entries({
        lnL: [x, y, x, y + h],
        lnR: [x + w, y, x + w, y + h],
        lnT: [x, y, x + w, y],
        lnB: [x, y + h, x + w, y + h],
      })) {
        const side = (
          { lnL: 'left', lnR: 'right', lnT: 'top', lnB: 'bottom' } as Record<string, string>
        )[edge]!;
        const inside =
          (edge === 'lnL' && colIndex > 0) || (edge === 'lnR' && colIndex < widths.length - 1)
            ? 'insideV'
            : (edge === 'lnT' && rowIndex > 0) || (edge === 'lnB' && rowIndex < rows.length - 1)
              ? 'insideH'
              : side;
        const inherited = [...styles]
          .reverse()
          .map((s) => child(child(s, 'tcBdr'), inside) ?? child(child(s, 'tcBdr'), side))
          .find(Boolean);
        const edgePr = child(pr, edge) ?? child(inherited, 'ln');
        // An omitted border on an unstyled Office table means the default grid;
        // only explicit noFill suppresses it. Draw grid after all cell fills.
        const stroke = edgePr
          ? child(edgePr, 'noFill') || num(edgePr, 'w', 12700) === 0
            ? undefined
            : (paint({ ...empty(), children: [{ ...edgePr, name: 'ln' }] }, ctx).stroke ?? {
                color: '#000000',
                width: num(edgePr, 'w', 12700) / 12700,
              })
          : { color: '#000000', width: 1 };
        if (stroke)
          borders.push({
            kind: 'line',
            x1: points[0]!,
            y1: points[1]!,
            x2: points[2]!,
            y2: points[3]!,
            stroke,
            role,
          });
      }
      nodes.push(...cellText(cell, b));
      x += w;
    }
    y += h;
  }
  const grid = new Map<string, Extract<SceneNode, { kind: 'line' }>>();
  for (const border of borders) {
    if (border.kind !== 'line') continue;
    const key = [border.x1, border.y1, border.x2, border.y2].map((v) => v.toFixed(9)).join(',');
    const previous = grid.get(key);
    if (!previous || border.stroke.width >= previous.stroke.width) grid.set(key, border);
  }
  const strips = new Map<string, Extract<SceneNode, { kind: 'line' }>[]>();
  for (const line of grid.values()) {
    const vertical = Math.abs(line.x1 - line.x2) < 1e-9;
    const key = `${vertical ? 'v' : 'h'}:${(vertical ? line.x1 : line.y1).toFixed(9)}:${JSON.stringify(line.stroke)}`;
    const strip = strips.get(key) ?? [];
    strip.push(line);
    strips.set(key, strip);
  }
  const continuous: Extract<SceneNode, { kind: 'line' }>[] = [];
  for (const strip of strips.values()) {
    const vertical = Math.abs(strip[0]!.x1 - strip[0]!.x2) < 1e-9;
    strip.sort((a, b) => (vertical ? a.y1 - b.y1 : a.x1 - b.x1));
    let current: Extract<SceneNode, { kind: 'line' }> | undefined;
    for (const line of strip) {
      if (current && (vertical ? line.y1 - current.y2 : line.x1 - current.x2) <= 1e-9) {
        if (vertical) current.y2 = Math.max(current.y2, line.y2);
        else current.x2 = Math.max(current.x2, line.x2);
      } else {
        current = { ...line };
        continuous.push(current);
      }
    }
  }
  // Office draws a table grid as uninterrupted strokes, extending each endpoint
  // by half its width so outer corners and intersections meet without a gap.
  for (const line of continuous) {
    const half = line.stroke.width / 144;
    if (Math.abs(line.x1 - line.x2) < 1e-9) {
      line.y1 -= half;
      line.y2 += half;
    } else {
      line.x1 -= half;
      line.x2 += half;
    }
  }
  return [...nodes, ...continuous];
}

/** Returns a native Scene, plus loss diagnostics and per-object provenance. */
export async function importPptxScene(
  file: string,
  options: PptxSceneImportOptions = {},
): Promise<ImportedPptxScene> {
  const path = resolve(file);
  const bytes = readFileSync(path);
  const zip = await JSZip.loadAsync(bytes);
  const read = async (part: string) => {
    const data = await zip.file(part)?.async('string');
    return data ? xml(data) : empty();
  };
  const presentation = await read('ppt/presentation.xml');
  const rels = await relationships(zip, 'ppt/presentation.xml');
  const parts = children(child(presentation, 'sldIdLst'), 'sldId').map(
    (s) => rels.get(s.attrs['r:id']!)?.target,
  );
  if (!parts.length || parts.some((p) => !p))
    throw new Error('PPTX has no valid ordered slide relationships');
  const diagnostics: PptxSceneDiagnostic[] = [];
  const shapes: PptxSourceShape[] = [];
  const id =
    options.id ??
    (basename(file, extname(file))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
      'imported');
  const scene: Scene = {
    deckId: id,
    title: basename(file, extname(file)),
    language: 'en',
    format: {
      id: 'imported',
      w: num(child(presentation, 'sldSz'), 'cx') / EMU,
      h: num(child(presentation, 'sldSz'), 'cy') / EMU,
    },
    themeId: 'source-pptx',
    masters: { source: { id: 'source', background: '#FFFFFF', nodes: [] } },
    slides: [],
  };
  if (!(scene.format.w > 0 && scene.format.h > 0))
    throw new Error('PPTX has invalid slide dimensions');
  const fonts = new Map<string, string>();
  const tableStyles = await read('ppt/tableStyles.xml');
  for (const [index, part] of parts.entries()) {
    const root = await read(part!);
    const slideRels = await relationships(zip, part!);
    const layoutPart = [...slideRels.values()].find((r) => r.type.endsWith('/slideLayout'))?.target;
    const layout = layoutPart ? await read(layoutPart) : empty();
    const layoutRels = layoutPart
      ? await relationships(zip, layoutPart)
      : new Map<string, Relationship>();
    const masterPart = [...layoutRels.values()].find((r) =>
      r.type.endsWith('/slideMaster'),
    )?.target;
    const master = masterPart ? await read(masterPart) : empty();
    const masterRels = masterPart
      ? await relationships(zip, masterPart)
      : new Map<string, Relationship>();
    const themePart =
      [...masterRels.values()].find((r) => r.type.endsWith('/theme'))?.target ??
      'ppt/theme/theme1.xml';
    const theme = themeFrom(await read(themePart));
    const clrMap = child(master, 'clrMap');
    for (const [key, value] of Object.entries(clrMap?.attrs ?? {}))
      if (theme.colors[value]) theme.colors[key] = theme.colors[value]!;
    const ctx: Context = {
      diagnostics,
      options,
      fonts,
      theme,
      slide: index + 1,
      shape: '',
      tableStyles,
      defaults: child(
        child(master, 'txStyles')
          ? child(child(master, 'txStyles'), 'otherStyle')
          : child(presentation, 'defaultTextStyle'),
        'lvl1pPr',
      ),
    };
    const nodes: SceneNode[] = [];
    const explicitTitles: TextNode[] = [];
    const layers =
      root.attrs.showMasterSp === '0'
        ? [{ root, part: part! }]
        : [
            { root: master, part: masterPart ?? '' },
            { root: layout, part: layoutPart ?? '' },
            { root, part: part! },
          ];
    for (const layer of layers) {
      ctx.links = layer.root === root ? slideRels : layer.root === layout ? layoutRels : masterRels;
      for (const shape of child(child(layer.root, 'cSld'), 'spTree')?.children ?? []) {
        if (shape.name === 'nvGrpSpPr' || shape.name === 'grpSpPr') continue;
        if (layer.root !== root && descendant(shape, 'ph')) continue;
        const info = descendant(shape, 'cNvPr');
        ctx.shape = info?.attrs.name ?? info?.attrs.id ?? shape.name;
        const start = nodes.length;
        if (shape.name === 'sp' || shape.name === 'cxnSp') nodes.push(...shapeNodes(shape, ctx));
        else if (shape.name === 'graphicFrame') nodes.push(...tableNodes(shape, ctx));
        else warn(ctx, 'PPTX-OBJECT', `Unsupported slide object ${shape.name}`);
        const ph = descendant(shape, 'ph')?.attrs.type;
        const isTitle = ph === 'title' || ph === 'ctrTitle' || /^title(?:[-\s]|$)/i.test(ctx.shape);
        for (let i = start; i < nodes.length; i++) {
          const node = nodes[i]!;
          if (isTitle && node.kind === 'text') explicitTitles.push(node);
          node.role = `ppt:${posix.basename(layer.part, '.xml')}-${info?.attrs.id ?? start}-${i - start}`;
        }
        shapes.push({
          slide: index + 1,
          part: layer.part,
          id: info?.attrs.id ?? '',
          name: ctx.shape,
          type: shape.name,
          box: boxOf(child(child(shape, 'spPr'), 'xfrm') ?? child(shape, 'xfrm')),
          nodes: Array.from({ length: nodes.length - start }, (_, i) => start + i),
        });
      }
    }
    const background =
      [root, layout, master]
        .map((r) =>
          color(
            child(child(child(r, 'cSld'), 'bg'), 'bgPr')
              ? child(child(child(child(r, 'cSld'), 'bg'), 'bgPr'), 'solidFill')
              : child(child(r, 'cSld'), 'bg'),
            ctx,
          ),
        )
        .find(Boolean) ?? '#FFFFFF';
    const text = nodes.filter((n): n is TextNode => n.kind === 'text');
    const titleNode =
      explicitTitles[0] ??
      text
        .filter((n) => n.box.y < scene.format.h * 0.25 && plainText(n.paragraphs).length > 8)
        .reduce<TextNode | undefined>(
          (best, n) => (!best || n.style.size > best.style.size ? n : best),
          undefined,
        );
    const title = explicitTitles.length
      ? explicitTitles.map((n) => plainText(n.paragraphs)).join('\n')
      : titleNode
        ? plainText(titleNode.paragraphs)
        : `Slide ${index + 1}`;
    if (titleNode) titleNode.role = 'title';
    const notesPart = [...slideRels.values()].find((r) => r.type.endsWith('/notesSlide'))?.target;
    const notesRoot = notesPart ? await read(notesPart) : empty();
    const notes = children(child(child(notesRoot, 'cSld'), 'spTree'), 'sp')
      .filter((s) => descendant(s, 'ph')?.attrs.type === 'body')
      .flatMap((s) =>
        children(child(s, 'txBody'), 'p').map((p) =>
          p.children
            .filter((r) => r.name === 'r' || r.name === 'fld')
            .map((r) => child(r, 't')?.text ?? '')
            .join(''),
        ),
      )
      .join('\n');
    scene.slides.push({
      id: `s${String(index + 1).padStart(2, '0')}`,
      index,
      layout: 'imported-native',
      master: 'source',
      background,
      nodes,
      title,
      ...(notes ? { notes } : {}),
    });
  }
  if (scene.slides.some((s) => /[А-Яа-яЁё]/.test(s.title))) scene.language = 'ru';
  scene.title = scene.slides[0]?.title ?? scene.title;
  if (options.strict && diagnostics.length)
    throw new Error(
      `PPTX Scene import needs review:\n${diagnostics.map((d) => `${d.code}: slide ${d.slide}, ${d.shape}: ${d.message}`).join('\n')}`,
    );
  return {
    scene,
    diagnostics,
    shapes,
    source: { path, sha256: createHash('sha256').update(bytes).digest('hex') },
  };
}
