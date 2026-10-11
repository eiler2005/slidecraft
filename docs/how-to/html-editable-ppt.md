# Author an editable PowerPoint equivalent of HTML

`freeform` and `freeform-canvas` keep `html` as the visual reference. For an
intentional, reviewable editable PowerPoint rendering, add `ppt:` beside it.
Every item has a stable `id`; it becomes a named PowerPoint object
`sc:<slide-id>/ppt/<id>`, so a person or an agent can change the right object
without using a CSS selector or inferring geometry from an image.

```yaml
html: <div class="card">HTML reference</div>
ppt:
  - { id: card, kind: rect, x: 0.4, y: 0.7, w: 3.1, h: 1.4,
      fill: "#EFF6FF", stroke: { color: "#155EEF", width: 1.5 }, radius: 0.16 }
  - { id: card-label, kind: text, x: 0.65, y: 1.14, w: 2.6, h: 0.35,
      text: "HTML reference", size: 18, color: "#10263D", bold: true, align: center }
  - { id: connector, kind: line, x1: 3.5, y1: 1.4, x2: 4.4, y2: 1.4,
      stroke: { color: "#155EEF", width: 1.5 }, arrowEnd: true }
```

Coordinates are inches relative to the HTML canvas. `text`, `rect`, `ellipse`
and `line` are editable Office primitives. The HTML deck always renders `html`;
an editable PPTX renders `ppt` when supplied. Without `ppt`, SlideCraft uses
Chrome's computed layout to generate a native starting point, including common
pseudo-elements, rounded cards, borders, circles and CSS border arrows.

Use the library layouts before freeform whenever possible. They are the
maintained editable component catalog: `kpi-tiles`, `process-steps`,
`options-comparison`, `data-table`, `timeline`, `matrix-2x2`, `risk-matrix`,
`issue-tree`, `architecture`, `org-chart`, `waterfall`, `funnel`, `marimekko`,
`bubble-chart`, `tornado`, `business-model-canvas`, `swot`, `pestel` and more.
Run `slidecraft layouts --json` for the complete machine-readable inventory and
`slidecraft layouts <id> --json` for an agent-ready contract.
