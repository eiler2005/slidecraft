> **Audience:** deck authors, layout and theme contributors, reviewers · **Used by:** exhibit-chooser, partner-review-checklist, deck-spec · **Last reviewed:** 2026-10-10

# Visual standard

The visual job of a slide is to make the title obviously true in five seconds. Everything on the page either serves that or goes to the notes. SlideCraft enforces much of this mechanically (grid, type scale, copy-fitting, contrast); this page explains the rules so you can make good choices where judgement is needed.

## 1. Grid and whitespace

- **One frame for every content slide.** Tracker label, action title (max two lines), optional lead, body, source line, footer and page number sit in fixed regions (`src/engine/format.ts`). Readers learn where to look; the deck feels like one document.
- **Align to edges, not to the eye.** Columns share the body edges and gutters of 0.25–0.4 in. Labels in parallel columns share a baseline.
- **Whitespace is structure.** Group related items with less space between them than between groups. If a slide needs smaller gaps to fit, it has too much content — split it.

## 2. Type hierarchy

| Role | Purpose | Rule |
|---|---|---|
| Action title | The claim | One sentence, ≤ 2 lines, the largest text on content slides |
| Lead | Optional framing line | One line, muted; never a second title |
| Body | Evidence and explanation | Theme body size; may step down to `minBody`, never below |
| Labels | Axis, column, category names | Small, muted, consistent case |
| Source | Where numbers come from | Smallest size, bottom-left, on every slide with numbers |

Three sizes visible at once is plenty. Bold marks the key phrase inside a sentence (`**…**`), not whole paragraphs. Avoid all-caps except short labels (trackers, quadrant names).

## 3. Colour: the one-accent rule

- **One accent colour for the one thing the eye must find**: the recommended option, the highlighted bar, the answer band. Everything else is ink, muted grey, rule lines and soft surfaces.
- **Colour has meaning, so keep it stable**: the same category or segment keeps the same colour across the deck; positive and negative colours are reserved for changes (waterfall, deltas).
- **Never decorate data.** Gradients, shadows and 3-D belong to decor, not to bars and lines.
- **Contrast:** body text ≥ 4.5:1 against its background, large text ≥ 3:1 (`SC-CONTRAST-001`). Dark themes need lighter muted greys than you expect.

## 4. Charts

1. **Pick the chart from the relationship** the title claims (see `exhibit-selection.md`).
2. **Direct labels, no value axis.** Put the number on the bar; drop gridlines and the y-axis. Legends only when there are several series and direct labelling is impossible.
3. **Zero baseline for bars.** Bar length must encode the value. Truncated axes are allowed only for lines, and must be labelled.
4. **Sort bars** by value unless the categories have a natural order (time, size bands).
5. **Highlight the insight** (`highlight:`), mute the rest. If everything is highlighted, nothing is.
6. **Size, area and length only for real quantities.** Circles or boxes sized "by importance" mislead.
7. **No pies with more than three slices**, no donuts for comparison, no dual axes.
8. **Label the measure**: what, unit, period, base — "Operating profit by segment, €M, FY2025".
9. **Same scale for compared charts.** Two charts side by side share an axis or say clearly that they do not.

## 5. Tables

- Use tables when people will look values up; use charts when they should see a pattern.
- Right-align numbers, left-align text; one decimal convention per column.
- Hairline rules between rows, a heavier rule under the header, no vertical lines.
- Highlight the recommended column or the key row with the accent tint, not with bold everywhere.
- More than ~8 rows or 6 columns → backup slide or appendix.

## 6. Density

- **One message per slide.** If a slide needs two titles, it is two slides.
- Aim for under ~120 words of body text; above ~170 SlideCraft warns (`SC-DENSITY-001`).
- Never shrink text below the theme minimum to make content fit. SlideCraft refuses and tells you how many characters to cut (`SC-FIT-001`). Rewrite, split, or move detail to notes.

## 7. Consistency across the deck

- Same number formatting and rounding everywhere (€42M, not €42.0M on one slide and €42m on another).
- Same term for the same thing (choose "mid-market" or "SME", not both).
- Same layout for the same kind of evidence: if one reason is a bar chart with a takeaway panel, the parallel reasons should be too.
- Source line style and footnote conventions identical on every slide.

## 8. Images and decor

- Images must carry meaning (a product, a place, a moment). Stock images that only decorate are noise.
- Every image has alt text; at least 144 ppi at its placed size (`SC-IMG-001`).
- Decor (waves, glows, frames) belongs to the theme and stays behind content; it never overlaps text.
- The cover carries the topic: a right-hand panel with a picture that shows the subject, or the
  topic motif (`art:`) in the theme accent. One visual, never on top of the title.

## 9. Accessibility

- Contrast as above; never colour as the only carrier of meaning (add labels or markers).
- Reading order follows the visual order; titles are real text, not images.
- Speaker notes for every slide make the deck usable by screen-reader users and by presenters who did not build it.
