import './backends/extra.ts';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { flattenFreeform, nativeFreeform } from './backends/freeform-raster.ts';
import { detect, resolveEngine } from './backends/registry.ts';
import type { OutputFile, OutputKind } from './backends/types.ts';
import { composeDeck } from './engine/compose.ts';
import type { Scene } from './engine/scene.ts';
import { getTheme, type LoadedDeck, loadDeck } from './library/load.ts';
import { VERSION } from './paths.ts';
import { checkChrome } from './qa/chrome.ts';
import { type Diagnostic, diag } from './qa/codes.ts';
import { checkConsistency } from './qa/consistency.ts';
import { verifyPptx } from './qa/pptx-verify.ts';
import { checkScene } from './qa/scene-checks.ts';

export interface BuildOptions {
  formats?: OutputKind[];
  pptxEngine?: string;
  pdfEngine?: string;
  pngEngine?: string;
  outDir?: string;
  previewWidth?: number;
}

export interface CheckResult {
  loaded: LoadedDeck;
  scene?: Scene;
  diagnostics: Diagnostic[];
}

export function sortDiagnostics(d: Diagnostic[]): Diagnostic[] {
  const rank = { error: 0, warning: 1, info: 2 } as const;
  return [...d].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Validate + compose + scene QA, no files written. */
export function checkDeck(path: string): CheckResult {
  const loaded = loadDeck(path);
  const diagnostics = [...loaded.diagnostics];
  if (diagnostics.some((d) => d.severity === 'error' && d.code.startsWith('SC-SPEC')))
    return { loaded, diagnostics };
  const { scene, diagnostics: cd } = composeDeck(loaded);
  diagnostics.push(
    ...cd,
    ...checkScene(scene),
    ...checkChrome(scene),
    ...checkConsistency(loaded.slides),
  );
  return { loaded, scene, diagnostics: sortDiagnostics(diagnostics) };
}

export function epochDate(): Date {
  const env = process.env.SOURCE_DATE_EPOCH;
  if (env && /^\d+$/.test(env)) return new Date(Number(env) * 1000);
  return new Date(Date.UTC(2026, 0, 1));
}

const sha256 = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

export interface BuildResult extends CheckResult {
  files: OutputFile[];
  manifestPath?: string;
  engines: Record<string, { id: string; reason: string; license: string }>;
}

export async function buildDeck(path: string, opts: BuildOptions = {}): Promise<BuildResult> {
  const checked = checkDeck(path);
  const { loaded, scene } = checked;
  const diagnostics = [...checked.diagnostics];
  const files: OutputFile[] = [];
  const engines: BuildResult['engines'] = {};
  if (
    !scene ||
    diagnostics.some(
      (d) => d.severity === 'error' && (d.code.startsWith('SC-SPEC') || d.code === 'SC-CHROME-001'),
    )
  ) {
    return { ...checked, files, engines };
  }
  const deck = loaded.deck;
  const outDir = resolve(opts.outDir ?? join(loaded.baseDir, 'dist'));
  mkdirSync(outDir, { recursive: true });
  const theme = getTheme(deck.theme);
  const formats = opts.formats ?? deck.output?.formats ?? ['pptx', 'pdf', 'png'];
  const epoch = epochDate();
  const limitations = new Set<string>();
  const hasFreeform = scene.slides.some((s) => s.nodes.some((n) => n.kind === 'html'));
  const order: OutputKind[] = ['pptx', 'png', 'html', 'pdf', 'onepager', 'docx'];
  let pptxPath: string | undefined;
  // HTML stays live; editable PPTX uses native primitives, raster export is explicit.
  let flat = scene;
  if (hasFreeform && formats.includes('pptx') && deck.output?.editablePptx !== false) {
    const f = await nativeFreeform(scene);
    flat = f.scene;
    diagnostics.push(...f.diagnostics);
    diagnostics.push(...checkChrome(flat));
    if (
      diagnostics.some(
        (d) => d.severity === 'error' && (d.code === 'SC-EDIT-002' || d.code === 'SC-CHROME-001'),
      )
    )
      return { ...checked, diagnostics: sortDiagnostics(diagnostics), files, engines };
  } else if (hasFreeform) {
    // labels may use the theme's small size; anything smaller is flagged
    const f = await flattenFreeform(scene, theme?.type.small ?? 9);
    flat = f.scene;
    diagnostics.push(...f.diagnostics);
  }

  for (const kind of order.filter((k) => formats.includes(k))) {
    const requested =
      kind === 'pptx'
        ? (opts.pptxEngine ?? deck.output?.engines.pptx)
        : kind === 'pdf'
          ? (opts.pdfEngine ?? deck.output?.engines.pdf)
          : kind === 'png'
            ? (opts.pngEngine ?? deck.output?.engines.png)
            : undefined;
    const { engine, reason } = await resolveEngine(kind, requested, theme);
    if (!engine) {
      diagnostics.push(diag('SC-ENGINE-001', `${kind}: ${reason}`));
      continue;
    }
    if (engine.needsPptx && !pptxPath) {
      diagnostics.push(diag('SC-ENGINE-001', `${engine.label} needs a PPTX; add pptx to formats`));
      continue;
    }
    if (engine.proprietary) {
      process.stderr.write(
        `notice: ${engine.label} is proprietary (${engine.license}); it is used from your local install and never bundled.\n`,
      );
    }
    const d = await detect(engine);
    const r = await engine.render(engine.id === 'html' ? scene : flat, {
      outDir,
      baseName: deck.id,
      deckDir: loaded.baseDir,
      epoch,
      ...(pptxPath ? { pptxPath } : {}),
      ...(opts.previewWidth ? { previewWidth: opts.previewWidth } : {}),
    });
    engines[kind] = { id: engine.id, reason, license: engine.license };
    if (d.version) engines[kind].reason += ` (v${d.version})`;
    files.push(...r.files);
    diagnostics.push(...r.diagnostics);
    r.limitations.forEach((l) => limitations.add(l));
    if (kind === 'pptx') {
      pptxPath = r.files.find((f) => f.kind === 'pptx')?.path;
      if (pptxPath) {
        const v = await verifyPptx(pptxPath, flat);
        diagnostics.push(...v.diagnostics);
      }
    }
  }

  const sorted = sortDiagnostics(diagnostics);
  const manifest = {
    tool: 'slidecraft',
    version: VERSION,
    deck: {
      id: deck.id,
      title: deck.title,
      status: deck.status,
      theme: deck.theme,
      storyline: deck.storyline ?? null,
      slides: scene.slides.length,
    },
    input: { path: relative(outDir, loaded.path), sha256: sha256(loaded.path) },
    ...(loaded.data
      ? {
          data: {
            files: loaded.data.files.map((f) => ({
              path: relative(outDir, f.path),
              sha256: f.sha256,
            })),
            facts: loaded.data.facts,
          },
        }
      : {}),
    epoch: epoch.toISOString(),
    engines,
    outputs: files.map((f) => ({
      path: relative(outDir, f.path),
      kind: f.kind,
      engine: f.engine,
      sha256: sha256(f.path),
    })),
    checks: {
      errors: sorted.filter((d) => d.severity === 'error').length,
      warnings: sorted.filter((d) => d.severity === 'warning').length,
      info: sorted.filter((d) => d.severity === 'info').length,
      codes: [...new Set(sorted.map((d) => d.code))],
    },
    ...(() => {
      // stock photo credits: author, licence and page of every photo in the deck
      const credits = loaded.slides.flatMap((s) => {
        const c = (s as { imageCredit?: Record<string, string>; image?: string }).imageCredit;
        return c ? [{ slide: s.id, image: (s as { image?: string }).image ?? null, ...c }] : [];
      });
      return credits.length ? { imageCredits: credits } : {};
    })(),
    visual_review: false,
    limitations: [...limitations],
    slides: scene.slides.map((s) => ({
      id: s.id,
      layout: s.layout,
      variant: s.variant ?? null,
      title: s.title,
    })),
  };
  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { loaded, scene, diagnostics: sorted, files, manifestPath, engines };
}
