# Changelog

All notable changes to SlideCraft. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

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
