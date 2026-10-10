# Deck spec (`deck.yaml`)

> **Audience:** deck authors and agents · **Schema:** [`schemas/deck.v1.json`](../../schemas/deck.v1.json) · **Last reviewed:** 2026-10-10

Add `# yaml-language-server: $schema=../../schemas/deck.v1.json` (path relative to your file) for completion and validation in editors.

## Deck fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `schemaVersion` | `1` | required | Spec version |
| `id` | kebab-case | required | Used for file names |
| `title` | string ≤ 140 | required | The answer in one sentence |
| `subtitle`, `author`, `organization`, `date` | string | — | Metadata |
| `language` | BCP-47 | `en` | Content language |
| `storyline` | id | — | Storyline used (for checks and docs) |
| `theme` | id | `consulting-classic` | See [themes](themes.gen.md) |
| `format` | id | `wide-16x9` | 13.333 × 7.5 in |
| `status` | `ghost \| draft \| review \| final` | `draft` | `ghost` renders sketches; `final` makes unsourced numbers errors |
| `footer` | string ≤ 80 | theme default | Shown on content slides |
| `sources` | list | `[]` | `{ id, title, publisher?, date?, url?, note?, illustrative? }` |
| `output.formats` | `pptx \| pdf \| png \| html` list | `[pptx, pdf, png]` | |
| `output.engines` | `{ pptx, pdf }` | `auto` | pptx: `auto \| pptxgenjs \| artifact-tool`; pdf: `auto \| native \| html \| pptx-convert` |
| `slides` | list | required | Slides or `{ include: path.yaml }` |

## Common slide fields

| Field | Notes |
|---|---|
| `id` | Unique kebab-case id; reviews and fixes target it |
| `layout`, `variant` | See [layouts](layouts.gen.md); variant defaults to the first |
| `title` | Action title, ≤ 140 chars, ≤ 2 lines at the theme title size |
| `lead` | Optional one-line lead (shifts the body down) |
| `tracker` | Small section label above the title |
| `sources` | Ids from the deck `sources:` list |
| `source` | Free-text source line |
| `notes` | Speaker notes (≤ 3000 chars) |
| `status` | `ghost \| draft \| final` per slide (overrides the deck for ghost rendering) |
| `ghost` | `{ exhibit, data?, confidence: solid \| likely \| speculative }` |

All other fields come from the layout's contract — run `slidecraft layouts <id> --json`.

## Includes

```yaml
slides:
  - include: sections/why.yaml     # a YAML list of slides, path relative to deck.yaml
```

Used by parallel slide writers; ids must stay unique across files.

## Inline text

`**bold**` and `*italic*` inside any text field. Paragraphs: separate with a blank line where a field accepts free text; list fields produce one paragraph per item.

## YAML gotcha

Inside flow maps `{ … }`, values containing `, ` or `: ` must be quoted: `{ summary: "Two resellers, direct later" }`.
