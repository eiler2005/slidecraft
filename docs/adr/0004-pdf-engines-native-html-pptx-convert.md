# 0004 — Three PDF engines: native, html, pptx-convert

**Status:** Accepted · 2026-10-10

## Context
"PDF" means different things: a reproducible artefact for CI, a browser-quality print of a storytelling deck, or exactly what a PowerPoint user would see. No single engine gives all three without heavy dependencies (Chromium downloads, LibreOffice).

## Decision
- `native` (default): pdfkit draws the Scene IR with embedded subset fonts — vector, selectable text, deterministic (fixed dates, one image object per source), zero install.
- `html`: the HTML deck printed by the **system** Chrome/Chromium/Edge in headless mode (no Playwright download). The process is stopped as soon as the PDF is written.
- `pptx-convert`: the built PPTX converted by Microsoft PowerPoint (macOS, AppleScript; one-time access grant) or LibreOffice headless — identical to what PowerPoint users see; also the calibration reference.
`auto` uses `native`, or `html` when the theme declares `prefers: html` and Chrome exists. `recommendOutput()` suggests `pptx-convert` when the deck is sent as PDF.

## Consequences
- CI always has a PDF; users choose fidelity when it matters.
- `html` and `pptx-convert` outputs are not byte-reproducible; the manifest says so.
