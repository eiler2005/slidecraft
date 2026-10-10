# 0003 — pptxgenjs is the default PPTX engine; artifact-tool is an optional local adapter

**Status:** Accepted · 2026-10-10

## Context
The predecessor built PPTX only through `@oai/artifact-tool` from the Codex runtime. Its license (checked in version 2.8.24) is *proprietary, internal evaluation and testing only*, forbids distribution and production/commercial use, and the package is not on npm — CI and most users cannot get it. Its API is capable (native text, tables, charts, notes, PNG export) but has no PDF export and no text measurement.

## Decision
- **Default:** `pptxgenjs` (MIT): native text boxes with zero insets and exact line spacing, native tables, native charts with explicit axes and manual plot layout, slide masters per theme, speaker notes. Output zips are normalised for byte-reproducibility.
- **Optional:** an `artifact-tool` adapter that *calls* a locally installed Codex runtime (found via `SLIDECRAFT_ARTIFACT_TOOL` or the stable runtime symlink, version ≥ 2.7.3). It is never copied, vendored or bundled; `auto` selects it only inside Codex; the build prints a license notice and the manifest records `proprietary`.

## Consequences
- Every user and CI gets editable PPTX with no proprietary dependency.
- Codex users can still use their runtime; documented limitations: chrome drawn per slide, runtime-controlled plot area (stacked totals and waterfall connectors omitted), approximate bullet indents.
