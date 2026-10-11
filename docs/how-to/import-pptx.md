# Import an existing PowerPoint

> **Audience:** anyone with a deck to restyle or review · **Prerequisites:** SlideCraft installed; PowerPoint or LibreOffice for `--render` · **Last reviewed:** 2026-10-11

`slidecraft import` turns a `.pptx` into a draft `deck.yaml`. You then redesign it: real action titles, real exhibits, your theme.

```sh
slidecraft import board-update.pptx --render
# ✔ slidecraft/board-update/deck.yaml · 11 slides · text ×7, chart-takeaway ×3, data-table ×1
```

## What is extracted

| From the original | Becomes |
|---|---|
| Title / centred-title placeholders. Without placeholders: the largest text on the slide | `title` |
| First slide with a centred title, or little text | `title` (cover) with a subtitle |
| Native chart (bar, column, stacked, line) | `chart-takeaway`: categories and series from the chart's data cache |
| Table | `data-table` (up to 6 columns × 10 rows; the rest goes to notes) |
| Picture next to text | `text-image`; the image is copied to `assets/` |
| Anything else | `text` (bullets); levels flattened |
| Speaker notes | `notes` |

Text longer than a layout allows is shortened with " …". The full original goes to the slide's notes under `IMPORT —`, so nothing is lost and `slidecraft check` stays green.

`--render` also writes `original.pdf`, rendered by PowerPoint (macOS) or LibreOffice. It is for the visual pass below.

## Redesign with Claude: `/slidecraft:import`

The plugin skill runs the import, reads `original.pdf` page by page and rewrites every slide:

- an action title instead of a topic;
- the exhibit the claim needs (`key-points`, `process-steps`, `matrix-2x2`, `before-after`…) instead of `text`;
- charts rebuilt from data, never pasted as pictures;
- sources registered and cited.

It shows you the old → new title chain before building.

```text
/slidecraft:import board-update.pptx --brand
```

## Keep the brand

```sh
slidecraft theme import board-update.pptx --id contoso -o slidecraft/board-update/theme
```

Then set `theme: theme/contoso.json` in the deck. See [Apply your brand](apply-brand.md).

## Limits

- Diagrams drawn from loose shapes come in as text; the visual pass rebuilds them.
- Text inside pictures is not read.
- Grouped shapes, SmartArt and embedded objects are skipped. Their text, where it can be found, lands in the `text` slide.
