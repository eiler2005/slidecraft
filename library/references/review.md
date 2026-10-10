> **Audience:** reviewers, agents running the review loop · **Used by:** partner-review-checklist, review skill, partner-reviewer and copy-fitter agents · **Last reviewed:** 2026-10-10

# Partner-grade review

A partner reviews top-down: story before slides, message before format. Review in that order so the fix list reflects real impact. SlideCraft automates the mechanical layer; humans and the partner-reviewer agent own the judgement layer.

## 0. Automated checks first

```sh
node dist/slidecraft.mjs check deck.yaml --json
```

Fix every **error** before a human looks. Codes are stable and documented in `docs/reference/error-codes.gen.md`:

| Family | What it catches | Who fixes |
|---|---|---|
| `SC-SPEC-*` | Schema, unknown ids, duplicates, includes | Author / agent at the pointer |
| `SC-FIT-*` | Text that does not fit at the minimum size, over-long words | copy-fitter (rewrite shorter, never truncate) |
| `SC-TITLE-*` | Titles over two lines, topic-like titles, trailing periods | copy-fitter / action-title-writer |
| `SC-SRC-*` | Numbers without a source (`final` decks: error) | Author — never invent a source |
| `SC-GEOM-*` | Elements outside the page, overlapping text | Layout bug or too much content |
| `SC-CONTRAST-001` | Text below WCAG contrast | Theme or highlight choice |
| `SC-DENSITY-001` | Too many words on a slide | Split or move to notes |
| `SC-PPTX-001`, `SC-IMG-*` | Text missing in the written PPTX, low-resolution images | Engine bug / supply a larger image |

## 1. Story and answer

- Is there one clear recommendation or idea, stated up front (cover + slide 2)?
- Does the deck answer the audience's actual question, from the brief?
- Read the executive summary alone: could the decision be made from it?

## 2. Title chain

- Read the action titles in order. Do they argue the full case with no gaps?
- Is every title a claim, not a topic? Does each slide prove exactly what its title says?
- Does every number in a title appear on that slide's exhibit?

## 3. Logic and MECE

- Within each group of reasons: no overlaps, nothing a sceptic would add.
- Every section ladders up to a point in the summary; no orphan slides.
- Facts, interpretations, proposals and unknowns are visibly distinct.

## 4. Exhibit fit

- The exhibit matches the relationship claimed (`exhibit-selection.md`).
- The one insight is highlighted; there is a comparison anchor.
- No chart implies a different conclusion than its title (correlation shown, causation claimed).

## 5. Slide craft

- Grid alignment, consistent spacing and type scale (the frame enforces most of this).
- One accent per slide, used for meaning; category colours stable across slides.
- Nothing cramped, clipped or overlapping in the rendered previews.

## 6. Density and consistency

- One message per slide; overloaded slides split; thin slides merged; detail in backup or notes.
- Same terms, number formats, rounding and source style everywhere.

## 7. Evidence and honesty

- Every number traceable to a source; illustrative data labelled as such.
- No claim beyond what the data shows; assumptions stated where they matter.

## 8. The ask

- The deck ends with an explicit decision or action: what, who, by when.

## 9. Prioritise

| Priority | Definition | Examples |
|---|---|---|
| **Blocker** | Story or logic broken; the deck cannot go out | No recommendation; title chain contradicts itself; key number wrong |
| **Major** | A slide fails its job | Exhibit does not prove title; unsourced figure; wrong chart type |
| **Minor** | Craft and consistency | Inconsistent rounding; label case; a colour drift |

Output: one-line verdict, then Blockers / Majors / Minors as specific fixes tied to slide ids, then the three highest-impact fixes to do first.

## 10. Render QA (every build)

1. Read the extracted text: `manifest.json` lists slides; `check` reports SC-PPTX-001 if any string is missing from the PPTX.
2. **Open every preview PNG** (`dist/previews/`). Look for overflow, overlap, wrong highlight, empty placeholders, source lines.
3. If the PDF goes to readers, build it with `--pdf-engine pptx-convert` so it is rendered by PowerPoint itself, and look at that too.
4. Fix, rebuild the affected outputs, re-check. Repeat at most three rounds; then escalate to the author.
5. `visual_review` in `manifest.json` stays `false` until a human has looked at every slide.
