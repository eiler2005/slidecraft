# Compose a slide from existing components

Storyline is the task and argument of the deck; theme is the look. Neither is an export engine. `storyline.themes` contains recommendations, not an allowlist: any installed theme can be paired with a storyline. Tests scaffold every installed pair; the layout harness separately composes all example exhibits in every theme. Neither test certifies visual fidelity in PowerPoint.

## Choose before drawing

1. `slidecraft templates --brief brief.yaml --json`: choose a storyline × theme for the audience and task. Preserve an existing approved storyline when redesigning client material.
2. `slidecraft exhibits bridge --json`: route the slide's intended relationship to existing layouts. A bridge uses `waterfall`; a sequence uses `process-steps`, not arbitrary cards connected by arrows.
3. `slidecraft components --json`: list existing native body exhibits usable in a composition. `slidecraft components key-points --json` returns its existing schema and examples.
4. Prefer one complete layout. If one message requires complementary exhibits, use `composition` to place several library layouts in body regions.
5. If none fits, add a reusable layout with a schema, examples, native Scene primitives and regression tests. Do not introduce a private raster fallback in an exporter.

## Constructor contract

```yaml
schemaVersion: 1
id: constructor-example
title: Shared capabilities support controlled execution
storyline: strategy-recommendation
theme: editorial-fintech
slides:
  - id: capabilities
    layout: composition
    title: Shared capabilities support controlled execution
    tracker: Operating model
    bottomLine: Validate the critical path before expanding the rollout.
    notes: Qualitative illustrative example, not client evidence.
    components:
      - id: capabilities
        layout: key-points
        variant: cards
        box: { x: 0, y: 0, w: 0.48, h: 1 }
        content:
          points:
            - { heading: Shared data, body: One agreed source. }
            - { heading: Clear roles, body: Named decision owners. }
      - id: execution
        layout: key-points
        variant: columns
        box: { x: 0.52, y: 0, w: 0.48, h: 1 }
        content:
          points:
            - { heading: Test first, body: Validate the critical path. }
            - { heading: Scale next, body: Expand after review. }
```

`box` uses fractions of the available content body, **after** the frame reserves space for the title, lead, sources and `bottomLine`. Components do not own or duplicate that frame. Their `content` is validated by the referenced layout's real schema. The same theme, fonts and text-fitting implementation are passed to every component.

IDs must be unique; regions must be in bounds and non-overlapping. Recursive compositions, covers, HTML freeform and canvas layouts are rejected as components. Unknown layouts, variants, invalid content and child geometry outside its region produce errors, never silent omission. Smaller regions still need proportionate content: the constructor does not make a dense full-page exhibit readable at quarter size.

Text pointers retain their nested path (for example `/slides/0/components/1/content/points/0/heading`) for diagnostics and PowerPoint sync. Sources, speaker notes and common design objects remain separate from component content.

## Export and verify

```bash
slidecraft check deck.yaml --json
slidecraft build deck.yaml -f html,pptx --pptx-engine pptxgenjs --json
slidecraft build deck.yaml -f pptx,png --png-engine pptx-convert --json
```

The native library composes once into Scene IR. HTML/SVG and PPTX exporters consume that composition; PPTX does not need a screenshot of the HTML. Imported HTML remains an escape hatch with its own [editable bridge contract](html-editable-ppt.md).

The `pptx-convert` preview uses the **actual exported file** through PowerPoint or LibreOffice; `resvg` previews only the Scene. The manifest identifies the renderer. Structural verification catches text, notes and named chrome losses. Visual comparison against a frozen HTML reference and human review are additional requirements; structural success alone is not a 95% visual match.

See [architecture](../explanation/architecture.md) for the layers and diagrams.
