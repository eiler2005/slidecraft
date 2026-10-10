import { composeDeck } from '../engine/compose.ts';
import { previewDeck } from '../gallery.ts';
import { LAYOUTS } from '../layouts/index.ts';
import { type Diagnostic, diag } from '../qa/codes.ts';
import { checkScene } from '../qa/scene-checks.ts';
import { loadStorylines, loadThemes } from './load.ts';

/** Cross-checks: storylines reference real layouts/themes; every storyline preview composes cleanly. */
export function libraryCheck(): Diagnostic[] {
  const out: Diagnostic[] = [];
  const layoutIds = new Set(LAYOUTS.map((l) => l.id));
  const themes = loadThemes();
  const themeIds = new Set(themes.map((t) => t.id));
  for (const s of loadStorylines()) {
    for (const t of s.themes)
      if (!themeIds.has(t))
        out.push(diag('SC-SPEC-002', `storyline ${s.id}: unknown theme "${t}"`));
    for (const sec of s.sections) {
      for (const slot of sec.slots) {
        for (const l of slot.layouts)
          if (!layoutIds.has(l))
            out.push(diag('SC-SPEC-002', `storyline ${s.id}/${slot.id}: unknown layout "${l}"`));
      }
    }
    const { scene, diagnostics } = composeDeck(previewDeck(s, s.themes[0]!));
    for (const d of [...diagnostics, ...checkScene(scene)]) {
      if (d.severity === 'error')
        out.push({ ...d, message: `storyline ${s.id} preview: ${d.message}` });
    }
  }
  for (const t of themes) {
    if (!t.bestFor.length)
      out.push(diag('SC-SPEC-001', `theme ${t.id}: empty bestFor`, { severity: 'warning' }));
  }
  return out;
}
