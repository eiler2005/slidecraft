# Bring in client material and cite the page

> **Audience:** anyone building a deck from reports, research, old decks or spreadsheets · **Prerequisites:** a deck (`slidecraft new`) · **Last reviewed:** 2026-10-11

A partner asks "where is that number from?". The answer should be "annual report, page 14", not "the report". `slidecraft ingest` reads your files and registers each one as a source. `slidecraft find` then tells you, and your AI assistant, on which page a phrase appears. Slides cite that page.

## 1. Ingest the files

```sh
slidecraft ingest annual-report-2025.pdf market-study.docx board-q2.pptx model.xlsx --deck slidecraft/germany/deck.yaml
```

| File | Read as | Place reference |
|---|---|---|
| PDF | text per page (pdf.js, bundled; scanned PDFs without a text layer have no text) | `#p14`, `#p14-16` |
| DOCX | sections by heading | `#s:Market outlook` |
| PPTX | text per slide | `#slide3` |
| XLSX, CSV | each sheet as a table (first 40 rows) | `#sheet:Plan` |
| MD, TXT | the whole file | — |

For each file SlideCraft:
- writes `materials/<id>.md` next to the deck, the plain text with a `{#p14}` marker per page or section, readable by you and by the assistant;
- adds a source to `deck.yaml` with the title and date (taken from the file where present), the file name and the page count, keeping comments and formatting;
- uses the file name as the source id (`annual-report-2025`). Running it again updates the text without adding a duplicate.

## 2. Find where something is said

```sh
slidecraft find "market share in Germany" --deck slidecraft/germany/deck.yaml
```

```
annual-report-2025#p14   p. 14   …our market share in Germany rose to 6.1% in the second half…
market-study#s:Competitors   “Competitors”   …the top five hold 31% market share…
```

Hits are ranked by how many of your words they contain, with a bonus for the exact phrase. `--json` gives the agent `ref`, `source`, `where` and `snippet` for each hit.

## 3. Cite the page on the slide

```yaml
  - id: share
    layout: kpi-tiles
    title: We already hold 6% of the German market without a local team
    tiles:
      - { value: "6.1%", label: Market share Germany, H2 2025 }
    sources: [annual-report-2025#p14]
```

The source line prints *Annual report 2025 (2025), p. 14*. In the PDF and PowerPoint, the link opens the file at that page (`#page=14`) when the source has a `url`. `slidecraft check` reports a page reference to an unknown source, or to a page past the end of the document (`SC-SRC-003`).

## Privacy

Material stays on your machine. `materials/` sits in the deck folder, which is git-ignored, like the client files themselves. Nothing is uploaded; your AI assistant sees only what it reads.
