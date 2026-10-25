# Changelog

All notable changes to SlideCraft. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.8.0] — 2026-10-25

### Changed
- Minimum Node.js version is now 22.13, matching PDF.js 6.4.299. Rebuilds include the updated PDF reader in the standalone bundle.

### Added
- 27 native diagram layouts: numeric heatmap, treemap, Sankey, fishbone, architecture delta, swimlane, dependency graph, flowchart, state machine, sequence, loop, layer stack, Kanban, user journey, service blueprint, ER, physical database schema, UML class, radar, polar, nested containment, Venn, Wardley map, story map, access matrix and two axonometric views. Every layout has a bounded contract and a synthetic example across all themes.
- Editable shape-based dumbbell, slopegraph, bump, observed ridgeline, streamgraph and beeswarm variants; shared numeric geometry and label spreading.
- Bounded semantic `import-diagram` for Mermaid, draw.io and Excalidraw, with a loss ledger and explicit unsupported-input diagnostics.
- Deck-level report/presentation readability; light/dark native diagram example decks; a dedicated website gallery and authoring guide.

### Fixed
- PDF ingestion and theme sampling release the PDF.js loading task on success or failure and preserve colours and filled areas from PDF.js 6 operator lists.
- Cubic native paths preserve fill opacity in HTML/SVG, native PDF and editable PPTX. The optional evaluation adapter reports unsupported paths explicitly.
- Shared graph routing, identity/endpoint checks and quantitative geometry checks reject misleading diagrams. Plot bands can explicitly opt out of text-container containment.
- Contrast correction chooses an achievable black/white endpoint on mid-tone fills.

## [0.7.8] — 2026-10-19

### Fixed
- **npm README launch preview:** replace the deleted GIF with the launch-film poster and links to the 65-second video and MP4. The poster uses an absolute URL pinned to a commit, so npm can display it without package-local assets or a dependency on the current default branch.

### Removed
- **Video tooling moved to [Storygro](https://github.com/eiler2005/Storygro).** The untracked `reelcraft/` prototype, the explainer-GIF generator (`scripts/launch/story.ts`, `gif-story.ts`, `gif.ts`, `npm run launch:gif`), the GIFs and their key frames, and the 23 MB launch MP4 left this repository; Storygro keeps their source and history (`examples/slidecraft-launch`, `docs/history/slidecraft-launch.md`). The README and the site show the poster and link to the film on YouTube; the MP4 is a Storygro release asset. Future SlideCraft videos are made with Storygro.

### Added
- **Claude plugin directory listing:** `.claude-plugin/plugin.json` carries `displayName` (SlideCraft), `version`, the site as `homepage`, and links to docs, support (issues), privacy (README "Privacy and network access") and terms (LICENSE); `.claude-plugin/icon.png` is a 1024 px icon rendered by `scripts/launch/media.ts`. Tests keep the plugin and MCP Registry versions equal to `package.json`.
- README: the MCP server is listed in the official MCP Registry as `io.github.eiler2005/slidecraft`.

### Changed
- **`.gitattributes`:** `* -text` instead of `* text=auto eol=lf` — files are checked out exactly as committed, whatever `core.autocrlf` says; the plugin directory rejects attributes that rewrite content.
- **Repository under 50 MiB** (the plugin directory's limit; was 57.9 MiB): showcase PNGs recompressed losslessly (decoded pixels identical, manifest sha256 updated) and a stray `eiler2005-slidecraft-0.2.0.tgz` removed; `*.tgz` is ignored.
- The privacy hook allows exactly `.claude-plugin/icon.png` besides the existing binary folders.

## [0.7.7] — 2026-10-14

### Fixed
- **No phantom slide masters in the PPTX package.** pptxgenjs 4.0.1 declares `slideMaster2.xml … slideMasterN.xml` in `[Content_Types].xml` (one per slide) but writes only `slideMaster1.xml`; a 12-slide deck carried 11 declarations of missing parts. The export now drops exactly those declarations. Found in a ChatGPT agent-mode run.
- **New check `SC-PPTX-004`:** every part `[Content_Types].xml` declares must exist in the file. Any other missing part is reported as an error instead of being cleaned up silently.
- **Example decks repaired:** the six committed showcase decks built before the fix had the same phantom declarations; only their `[Content_Types].xml` was corrected (every other part is byte-identical, so their renders and review reports still match) and the manifests' sha256 updated.

## [0.7.6] — 2026-10-14

### Added
- **Listed in the official MCP Registry** as `io.github.eiler2005/slidecraft`: `server.json` (stdio, `npx @eiler2005/slidecraft mcp`) and `mcpName` in `package.json`; `glama.json` names the maintainer for Glama.
- **README: "Privacy and network access"** — no account, no telemetry; what goes online and when (npm, stock photos, generated pictures, a theme read from a website), and `--dry-run` to see every prompt or search before it is sent.

### Fixed
- The docs test skips local-only folders (`private/`, `out/`, `clients/`), as the privacy hook does.

## [0.7.5] — 2026-10-14

Found in a full run of the one prompt in ChatGPT agent mode (Linux sandbox, no PowerPoint).

### Fixed
- **Numbered labels are not data:** "1 · Decision", "2. Storyline", "Step 2", "Phase 3", "Неделя 4" no longer need a source (`SC-SRC-001/002`); figures such as "40%", "$69k" or "Phase 2.5" still do. The agent had attached an unrelated source to a proposed checklist to pass the check.
- **Every command accepts `--json`,** as AGENTS.md promises: `choose`, `scaffold`, `codex install/uninstall` and `uninstall` print JSON results; the rest accept the flag and print plain text.
- **Visual QA rasters always match in size:** pages are rasterised to the slide's exact pixel size, so a LibreOffice PDF (959.98 × 540 pt for a 960 × 540 slide) no longer stops the comparison with "Raster dimensions differ".
- **Contrast is sampled where the text is drawn:** a bottom-anchored source line under a takeaway band is no longer reported at 1.12:1.
- Review records name the allowed `severity`, `area` and `status` values when one is wrong.

### Changed
- **LibreOffice is not PowerPoint:** a visual QA pack rendered by LibreOffice says so (`reference: libreoffice`) and explains why parity sits below the 95 % target.
- **Chrome in Linux containers** gets `--disable-dev-shm-usage` (and `--no-sandbox` as root); a time-out explains how to point `CHROME_PATH` at a working Chromium.
- **AGENTS.md:** inside a clone use `node dist/slidecraft.mjs` (npx resolves the local package and fails); what to do when visual QA has no PowerPoint or no browser.
- **README:** the assembly diagram is the workflow picture (npm does not draw Mermaid, so the flowchart showed as code there); the layout count in the table is 46; the ChatGPT agent-mode run is noted.

## [0.7.4] — 2026-10-13

### Changed
- **Gallery site is a landing page:** the tagline, the explainer GIF, the one prompt with a Copy button (read from the README at build time, so the two never disagree), three featured decks, then the gallery; Open Graph and Twitter card tags with a 1280×640 social preview, and a favicon.
- **README** opens with the GIF, a one-line pitch and the one-prompt section; the longer description follows under "What SlideCraft is".
- **README brought up to date:** the layout library lists all 46 layouts (value chain, 7S, combo chart, evidence panorama, composition and the canvas layouts were missing), 0.7.1–0.7.3 are in "Shipped", eleven example decks, 1,200+ tests. The layout count in the GIF, the site and the launch images now comes from the code.

## [0.7.3] — 2026-10-13

### Added
- **`imageFocus`** on the cover (`title`) and `text-image`: which part of a cropped picture stays in view — `left`, `center`, `right`, `top`, `bottom` or `{ x, y }` from 0 to 1. PowerPoint gets an exact crop window (still an editable picture), the PDF and HTML the same crop.

### Fixed
- **Stock photo sizes are measured:** a listing can report the original's size while its link serves a 1024 px preview (Rawpixel on Openverse). Each download is now measured; if it is narrower than 1600 px the next candidate is tried (up to four) and the widest download is kept.
- **Wikimedia Commons:** renditions are requested at a standard width (1920 px) and their real width is read from the link; downloads send a User-Agent as Commons asks.
- **Gallery site:** a deck's own theme (e.g. `fde-desk` next to an example) no longer joins the library theme list, which added a row of broken "FDE desk" images to every storyline on the site.
- **Hyperlinks look the same in every engine:** PowerPoint always underlines links (sources line), through descenders; the HTML, SVG and PDF now do too. The remaining ~83 % on the sources strip is anti-aliasing of 8–9 pt text in a nearly empty region, not a visible difference.
- **`theme from` a dark photograph:** a dark, muted photo could fill one colour cluster and be taken for a screenshot (dark page, low contrast). Flatness now decides too: a screenshot's background is one exact colour, a photo's most common colour covers under a tenth of it.
- FDE v2 example: sharp 1920 px cover photo (was 1024 px); showcase decks re-rendered and re-checked in PowerPoint; calibration corpus re-run (all pages 90.0 %, generated decks 87.4 %).

## [0.7.2] — 2026-10-13

### Fixed
- **Line placement in generated decks:** a spacing multiple of exactly 1 could be computed as 1.0000000000000002 (21.6 pt over 1.2 × 18 pt) and placed with the "above one" rule — 18 pt bold headings sat 1–2 pt too high in the HTML/PDF against PowerPoint in every generated deck. The multiple is now rounded to PPTX precision; on the key-points test slide the worst-region parity rose from 0.85 to 0.92 and the headings match PowerPoint to the pixel.
- The calibration probe now measures generated point spacing (exported as a multiple) as its own mode, so this path is covered on every calibration.
- `slidecraft covers --choose` keeps the deck's formatting when it only adds fields; with no topic match it offers three different motifs.

### Added
- **`SC-COVER-001`:** a cover without a visual is reported, so the cover choice cannot be skipped silently; the plain covers of five examples were chosen with `slidecraft covers`.
- **Sharper stock photos without a key:** `--stock auto` (default) searches Openverse and **Wikimedia Commons** (free licences only, 2400 px renditions) and puts photos ≥ 1600 px first; `--stock wikimedia` on its own.
- README shows the 30-second explainer GIF (`scripts/launch/gif-story.ts`).

## [0.7.1] — 2026-10-13

### Fixed
- **Ghost decks no longer pass silently:** every slide still marked `status: ghost` reports `SC-GHOST-001` (and says when its content is already written); AGENTS.md defines when a deck is done. Found by running the README prompt in Claude Code, which handed over a deck of sketches.
- **Cover options** render as finished covers, also while the deck is still a ghost deck.
- **Template recommender:** explainer, primer and key-concepts briefs rank `training-workshop` first; with no matching words, general storylines lead instead of alphabetical order.
- **Stock photos:** large photos first, ≥ 1600 px preferred for full-height panels; when no photo is found, `--stock` generates from the slide's `imagePrompt` or explains how to.
- `rasterPixels` renders text (fonts loaded).

### Added
- `examples/llm-concepts` — a deck Codex made from the README prompt alone, unedited, with an independent review; the one-prompt path is verified with Codex and Claude Code.
- Gallery images and the README GIF (`scripts/launch/`, own GIF encoder); example covers on the site open the HTML deck; Discussions and a feature-request template.

## [0.7.0] — 2026-10-12

### Added
- **Cover choice:** `slidecraft covers <deck>` renders 2–3 cover options — the topic motifs that fit the title best and a photo — with facts to compare (topic words, licence, sharpness on the panel) and a picker page; the assistant recommends, the user chooses, `--choose` writes it into deck.yaml. A workflow rule: never default the cover ([design the cover](docs/how-to/design-the-cover.md)).
- **Stock photos with licence tracking:** `imageQuery` on cover and text-image slides; `slidecraft images --stock [openverse|pexels|pixabay]`, `--list` to see candidates, `--pick N`; Openverse only returns licences that allow commercial use and changes. `imageCredit` is shown with the sources (on the picture for covers), in the notes and in `manifest.json` ([fill image slots](docs/how-to/generate-images.md)).
- **Icons:** 114 Tabler icons (MIT) drawn as native, editable shapes — PowerPoint freeforms with round caps, paths in HTML and PDF; `icon:` on `key-points` and `process-steps`; `slidecraft icons` lists them ([use icons](docs/how-to/use-icons.md)).
- **Theme from a sample:** `slidecraft theme from <pdf|png|jpg|url>` reads colours, fonts and margins from a reference deck, a screenshot or a website (a photograph gives only its colours) and writes a theme plus a page format ([theme from a sample](docs/how-to/theme-from-sample.md)).
- **Frameworks and charts:** `value-chain` (Porter: support bands, primary chevrons, margin), `seven-s` (McKinsey 7S with aligned/partial/gap ratings), and the `combo` variant of `chart-takeaway` — bars and a line on its own scale, native and editable in PowerPoint.
- **Deeper consistency checks:** `SC-CONSIST-002` totals that do not add up (total rows and columns, "Total" categories, waterfall totals; one unit of the last digit tolerated), `SC-CONSIST-003` one figure with two periods or currencies.
- Example: `examples/fde-engineer-en-v2` — the FDE briefing remade with all of the above; results and review report in `docs/showcase/fde-engineer/en-v2/`.

### Changed
- **Licence:** from 0.7.0 SlideCraft is released under the **PolyForm Shield License 1.0.0** — free to use, modify and build decks with, also commercially; not to be sold, redistributed or offered as a competing product or service. Versions up to 0.6.0 stay MIT.

### Fixed
- PowerPoint stretched pictures with `fit: cover`/`contain` to their box; they now crop exactly as in HTML and PDF.
- "Illustrative data." and new layout labels follow the deck language.

## [0.6.0] — 2026-10-12

### Added
- **Cover visual:** the cover gets a full-height panel that carries the topic — `art:` draws one of six motifs (network, growth, flow, orbit, grid, layers) from native, editable shapes in the theme accent, `auto` picks it from the title; or `image:` / `imagePrompt:` (generated by `slidecraft images`) puts a picture there. Part of the build stage and the reviewer checklist ([design the cover](docs/how-to/design-the-cover.md)).
- **Deck language:** `language:` drives SlideCraft's own labels (en, ru, de), number format (1 234,5), Russian typography (no-break spaces after short words and before dashes), PowerPoint's proofing language (no red underlines on Russian text), and the language of the visual-QA report ([deck language](docs/how-to/deck-language.md)).
- **Sources in speaker notes:** every exported deck lists each slide's sources in a `[Sources]` block after the notes (title, publisher, date, page, link); `sync` ignores the block ([cite sources](docs/how-to/cite-sources.md#sources-in-the-speaker-notes)).
- **Example in two languages:** `examples/fde-engineer-en` and `examples/fde-engineer-ru` — a six-slide briefing on the Forward Deployed Engineer role, made through the full workflow, with the review log and results in every format in `docs/showcase/fde-engineer/`.
- **PowerPoint text rules, measured:** advances snap to 1/576 in, glyphs draw at whole points, baselines sit on whole points (automatic pitch 1.2 em, ascent-share placement), anchored blocks centre the ink height. Rules are data in `src/engine/office-rules.gen.ts`, read by measurement, HTML/SVG and PPTX alike ([rules](docs/explanation/office-rendering-rules.md)).
- **Calibration mode:** `npm run calibrate` renders ~2 200 probe lines in PowerPoint, fits candidate models, rewrites the rules (`--write`) with evidence in `calibration/RULES.md`, and gates a 10-deck corpus at ≥ 95 % per page (`calibration/REPORT.md`). Runs on demand.
- **Final visual QA by a reviewer model:** `slidecraft visual-qa` writes per-slide PowerPoint, HTML and difference images with measured facts; the new `visual-reviewer` agent and `visual-qa` skill judge parity, template conformance, layout, colour, typography, charts and meaning; `--record` writes the user report `REPORT.md` (verdict, needs your attention, fixed, changes).
- **Review log:** every fit-fix rewrite (field, before, after), review pack and review round (with a diff of the sources) is appended to `review-log.jsonl` / `REVIEW-LOG.md`.
- **Orchestration templates** for every stage in YAML, JSON and Markdown, and a complete example run in every format (`examples/orchestration/`).
- **Side-by-side comparison:** `npm run comparison` collects every reference (original PPTX, or the editable PPTX in PowerPoint) next to SlideCraft's result, with page images, difference images, per-page scores and the calibration reports, in a local `comparison/` folder with a viewer ([see results](docs/how-to/see-results.md)).
- Office font lookup for any family (Office's bundled fonts first); HTML prefers installed metric-compatible originals through `local()`.

### Changed
- Generated line spacing is written to PPTX as the equivalent **multiple**, which PowerPoint places deterministically; authored "Exactly" spacing in imported decks stays exact.
- Titles are balanced (no one-word last line) with the same line count and PPTX box; lines break after a hyphen between letters, as PowerPoint does.
- Paragraph marks carry the last run's font; axis-aligned lines are crisp freeforms; slide numbers use the shared layout.
- PowerPoint conversion jobs run inside its sandbox container — no "Grant Access" prompts; `SLIDECRAFT_OFFICE_RECOVER=1` restarts a stuck PowerPoint once for unattended runs.

### Fixed
- Multi-line speaker notes were one paragraph with raw line breaks; contrast checks now see text on chevrons and other polygon or ellipse fills.
- Runs of spaces were collapsed; arrowheads on lines pointing up or left were reversed in PPTX; the visual-QA build no longer overwrites the user's `dist/` manifest.

### Verification
- Digital Ruble: rebuilt editable PPTX ≥ 95 % on 22/22 pages against the original (98.5–99.8 %); HTML 88.9–97.0 % (was 69–86 %).
- Generated corpus: mean 89.2 % per page HTML ↔ PowerPoint under the strict worst-region metric (first run 78.6 %); remaining differences are sub-pixel glyph edges and native chart labels, judged by the reviewer stage. Not a blanket 95 % guarantee.

## [0.5.3] — 2026-10-11

### Added
- **Component constructor:** `composition` reuses existing native layout contracts inside bounded body regions; nested text pointers support diagnostics and sync. `components` / `exhibits` CLI commands and `list_components` / `list_exhibits` MCP tools expose contracts and semantic routing to any model.
- **Independent design layer:** shared chrome schema/composer for side rails, section markers, page badges, styled citations and a `bottomLine` band; `editorial-fintech` theme and native `evidence-panorama` exhibit.
- **Actual Office PNG previews:** `--png-engine pptx-convert` and MCP `preview_slide(renderer: "pptx-convert")`, distinct from Scene/resvg thumbnails.
- **No-loss checks:** named native/chrome elements, inherited master text and speaker notes checked after PPTX export. Architecture diagrams, constructor guide, and coverage for all 14 storyline × 7 theme pairs.
- **Authored HTML bridge:** named editable text/rect/ellipse/line alternatives and sync by stable object ID.

### Fixed
- Native rounded-rectangle radius units, CSS circle geometry, positioned pseudo-elements and border triangles; wait for browser fonts and avoid applying alignment/translation twice.
- Brand templates without a footer placeholder retain the generated editable footer instead of losing it.
- Default PPTX engine stays portable inside Codex. OpenAI's proprietary adapter is explicitly selected and limited by its local internal-evaluation licence; it is never bundled.
- Package lock version is synchronized with the package version.

### Verification limits
- Structural tests and actual Office previews do **not** certify 95% visual fidelity for arbitrary HTML or the complete private Digital Ruble corpus. That remains a measured acceptance target, not a release guarantee.

## [0.5.2] — 2026-10-11

### Added
- **Editable freeform conversion:** supported HTML/CSS freeform slides now use Chrome only to resolve grid/flex geometry, then become separate native PowerPoint rectangles, borders, and text boxes. Rasterisation is no longer the editable default.
- **`freeform-canvas` layout:** a clean full-canvas master for reference-matched compositions that own their title and chrome, without a duplicate SlideCraft frame.

### Changed
- Editable PPTX conversion fails explicitly with `SC-EDIT-002` when a freeform block uses CSS without a faithful native analogue (for example gradients, shadows, filters or pseudo-elements), rather than silently flattening it.
- The native conversion retains a semantic title object when its HTML title matches the slide title; it therefore passes PowerPoint accessibility checks without drawing a second title.

## [0.5.1] — 2026-10-11

### Added
- **`native-canvas` layout:** bespoke compositions can now use native rectangles, ellipses, lines and text boxes, each editable in PowerPoint.

### Changed
- PPTX is editable by default. A deck containing `freeform` HTML now fails with `SC-EDIT-001` instead of silently embedding its body as a raster picture. Set `output.editablePptx: false` only for an explicit raster opt-out.
- PowerPoint import now turns one- and two-character visual titles into valid contextual titles, preserving the original short text.
- The consistency check ignores CSS and markup in freeform HTML, avoiding false metric conflicts from style percentages.

## [0.5.0] — 2026-10-11

### Added
- **MCP server** (`slidecraft mcp`, stdio):
  - 18 tools cover the whole workflow — brief, templates, ghost deck, contracts, check, fit loop, build, ingest, find, import, sync;
  - `preview_slide` returns the slide as an image;
  - a `make_deck` prompt starts the flow from a goal;
  - decks live in `~/SlideCraft` (`SLIDECRAFT_WORKSPACE`). [How-to](docs/how-to/use-with-mcp.md).
- **`slidecraft install` / `uninstall`:** one command connects every AI app found on the machine:
  - Claude Code (plugin) and Codex (skills);
  - Claude Desktop, Cursor, VS Code, Windsurf and Gemini CLI (MCP server). JSON configs are backed up first; `--dry-run` and `--only` are available.
- **Facts and spreadsheet data:**
  - `facts:` defines a number once (`value`, or `from: { file, sheet, cell }`, with an Excel-style `format` and `divide`), and `{{id}}` uses it in any text;
  - charts, table rows, headers, values and categories read `.xlsx` and `.csv` ranges directly. Formula results come from the workbook's cached values; the CSV delimiter is detected;
  - the manifest records each data file's sha256 and every fact's value;
  - codes `SC-DATA-001…003`. [How-to](docs/how-to/use-data-and-facts.md).
- **Consistency check:** `SC-CONSIST-001` flags one metric shown with different values on different slides, allowing for rounding ("€40M" agrees with "€40.2M"). It found a real mismatch in the pitch-deck example (30% vs 31%).
- **Client material with page-level sources:**
  - `slidecraft ingest` reads PDF (pdf.js, bundled separately and loaded only when needed), DOCX, PPTX, XLSX, CSV and Markdown into `materials/<id>.md` with page or section markers, and registers each file in `sources:`;
  - `slidecraft find` returns the page for a phrase;
  - slides cite `id#p14`, `#p14-16`, `#slide3`, `#sheet:Plan` or `#s:Heading`; the source line prints "…, p. 14" and PDF links open that page;
  - `SC-SRC-003` reports unknown ids and pages past the end of the document. [How-to](docs/how-to/ingest-materials.md).
- **Edits flow back:**
  - `slidecraft sync <deck> <edited.pptx> [--apply]` writes text edited in PowerPoint back into the YAML: titles, bullets (added or removed), labels and speaker notes. Comments and formatting are kept;
  - PPTX text boxes are now named after their field (`sc:<slide>/<field>`), so mapping survives reordered slides;
  - for files from Keynote or Google Slides, slides are matched by order and boxes by position;
  - derived text (capitals, `{{facts}}`), new boxes and moved or deleted slides are reported, never overwritten; edited table cells are listed cell by cell;
  - verified in PowerPoint for Mac (title, bullets, notes and a table cell edited there). [How-to](docs/how-to/sync-edits.md).
- **Frameworks and charts pack:** eight layouts, drawn as editable shapes in every engine, with examples in every variant:
  - `swot` (grid, with-implications), `five-forces`, `pestel`, `business-model-canvas`;
  - `bubble-chart` (bubble, scatter, growth-share portfolio with dividers), `marimekko`, `tornado`, `football-field`.

  40 layouts in total; the exhibit-selection guide and exhibit-chooser cover them.

### Changed
- `fix --apply`, `sync --apply`, `ingest` and `images` edit YAML surgically: only the changed values, the new keys and the appended list items are written, and the rest of the file stays byte for byte (comments, quoting, `[a, b]` and `{ a: 1 }` styles).
- Chart `from:` can sit next to chart options (`highlight`, `decimals`, `unit`).

## [0.4.2] — 2026-10-11

### Added
- `slidecraft new "<goal in your words>"`: a sentence is accepted as the goal, and the deck id is made from its key words (Cyrillic transliterated). A kebab-case id still works.
- Generated `brief.yaml` and `deck.yaml` start with a `yaml-language-server` schema line, so VS Code, Cursor and JetBrains autocomplete fields, show their descriptions and flag errors. The examples carry it too.
- No-clone setup for Codex and other assistants: `npm i -g @eiler2005/slidecraft`, then `slidecraft codex install`. `AGENTS.md` now ships in the package.
- CI: a Windows smoke job builds an example deck in every format.

## [0.4.1] — 2026-10-11

### Added
- **Showcase deck:** [`examples/slidecraft-overview`](examples/slidecraft-overview/deck.yaml), a 12-slide deck about SlideCraft made with SlideCraft, committed as PPTX, PDF, one-pager and contact sheet in `docs/showcase/` (`npm run showcase`; CI checks it is current). Shown at the top of the README and on the gallery site.
- **User docs:**
  - [Start here](docs/start-here.md): install, what to say, the four checkpoints, your files, changing the deck;
  - [What you can do](docs/features.md): capabilities by job to be done;
  - [Example library](docs/examples.md): six decks with previews, downloads and how to start from one.
- `SC-GEOM-004`: text hidden under an opaque shape drawn after it.

### Fixed
- `kpi-tiles` (tiles variant): labels were drawn under the card background and invisible since 0.1. Cards are now drawn first; the new check prevents a repeat.
- **Native PDF reproducibility:** theme decor is now embedded as an opaque RGB image. pdfkit splits alpha channels asynchronously, and that occasionally reordered objects between runs (caught by the new showcase check in CI).

## [0.4.0] — 2026-10-11

### Added
- **PPTX inside the brand template (M3):** `theme import` keeps the template (`"template"`). PPTX output is built inside it:
  - slides are linked to its *Title Slide*, *Title Only* or *Title and Content*, and *Section Header* layouts;
  - its masters, theme and art apply, and its slide-number and footer placeholders are filled;
  - the template's own slides and everything only they used are removed.

  Verified in PowerPoint.
- **Vector decoration from templates:** rectangles, rounded rectangles, ellipses and lines on the master and layouts become `chrome.art.shapes`, drawn by every engine.
- **PPTX accessibility:**
  - titles are moved to the front of the reading order;
  - charts get alt text in words (helper series folded back, waterfall steps with signs), in both PPTX engines;
  - decor, logos and art are marked decorative;
  - new checks `SC-A11Y-001/002/003`.
- **Layout `callout` (V15):** numbered callouts on a screenshot or photo, steps with action and expected result, and a check line. All 15 visual patterns now have a layout (32 layouts).
- **Docs:** [use with any agent](docs/how-to/use-with-any-agent.md) (Cursor, Gemini CLI, Aider, Copilot agents, scripts). README rewritten as agent-neutral, with a section on why SlideCraft exists. The v0.5 roadmap: npm, MCP server, stock photos, Excel/CSV, icons, live preview.

### Fixed
- **Privacy:** pptxgenjs wrote the absolute file path into `descr` for images without alt text (brand art). Such images are now decorative with empty alt text.
- **Frame:** the source line and body now follow the bottom margin, so brand frames with a tall footer band no longer overlap the source line.
- **Quote slides** carry their action title as the title placeholder.

### Changed
- CI and Pages use `actions/checkout@v7`, `actions/setup-node@v7` and `actions/upload-artifact@v7`; `@types/node` 22.20.5 (Dependabot).

## [0.3.0] — 2026-10-11

### Added
- **Brand templates reused (M3):** `theme import` now also reads:
  - the pictures on the template's master and on its title and content layouts, kept in place as `chrome.art` and drawn by every engine;
  - the title-placeholder position and slide size, written as `<id>.format.json` and used with `format:` in the deck. The footer stays above a bottom band of art, and 4:3 templates work.
  - Accent tints are chosen for readable muted text.
- **Title placeholders:** action titles in PPTX are real title placeholders. Verified in PowerPoint: the outline export lists every title, and rendering is unchanged.
- **Freeform HTML slides (M6):** layout `freeform` takes HTML/CSS with theme tokens as CSS variables.
  - The HTML engines show it live; Chrome renders it to a picture for PPTX, PDF, PNG and DOCX.
  - Checks: overflow (`SC-FIT-004`) and minimum text size (`SC-FIT-005`). Scripts, handlers and remote URLs are stripped (`SC-HTML-001`).
- **Fit-fix loop (M6):** `slidecraft fix deck.yaml` lists every too-long field with an exact character budget, measured by re-laying-out the slide or taken from the contract. `--apply fixes.json` writes rewrites by JSON pointer into deck.yaml or section files, keeps comments and re-checks. The copy-fitter agent and the review skill use it.
- **Layouts (M4):** `architecture` (zones, request/response links, numbered register — V06), `evidence-chain` (checks, sources, results, conclusion — V08), `cadence` (role calendar — V11). 31 layouts in total.
- **Contract capacity test:** every string field of every layout example, at its contract maximum, must fit its box.

### Fixed
- Contracts that could not hold their own maximum:
  - `options-comparison` summary is now limited to 60 characters, and the recommended column gets the same summary space;
  - the `gate-matrix` decider has two lines;
  - `issue-tree` driver labels: the root shows its value above the label;
  - the agenda divider and the quote title take longer titles.
- `artifact-tool` adapter, checked page by page in PowerPoint:
  - a real slide-number field on layouts;
  - waterfall connectors drawn;
  - bullet hanging indents and paragraph spacing written in OOXML units;
  - the theme font on chart text, and category labels below negative axes;
  - line-chart labels above the points.
- Freeform slides no longer trigger `SC-SRC-001` from numbers in markup.

### Removed
- Third-party inspiration notes from README and NOTICE (no third-party code or assets are used).

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
