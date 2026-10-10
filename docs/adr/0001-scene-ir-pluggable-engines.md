# 0001 — One Scene IR, pluggable output engines

**Status:** Accepted · 2026-10-10

## Context
Users need the same deck as an editable PPTX, a PDF, PNG previews and an HTML deck, from different engines (open, office-suite, Codex). The predecessor project wrote layouts directly against one proprietary PPTX API, which made every other output and every engine swap a rewrite, and it ran three overlapping pipelines with different canvases.

## Decision
Layouts compose slides into a backend-neutral **Scene IR** (`src/engine/scene.ts`): text with pre-broken lines and exact line spacing, rects, ellipses, polygons, lines, images, tables, charts (data + computed axes + vector primitives), masters and notes, all in inches/points. **Engines only translate** the IR (`src/backends/*`), behind one interface with `detect()` and `render()`, registered in a registry with deterministic `auto` resolution.

## Consequences
- A new engine is one file; layouts never change. Previews, PDF and PPTX share geometry and line breaks.
- QA runs on the IR (bounds, overlap, contrast) independent of the engine, plus engine-specific checks on outputs.
- Charts carry both native parameters and vector primitives; engines without native charts draw the primitives.
- Features the IR lacks (e.g. rotated text) must be added to the IR and every engine, which keeps engines honest but slows exotic visuals — freeform HTML mode is planned separately (M6).
