/**
 * Output recommendation: what the user will do with the deck → formats and engines.
 * The same table is documented in docs/how-to/choose-output-engine.md.
 */
import { detect, findEngine, inCodex } from '../backends/registry.ts';
import type { OutputKind } from '../backends/types.ts';
import type { Usage } from '../spec/brief.ts';
import type { Theme } from '../spec/theme.ts';

export interface OutputPlan {
  formats: OutputKind[];
  engines: { pptx: string; pdf: string };
  rationale: string[];
}

async function has(kind: OutputKind, id: string): Promise<boolean> {
  const e = findEngine(kind, id);
  return !!e && (await detect(e)).available;
}

export async function recommendOutput(usage: Usage[], theme?: Theme): Promise<OutputPlan> {
  const u = new Set(usage.length ? usage : ['edit-together']);
  const formats = new Set<OutputKind>(['pptx', 'pdf', 'png']);
  const pptx = 'pptxgenjs';
  let pdf = 'native';
  const why: string[] = [];

  if (u.has('codex') || inCodex()) {
    why.push(
      'Codex uses the same portable themes, components and pptxgenjs engine as other agents. The optional local artifact-tool adapter must be selected explicitly for internal evaluation/testing only, not production, commercial use or benchmarking.',
    );
  }
  if (u.has('send-pdf')) {
    if (await has('pdf', 'pptx-convert')) {
      pdf = 'pptx-convert';
      why.push(
        'PDF goes to readers: convert the PPTX with your office suite so the PDF matches PowerPoint exactly.',
      );
    } else
      why.push(
        'PDF goes to readers: native vector PDF (install PowerPoint or LibreOffice for a pixel-identical PDF).',
      );
  }
  if (u.has('web-link') || u.has('present-live')) {
    formats.add('html');
    if (
      (theme?.prefers === 'html' || u.has('web-link')) &&
      pdf === 'native' &&
      (await has('pdf', 'html'))
    ) {
      pdf = 'html';
      why.push(
        'Web or live presenting: self-contained deck.html, PDF printed by Chrome from the same page.',
      );
    } else why.push('Web or live presenting: self-contained deck.html for the browser.');
  }
  if (u.has('edit-together') || u.has('automation')) {
    why.push(
      'Editable PPTX with native text, tables and charts; deterministic vector PDF; PNG previews.',
    );
  }
  return { formats: [...formats], engines: { pptx, pdf }, rationale: why };
}
