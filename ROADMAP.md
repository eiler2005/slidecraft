# Roadmap

SlideCraft ships in milestones. Each one ends with something people can use, tests that guard it and docs that explain it.

## v0.1 — shipped

**M0 Foundation · M1 Rendering core · M2 Guided workflow · Library v0**

- Scene IR with pre-measured text; metric-compatible fonts; PowerPoint calibration (98.6% identical line breaks, zero overflows on 144 strings).
- Engines: `pptxgenjs` PPTX, native vector PDF, PNG previews, self-contained HTML + Chrome PDF, `pptx-convert` (PowerPoint / LibreOffice), optional `artifact-tool` adapter.
- 16 layouts, 6 themes, 9 storylines, 4 complete example decks, gallery and picker.
- Claude Code plugin: 10 skills, 4 model-tiered agents, four user checkpoints; Codex via `AGENTS.md`.
- QA with stable diagnostic codes; deterministic builds; manifest; CI; privacy hooks.
- Docs: tutorials, how-to guides, generated reference, explanation, ADRs.

## M3 — Bring your brand · *partly shipped*

- ✅ Theme from a `.pptx`/`.potx`: colours, fonts, logo (`slidecraft theme import`).
- ✅ Brand font files as measure fonts (`fonts.*.files`), embedded in PDF/PNG/HTML.
- Use the customer's slide master in PPTX output (placeholders mapped to the frame).
- Logo slot and brand-safe decor; theme preview gallery generated on import.
- ✅ `slidecraft calibrate --theme …` — go/no-go report against PowerPoint/LibreOffice.

## M4 — Library growth · *partly shipped*

- ✅ 22 layouts: added issue/driver tree, RACI, gate matrix, current-vs-proposed process, funnel/pyramid, risk heatmap.
- ✅ Storylines: project kickoff, post-mortem, training/workshop.
- 30+ layouts, covering the full M/V catalogue (`library/references/patterns.md`): issue / diagnostic tree, pyramid, funnel, maturity model, gate matrix, current-vs-proposed process, RACI / decision rights, risk matrix, value driver tree, org chart, coverage map, before/after.
- Storylines: project kickoff, post-mortem, training / workshop, sales QBR, investment committee memo.
- Variant-level thumbnails and "when not to use" examples in the reference.

## M5 — Template from your PPTX

- Render an existing deck, let Claude (vision) mark editable vs decorative regions and text capacity, and emit layout definitions that reuse the original geometry.
- Import an existing deck's content into `deck.yaml` for restyling or review.

## M6 — Quality and reach

- Freeform HTML mode for creative, story-led decks (PDF/web only) with the same overflow checklist.
- Visual regression on golden PNGs in CI; automatic fix loop for fit diagnostics.
- Tagged, accessible PDF; reading-order checks.
- A4 reading decks and one-pagers; DOCX export.
- Image generation for `text-image` slots (opt-in, with provenance in the manifest).
- `npm publish` (`npx slidecraft`), docs site with the gallery on GitHub Pages.

## Principles for what goes in

- Keep the four layers independent: storyline, layout, format, theme.
- Every new layout ships with a contract, examples for each variant, harness coverage in all themes, and docs.
- No proprietary dependency in the default path.
