# 0005 — Measure text with metric-compatible open fonts; never truncate

**Status:** Accepted · 2026-10-10

## Context
Generated decks fail most visibly through text overflow. PowerPoint wraps text itself; we must predict its line breaks. Arial and Georgia are installed almost everywhere but cannot be redistributed.

## Decision
Measure with bundled OFL fonts whose advance widths match the system fonts written into PPTX: Liberation Sans ↔ Arial, Liberation Serif ↔ Times New Roman, Gelasio ↔ Georgia. Text boxes use zero insets, exact line spacing, no autofit and no kerning. Copy-fitting steps the size down to the theme's `minBody`; beyond that the engine **refuses** with `SC-FIT-001` (characters to cut, pointer to the field) instead of truncating. Themes declare a Cyrillic override because Gelasio has no Cyrillic glyphs.

**Calibration (go/no-go, 2026-10-10):** 144 strings (EN + RU; Arial, Georgia, Times; 11/14/20 pt; regular/bold; three widths) built to PPTX and exported by Microsoft PowerPoint: 98.6% identical line counts, **0 cases where PowerPoint needed more lines** than measured. Script: `scripts/calibrate.ts`.

## Consequences
- "Fits in SlideCraft" ⇒ "fits in PowerPoint" for the supported fonts.
- Theme fonts are limited to these families until a brand-font calibration flow exists (M3).
- Previews and native PDF render with the substitute fonts (same metrics, slightly different glyph shapes).
