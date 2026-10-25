# Diagram gallery review log

## 2026-10-25 — shared diagram implementation

Scope: 27 new native layouts and six variants, built as 33-slide synthetic decks in Consulting Classic and Midnight. No client material. The same Scene supplies HTML, native editable PPTX and vector PDF.

Viewed all 66 Chrome slide renders. Corrected reusable rules rather than deck-specific rendering branches:

- Choose a reachable black/white contrast target for mid-tone fills; heatmap and treemap labels use their actual cell background.
- Clip loop edges to node boundaries so arrowheads stay visible.
- Separate exploded spatial layers using the largest footprint height.
- Keep Venn set labels outside the circle strokes; the overlap remains qualitative.
- Show rank ticks for bump, a shared observed-count scale note for ridgeline, and colour keys for streamgraph.
- Keep Sankey ribbons proportional and transparent; retain separate editable labels and reject unbalanced inputs.
- Align UML and sequence example titles with the entities and messages actually shown.
- Preserve reversed Mermaid ER many-to-one cardinality by normalizing the endpoint order.

Validation: `npm run check` passed (37 files, 1655 tests; one optional test skipped). `npm run gen`, `npm run build`, the gallery/site builders and `npm run showcase` passed. The real PPTX ZIP regression checks native cubic geometry, alpha and text without rasterizing the exhibit. All layout examples compose across seven themes; the fit harness passes.

Reproduce the browser packs on a host without a working Office converter:

```sh
node dist/slidecraft.mjs build examples/diagram-gallery/deck.yaml -f pptx,pdf,html,png
node dist/slidecraft.mjs build examples/diagram-gallery-midnight/deck.yaml -f pptx,pdf,html,png
SLIDECRAFT_CONVERTER=libreoffice node dist/slidecraft.mjs visual-qa examples/diagram-gallery/deck.yaml
SLIDECRAFT_CONVERTER=libreoffice node dist/slidecraft.mjs visual-qa examples/diagram-gallery-midnight/deck.yaml
```

This machine has no LibreOffice. Both packs therefore explicitly report `reference: none` and contain actual Chrome renders only. The environment override selects the documented no-converter path; no reference pages or parity measurements were fabricated.

## Needs attention before Office fidelity acceptance

PowerPoint automation export failed with `-1712` / `-9074`; an ordinary quit was cancelled by the application (`-128`). PowerPoint was not force-quit. Actual PowerPoint renders, HTML ↔ Office parity and manual movement/editing of native shapes remain unverified. Repeat `visual-qa` on a responsive PowerPoint installation; do not interpret the browser-only pack's zero compared pages as a passing parity score. Automatic connector reattachment is not promised.
