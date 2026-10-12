import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { ChartSpec, ComposeContext, TableSpec, TextOpts } from '../layouts/types.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import type { FontSpec, Theme } from '../spec/theme.ts';
import { buildChart } from './charts.ts';
import type { Format } from './format.ts';
import { label, typeset } from './i18n.ts';
import { iconNode } from './icons.ts';
import type { Box, Paragraph, SceneNode, TableCell, TableNode, TextStyle } from './scene.ts';
import { balanceLines, fitText, layoutText, makeTextNode, para, plainText } from './text.ts';

export interface ContextInit {
  theme: Theme;
  format: Format;
  fonts: { heading: FontSpec; body: FontSpec };
  slideId: string;
  slideIndex: number;
  pointerPrefix?: string;
  variant: string;
  slide: { title: string; lead?: string };
  body: Box;
  baseDir: string;
  /** Deck language: labels SlideCraft draws and typography follow it. */
  language?: string;
}

export function sizeLadder(start: number, min: number): number[] {
  const out: number[] = [];
  for (let s = start; s >= min - 1e-6; s -= start > 20 ? 2 : 1) out.push(+s.toFixed(1));
  if (out[out.length - 1] !== min) out.push(min);
  return out;
}

export function createContext(
  init: ContextInit,
): ComposeContext & { nodes: SceneNode[]; diagnostics: Diagnostic[] } {
  const { theme, format, fonts } = init;
  const nodes: SceneNode[] = [];
  const diagnostics: Diagnostic[] = [];
  const base = init.pointerPrefix ?? `/slides/${init.slideIndex}`;
  const ptr = (field?: string) => (field ? `${base}/${field}` : base);
  const colors = { ...theme.colors, chart: theme.chart };

  const semantic = (s: TextOpts['size']): number => {
    if (typeof s === 'number') return s;
    return theme.type[s ?? 'body'];
  };

  const toParagraphs = (content: string | string[] | Paragraph[]): Paragraph[] => {
    if (typeof content === 'string') return content.split(/\n{2,}/).map((p) => para(p));
    if (content.length === 0) return [para('')];
    if (typeof content[0] === 'string') return (content as string[]).map((p) => para(p));
    return content as Paragraph[];
  };

  const ctx: ComposeContext & { nodes: SceneNode[]; diagnostics: Diagnostic[] } = {
    nodes,
    diagnostics,
    theme,
    format,
    fonts,
    slideId: init.slideId,
    slideIndex: init.slideIndex,
    variant: init.variant,
    slide: init.slide,
    baseDir: init.baseDir,
    body: init.body,
    page: { x: 0, y: 0, w: format.w, h: format.h },
    colors,
    ptr,
    language: init.language ?? 'en',
    t: (key) => label(init.language, key),

    paragraphs(items, opts = {}) {
      return items.map((t, i) => {
        const p = para(t, opts.bullet ? { bullet: true } : {});
        if (i > 0 && opts.spaceBefore) p.spaceBefore = opts.spaceBefore;
        return p;
      });
    },

    text(content, box, opts = {}) {
      const paragraphs = toParagraphs(content).map((p) => ({
        ...p,
        runs: p.runs.map((r) => ({ ...r, text: typeset(r.text, init.language) })),
      }));
      const font = opts.font === 'heading' ? fonts.heading : fonts.body;
      const start = semantic(opts.size);
      const sizes =
        opts.sizes ??
        (opts.fixed ? [start] : sizeLadder(start, Math.min(start, theme.type.minBody)));
      const style: Omit<TextStyle, 'size' | 'lineSpacing'> = {
        family: font.family,
        measure: font.measure,
        color: opts.color ?? theme.colors.ink,
        bold: opts.bold ?? false,
        italic: opts.italic ?? false,
        align: opts.align ?? 'left',
        valign: opts.valign ?? 'top',
      };
      const extra: Parameters<typeof fitText>[5] = {};
      if (opts.role) extra.role = opts.role;
      if (opts.field) extra.pointer = ptr(opts.field);
      if (opts.bulletIndent) extra.bulletIndent = opts.bulletIndent;
      if (opts.maxLines !== undefined) extra.maxLines = opts.maxLines;
      const r = fitText(
        paragraphs,
        box,
        style,
        sizes,
        opts.lineHeight ?? theme.type.lineHeight,
        extra,
      );
      const txt = plainText(paragraphs);
      if (!r.fits) {
        const laid = layoutText(paragraphs, r.node.style, box.w, opts.bulletIndent ?? 14);
        if (laid.splitWord) {
          diagnostics.push(
            diag(
              'SC-FIT-003',
              `A word in "${txt.slice(0, 60)}" is wider than its ${box.w.toFixed(2)}in column`,
              {
                slide: init.slideId,
                pointer: ptr(opts.field),
              },
            ),
          );
        } else {
          const lineIn = r.node.style.lineSpacing / 72;
          const extraLines = Math.max(
            1,
            Math.ceil(r.overflow / lineIn - 1e-6),
            r.lines - r.maxLines,
          );
          const avgCharsPerLine = Math.max(1, Math.round(txt.length / Math.max(1, r.lines)));
          diagnostics.push(
            diag(
              'SC-FIT-001',
              `Text does not fit at ${r.size}pt: needs ${r.lines} lines, box holds ${r.maxLines}`,
              {
                slide: init.slideId,
                pointer: ptr(opts.field),
                measured: `${txt.length} chars / ${r.lines} lines`,
                limit: `${r.maxLines} lines`,
                hint: `Cut about ${extraLines * avgCharsPerLine} characters (+${extraLines} line${extraLines > 1 ? 's' : ''}), split the point, or move detail to notes.`,
              },
            ),
          );
        }
      } else if (r.size < start - 0.01 && !opts.sizes) {
        diagnostics.push(
          diag('SC-FIT-002', `Text shrunk from ${start}pt to ${r.size}pt to fit`, {
            slide: init.slideId,
            pointer: ptr(opts.field),
          }),
        );
      }
      // Headlines never end on a widow: balance the break, same number of lines.
      const node =
        r.fits && (opts.role === 'title' || opts.role === 'subtitle')
          ? balanceLines(r.node)
          : r.node;
      nodes.push(node);
      return node;
    },

    rect(box, opts = {}) {
      const n = { kind: 'rect' as const, box, ...opts };
      nodes.push(n);
      return n;
    },

    ellipse(box, opts = {}) {
      const n = { kind: 'ellipse' as const, box, ...opts };
      nodes.push(n);
      return n;
    },

    icon(name, box, opts = {}) {
      const n = iconNode(name, box, opts.color ?? theme.colors.accent);
      if (opts.field) n.pointer = ptr(opts.field);
      nodes.push(n);
      return n;
    },

    polygon(points, opts = {}) {
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const n = {
        kind: 'polygon' as const,
        box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y },
        points,
        ...opts,
      };
      nodes.push(n);
      return n;
    },

    line(x1, y1, x2, y2, stroke = {}, opts = {}) {
      const n = {
        kind: 'line' as const,
        x1,
        y1,
        x2,
        y2,
        stroke: {
          color: stroke.color ?? theme.colors.rule,
          width: stroke.width ?? 0.75,
          ...(stroke.dash ? { dash: stroke.dash } : {}),
        },
        ...(opts.arrowEnd ? { arrowEnd: true } : {}),
        ...(opts.role ? { role: opts.role } : {}),
      };
      nodes.push(n);
      return n;
    },

    image(box, src, alt, opts = {}) {
      let path: string | undefined;
      if (src) {
        const p = isAbsolute(src) ? src : resolve(init.baseDir, src);
        if (existsSync(p)) path = p;
      }
      if (!path) {
        diagnostics.push(
          diag('SC-IMG-002', src ? `Image not found: ${src}` : 'Image slot is empty', {
            slide: init.slideId,
            pointer: ptr(opts.field),
            severity: src ? 'warning' : 'info',
          }),
        );
      }
      const n = {
        kind: 'image' as const,
        box,
        ...(path ? { path } : {}),
        alt,
        fit: opts.fit ?? 'cover',
        placeholderLabel: opts.label ?? 'Image placeholder',
        role: 'image',
      };
      nodes.push(n);
      return n;
    },

    table(spec: TableSpec, box: Box): TableNode {
      const rowsAll = spec.header ? [spec.header, ...spec.rows] : spec.rows;
      const ncol = Math.max(...rowsAll.map((r) => r.length));
      const weights =
        spec.colWeights ?? Array.from({ length: ncol }, (_, i) => (i === 0 ? 1.3 : 1));
      const wsum = weights.reduce((a, b) => a + b, 0);
      const colW = weights.map((w) => (box.w * w) / wsum);
      const pad = { l: 0.08, r: 0.08, t: 0.06, b: 0.06 };
      const start = spec.size ?? theme.type.body - 1;
      const ladder = sizeLadder(start, theme.type.minBody - 1);
      let chosen: { cells: TableCell[][]; rowH: number[] } | undefined;
      let fitted = false;
      for (const size of ladder) {
        const cells: TableCell[][] = [];
        const rowH: number[] = [];
        rowsAll.forEach((row, ri) => {
          const isHead = !!spec.header && ri === 0;
          const dataRow = spec.header ? ri - 1 : ri;
          const cellRow: TableCell[] = [];
          let maxH = 0;
          for (let ci = 0; ci < ncol; ci++) {
            const raw = row[ci] ?? '';
            const hl =
              spec.highlightCol === ci ||
              (spec.highlightRow !== undefined && spec.highlightRow === dataRow);
            const s: TextStyle = {
              family: (isHead ? fonts.heading : fonts.body).family,
              measure: (isHead ? fonts.heading : fonts.body).measure,
              size: isHead ? Math.max(size - 1, theme.type.small) : size,
              lineSpacing: +((isHead ? Math.max(size - 1, theme.type.small) : size) * 1.18).toFixed(
                2,
              ),
              color: isHead ? (hl ? theme.colors.accent : theme.colors.muted) : theme.colors.ink,
              bold:
                isHead ||
                (spec.firstColBold !== false && ci === 0) ||
                (hl && !isHead && spec.highlightRow === dataRow),
              align: spec.align?.[ci] ?? 'left',
              valign: 'top',
            };
            const ps = [para(raw)];
            const w = colW[ci]! - pad.l - pad.r;
            const laid = layoutText(ps, s, w);
            const hgt = laid.contentHeight + pad.t + pad.b;
            maxH = Math.max(maxH, hgt);
            const cell: TableCell = {
              text: makeTextNode(ps, { x: 0, y: 0, w, h: laid.contentHeight }, s, laid),
            };
            if (hl && !isHead) cell.fill = theme.colors.accentSoft;
            if (isHead) cell.borderBottom = { color: theme.colors.ink, width: 1 };
            else cell.borderBottom = { color: theme.colors.rule, width: 0.5 };
            cellRow.push(cell);
          }
          rowH.push(Math.max(maxH, isHead ? 0.34 : 0.36));
          cells.push(cellRow);
        });
        chosen = { cells, rowH };
        if (rowH.reduce((a, b) => a + b, 0) <= box.h + 1e-3) {
          fitted = true;
          break;
        }
      }
      const { cells, rowH } = chosen!;
      // place cell text boxes absolutely
      let y = box.y;
      cells.forEach((row, ri) => {
        let x = box.x;
        row.forEach((cell, ci) => {
          const w = colW[ci]!;
          cell.text.box = {
            x: x + pad.l,
            y: y + pad.t,
            w: w - pad.l - pad.r,
            h: rowH[ri]! - pad.t - pad.b,
          };
          x += w;
        });
        y += rowH[ri]!;
      });
      const total = rowH.reduce((a, b) => a + b, 0);
      if (!fitted) {
        diagnostics.push(
          diag('SC-FIT-001', `Table needs ${total.toFixed(2)}in, box holds ${box.h.toFixed(2)}in`, {
            slide: init.slideId,
            pointer: ptr(spec.field),
            measured: `${rowsAll.length} rows`,
            limit: `${box.h.toFixed(2)}in`,
            hint: 'Shorten cell text, drop a row or column, or move detail to backup.',
          }),
        );
      }
      const node: TableNode = {
        kind: 'table',
        box: { ...box, h: Math.min(total, box.h + 2) },
        colW,
        rowH,
        cells,
        pad,
        role: 'table',
        ...(spec.field ? { pointer: ptr(spec.field) } : {}),
      };
      nodes.push(node);
      return node;
    },

    chart(spec: ChartSpec, box: Box) {
      const n = buildChart(spec, box, { theme, font: fonts.body, language: init.language });
      if (spec.field) n.pointer = ptr(spec.field);
      nodes.push(n);
      return n;
    },

    add(node) {
      nodes.push(node);
    },

    issue(d) {
      diagnostics.push({ ...d, slide: d.slide ?? init.slideId });
    },
  };
  return ctx;
}
