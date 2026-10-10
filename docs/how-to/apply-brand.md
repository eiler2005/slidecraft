# Apply your brand

> **Audience:** teams with brand guidelines · **Prerequisites:** your `.pptx` or `.potx` template; optionally the brand font files · **Last reviewed:** 2026-10-10

## 1. Import the template

```sh
node dist/slidecraft.mjs theme import brand.potx --id contoso --font-dir ./brand-fonts
```

This reads the Office theme inside the file and writes `slidecraft-theme/contoso.json` next to it:

| From the template | Into the theme |
|---|---|
| Colour scheme (dk1, lt1, dk2, lt2, accent1–6) | `background`, `ink`, `titleInk`, `accent`, `accentSoft`, `surface`, `muted`, `rule`, chart palette; positive/negative picked from the accents when they fit |
| Major / minor fonts | `fonts.heading` / `fonts.body` |
| Largest image on the slide masters | `chrome.logo` (top-right on content slides, bottom-right on the cover) |

**Fonts.** Arial, Georgia and Times New Roman map to bundled metric-compatible fonts. For any other brand font, pass `--font-dir` with its TTF/OTF files: the files are copied next to the theme and used to measure text, render previews and PDFs, and embed in HTML — while the PPTX names the brand font. Without the files SlideCraft maps to the closest measurable family and tells you so.

## 2. Use it in a deck

```yaml
theme: ./slidecraft-theme/contoso.json   # path relative to deck.yaml
```

## 3. Calibrate a new font against PowerPoint

```sh
node dist/slidecraft.mjs calibrate --theme ./slidecraft-theme/contoso.json
```

Builds 144 test strings (EN and RU, three widths, 11/14/20 pt, regular and bold), has PowerPoint (or LibreOffice) render them, and compares line counts. **GO** means ≥ 95% identical and no case where PowerPoint needs more lines than SlideCraft measured. Needs PowerPoint (macOS) or LibreOffice, plus `pdftotext` (`brew install poppler`). Reference result for the bundled themes: 98.6% (consulting-classic), 97.2% (executive), zero overflows.

## 4. Review the theme

Open the JSON and adjust anything the import guessed: decor, type scale, `bestFor`. Then look at a contact sheet:

```sh
node dist/slidecraft.mjs build your-deck/deck.yaml -f png
```

`check` warns about any colour pair below WCAG contrast (`SC-CONTRAST-001`).

## Not yet

Reusing the template's own slide master (placeholders, background art) inside the PPTX is planned — see [ROADMAP](../../ROADMAP.md). Today SlideCraft builds its own master from the imported tokens and logo.
