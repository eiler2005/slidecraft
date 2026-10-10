import type { z } from 'zod';
import type { Format } from '../engine/format.ts';
import type {
  Box,
  ChartNode,
  EllipseNode,
  ImageNode,
  LineNode,
  Paragraph,
  RectNode,
  SceneNode,
  Stroke,
  TableNode,
  TextNode,
} from '../engine/scene.ts';
import type { Diagnostic } from '../qa/codes.ts';
import type { FontSpec, Theme } from '../spec/theme.ts';

export type LayoutGroup =
  | 'frame'
  | 'message'
  | 'numbers'
  | 'decide'
  | 'sequence'
  | 'people'
  | 'close';

/**
 * A layout is one exhibit type. It owns a content contract (zod schema with
 * capacity limits) and a compose function that turns validated content into
 * Scene IR nodes inside the frame the engine prepares.
 */
export interface LayoutDef<S extends z.ZodObject = z.ZodObject> {
  id: string;
  name: string;
  group: LayoutGroup;
  /** Purpose-first description: "Use for X when Y." */
  purpose: string;
  useWhen: string[];
  avoidWhen: string[];
  variants: readonly [string, ...string[]];
  /**
   * standard: the frame draws tracker, action title, lead and source line; the layout fills ctx.body.
   * none: the layout draws the whole slide (covers, dividers, statements).
   */
  frame: 'standard' | 'none';
  master: 'content' | 'cover' | 'divider';
  /** Content fields only. Common fields (id, title, lead, sources, notes…) are added by the deck spec. */
  schema: S;
  /** Sample content used for gallery thumbnails, docs and tests. First entry is canonical. */
  examples: {
    title: string;
    lead?: string;
    variant?: string;
    content: z.input<S>;
    sources?: string[];
  }[];
  compose(ctx: ComposeContext, content: z.infer<S>): void;
}

export interface TextOpts {
  role?: string;
  /** Semantic size or explicit pt. Copy-fitting steps down from here to theme.type.minBody. */
  size?: 'cover' | 'title' | 'subtitle' | 'heading' | 'body' | 'small' | 'source' | number;
  /** Explicit ladder of sizes to try (overrides `size` stepping). */
  sizes?: number[];
  /** Do not shrink below the starting size. */
  fixed?: boolean;
  font?: 'heading' | 'body';
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  maxLines?: number;
  lineHeight?: number;
  /** Field pointer relative to the slide, e.g. "points/1". */
  field?: string;
  bulletIndent?: number;
}

export interface ComposeContext {
  theme: Theme;
  format: Format;
  /** Resolved fonts (Cyrillic override applied). */
  fonts: { heading: FontSpec; body: FontSpec };
  slideId: string;
  variant: string;
  /** Common slide fields (title is the action title / cover title). */
  slide: { title: string; lead?: string };
  /** Content region for standard-frame layouts. */
  body: Box;
  /** The full page box. */
  page: Box;
  colors: Theme['colors'] & { chart: string[] };

  /** Lay out text into a box with copy-fitting; records SC-FIT diagnostics. */
  text(content: string | string[] | Paragraph[], box: Box, opts?: TextOpts): TextNode;
  /** Paragraph helpers. */
  paragraphs(items: string[], opts?: { bullet?: boolean; spaceBefore?: number }): Paragraph[];
  rect(box: Box, opts?: Omit<RectNode, 'kind' | 'box'>): RectNode;
  ellipse(box: Box, opts?: Omit<EllipseNode, 'kind' | 'box'>): EllipseNode;
  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke?: Partial<Stroke>,
    opts?: { arrowEnd?: boolean; role?: string },
  ): LineNode;
  image(
    box: Box,
    src: string | undefined,
    alt: string,
    opts?: { fit?: 'cover' | 'contain'; field?: string; label?: string },
  ): ImageNode;
  table(spec: TableSpec, box: Box): TableNode;
  chart(spec: ChartSpec, box: Box): ChartNode;
  add(node: SceneNode): void;
  issue(d: Diagnostic): void;
  /** Absolute JSON pointer for a slide-relative field. */
  ptr(field?: string): string;
}

export interface TableSpec {
  header?: string[];
  rows: string[][];
  /** Relative column widths. */
  colWeights?: number[];
  /** Index of a column to emphasise (e.g. the recommended option). */
  highlightCol?: number;
  /** Index of a row to emphasise. */
  highlightRow?: number;
  align?: ('left' | 'center' | 'right')[];
  firstColBold?: boolean;
  size?: number;
  field?: string;
}

export interface ChartSpec {
  type: ChartNode['type'];
  categories: string[];
  series: { name: string; values: number[] }[];
  /** Category index to highlight in single-series charts. */
  highlight?: number[];
  unit?: string;
  /** Number of decimals for labels. */
  decimals?: number;
  showAxis?: boolean;
  field?: string;
}
