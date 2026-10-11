import type { Scene } from '../engine/scene.ts';
import { type Diagnostic, diag } from './codes.ts';

/** Checks the actual serialized HTML, not merely that compose intended chrome. */
export function verifyHtml(html: string, scene: Scene): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const sections = [
    ...html.matchAll(/<section\b[^>]*data-slide="(\d+)"[^>]*>([\s\S]*?)<\/section>/g),
  ];
  for (const slide of scene.slides) {
    const section = sections.find((m) => Number(m[1]) === slide.index + 1)?.[2];
    if (!section) {
      diagnostics.push(diag('SC-HTML-002', 'Slide absent from rendered HTML', { slide: slide.id }));
      continue;
    }
    const roles = [...section.matchAll(/data-sc-role="([^"]+)"/g)].map((m) => m[1]);
    for (const role of slide.requiredRoles ?? []) {
      const count = roles.filter(
        (value) => value === role || (role === 'page-number' && value === 'chrome-page-number'),
      ).length;
      if (count !== 1)
        diagnostics.push(
          diag('SC-HTML-002', `HTML element ${role}: expected once, found ${count}`, {
            slide: slide.id,
          }),
        );
    }
  }
  return diagnostics;
}
