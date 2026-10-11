---
name: deck-spec
description: Write or edit SlideCraft deck.yaml and brief.yaml correctly — common slide fields, layout contracts, sources, includes, output engines and the YAML pitfalls that break validation. Use whenever editing deck.yaml or section files.
---

# Writing deck.yaml

`sc` = `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"`. Schemas: `${CLAUDE_PLUGIN_ROOT}/schemas/deck.v1.json`, `brief.v1.json`. Reference: `${CLAUDE_PLUGIN_ROOT}/docs/reference/deck-spec.md` and `layouts.gen.md`.

## Shape

```yaml
schemaVersion: 1
id: northwind-germany            # kebab-case, stable
title: Entering Germany can add €40M by 2028
storyline: strategy-recommendation
theme: consulting-classic
status: draft                    # ghost | draft | review | final (final = unsourced numbers are errors)
footer: Northwind · Confidential
sources:
  - { id: finance-fy25, title: Management accounts FY2025, illustrative: true }
output:
  formats: [pptx, pdf, png]       # + html
  engines: { pptx: auto, pdf: auto }   # pptxgenjs | artifact-tool ; native | html | pptx-convert
slides:
  - id: summary                  # unique, stable — reviews target ids
    layout: exec-summary
    variant: scr
    tracker: Executive summary   # small section label
    title: Entering Germany now captures a €40M window before two rivals scale
    situation: …
    complication: …
    resolution: …
    ask: …
    sources: [finance-fy25]
    notes: Speaker notes.
  - include: sections/why.yaml   # a YAML list of slides
```

## Client numbers: facts and spreadsheets

Write each client number once; every slide uses the same value, and a changed file updates every slide on the next build.

```yaml
facts:
  revenue-2028: { value: 40000000, divide: 1000000, format: "€0M", source: finance-fy25 }   # → €40M
  churn: { from: { file: data/model.xlsx, sheet: KPIs, cell: B6 }, format: "0.0%" }
slides:
  - id: answer
    layout: big-statement
    title: Entering Germany can add {{revenue-2028}} by 2028
  - id: trend
    layout: chart-takeaway
    chart: { from: { file: data/model.xlsx, sheet: Plan, range: A1:C6 } }   # first column = categories, header row = series
  - id: costs
    layout: data-table
    rows: { from: { file: data/costs.csv, range: A1:D9 }, header: true }    # header row fills `header:`
```

The manifest records each file's sha256 and every fact's value. `SC-DATA-*` = a file, sheet or cell that cannot be read; `SC-CONSIST-001` = one metric shown with different values on different slides.

## Page-level sources

After `sc ingest <files> --deck <deck>`, each file is a source. Cite where the number is: `sources: [annual-report#p14]` (page), `#p14-16`, `#slide3`, `#sheet:Plan`, `#s:Market outlook` (a DOCX heading). The source line prints "Annual report 2025, p. 14" and the PDF link opens that page. `sc find "<phrase>" --deck <deck>` finds the page.

Common fields on every slide: `id`, `layout`, `variant`, `title`, `lead`, `tracker`, `sources`, `source`, `notes`, `status`, `ghost {exhibit, data, confidence}`. Everything else comes from the layout contract: `sc layouts <id> --json`.

## Pitfalls

- **Quote values containing `, ` or `: ` inside `{ … }`** — `{ summary: "Two resellers, direct later" }`. Unquoted, YAML splits it into keys (`SC-SPEC-001 Unrecognized key`).
- Numbers need `sources:` ids that exist in the deck `sources:` list (or a `source:` line). Dates, owners and indices do not, and plan slides (next-steps, timeline, process-steps, gate-matrix, raci, agenda) never need a source. Mark sample figures with a source that has `illustrative: true` — the source line then starts "Illustrative data."
- Deck-level fields (`theme`, `storyline`, `footer`, `output`) live at the top of deck.yaml, never inside a slide.
- `theme:` may be a path to a brand theme JSON (`./slidecraft-theme/contoso.json`, from `slidecraft theme import`).
- Limits (`maxLength`, `maxItems`) are early warnings; the measurer decides (`SC-FIT-001` with the characters to cut). Rewrite, never truncate.
- Chart series need one value per category. Waterfall `total: true` steps show absolute values; others are deltas and must add up.
- Inline emphasis: `**bold**`, `*italic*` only.
- `status: ghost` (deck or slide) renders a sketch from `ghost.exhibit` instead of content.

After edits: `sc validate <deck>` then `sc check <deck>`.
