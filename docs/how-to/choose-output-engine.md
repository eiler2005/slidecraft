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
| **Work inside Codex** | pptx, pdf | `artifact-tool` if present | `native` | Uses the local Codex runtime (proprietary, internal use only) |
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
node dist/slidecraft.mjs build deck.yaml --pptx-engine artifact-tool
```

In `brief.yaml`, `usage:` (`edit-together`, `send-pdf`, `present-live`, `web-link`, `automation`, `codex`) drives the recommendation shown by `slidecraft templates --brief`.

## Pros and cons in one line each

| Engine | Strength | Watch out for |
|---|---|---|
| `pptxgenjs` | Open, everywhere, masters, calibrated against PowerPoint, reproducible | Waterfall/stacked labels are text boxes over native charts |
| `artifact-tool` | Codex-native runtime with its own renderer and PPTX import | Proprietary, internal use only; not in CI; chrome per slide |
| `native` PDF | Instant, vector, deterministic | Not drawn by PowerPoint |
| `pptx-convert` PDF | Pixel-identical to PowerPoint | Needs PowerPoint/LibreOffice; slower |
| `html` | Best visuals, one file, presenter mode | Not editable in PowerPoint; PDF needs Chrome |

Full trade-offs and recommended setups: [engines compared](../explanation/engines-compared.md).

## Set a personal default

```sh
export SLIDECRAFT_PPTX_ENGINE=artifact-tool   # e.g. Codex users; falls back to pptxgenjs if missing
export SLIDECRAFT_PDF_ENGINE=pptx-convert      # e.g. you always send PDFs
```

Used whenever a deck says `auto`; explicit flags and `output.engines` win.

## What `auto` does

- **Preference:** `SLIDECRAFT_PPTX_ENGINE` / `SLIDECRAFT_PDF_ENGINE`, if set and available.
- **PPTX:** `artifact-tool` only when running inside Codex and the runtime is installed; otherwise `pptxgenjs`.
- **PDF:** `html` when the theme says `prefers: html` (e.g. `midnight`) and Chrome is installed; otherwise `native`.
- **PNG:** `resvg`. **HTML:** `html`.

## What is available here?

```sh
node dist/slidecraft.mjs doctor
```

lists every engine, whether it was found, its version, install hints and license notes. Unavailable engines are skipped with `SC-ENGINE-001` rather than failing the build.

## Fidelity, briefly

| Level | Engines | Meaning |
|---|---|---|
| native | pptxgenjs, artifact-tool | Real PowerPoint objects |
| identical | pptx-convert | Rendered by PowerPoint/LibreOffice |
| same-layout | native PDF, html | Identical geometry and line breaks; glyphs from the bundled metric-compatible fonts |
| preview | resvg | Raster thumbnails |

Full matrix: [engines reference](../reference/engines.gen.md). Background: [ADR 0003](../adr/0003-pptxgenjs-default-artifact-tool-optional.md), [ADR 0004](../adr/0004-pdf-engines-native-html-pptx-convert.md).
