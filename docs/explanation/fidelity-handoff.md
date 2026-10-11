# Editable fidelity: next-agent handoff

Checkpoint: 2026-10-11. This is a work-in-progress checkpoint, **not a 95% fidelity release**.
Checkpoint validation: `npm run gen`, `npm run build`, `npm run check` passed;
24 test files, 1043 tests passed and 1 skipped. Lint reported warnings, no errors.
No npm publication or version bump is part of this checkpoint.

## Objective and non-negotiable constraints

Improve the reusable SlideCraft library so its HTML and editable PPTX preserve the
same visual composition, content and theme. Digital Ruble is an integration corpus,
not a special rendering mode. Fix shared modules and add unrelated synthetic tests;
never branch on a client title, slide number or deck ID. Preserve original wording,
numbers, punctuation and notes. Keep text, lines, shapes and diagrams editable;
do not flatten slides or return a renamed original. Implement editable equivalents
for unsupported effects; until implemented, diagnose/block instead of silently
dropping them. Keep content, semantic exhibit selection, themes, composition and
output backends separate. Existing storylines and themes must continue to compose.

The user explicitly approved this corpus in Git. This does not authorise committing
other client files or licensed font binaries. Architecture diagrams use English.

## Authority and reproduction

- Read `AGENTS.md`, `docs/explanation/architecture.md`,
  `docs/explanation/presentation-generation-principles.md` and
  `tests/fixtures/digital-ruble/README.md` first.
- Authoritative content AND visual baseline:
  `tests/fixtures/digital-ruble/Digital_Ruble_Explainer_RU_v3.pptx` (22 slides).
  SHA-256: `419c93d91d899dd870ea386f0dfef55e9e07bc4afa1797ad7cee6abd6aa5e790`.
- Frozen `reference.html` is historical evidence, not a correct visual target:
  the user identified missing chrome in it. Never overwrite either baseline to
  make the test green. `deck.yaml` and its sections are candidate input, not goldens.
- Full reproduction needs Chrome, PowerPoint, Poppler and the original local fonts.
  Calibri was available at `/Library/Fonts/Microsoft/Calibri*.ttf` on this Mac.
  Missing dependencies/fonts must not become a passing skipped test.

```sh
npm ci
npm run check
npm run gen
npm run build
npm run test:digital-ruble
```

The last command intentionally exits 1 while acceptance fails. Outputs are ignored:
`tests/.output/digital-ruble/fidelity/report.json`, `report.md`,
`original-office.pdf`, `candidate-office.pdf`, `reference-html.pdf`, and raster
directories. Rebuilt editable PPTX, HTML, browser PDF, scene and manifest are under
`candidate/`. The CLI entry point is `slidecraft rebuild input.pptx -f pptx,html`.
`npm run test:digital-ruble -- --legacy-html` exercises the old YAML candidate.
Passing the native-import roundtrip alone does NOT prove new-deck generation works.

## What is implemented in shared modules

| Concern | Implementation / verification |
| --- | --- |
| Frame composition | `src/engine/compose.ts`: standard frame for canvas by default; required roles for title, tracker, rule, rail, marker, page/badge, source, takeaway and footer when applicable |
| Scene contract | `src/engine/scene.ts`: required roles; source text frame, insets and textbox semantics; automatic/percentage line spacing; kerning and underline |
| Typography | `src/engine/fonts.ts`, `text.ts`: kerning-aware measurement and preserved run styling |
| Native importer | `src/library/pptx-scene-import.ts`: geometry, shapes, notes, connectors, rich text, table cell equivalents, borders, row growth, hyperlink theme colors |
| Rebuild orchestration | `src/library/pptx-rebuild.ts`: original → Scene → independent standard backends, source mappings and diagnostics; no raster substitute |
| Backends | `src/backends/svg.ts`, `html.ts`, `pptxgenjs.ts`, `native-pdf.ts`: shared typography properties and editable export |
| Required-element QA | `src/qa/chrome.ts`, `html-verify.ts`, `pptx-verify.ts`: role presence; exported PPTX geometry/font-size checks |
| Fresh Office render | `src/backends/pptx-convert.ts`: unique temporary input/output on each conversion; validate PDF signature before replacing output |
| Regression | `scripts/digital-ruble-regression.ts`, `scripts/lib/deck-regression.ts`: three-way visual comparison, content/notes/native-object checks, provenance |

Generic tests include `tests/chrome.test.ts`, `text-fidelity.test.ts`,
`pptx-convert-freshness.test.ts` and synthetic cases in `pptx-scene-import.test.ts`.
Layout/theme tests also check frame roles. Only the two canvas visual goldens were
intentionally changed for standard framing; SVG snapshots also contain role and
kerning serialization updates. Do not casually rebaseline further visual failures.

## Status, not a success claim

The last complete, fresh Office run was around 18:07 Moscow on 2026-10-11, BEFORE
the final text-frame, hyperlink and continuous-grid patches. Content, notes and
native-object checks passed on 22/22. Visual acceptance passed on 0/22.

Its per-slide worst-region scores ranged approximately:

- original vs editable PPTX: 0.823–1.000;
- original vs generated HTML: 0.688–0.861;
- generated HTML vs editable PPTX: 0.688–0.861.

These are strict RGB/detail engineering scores, not calibrated perceptual quality
percentages. Some PPTX pages matched nearly exactly while HTML remained the main
gap. **Rerun after this checkpoint before reporting current numbers.** The latest
targeted run passed 13 tests across four files plus TypeScript checking. Full check
and bundle results belong to the checkpoint commit, not these old render numbers.

## Next work, in priority order

1. **Establish a fresh baseline.** Run the full regression. Confirm provenance,
   source/font hashes, unique Office conversion and current output timestamps.
   Render every original, candidate PPTX and HTML page at the same dimensions.
   Save contact sheets, overlays and per-element error tables; inspect all 22 pages.
2. **Fix HTML text placement/shaping in shared code.** Compare PDF text transforms
   and bounding boxes, not just screenshots. Inspect font family/face, shaping,
   kerning, baseline, paragraph spacing, authored insets, vertical anchoring and
   overflow. HTML currently uses resolved glyph boxes; Office uses original
   `textFrame` containers. Reconcile their semantics without deck-specific nudges.
3. **Investigate fractional font sizes, do not blindly round globally.** PDF.js
   inspection of this Office output showed 23.25 pt source text rendered near
   23 pt, 16.5 pt near 17 pt, and 18 pt unchanged. Some 16.5 pt native text baselines
   still differed by about 1.2 pt. Test multiple sizes, faces, scripts and renderers
   to distinguish Office export quantisation from a genuine text-layout rule.
   Preserve nominal source font sizes; any compatibility policy must be explicit,
   scoped to the renderer and tested. Word positions in rebuilt tables had already
   matched original Office within about 0.3 pt before the final grid patch.
4. **Verify the latest table/link fixes.** Source grids use 1 pt strokes, not 0.5.
   The importer now merges collinear same-style cell borders into continuous lines
   and extends their terminals by half the stroke width. PPTX line export no longer
   adds a 0.0001-inch off-axis extent. Verify joins, mixed borders, hidden borders,
   one-cell and adjacent-table cases with synthetic tests. Hyperlinks now resolve
   original theme hyperlink color unless source markup explicitly preserves text
   color. Check underlining and destinations too.
5. **Test generated presentations, not just imported slides.** Exercise ordinary
   YAML → semantic components → theme/frame → Scene → HTML/PPTX, including all
   storylines/themes, multiple title lengths, sources, page numbers, footers and
   takeaways. Explicit `frame: none` is author-owned framing, not an excuse for
   silently missing elements. Expand backend checks beyond presence to style,
   ordering, geometry and overflow where necessary.
6. **Generalise every fix.** Add a small unrelated-content regression for each bug,
   plus the Digital Ruble integration evidence. Keep production code independent
   of test fixtures. If adding an editable equivalent, expose it through the shared
   component/Scene contract so both backends and other models can use it.
7. **Complete review and release only with evidence.** Run the commands above,
   update the fidelity audit and handoff with fresh results, inspect all rendered
   pages, and deliver PPTX + HTML + report. Commit explicit paths. Do not publish
   an npm release or advertise 95% merely because build/unit tests pass.

## How to validate the 95% target honestly

Current regression uses 1600 px rasters and a 4×4 grid of RGB absolute error and
edge/detail error. Each slide's worst region must reach 0.95 for each required pair:
original↔HTML, original↔PPTX, HTML↔PPTX. Do not replace this with a deck-average
white-background score, shift/resize images to hide geometry errors, weaken the
threshold or bless new goldens to pass. The current measure is deliberately strict
but is not a perceptually calibrated percentage.

Before calling this "95% visual similarity", validate a documented metric against
human-reviewed examples and deliberate regressions: removed rail/page/source,
wrong font size, 1–2 pt shifts, wrong wrapping, lost underline, changed colors and
table borders. Weight meaningful foreground/text regions, and report both raw
metrics and per-element errors. Any metric change needs an explicit rationale and
old/new results; keep structural/editability/content gates independent. All 22
pages must pass, with a manual review record. Never set `visualReview` true merely
because a script completed. Exact token counts do not prove reading order.

## Known traps

- Re-exporting to an existing PDF path previously yielded stale PowerPoint output;
  the converter now uses a fresh temporary directory. Keep its regression test.
- PptxGenJS shape-text margins use `[left, right, bottom, top]`; table margins use
  `[top, right, bottom, left]`. Swapping these caused baseline drift.
- OOXML `kern="0"` disables kerning in observed Office output. The backend uses
  100 for enabled and 400000 for disabled; font measurement must agree.
- Automatic Office line spacing is not a font bounding-box multiplier. Imported
  automatic paragraphs omit explicit line spacing; percentage spacing is separate.
- PptxGenJS can inject hyperlink text-color preservation markup. Preserve actual
  source hyperlink semantics rather than merely copying an explicit run color.
- Tables currently use editable cell shapes/text/lines, not native PowerPoint
  table objects. A native-table path is possible but needs matching cell margins,
  four borders, row expansion, anchoring and rich-text behavior across backends.
- Proprietary OpenAI artifact runtime is not part of this fidelity benchmark.
- `tmp/` contains local diagnostics and unrelated files; `docs/gallery/*--*.png`
  contains unrelated untracked assets. Neither belongs in this checkpoint.
- Older `editable-fidelity-audit.md` numbers predate these changes; do not cite them
  as the current score. This handoff also requires refreshing after the next run.
