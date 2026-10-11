# Editable-export audit

Reviewed 2026-10-11. This records confirmed defects and remaining acceptance work; it is not a 95% fidelity certificate.

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

## Digital Ruble integration run — 2026-10-11

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

- An initial region-level diagnostic gate is implemented; calibration against human review remains open. Whole-page background similarity is not sufficient.
- The now-public 22-slide regression presentation has not been fully migrated into semantic native components or certified at 95%+. Its frozen references must not be rewritten to make comparisons pass.
- Arbitrary CSS remains outside the automatic native extractor's coverage. Complex paint order, clipping, typography and effects require explicit equivalents and tests. An error is a request to supply that equivalent, not permission to rasterize or omit content.
- An authored `ppt` alternative can diverge from its HTML content; automatic cross-representation semantic parity still needs coverage. Review both when syncing PowerPoint edits.
- OpenAI's locally inspected runtime is internal-evaluation only and cannot be used for commercial client delivery or benchmarking.

See [architecture](architecture.md), [component constructor](../how-to/compose-components.md) and [HTML bridge](../how-to/html-editable-ppt.md).
