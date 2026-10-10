# Export a PDF

> **Audience:** anyone sending a PDF · **Prerequisites:** a buildable deck · **Last reviewed:** 2026-10-10

Three PDF engines; choose by what the PDF is for.

| Engine | Command | Best for | Needs |
|---|---|---|---|
| `native` | `build deck.yaml -f pdf` | CI, archives, quick drafts — vector, selectable text, byte-reproducible | nothing |
| `pptx-convert` | `build deck.yaml -f pptx,pdf --pdf-engine pptx-convert` | PDFs that go to readers — rendered by PowerPoint/LibreOffice itself | PowerPoint (macOS) or LibreOffice |
| `html` | `build deck.yaml -f pdf --pdf-engine html` | Story decks with gradients and decor | Chrome, Chromium or Edge |

## pptx-convert notes

- macOS + PowerPoint: the first run shows a one-time **Grant Access** dialog in PowerPoint for the output folder. Click it and run again.
- Force LibreOffice: `SLIDECRAFT_CONVERTER=libreoffice`. Setup: [pptx-convert setup](pptx-convert-setup.md).
- It needs the PPTX in the same build (`-f pptx,pdf`).

## html notes

- Uses your installed browser (set `CHROME_PATH` to choose); nothing is downloaded.
- Page size is 13.333 × 7.5 in, one slide per page, no browser headers.

## Check the result

```sh
pdftoppm -png -r 60 dist/<id>.pdf /tmp/page   # optional: rasterise and look at every page
```
