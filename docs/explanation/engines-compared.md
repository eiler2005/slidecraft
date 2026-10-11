# Output engines compared

> **Audience:** anyone choosing how SlideCraft renders their decks · **Prerequisites:** [concepts](concepts.md) · **Last reviewed:** 2026-10-10

Every engine draws the same Scene IR, so layout, line breaks and content are identical across engines. They differ in **what kind of file** you get, **how faithful** it is to PowerPoint, **what it needs installed** and **what its license allows**. The quick decision table is in [choose formats and engines](../how-to/choose-output-engine.md); this page gives the trade-offs behind it.

## PPTX engines

### `pptxgenjs` — default

| Pros | Cons |
|---|---|
| MIT, bundled — works for every user, in CI and in any agent | Charts are emulated where PowerPoint lacks a portable type: waterfalls are stacked columns with an invisible base, highlights use a second series; labels on waterfalls and stacked totals are text boxes over the chart (edit them if you change data) |
| Real slide **masters** per theme (background, decor, footer, page number) — the deck feels native when edited | No import of an existing `.potx` master yet (planned, M3) |
| Exact text geometry (zero insets, exact line spacing, no autofit) — **calibrated against PowerPoint**: 98.6% identical line breaks, no overflows | Cannot render previews itself (SlideCraft renders PNG/PDF from the same IR instead) |
| Native tables and charts with explicit axes and manual plot area, so labels line up | Kerning and autofit deliberately disabled — text looks very slightly looser than hand-made slides |
| **Byte-reproducible** output (normalised zip, renumbered parts) | |
| Safe for **client deliverables and commercial use** | |

### `artifact-tool` — optional, Codex runtime

| Pros | Cons |
|---|---|
| Optional installed OpenAI runtime; explicitly selected for evaluation | **Proprietary (OpenAI): internal evaluation and testing only** — no distribution, no production or commercial use, license revocable. Check before using it for client work |
| Rich API with its own renderer (PNG, montage), table and chart facades; can import and edit existing PPTX — the most promising base for future "edit my deck" features | Not on npm: unavailable in CI, for collaborators without Codex, and on servers |
| Good native output for text, shapes, tables and charts | The runtime ignores some settings (plot area, chart fonts, paragraph units); SlideCraft fixes them in the exported XML, so the adapter depends on that post-processing |
| | Geometry is rounded to whole pixels; not byte-reproducible (the runtime writes random relationship ids) |
| | API and behaviour can change with Codex updates (version ≥ 2.7.3 is checked) |

**Bottom line.** Use `pptxgenjs` for anything that leaves your team. Use `artifact-tool` only for internal evaluation/testing, not production, commercial work or benchmarking — switching is one flag, the deck spec is the same.

## PDF engines

### `native` — default

| Pros | Cons |
|---|---|
| Zero install, fast (≈1 s), deterministic bytes — ideal for CI, archives, drafts | Drawn by SlideCraft, not by PowerPoint: glyphs come from the metric-compatible fonts (same widths, slightly different shapes) |
| Vector graphics, embedded subset fonts, selectable and searchable text | No hyperlinks or tagged/accessible PDF yet (M6) |
| Identical layout to the PPTX and the previews | |

### `pptx-convert` — PowerPoint or LibreOffice

| Pros | Cons |
|---|---|
| **Rendered by PowerPoint itself** (macOS) or LibreOffice — exactly what PPTX recipients see, with real Arial/Georgia | Needs PowerPoint (macOS) or LibreOffice installed |
| Best choice when the PDF is the deliverable (board packs, client PDFs) | Slower (seconds, PowerPoint opens briefly); first run needs a one-time "Grant Access"; not byte-reproducible |
| Doubles as the calibration reference for SlideCraft's measurer | In CI only with LibreOffice, whose rendering differs slightly from PowerPoint |

### `html` — Chrome print

| Pros | Cons |
|---|---|
| Best rendering of gradients, glows and decor — great for story decks and dark themes | Needs Chrome, Chromium or Edge |
| Same file as the HTML deck; no extra dependency (uses your browser) | Not byte-reproducible; glyphs from bundled fonts like `native` |

## HTML deck

| Pros | Cons |
|---|---|
| One self-contained file — attach it, host it, open offline; keyboard navigation, presenter notes, fullscreen, deep links | Not editable in PowerPoint (edit `deck.yaml` and rebuild) |
| Ideal for presenting from a browser, sharing a link, storytelling | Slides are SVG: copy-paste of text works, but there is no slide-sorter editing |

## PNG previews (`resvg`)

Always on; used for review, contact sheets and the gallery. Bundled WebAssembly, deterministic.

## Recommended setups

| Profile | `output.formats` | Engines | How |
|---|---|---|---|
| **Consultant who also works in Codex** *(the author's setup)* | `pptx, pdf, png` (+ `html` when presenting) | PPTX: `pptxgenjs` by default, `artifact-tool` only for explicit internal evaluation · PDF: `native`, `pptx-convert` for decks sent as PDF | `--pptx-engine artifact-tool` for a local evaluation build; for client builds `--pptx-engine pptxgenjs --pdf-engine pptx-convert` |
| Team editing together | `pptx, pdf, png` | `pptxgenjs` + `native` | defaults |
| Board / client PDF | `pptx, pdf` | `pptxgenjs` + `pptx-convert` | `usage: [send-pdf]` in the brief |
| Keynote or story talk | `html, pdf, pptx` | `html` PDF; PPTX as a backup | `usage: [present-live]`, theme `midnight` or `editorial` |
| CI / automation | `pptx, pdf, png` | `pptxgenjs` + `native` | `SOURCE_DATE_EPOCH` for reproducible bytes |

## Machine-wide preferences

`SLIDECRAFT_PPTX_ENGINE` and `SLIDECRAFT_PDF_ENGINE` set your preferred engine whenever a deck asks for `auto`. If the preferred engine is not available, SlideCraft silently falls back to the normal `auto` choice. An explicit `--pptx-engine` / `--pdf-engine` flag or `output.engines` in `deck.yaml` always wins.

```sh
# ~/.zshrc
export SLIDECRAFT_PPTX_ENGINE=pptxgenjs       # same portable default inside and outside Codex
export SLIDECRAFT_PDF_ENGINE=native
```
