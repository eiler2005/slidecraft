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

## Remaining work

- A calibrated region-level HTML ↔ actual Office visual-diff gate is not implemented. Whole-page background similarity is not sufficient.
- The private 22-slide regression presentation has not been fully migrated into semantic native components or certified at 95%+. Its frozen references must not be rewritten to make comparisons pass.
- Arbitrary CSS remains outside the automatic native extractor's coverage. Complex paint order, clipping, typography and effects require explicit equivalents and tests. An error is a request to supply that equivalent, not permission to rasterize or omit content.
- An authored `ppt` alternative can diverge from its HTML content; automatic cross-representation semantic parity still needs coverage. Review both when syncing PowerPoint edits.
- OpenAI's locally inspected runtime is internal-evaluation only and cannot be used for commercial client delivery or benchmarking.

See [architecture](architecture.md), [component constructor](../how-to/compose-components.md) and [HTML bridge](../how-to/html-editable-ppt.md).
