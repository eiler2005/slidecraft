# Apply your brand

> No `.pptx`/`.potx` template? [Create a theme from a sample](theme-from-sample.md) — a PDF, a screenshot or a website.

> **Audience:** teams with brand guidelines · **Prerequisites:** your `.pptx` or `.potx` template; optionally the brand font files · **Last reviewed:** 2026-10-11

## 1. Import the template

```sh
node dist/slidecraft.mjs theme import brand.potx --id contoso --font-dir ./brand-fonts
```

This reads the Office theme inside the file and writes `slidecraft-theme/contoso.json` next to it:

| From the template | Into the theme |
|---|---|
| Colour scheme (dk1, lt1, dk2, lt2, accent1–6) | `background`, `ink`, `titleInk`, `accent`, `accentSoft`, `surface`, `muted`, `rule`, chart palette; positive/negative picked from the accents when they fit |
| Major / minor fonts | `fonts.heading` / `fonts.body` |
| Pictures on the slide master and on the title and content layouts | `chrome.art`: drawn in their original positions on SlideCraft's cover and content masters, in every engine; a small one is the logo |
| Title placeholder position and slide size | `<id>.format.json`: SlideCraft's title band sits where the template has its title, at the template's slide size (4:3 works too) |
| Office theme part (`theme1.xml`) | `<id>.theme.xml`, carried into every PPTX — see below |
| Largest image, if the template has no pictures in place | `chrome.logo` (top-right on content slides, bottom-right on the cover) |

**Fonts.** Arial, Georgia and Times New Roman map to bundled metric-compatible fonts. For any other brand font, pass `--font-dir` with its TTF/OTF files: the files are copied next to the theme and used to measure text, render previews and PDFs, and embed in HTML — while the PPTX names the brand font. Without the files SlideCraft maps to the closest measurable family and tells you so.

## 2. Use it in a deck

```yaml
theme: ./slidecraft-theme/contoso.json          # colours, fonts, art, logo
format: ./slidecraft-theme/contoso.format.json  # optional: the template's slide size and title band
```

The format keeps the frame consistent with the template: the left and right margins follow the template's title placeholder, and the footer sits above a band of art along the bottom edge. Every layout re-flows into it and is checked as usual.

Action titles are written as real **title placeholders**. PowerPoint's outline view, slide sorter, accessibility checker and screen readers see them as slide titles.

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

## The brand's Office theme travels with the deck

The import also saves the template's Office theme part as `<id>.theme.xml`, and the theme JSON points to it (`"officeTheme"`). Every PPTX built with this theme carries that part. In PowerPoint, *Design › Variants* and the colour and font pickers then show the brand's palette and fonts. Shapes people add later pick up the brand automatically.

SlideCraft still builds its own masters (background, decor, footer, logo) from the imported tokens. Reusing the template's own placeholder layouts and background art is on the [ROADMAP](../../ROADMAP.md).

## PPTX built inside your template

The import also copies the template itself (`<id>.template.pptx`), and the theme points to it (`"template"`). PPTX output is then built **inside the template package**:

| SlideCraft slide | Linked to the template layout |
|---|---|
| Cover, closing | *Title Slide* (`title`) |
| Content slides | *Title Only* (`titleOnly`), else *Title and Content* (`obj`) |
| Section dividers | *Section Header* (`secHead`), else the cover's layout |

The effects in PowerPoint:
- the template's masters, layouts, theme and art apply;
- the Layout menu shows the brand's layouts;
- editing the slide master changes every slide;
- slide numbers and the footer use the layout's own placeholders.

The footer appears where the template has a footer placeholder.

PDF, PNG and HTML are drawn by SlideCraft from the imported art (pictures and simple vector shapes: rectangles, ellipses, lines) and the template's frame. So all formats match. To go back to SlideCraft's own masters in PPTX, remove `"template"` from the theme JSON.

## Limits

- Slide content stays SlideCraft's own: positioned text boxes, tables and charts, not the template's body placeholders. So switching a slide to another template layout in PowerPoint keeps the content where it is.
- For PDF, PNG and HTML only simple vector shapes are imported (rectangles, rounded rectangles, ellipses, lines with solid colours). Gradients, freeforms and grouped shapes appear in the PPTX (it is the template), but not in the vector outputs. Export such decoration as a PNG into `chrome.art` if it must appear everywhere.
