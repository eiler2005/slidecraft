# Create native PowerPoint diagrams

> **Audience:** deck authors and agents · **Last reviewed:** 2026-10-25 · **Availability:** SlideCraft 0.8.0; see [changelog](../../CHANGELOG.md)

Choose a diagram from the relationship in your action title. Run `slidecraft layouts <id> --json` for its actual schema, limits and examples. Every layout below composes native Scene objects: text, rectangles, lines, polygons and editable cubic freeforms. Advanced chart variants use editable shapes rather than an embedded Office chart worksheet.

## Choose the exhibit

| Message | Layout or variant |
|---|---|
| A numeric row × column pattern | `heatmap` — one explicit sequential or diverging scale; `null` is missing |
| Parts of one total, encoded by area | `treemap` — deterministic squarification; zero has no area |
| Where a quantity splits and merges | `sankey` — three stages, one unit and scale, conserved intermediate nodes |
| Paired measurements | `chart-takeaway` · `dumbbell` or `slopegraph` |
| Rank changes | `chart-takeaway` · `bump` — positive integer ranks |
| Observed distributions | `chart-takeaway` · `ridgeline` — increasing numeric bin centres and nonnegative bin counts; no invented density estimate |
| Changing mix around a centred baseline | `chart-takeaway` · `streamgraph` — nonnegative values |
| Individual observations on one measured axis | `bubble-chart` · `beeswarm` — x is data, y is a packing offset |
| Grouped causes and evidence | `fishbone` — each cause has hypothesis/supported/confirmed status |
| System migration | `architecture-delta` — stable node and edge IDs, synchronized grids, computed change ledger |
| Shared dependencies | `dependency-graph` — bounded explicit grid, including cycles |
| Ownership handoffs | `swimlane` — named lanes and explicit connections |
| Branching decisions | `flowchart` — decisions require distinctly labelled branches |
| Subject lifecycle | `state-machine` — initial state, reachable states, terminal outcomes |
| Messages over time | `sequence` — participants, calls, returns and self-calls |
| Closed mechanism and its accumulated result | `loop` — include evidence or identify the mechanism as a hypothesis |
| Ordered abstractions or controls | `layer-stack` |
| State census, limits and blocked work | `kanban` |
| Experience and ordinal sentiment | `user-journey` — name the persona and evidence |
| Visible and hidden service operations | `service-blueprint` — customer/frontstage/backstage and a visibility line |
| Conceptual entities and cardinality | `er-diagram` |
| Physical foreign keys attached to fields | `database-schema` |
| Attributes, operations and typed relationships | `uml-class` |
| A few entities on shared bounded criteria | `radar` |
| One measured series on cyclic categories | `polar` — radius is linear |
| Qualitative containment or overlap | `nested`, `venn` — Venn areas do not encode quantities |
| Value chain × evolution and dependencies | `wardley-map` |
| Narrative backbone × release scope | `story-map` |
| Role/resource access permissions | `security-matrix` — distinct from RACI |
| Parts separated along a projection axis | `exploded-axonometric` |
| Relative footprints on a shared spatial plane | `axonometric-plan` — overlapping footprints are rejected |

The complete light and dark examples are [diagram-gallery](../../examples/diagram-gallery/deck.yaml) and [diagram-gallery-midnight](../../examples/diagram-gallery-midnight/deck.yaml). Their data is explicitly synthetic. Build either with:

```sh
node dist/slidecraft.mjs build examples/diagram-gallery/deck.yaml -f pptx,pdf,png,html
node dist/slidecraft.mjs check examples/diagram-gallery/deck.yaml
node dist/slidecraft.mjs visual-qa examples/diagram-gallery/deck.yaml
```

## Use the theme and readable type

Keep colours/fonts in the theme and content inside the shared body. A diagram does not bring a second page title, source footer or decoration layer. Direct labels and a restrained focal accent make the exhibit readable; no data is changed to improve the composition. Contracts reject unreadable complexity rather than silently deleting nodes or flows.

Deck-level `readability: report` preserves the theme's typography. `readability: present` raises the title to at least 28 pt, headings/body to 18 pt, supporting text to 14 pt and the body fitting floor to 16 pt. It applies to the entire deck and does not mutate the saved theme. It can require fewer nodes or shorter text; resolve fit diagnostics instead of shrinking the slide in PowerPoint.

```yaml
schemaVersion: 1
id: service-pattern
title: Support delays concentrate in billing
theme: consulting-classic
readability: report
sources:
  - id: demo
    title: Illustrative synthetic observations
    illustrative: true
slides:
  - id: delays
    layout: heatmap
    title: Billing has the longest waits across the observed channels
    rows: [Orders, Billing]
    columns: [Email, Chat]
    values: [[12, 8], [28, 15]]
    unit: min
    focal: {row: 1, column: 0}
    sources: [demo]
```

Every client number still needs a real source. Area, ribbon widths, observed values and sentiment must retain their meanings. The engine checks quantity geometry, graph identities, endpoints, routing and text fit; actual Office rendering and a visual review remain required. An editable freeform can be edited in PowerPoint, but automatic connector attachment while moving a node is not promised.

## Import a diagram

```sh
node dist/slidecraft.mjs import-diagram architecture.mmd -o slidecraft/architecture --json
node dist/slidecraft.mjs import-diagram architecture.drawio -o slidecraft/drawio-redesign --json
node dist/slidecraft.mjs import-diagram architecture.excalidraw -o slidecraft/excalidraw-redesign --json
```

The importer writes a draft `deck.yaml` and `import-ledger.json`. It preserves semantic identities, names and bound relationships, then lays out new native objects. Review the ledger, refine the action title and inspect the output before presenting it. Existing output decks are never overwritten.

- Mermaid: bounded `flowchart`/`graph`, `sequenceDiagram`, `stateDiagram-v2` and `erDiagram`. One edge per statement; explicit sequence messages and ER attributes. State imports require explicit initial and terminal transitions. Sequence fragments/notes and unknown syntax fail explicitly. Styling/click directives and source grouping are reported as omitted. ER wording and optionality simplifications appear in the ledger.
- draw.io: one page, raw XML or a compressed page, vertex labels and bound edges. Source grouping, styles and coordinates are reported when replaced. An unbound relationship is an error.
- Excalidraw: rectangles, diamonds, ellipses, bound text and bound arrows. Unbound annotations, grouping and unsupported decorative elements appear in the ledger; unbound arrows fail.

Input is limited to 1 MiB; native output contracts impose their own node/message budgets. Imports never execute source scripts, directives or URLs, and do not claim complete compatibility with these formats. Supported labels are never truncated to fit.

## Domain patterns

IT current-state, high-level/data-platform integration, medallion and governance views reuse the existing `architecture`, `coverage-map`, `layer-stack`, `security-matrix` and `composition` contracts. They are semantic patterns, not alternate renderers. See [diagram patterns](../../library/references/diagram-patterns.md) and the [visual specification](../research/diagram-design-visual-spec-2026-10.md).
