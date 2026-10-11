import type { Scene } from '../engine/scene.ts';
import { type Diagnostic, diag } from './codes.ts';

/** Validate declared frame requirements independently of the frame renderer.
 * A composer bug must not redefine missing chrome as an intentionally empty frame. */
export function checkChrome(scene: Scene): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const slide of scene.slides) {
    const master = scene.masters[slide.master];
    const nodes = [...(master?.nodes ?? []), ...slide.nodes];
    for (const role of slide.requiredRoles ?? []) {
      const count =
        role === 'page-number'
          ? Number(!!master?.slideNumber) +
            nodes.filter((n) => n.role === 'chrome-page-number').length
          : nodes.filter((n) => n.role === role).length;
      if (count !== 1)
        diagnostics.push(
          diag('SC-CHROME-001', `Required slide element ${role}: expected once, found ${count}`, {
            slide: slide.id,
          }),
        );
    }
  }
  return diagnostics;
}
