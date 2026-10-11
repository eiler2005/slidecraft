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

## v0.2 – v0.4 — shipped

### M3 — Bring your brand · *shipped*

- ✅ Theme from a `.pptx`/`.potx`: colours, fonts, logo (`slidecraft theme import`).
- ✅ Brand font files as measure fonts (`fonts.*.files`), embedded in PDF, PNG and HTML.
- ✅ The template's Office theme part travels into PPTX output (Design tab, colour and font pickers).
- ✅ `slidecraft calibrate --theme …` — go/no-go report against PowerPoint or LibreOffice.
- ✅ Template reuse: pictures in place, the template's title band and slide size as the frame, action titles as title placeholders.
- ✅ PPTX built inside the brand template: slides linked to its Title Slide / Title Only / Section Header layouts, with its slide-number and footer placeholders. Simple vector decoration is imported for PDF, PNG and HTML (0.4).

### M4 — Library growth · *shipped*

- ✅ 31 layouts: adds architecture with register, evidence chain and role calendar to the 27 of 0.2.
- ✅ Added in 0.2: issue/driver tree, RACI, gate matrix, current-vs-proposed process, funnel/pyramid, risk heatmap, maturity model, coverage map, before/after, org chart, text.
- ✅ 14 storylines. Added: project kickoff, post-mortem, training/workshop, sales QBR, investment memo.
- ✅ 32 layouts: `callout` covers V15, so all 15 visual patterns now have a layout (0.4).
- Next: variant-level "when not to use" examples in the reference.

### M5 — From your existing PPTX · *shipped*

- ✅ `slidecraft import` — content, tables, chart data, pictures and notes into `deck.yaml`; `--render` for the original as PDF.
- ✅ `/slidecraft:import` — Claude reads the rendered original and redesigns each slide (action titles, exhibits, sources).
- Next: emit reusable layout definitions from a template's geometry (editable vs decorative regions, text capacity).

### M6 — Quality and reach · *shipped*

- ✅ Visual regression on PNG hashes of every layout in a light and a dark theme, in CI.
- ✅ Tagged, accessible PDF (headings, alt text, table headers, artifacts); source hyperlinks in every format.
- ✅ A4 landscape format, one-pager, DOCX memo.
- ✅ Image generation for `text-image` slots (`slidecraft images`, opt-in; prompt kept as provenance).
- ✅ npm package [`@eiler2005/slidecraft`](https://www.npmjs.com/package/@eiler2005/slidecraft) published (zero runtime deps; `npx @eiler2005/slidecraft`), gallery site on GitHub Pages.
- ✅ Freeform HTML slides with the same overflow and text-size checks.
- ✅ `slidecraft fix`: fit loop with measured character budgets, applied by JSON pointer.
- ✅ PPTX accessibility: title placeholders read first, chart alt text in words, decorative marks; `SC-A11Y-*` checks (0.4).

## v0.5 — shipped

Your material in, your edits back, every AI app.

- ✅ **MCP server** (`slidecraft mcp`) with 18 tools and a `make_deck` prompt, including slide previews as images; **`slidecraft install`** connects Claude Code, Codex, Claude Desktop, Cursor, VS Code, Windsurf and Gemini CLI in one command.
- ✅ **Excel and CSV into charts and tables** (`from: { file, sheet, range }`), and **`facts:`** written once and used as `{{id}}`; files and values pinned in the manifest.
- ✅ **Cross-slide consistency check** (`SC-CONSIST-001`): one metric, one value.
- ✅ **Document intake with page-level sources:** `ingest` (PDF, DOCX, PPTX, XLSX, CSV, MD) and `find`; slides cite `report#p14`, PDF links open the page.
- ✅ **Edits flow back:** `sync` writes text edited in PowerPoint, Keynote or Google Slides back into deck.yaml.
- ✅ **Frameworks and charts pack:** `swot`, `five-forces`, `pestel`, `business-model-canvas`, `bubble-chart` (bubble, scatter, portfolio), `marimekko`, `tornado`, `football-field` — 40 layouts.

## v0.6 — next

| Item | Why | Notes |
|---|---|---|
| **Stock photos** (Pexels, Pixabay) next to generation | Real photos for story decks instead of generated ones, with credit lines | Provider option for `slidecraft images`; attribution goes to the source line and the manifest |
| **Icon library** (Lucide or Tabler, MIT) | Icons for `key-points`, `process-steps` and similar | Optional per item; one icon set per theme; used sparingly in consulting themes |
| **Live preview** (`slidecraft preview --watch`) | Edit YAML, see the slide instantly | Local server with hot reload of the HTML deck and diagnostics overlay |
| **Table sync** | Bring edited table cells back too | Extends `sync` to `data-table` and option tables |

## Principles for what goes in

- Keep the four layers independent: storyline, layout, format, theme.
- Every new layout ships with a contract, examples for each variant, harness coverage in all themes, and docs.
- No proprietary dependency in the default path.
