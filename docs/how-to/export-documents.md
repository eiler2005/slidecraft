# Export A4 decks, a one-pager and a Word memo

> **Audience:** anyone whose readers print or read rather than watch · **Prerequisites:** a buildable deck · **Last reviewed:** 2026-10-11

## Formats

| Format | Command | What you get |
|---|---|---|
| A4 landscape deck | `format: a4-landscape` in deck.yaml | The same deck on 297 × 210 mm pages; every layout re-flows into the page and is checked |
| One-pager | `build deck.yaml -f onepager` | `<id>-onepager.pdf`: A4 portrait. The deck title, then every slide as a vector thumbnail captioned with its action title — the argument at a glance |
| Word memo | `build deck.yaml -f docx` | `<id>.docx`, described below |

Formats combine: `-f pptx,pdf,onepager,docx`. Or set them in the deck:

```yaml
format: a4-landscape          # optional; default wide-16x9
output:
  formats: [pptx, pdf, onepager, docx]
```

## The Word memo

Each slide becomes a section:

- **Heading 1** — the action title. Word's navigation pane shows the same title chain as the deck.
- **Body** — depends on the slide:
  - text slides (exec summary, key points, statements, next steps) as editable paragraphs and bullets;
  - tables as Word tables;
  - charts and diagrams as the slide image, with alt text.
- **Source line** — with links, then the speaker notes.

Use it as a pre-read, as a memo for readers who will not open PowerPoint, or as the start of a written report.

## Accessible PDF

The native PDF engine writes a tagged PDF:

- each slide is a section, and its action title an `H1`;
- body text is `P`;
- charts and pictures are `Figure` with alt text. Chart alt text lists the data;
- tables are `Table` › `TR` › `TH`/`TD`;
- backgrounds, decor, footers and page numbers are artifacts, which screen readers skip.

Document language and title come from the deck (`language`, `title`).

## Links

Give a source a `url` in the registry, and its title becomes a link on every slide that cites it. This works in the PPTX, the native PDF, the HTML deck and the Word memo.

```yaml
sources:
  - id: eurostat
    title: Eurostat tourism statistics
    url: https://ec.europa.eu/eurostat/web/tourism
```
