# Changelog

All notable changes to SlideCraft. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [0.2.0] — 2026-10-11

### Added
- **Import (M5):** `slidecraft import file.pptx [--render]` extracts slides in order — titles (placeholder or largest text), native chart data, tables, pictures, notes — into a draft `deck.yaml`. Over-limit text is shortened, and the original is kept in notes. `--render` writes `original.pdf` through PowerPoint or LibreOffice. New skill `/slidecraft:import` redesigns the draft from the rendered original (vision pass, old → new title chain checkpoint).
- **Brand master (M3):** `theme import` keeps the template's Office theme part (`officeTheme`). Every PPTX built with the theme carries it, so PowerPoint's Design tab and colour and font pickers show the brand.
- **Layouts (M4):** `text` (bullets, paragraphs, two-column), `before-after`, `maturity-model` (grid, staircase), `coverage-map`, `org-chart` — 27 in total. **Storylines:** `sales-qbr`, `investment-memo` — 14 in total.
- **Accessible PDF (M6):** the native PDF is tagged. Titles are `H1`, charts and pictures are `Figure` with alt text (chart alt text lists the data), tables are `TH`/`TD`, and decoration is marked as artifacts.
- **Source links (M6):** sources with a `url` become hyperlinks in PPTX (run colour kept), PDF, HTML and DOCX.
- **Documents (M6):**
  - `format: a4-landscape`, with every layout checked in A4;
  - `onepager` output: A4 portrait title chain with vector thumbnails;
  - `docx` output: Word memo with headings, editable text and tables, exhibits as images, links and notes.
- **Images (M6):** `imagePrompt` on `text-image`; `slidecraft images deck.yaml [--dry-run] [--force]` fills empty slots through an OpenAI-compatible API and writes `image:` back with comments preserved.
- **Visual regression (M6):** `tests/visual.test.ts` hashes PNG renders of every layout example in a light and a dark theme. CI uploads the changed renders on failure.
- **Gallery site (M6):** `slidecraft site` builds the full gallery and every example in every format; `.github/workflows/pages.yml` publishes it to GitHub Pages. Only the curated images stay in git.
- **npm (M6):** package `@eiler2005/slidecraft` (bin `slidecraft`) with zero runtime dependencies (everything is in the bundle), a `files` whitelist and a `prepublishOnly` check.

### Changed
- `artifact-tool` adapter: decor, footer and logo live on real slide layouts instead of every slide. Chart plot areas are pinned to SlideCraft geometry after export, so stacked totals are drawn and line up. The brand Office theme is applied here too.
- `raci` legend scales to narrow pages.

## Earlier unreleased work (shipped in 0.2.0)

### Added
- `SLIDECRAFT_PPTX_ENGINE` / `SLIDECRAFT_PDF_ENGINE`: machine-wide engine preference used for `auto`, with automatic fallback.
- **Codex:** `slidecraft codex install` packages the skills for OpenAI Codex; verified with a live `codex exec` run.
- **Live end-to-end runs** of `/slidecraft:new` with the plugin agents (Opus strategist, Sonnet writers, Haiku copy-fitter, Opus reviewer) and of Codex; fixes from both: `new --json`, scaffold honours `length.slides` (breadth-first), panel-overflow check `SC-GEOM-003`, YAML comma and deck-field hints, plan layouts exempt from source checks, recommended formats carried into the deck, `options-comparison` up to 5 options, clearer `layouts <theme-id>` error, shorter `task` placeholder.
- **Brand (M3):** `theme import` from .pptx/.potx (colours, fonts, logo), brand font files as measure fonts, logo on masters, `calibrate --theme` against PowerPoint; `theme:` may be a JSON path next to the deck.
- **Layouts (M4):** `issue-tree`, `raci`, `gate-matrix`, `process-compare`, `funnel`, `risk-matrix` (22 total). **Storylines:** `project-kickoff`, `post-mortem`, `training-workshop` (12 total).
- **Example:** `examples/europe-first-trip` — five-slide travel guide.
- `ensureContrast()` colour helper.
- Docs: [engines compared](docs/explanation/engines-compared.md) — pros, cons and recommended setups.

## [0.1.0] — 2026-10-10

### Added
- **Rendering core.** Scene IR with pre-broken text lines; fontkit measurer on metric-compatible OFL fonts (Liberation Sans ↔ Arial, Liberation Serif ↔ Times New Roman, Gelasio ↔ Georgia) with a Cyrillic override; copy-fitting that never truncates.
- **Engines.** `pptxgenjs` PPTX with slide masters, native tables and charts and speaker notes; native vector PDF (pdfkit); PNG previews (resvg); self-contained HTML deck with presenter notes and Chrome-printed PDF; `pptx-convert` via Microsoft PowerPoint (macOS) or LibreOffice; optional adapter for the proprietary Codex `artifact-tool` runtime (never bundled).
- **Library.** 16 layouts, 6 themes, 9 storylines; methodology references (writing, visual, exhibit selection, patterns, review, storytelling).
- **Workflow CLI.** `new`, `templates`, `pick`, `choose`, `scaffold`, `validate`, `check`, `build`, `layouts`, `themes`, `storylines`, `schema`, `gallery`, `gen`, `doctor`, `library check`.
- **Claude Code plugin.** Skills `new`, `pick`, `build`, `review`, `storyline-architect`, `exhibit-chooser`, `deck-spec`, `action-title-writer`, `ghost-deck-skeleton`, `partner-review-checklist`; agents `deck-strategist` (Opus), `slide-writer` (Sonnet), `copy-fitter` (Haiku), `partner-reviewer` (Opus).
- **QA.** Stable `SC-*` diagnostic codes with JSON pointers, measured vs limit and fix hints; title, source, geometry, contrast and density checks; PPTX text-presence and image-resolution checks; deterministic outputs; build manifest.
- **Examples.** Strategy recommendation, narrative story, pitch deck and executive update — fictional data, zero diagnostics.
- **Docs.** README with gallery, tutorials, how-to guides, generated reference, explanation pages and ADRs 0001–0007.
- **Repo hygiene.** CI on Ubuntu and macOS, bundle and generated-docs drift checks, privacy-check hooks with tests, issue and PR templates.
