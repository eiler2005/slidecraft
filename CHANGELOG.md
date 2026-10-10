# Changelog

All notable changes to SlideCraft. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

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
