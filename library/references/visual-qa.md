# Visual QA — the final LLM review stage

Rules and calibration make the editable PPTX and the HTML agree with PowerPoint to a
fraction of a point. They cannot judge whether a slide *looks right* or *says the right
thing*. This last stage is part of the algorithm, not an optional extra: a reviewer model
looks at what was actually rendered and closes the final 5–10 %.

## Inputs

`slidecraft visual-qa <deck.yaml> --json` builds the deck, renders the PPTX in PowerPoint
(or LibreOffice) and the HTML in Chrome, and writes `dist/visual-qa/`:

- `NN-<slide>-pptx.png` — what PowerPoint draws (the deliverable).
- `NN-<slide>-html.png` — what the browser draws.
- `NN-<slide>-diff.png` — grey where they agree, **red** where only PowerPoint has ink,
  **cyan** where only HTML has ink.
- `index.md` / `qa.json` — parity score and hotspots per slide, scene diagnostics, contrast
  ratios near the limit, colours outside the theme, almost-aligned edges, text outside the
  safe area, text filling its box, fonts; deck facts (title position spread, palette size).

Open **every** image. Facts point you at places to look; they are not the verdict.

## Checklist (in this order)

1. **Parity.** Red/cyan shapes in the difference image: anything visible at 100 % zoom —
   a moved line, a different wrap, a missing rail/page number/source, a different chart
   label — is a defect in shared code (`docs/explanation/office-rendering-rules.md`).
   Sub-pixel fringes on glyph edges are expected and not a finding.
2. **Template conformance.** The slide uses the theme's frame (marker, rail, title rule,
   page badge/number, sources, takeaway band) and tokens — fonts, sizes, palette, spacing.
   The layout is the right exhibit for the storyline beat (`exhibit-selection.md`). No
   one-off colours, no stray fonts, title and body start where every other slide starts.
3. **Layout craft.** Alignment to a shared grid (no 1–4 pt near-misses), consistent gutters
   and rhythm, balanced whitespace, nothing clipped, overlapping or crowding the edges,
   no orphaned single words on the last line of a title, no ragged two-line labels where
   one line fits, reading order obvious in two seconds.
4. **Colour.** One accent carries the insight; secondary series recede; positive/negative
   colours used semantically; WCAG contrast ≥ 4.5:1 for body text and ≥ 3:1 for large text
   (also on photos and tinted panels); dark themes keep the same hierarchy.
5. **Typography.** Hierarchy title › lead › body › label is visible; sizes consistent
   across slides; no fake bold/italic; numbers right-aligned in tables; units and
   separators consistent; Cyrillic and Latin use fonts that have the glyphs.
6. **Charts and tables.** Every label legible at presentation size; axis starts at zero for
   bars; highlighted series is the one the title talks about; sorted when order carries no
   meaning; sources under every number.
7. **Meaning.** The action title is a full-sentence claim the body proves; one message per
   slide; the title chain reads as the argument; numbers agree across slides and with the
   sources; the ask is explicit. Never invent data or sources.
8. **Cover.** The first slide stands out and says what the deck is about: a cover visual
   (`art:` motif that fits the topic, or a picture that shows the subject), title in three
   lines or fewer, nothing crowding the panel. A plain cover is a `should` finding.
9. **Readiness.** Would a demanding partner hand this to the client now? Decide
   `ready`, `ready-with-notes` or `not-ready`.

## Fix policy

- A defect that would recur on other decks (wrong wrap, offset, missing chrome, renderer
  difference) is fixed in **shared code** with a generic test — never by nudging one slide.
- A content or design choice is fixed in `deck.yaml` / `sections/*.yaml` (wording, layout,
  variant, emphasis, chart options). Text that is too long goes through `slidecraft fix`.
- Never edit generated PPTX/HTML/PDF by hand. Rebuild and rerun `visual-qa` after fixes.
- At most three rounds. Anything you cannot fix confidently becomes `needs-user`.

## Record and report

Write the round as JSON and record it:

```json
{
  "reviewer": "visual-reviewer (opus)",
  "verdict": "ready-with-notes",
  "summary": "Clean, on-template deck; one chart label needs a business decision.",
  "findings": [
    { "slide": "market", "severity": "major", "area": "layout", "issue": "KPI values sit 3 pt lower than their labels' grid", "fix": "shared: kpi-tiles baseline", "status": "fixed" },
    { "slide": "traction", "severity": "minor", "area": "meaning", "issue": "Title says eight-fold; chart shows 7.6×", "fix": "Round in the source or say 'nearly eight-fold'", "status": "needs-user" }
  ]
}
```

`slidecraft visual-qa <deck> --record findings.json` appends the round to
`visual-qa/record.json` and rewrites `visual-qa/REPORT.md` — the user-facing report: verdict,
**what needs your attention**, and what was fixed. `ready` is refused while a blocker or
major is open. `visual_review` in the manifest stays `false` until a human has looked.
