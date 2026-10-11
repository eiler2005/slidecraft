# Choose formats and engines

> **Audience:** anyone deciding what to hand over · **Prerequisites:** none · **Last reviewed:** 2026-10-10

SlideCraft renders one deck spec with interchangeable engines. Pick by **what will happen with the deck**. In the plugin you answer this at checkpoint 1 and SlideCraft recommends the set; you can always override.

## Recommendations

| You will… | Formats | PPTX engine | PDF engine | Why |
|---|---|---|---|---|
| **Edit the deck with your team** (default) | pptx, pdf, png | `pptxgenjs` | `native` | Native, editable PowerPoint; vector PDF; no external software |
| **Send it as a PDF** to a board or client | pptx, pdf | `pptxgenjs` | `pptx-convert` | The PDF is rendered by PowerPoint/LibreOffice itself — exactly what PowerPoint users see |
| **Present from a browser / share a link** | html, pdf | optional | `html` | One self-contained HTML file; Chrome prints the PDF from the same page |
| **Tell a story on stage** (dark theme, decor) | html, pptx | `pptxgenjs` | `html` | Browser rendering shows gradients and glow best; PPTX as backup |
| **Automate / run in CI** | pptx, pdf, png | `pptxgenjs` | `native` | Deterministic bytes, no external programs |
| **Work inside Codex** | pptx, pdf | `pptxgenjs` by default | `native` or `pptx-convert` | Same shared themes/components; optional OpenAI skill for authoring and review |
| **Evaluate the OpenAI adapter locally** | pptx | explicitly `artifact-tool` | optional | Installed proprietary runtime; internal evaluation/testing only, not production, commercial use or benchmarking |
| **Corporate template** (`.potx`) — M3 | pptx, pdf | `pptxgenjs` + master import | `pptx-convert` | Keeps the brand master (planned) |

## How to set it

In `deck.yaml`:

```yaml
output:
  formats: [pptx, pdf, png, html]
  engines: { pptx: auto, pdf: pptx-convert }
```

or per build:

```sh
node dist/slidecraft.mjs build deck.yaml -f pptx,pdf --pdf-engine pptx-convert
node dist/slidecraft.mjs build deck.yaml -f html,pdf --pdf-engine html
# Actual Office-rendered PNGs in previews-office/ (requires Poppler):
node dist/slidecraft.mjs build deck.yaml -f pptx,png --png-engine pptx-convert
# Internal evaluation/testing only; requires the installed OpenAI runtime:
node dist/slidecraft.mjs build deck.yaml --pptx-engine artifact-tool
```

In `brief.yaml`, `usage:` (`edit-together`, `send-pdf`, `present-live`, `web-link`, `automation`, `codex`) drives the recommendation shown by `slidecraft templates --brief`.

## Pros and cons in one line each

| Engine | Strength | Watch out for |
|---|---|---|
| `pptxgenjs` | Open, everywhere, masters, calibrated against PowerPoint, reproducible | Waterfall/stacked labels are text boxes over native charts |
| `artifact-tool` | Optional local OpenAI runtime adapter consuming the same Scene IR | Proprietary; internal evaluation/testing only, no production/commercial/benchmarking use; never bundled |
| `native` PDF | Instant, vector, deterministic | Not drawn by PowerPoint |
| `pptx-convert` PDF | Pixel-identical to PowerPoint | Needs PowerPoint/LibreOffice; slower |
| `html` | Best visuals, one file, presenter mode | Not editable in PowerPoint; PDF needs Chrome |

Full trade-offs and recommended setups: [engines compared](../explanation/engines-compared.md).

## Set a personal default

```sh
export SLIDECRAFT_PPTX_ENGINE=pptxgenjs       # portable default for all agents
export SLIDECRAFT_PDF_ENGINE=pptx-convert      # e.g. you always send PDFs
```

Used whenever a deck says `auto`; explicit flags and `output.engines` win.

## What `auto` does

- **Preference:** `SLIDECRAFT_PPTX_ENGINE` / `SLIDECRAFT_PDF_ENGINE`, if set and available.
- **PPTX:** `pptxgenjs`, including inside Codex. Merely detecting Codex or an installed OpenAI runtime never opts a production deck into an evaluation-only engine. An explicit `--pptx-engine artifact-tool` selects the local evaluation adapter and fails if unavailable. `SLIDECRAFT_PPTX_ENGINE=artifact-tool` is an opt-in machine preference for evaluation sessions only; it falls back if unavailable.
- **PDF:** `html` when the theme says `prefers: html` (e.g. `midnight`) and Chrome is installed; otherwise `native`.
- **PNG:** `resvg`. **HTML:** `html`.

## What is available here?

```sh
node dist/slidecraft.mjs doctor
```

lists every engine, whether it was found, its version, install hints and license notes. Unavailable engines are skipped with `SC-ENGINE-001` rather than failing the build.

## Shared design, optional OpenAI integration

Themes, layout contracts, editable HTML equivalents and the Scene IR belong to
SlideCraft, not to a model provider. Changing `--pptx-engine` must not select a
different theme, rewrite content or require a second deck specification.

In Codex, the SlideCraft skill additionally directs the agent to read an available
OpenAI presentation skill for reference handling and visual review. The skill and
the rendering runtime are separate integrations; neither is copied into npm.
Other models use SlideCraft's universal skills and the very same component catalog.

Scene PNG previews (`resvg`) are not PowerPoint renders. Verify PPTX appearance
using an Office-rendered PDF, and compare it with an unchanged HTML reference.
An editable object count is not a visual-fidelity score.

## Fidelity, briefly

| Level | Engines | Meaning |
|---|---|---|
| native | pptxgenjs, artifact-tool | Real PowerPoint objects |
| identical | pptx-convert | Rendered by PowerPoint/LibreOffice |
| same-layout | native PDF, html | Identical geometry and line breaks; glyphs from the bundled metric-compatible fonts |
| preview | resvg | Raster thumbnails |

Full matrix: [engines reference](../reference/engines.gen.md). Background: [ADR 0003](../adr/0003-pptxgenjs-default-artifact-tool-optional.md), [ADR 0004](../adr/0004-pdf-engines-native-html-pptx-convert.md).
