import type { Scene } from '../engine/scene.ts';
import type { Diagnostic } from '../qa/codes.ts';

export type OutputKind = 'pptx' | 'pdf' | 'png' | 'html';

export interface Detection {
  available: boolean;
  version?: string;
  /** Why it is unavailable, or where it was found. */
  detail?: string;
  /** How to make it available. */
  install?: string;
}

export interface Capabilities {
  editable: boolean;
  nativeCharts: boolean;
  speakerNotes: boolean;
  /** How closely the output matches what PowerPoint shows. */
  fidelity: 'native' | 'identical' | 'same-layout' | 'preview';
  install: string;
  ci: boolean;
}

export interface RenderOptions {
  outDir: string;
  /** File stem, e.g. deck id. */
  baseName: string;
  deckDir: string;
  /** Fixed timestamp for reproducible output (SOURCE_DATE_EPOCH). */
  epoch: Date;
  /** Path to an already-built PPTX (for engines that convert from PPTX). */
  pptxPath?: string;
  /** PNG preview width in px. */
  previewWidth?: number;
}

export interface OutputFile {
  path: string;
  kind: OutputKind;
  engine: string;
}

export interface RenderResult {
  files: OutputFile[];
  diagnostics: Diagnostic[];
  limitations: string[];
}

export interface Engine {
  id: string;
  kind: OutputKind;
  label: string;
  license: string;
  /** Proprietary engines print a notice and are never bundled. */
  proprietary?: boolean;
  capabilities: Capabilities;
  /** Engines that need a built PPTX first. */
  needsPptx?: boolean;
  detect(): Promise<Detection>;
  render(scene: Scene, opts: RenderOptions): Promise<RenderResult>;
}
