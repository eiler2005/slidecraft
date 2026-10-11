/**
 * Scene IR — the single source of geometry for every engine.
 *
 * Layouts compose slides into these primitives; engines (PPTX, PDF, SVG/PNG, HTML)
 * only translate them. Geometry is in inches from the slide's top-left corner,
 * font sizes and line spacing in points. Text arrives pre-measured: `lines` holds the
 * exact line breaks our measurer computed, so vector engines draw identical layouts
 * and the PPTX engine can rely on PowerPoint wrapping the same way (metric-compatible
 * fonts, exact line spacing, zero insets, no autofit).
 */
import type { MeasureFont } from '../spec/theme.ts';

export type Color = string; // #RRGGBB

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: Color;
  /** Hyperlink target (source URLs). */
  link?: string;
}

export interface Paragraph {
  runs: Run[];
  bullet?: boolean;
  /** Space before the paragraph, pt. Ignored for the first paragraph. */
  spaceBefore?: number;
}

export interface TextStyle {
  /** Family written into PPTX/HTML (e.g. Arial). */
  family: string;
  /** Bundled font used for measuring and vector rendering. */
  measure: MeasureFont;
  size: number;
  /** Exact line spacing, pt. */
  lineSpacing: number;
  color: Color;
  bold?: boolean;
  italic?: boolean;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle' | 'bottom';
  /** Letter case transform applied at compose time is already in the text. */
  caps?: boolean;
}

export interface LineSegment {
  text: string;
  /** Offset from the box left edge, inches. */
  x: number;
  width: number;
  bold: boolean;
  italic: boolean;
  color: Color;
  link?: string;
}

export interface Line {
  /** Baseline offset from the box top, inches. */
  baseline: number;
  segments: LineSegment[];
  /** Bullet glyph position, if this line starts a bulleted paragraph. */
  bulletX?: number;
}

export interface TextNode {
  kind: 'text';
  box: Box;
  style: TextStyle;
  paragraphs: Paragraph[];
  lines: Line[];
  /** Measured content height, inches. */
  contentHeight: number;
  /** Hanging indent for bullets, pt. */
  bulletIndent: number;
  role?: string;
  /** JSON pointer of the deck field this text came from (for diagnostics). */
  pointer?: string;
}

export interface Stroke {
  color: Color;
  /** Width, pt. */
  width: number;
  dash?: 'solid' | 'dash' | 'dot';
}

export interface RectNode {
  kind: 'rect';
  box: Box;
  fill?: Color;
  /** 0–1 */
  fillOpacity?: number;
  stroke?: Stroke;
  /** Corner radius, inches. */
  radius?: number;
  role?: string;
}

export interface EllipseNode {
  kind: 'ellipse';
  box: Box;
  fill?: Color;
  fillOpacity?: number;
  stroke?: Stroke;
  role?: string;
}

/** Closed polygon, absolute points in inches (chevrons, arrows, Harvey balls). */
export interface PolygonNode {
  kind: 'polygon';
  /** Bounding box of the points (computed by ctx.polygon). */
  box: Box;
  points: [number, number][];
  fill?: Color;
  fillOpacity?: number;
  stroke?: Stroke;
  role?: string;
}

export interface LineNode {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: Stroke;
  arrowEnd?: boolean;
  role?: string;
}

export interface ImageNode {
  kind: 'image';
  box: Box;
  /** Absolute path to a PNG/JPEG, or undefined for a placeholder. */
  path?: string;
  /** Raw image bytes (e.g. rendered decor). */
  data?: { mime: 'image/png' | 'image/jpeg'; base64: string };
  /** SVG source for vector engines when available (decor). */
  svg?: string;
  alt: string;
  fit: 'cover' | 'contain';
  placeholderLabel?: string;
  decorative?: boolean;
  role?: string;
}

export interface TableCell {
  text: TextNode;
  fill?: Color;
  borderBottom?: Stroke;
  borderTop?: Stroke;
}

export interface TableNode {
  kind: 'table';
  box: Box;
  colW: number[];
  rowH: number[];
  cells: TableCell[][];
  /** Inner cell padding, inches. */
  pad: { l: number; r: number; t: number; b: number };
  role?: string;
  pointer?: string;
}

export type ChartType = 'bar' | 'column' | 'stacked-column' | 'stacked-bar' | 'line' | 'waterfall';

export interface ChartSeries {
  name: string;
  values: number[];
  color: Color;
  /** Hidden helper series (waterfall base). */
  invisible?: boolean;
  /** Per-point colors overriding the series color. */
  pointColors?: (Color | undefined)[];
}

export interface ChartNode {
  kind: 'chart';
  box: Box;
  type: ChartType;
  categories: string[];
  series: ChartSeries[];
  axis: { min: number; max: number; major: number; format: string; hidden: boolean };
  labels: { show: boolean; format: string; size: number; color: Color };
  catLabels: { size: number; color: Color };
  font: { family: string; measure: MeasureFont };
  gapWidth: number;
  legend: boolean;
  /** Plot area (absolute inches) — native charts get it as a manual layout. */
  plot: Box;
  /**
   * When false, the PPTX engine hides native data labels and draws the computed
   * label primitives (role `chart-label`) on top instead (waterfall).
   */
  nativeLabels: boolean;
  /** Category axis labels drawn natively (true) or via primitives. */
  nativeCatLabels: boolean;
  barDir: 'col' | 'bar';
  grouping: 'clustered' | 'stacked';
  /** Vector fallback for engines without native charts (SVG, PDF, HTML). */
  primitives: SceneNode[];
  role?: string;
  pointer?: string;
}

export type SceneNode =
  | TextNode
  | RectNode
  | EllipseNode
  | PolygonNode
  | LineNode
  | ImageNode
  | TableNode
  | ChartNode;

export interface SlideNumberSpec {
  box: Box;
  style: TextStyle;
}

export interface Master {
  id: string;
  background: Color;
  /** Static nodes drawn under every slide using this master (decor, footer, rules). */
  nodes: SceneNode[];
  slideNumber?: SlideNumberSpec;
}

export interface SceneSlide {
  id: string;
  index: number;
  layout: string;
  variant?: string;
  master: string;
  /** Optional per-slide background override. */
  background?: Color;
  nodes: SceneNode[];
  notes?: string;
  /** Plain title text, for manifests, outlines and accessibility. */
  title: string;
}

export interface Scene {
  deckId: string;
  title: string;
  author?: string;
  language: string;
  format: { id: string; w: number; h: number };
  themeId: string;
  masters: Record<string, Master>;
  slides: SceneSlide[];
  /** Theme roles and fonts for document engines (one-pager, DOCX) that lay out their own pages. */
  palette?: {
    background: Color;
    ink: Color;
    muted: Color;
    accent: Color;
    rule: Color;
    surface: Color;
  };
  fonts?: Record<'heading' | 'body', { family: string; measure: MeasureFont }>;
  meta?: { subtitle?: string; date?: string; organization?: string };
  /** Absolute path of a brand Office theme part to write into PPTX output. */
  officeTheme?: string;
}

export const PT_PER_IN = 72;
export const pt2in = (pt: number) => pt / PT_PER_IN;
export const in2pt = (inch: number) => inch * PT_PER_IN;
