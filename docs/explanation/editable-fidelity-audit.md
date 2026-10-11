# Editable-export audit

Reviewed 2026-10-11. This records confirmed defects and remaining acceptance work; it is not a blanket 95% fidelity certificate.

| Finding | Cause | Resolution / evidence |
|---|---|---|
| Body exhibits became pictures | Historical freeform export rasterized HTML | Editable default retained; explicit authored `ppt` alternatives and native components avoid a body image |
| Missing sources, page numbers and design marks | Full-canvas ownership bypassed the standard frame | Independent chrome schema/composer; canvas can opt into `standard`; tests check rail, marker, page badge, sources and bottom line |
| Title repeated inside and outside exhibit | Both freeform HTML and frame owned the title | Component constructor owns body only; frame draws title once. Existing imported HTML still needs its duplicate title removed when opting into a frame |
| Rounded corners differed materially | PPTX radius option received a ratio rather than inches | Corrected units; OOXML geometry tests |
| Circles and pseudo-elements diverged | Border-radius and pseudo-element geometry were guessed | Native ellipse mapping; browser probe for positioned pseudo-elements and border triangles |
| Font / alignment drift | Geometry measured before fonts were ready; alignment applied again | Wait for browser fonts, preserve named families and remove double alignment/translation. Cross-platform font substitution remains a visual-review risk |
| A preview was treated as the actual PPTX result | resvg renders Scene IR, not PowerPoint | Separate `previews-office/` engine and explicit MCP renderer/provenance |
| Brand-template export lost footer | New master had no footer placeholder | Reuse original editable footer shape as fallback; brand tests pass |
| Unsupported visual content could disappear | Native extractor ignored embedded visuals and kept only the last feature diagnostic | Embedded visuals now require a native equivalent; report all unsupported features for the block |
| New panorama contract accepted overflowing text | Character limits exceeded geometry capacity | Tightened metric explanation limits; contract-capacity tests pass |
| Light accent labels were hard to read | Chart-series colours were reused as text without checking contrast | Contrast-aware text colour in the panorama component |
| Package metadata versions diverged | Lockfile remained at 0.5.1 while package was 0.5.2 | Both synchronized to 0.5.3 |

## Text and export fidelity, calibrated — 2026-10-11 (later)

Measured against PowerPoint for Mac 16.113.4; details in [Office rendering rules](office-rendering-rules.md),
[`calibration/RULES.md`](../../calibration/RULES.md) and [`calibration/REPORT.md`](../../calibration/REPORT.md).

| Finding | Cause | Resolution / evidence |
|---|---|---|
| HTML words drifted up to 1.4 pt from PowerPoint | PowerPoint snaps each glyph advance to 1/576 in | Snapped advances, per-glyph SVG x; 0.09 pt mean over 8 300 words |
| Glyphs 1–4 % larger in HTML | PowerPoint draws whole-point sizes | `drawSize` rounds half up; 0 mismatches on 2 196 lines |
| Baselines alternated ±0.7 pt | Baselines sit on whole points; automatic pitch is 1.2 em for every font | Calibrated ascent-share rule; 0.066 pt mean |
| Generated "Exactly N pt" lines off by up to 1 pt | PowerPoint quantises exact spacing unpredictably | Generated spacing exported as the equivalent multiple; 0.064 pt mean |
| Three spaces collapsed to one | Tokeniser merged runs of spaces | Spaces kept and measured |
| A heading wrapped differently | PowerPoint breaks after a hyphen | Hyphen break opportunity (found by visual QA) |
| ₽ measured as a missing glyph | System Calibri 5.62 lacks ₽; PowerPoint uses its bundled 6.20 | Font lookup prefers Office's bundled fonts, for any family |
| Text box baseline ~1 pt low | Paragraph mark used the theme font | End mark mirrors the last run |
| Table borders 2–3 px blurred | Preset lines get a 1-EMU slope | Axis lines exported as one-segment freeforms |
| Slide number 3.6 pt low in HTML | Ad-hoc baseline formula | Laid out with the shared rules |
| Axis arrow reversed in PowerPoint | Line flips ignored direction | flipH/flipV from direction (found by visual QA) |
| Titles ended on a single word | Greedy wrap | Balanced titles with the same line count and the same PPTX box |
| PowerPoint asked for folder access each run | Jobs ran in new temp folders outside its sandbox | Jobs run inside PowerPoint's container; optional recovery |

| Corpus (10 decks) | Gate pair | Result |
|---|---|---|
| Digital Ruble, rebuilt editable PPTX | original ↔ PPTX (PowerPoint) | **22/22 pages ≥ 95 %** (98.5–99.8 %) |
| Digital Ruble, HTML | original ↔ HTML | 88.9–97.0 % (was 69–86 %) |
| Nine generated decks | HTML ↔ PPTX (PowerPoint) | mean 89.2 % per page (first run 78.6 %); visually indistinguishable at viewing size, not yet ≥ 95 % on the strict metric |

## Digital Ruble integration run — 2026-10-11 (first)

The owner-approved corpus is now versioned in `tests/fixtures/digital-ruble/`.
`npm run test:digital-ruble` exercised the complete 22-slide pipeline with Chrome,
Microsoft PowerPoint and Poppler, comparing the original, frozen HTML, current
HTML and actual PowerPoint output. The original SHA-256 begins `419c93d91d899dd8`.

| Acceptance check | Passed slides | Interpretation |
|---|---:|---|
| Native shapes, no slide pictures | 22 / 22 | Editability alone does not establish fidelity |
| Exact original text token counts | 2 / 22 | Case, punctuation and repeated text count; slide order is fixed |
| No missing original note tokens | 18 / 22 | Source-note content changed in four appendix slides |
| Worst-region visual threshold ≥0.95 | 0 / 22 | Both historical HTML and current HTML comparisons fail |

Build diagnostics were empty despite these acceptance failures. On slide 9 the
original section heading and page number are absent; the native title/body use
different text metrics and line wraps from HTML, and coloured card-edge corners
differ. Slide 1 contains an extra copy of the title. Slide 22's source URL has
changed. These are **detected defects, not fixes**.

The region metric combines RGB and edge-detail absolute differences in a 4×4 grid.
The first run's worst HTML/PPTX region was 0.591 (slide 5). This is a diagnostic
signal, not a statement that the slide is “59% visually correct”. Frozen references
were not replaced with newly generated output. Diagrams were visually inspected;
the full presentation has not received a new slide-by-slide manual acceptance.

## Remaining work

- Generated decks: sub-pixel glyph edges between Chrome and PowerPoint PDF output, native chart label placement (~1 px) and dark backgrounds keep the strict per-page score at 67–93 %; the reviewer-model stage judges these pages visually.
- Authored exact spacing in imported decks keeps a ±1 pt residual on some lines (typo-ascent model, mean 0.33 pt).

- An initial region-level diagnostic gate is implemented; calibration against human review remains open. Whole-page background similarity is not sufficient.
- The now-public 22-slide regression presentation has not been fully migrated into semantic native components or certified at 95%+. Its frozen references must not be rewritten to make comparisons pass.
- Arbitrary CSS remains outside the automatic native extractor's coverage. Complex paint order, clipping, typography and effects require explicit equivalents and tests. An error is a request to supply that equivalent, not permission to rasterize or omit content.
- An authored `ppt` alternative can diverge from its HTML content; automatic cross-representation semantic parity still needs coverage. Review both when syncing PowerPoint edits.
- OpenAI's locally inspected runtime is internal-evaluation only and cannot be used for commercial client delivery or benchmarking.

See [architecture](architecture.md), [component constructor](../how-to/compose-components.md) and [HTML bridge](../how-to/html-editable-ppt.md).
