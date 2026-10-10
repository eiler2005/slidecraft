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

Common fields on every slide: `id`, `layout`, `variant`, `title`, `lead`, `tracker`, `sources`, `source`, `notes`, `status`, `ghost {exhibit, data, confidence}`. Everything else comes from the layout contract: `sc layouts <id> --json`.

## Pitfalls

- **Quote values containing `, ` or `: ` inside `{ … }`** — `{ summary: "Two resellers, direct later" }`. Unquoted, YAML splits it into keys (`SC-SPEC-001 Unrecognized key`).
- Numbers need `sources:` ids that exist in the deck `sources:` list (or a `source:` line). Dates, owners and indices do not.
- Limits (`maxLength`, `maxItems`) are early warnings; the measurer decides (`SC-FIT-001` with the characters to cut). Rewrite, never truncate.
- Chart series need one value per category. Waterfall `total: true` steps show absolute values; others are deltas and must add up.
- Inline emphasis: `**bold**`, `*italic*` only.
- `status: ghost` (deck or slide) renders a sketch from `ghost.exhibit` instead of content.

After edits: `sc validate <deck>` then `sc check <deck>`.
