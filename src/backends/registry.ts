import type { Theme } from '../spec/theme.ts';
import { nativePdfEngine } from './native-pdf.ts';
import { pptxgenjsEngine } from './pptxgenjs.ts';
import { resvgEngine } from './resvg.ts';
import type { Detection, Engine, OutputKind } from './types.ts';

const ENGINES: Engine[] = [pptxgenjsEngine, nativePdfEngine, resvgEngine];

/** Register additional engines (html, pptx-convert, artifact-tool live in their own modules). */
export function registerEngine(e: Engine): void {
  if (!ENGINES.some((x) => x.id === e.id && x.kind === e.kind)) ENGINES.push(e);
}

export function engines(): Engine[] {
  return ENGINES;
}

export function findEngine(kind: OutputKind, id: string): Engine | undefined {
  return ENGINES.find((e) => e.kind === kind && e.id === id);
}

const detectCache = new Map<string, Promise<Detection>>();
export function detect(e: Engine): Promise<Detection> {
  const k = `${e.kind}:${e.id}`;
  let d = detectCache.get(k);
  if (!d) {
    d = e.detect().catch((err) => ({ available: false, detail: String(err) }));
    detectCache.set(k, d);
  }
  return d;
}

export function inCodex(): boolean {
  return !!(
    process.env.CODEX_HOME ||
    process.env.CODEX_SANDBOX ||
    process.env.CODEX_MANAGED_BY_NPM ||
    process.env.SLIDECRAFT_IN_CODEX
  );
}

/**
 * Resolve `auto` deterministically:
 *  pptx: artifact-tool when running inside Codex and detected, else pptxgenjs.
 *  pdf:  html when the theme prefers html and Chrome is available, else native.
 *  png:  resvg.  html: html.
 */
export async function resolveEngine(
  kind: OutputKind,
  requested: string | undefined,
  theme?: Theme,
): Promise<{ engine?: Engine; reason: string }> {
  const req = requested && requested !== 'auto' ? requested : undefined;
  // Machine-wide preference (e.g. SLIDECRAFT_PPTX_ENGINE=artifact-tool for Codex users):
  // used only when the deck asks for `auto`, and falls back to the auto chain if unavailable.
  const pref = !req ? process.env[`SLIDECRAFT_${kind.toUpperCase()}_ENGINE`] : undefined;
  if (pref && pref !== 'auto') {
    const e = findEngine(kind, pref);
    if (e && (await detect(e)).available)
      return { engine: e, reason: `preferred via SLIDECRAFT_${kind.toUpperCase()}_ENGINE` };
  }
  if (req) {
    const e = findEngine(kind, req);
    if (!e) return { reason: `unknown ${kind} engine "${req}"` };
    const d = await detect(e);
    return d.available
      ? { engine: e, reason: 'requested' }
      : { reason: `${e.label} unavailable: ${d.detail ?? ''}` };
  }
  if (kind === 'pptx') {
    const at = findEngine('pptx', 'artifact-tool');
    if (at && inCodex() && (await detect(at)).available)
      return { engine: at, reason: 'auto: running inside Codex' };
    return { engine: pptxgenjsEngine, reason: 'auto: default' };
  }
  if (kind === 'pdf') {
    const html = findEngine('pdf', 'html');
    if (html && theme?.prefers === 'html' && (await detect(html)).available)
      return { engine: html, reason: 'auto: theme prefers html' };
    return { engine: nativePdfEngine, reason: 'auto: default' };
  }
  if (kind === 'png') return { engine: resvgEngine, reason: 'auto: default' };
  const html = findEngine('html', 'html');
  return html
    ? { engine: html, reason: 'auto: default' }
    : { reason: 'html engine not registered' };
}
