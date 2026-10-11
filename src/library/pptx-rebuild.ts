import '../backends/extra.ts';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { resolveEngine } from '../backends/registry.ts';
import type { OutputFile, OutputKind } from '../backends/types.ts';
import { type BuildOptions, epochDate } from '../build.ts';
import { VERSION } from '../paths.ts';
import { checkChrome } from '../qa/chrome.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import { verifyPptx } from '../qa/pptx-verify.ts';
import { importPptxScene } from './pptx-scene-import.ts';

/** Geometry-preserving import → shared Scene → independent output engines.
 * This is a real rebuild, never a renamed copy of the original file. */
export async function rebuildPptx(file: string, opts: BuildOptions = {}) {
  const imported = await importPptxScene(file);
  const scene = imported.scene;
  const diagnostics: Diagnostic[] = imported.diagnostics.map((d) =>
    diag('SC-IMPORT-001', `${d.code}: ${d.message}`, {
      slide: d.slide ? `s${String(d.slide).padStart(2, '0')}` : undefined,
      measured: d.shape,
    }),
  );
  // Give every imported primitive an identity: frame and body cannot quietly
  // disappear merely because the source used arbitrary PowerPoint shape names.
  for (const slide of scene.slides) {
    slide.nodes.forEach((node, i) => {
      if (node.role !== 'title' && !node.role?.startsWith('ppt:')) node.role = `ppt:object-${i}`;
    });
    slide.requiredRoles = slide.nodes.map((n) => n.role!);
  }
  diagnostics.push(...checkChrome(scene));
  const files: OutputFile[] = [];
  const outDir = resolve(opts.outDir ?? join(dirname(file), 'rebuilt'));
  const baseName = `${basename(file, extname(file))}-rebuilt`;
  const formats = opts.formats ?? ['pptx', 'html'];
  const engines: Record<string, { id: string; reason: string }> = {};
  const limitations: string[] = [
    'Imported native geometry is rebuilt through shared Scene IR. Office-rendered visual verification remains required.',
  ];
  mkdirSync(outDir, { recursive: true });
  let pptxPath: string | undefined;
  if (!diagnostics.some((d) => d.severity === 'error')) {
    for (const kind of (['pptx', 'html', 'pdf', 'png'] as OutputKind[]).filter((k) =>
      formats.includes(k),
    )) {
      const requested =
        kind === 'pptx'
          ? (opts.pptxEngine ?? 'pptxgenjs')
          : kind === 'pdf'
            ? opts.pdfEngine
            : kind === 'png'
              ? opts.pngEngine
              : undefined;
      const { engine, reason } = await resolveEngine(kind, requested);
      if (!engine || (engine.needsPptx && !pptxPath)) {
        diagnostics.push(
          diag(
            'SC-ENGINE-001',
            `${kind}: ${reason}; a built PPTX is required by conversion engines`,
            { severity: 'error' },
          ),
        );
        continue;
      }
      if (engine.proprietary)
        throw new Error(
          'Reference fidelity rebuild uses portable engines; proprietary evaluation adapters are not used for this comparison',
        );
      const result = await engine.render(scene, {
        outDir,
        baseName,
        deckDir: dirname(resolve(file)),
        epoch: epochDate(),
        pptxPath,
        previewWidth: opts.previewWidth,
      });
      files.push(...result.files);
      diagnostics.push(...result.diagnostics);
      limitations.push(...result.limitations);
      engines[kind] = { id: engine.id, reason };
      if (kind === 'pptx') {
        pptxPath = result.files.find((f) => f.kind === 'pptx')?.path;
        if (pptxPath) diagnostics.push(...(await verifyPptx(pptxPath, scene)).diagnostics);
      }
    }
  }
  const manifestPath = join(outDir, 'manifest.json');
  const manifest = {
    tool: 'slidecraft',
    version: VERSION,
    mode: 'native-reference-rebuild',
    source: { file: basename(file), sha256: imported.source.sha256 },
    slides: scene.slides.length,
    engines,
    diagnostics,
    limitations,
    visual_review: false,
    outputs: files.map((f) => ({
      ...f,
      sha256: createHash('sha256').update(readFileSync(f.path)).digest('hex'),
    })),
    sourceObjects: imported.shapes,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(outDir, 'scene.json'), `${JSON.stringify(scene, null, 2)}\n`);
  return { scene, files, diagnostics, manifestPath, engines };
}
