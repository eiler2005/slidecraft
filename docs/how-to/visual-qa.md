# Final visual QA with a reviewer model

> **Audience:** agents and users finishing a deck · **Prerequisites:** [workflow](../explanation/workflow.md) · **Last reviewed:** 2026-10-11

Rules and calibration make the editable PPTX and the HTML follow PowerPoint's own layout to a
fraction of a point. They cannot tell whether a slide looks right, follows its template or
says the right thing. The last stage of every deck is therefore a review by a strong model
(Opus) that looks at what was actually rendered, fixes what it can, and writes a report for
the user of what still needs a human decision. It is part of the algorithm, not an extra.

![Quality stages](../assets/workflow/quality-stages.svg)

## 1 · Build the review pack

```sh
slidecraft visual-qa slidecraft/<id>/deck.yaml --json
```

The deck is built (PPTX, HTML, Chrome PDF), the PPTX is rendered by PowerPoint (or
LibreOffice), both are rasterised at 1600 px, and `dist/visual-qa/` receives per slide:

| File | Meaning |
|---|---|
| `NN-<slide>-pptx.png` | What PowerPoint draws — the deliverable |
| `NN-<slide>-html.png` | What the browser draws |
| `NN-<slide>-diff.png` | Grey = same; **red** = only PowerPoint; **cyan** = only HTML |
| `index.md`, `qa.json` | Parity score and hotspot regions, diagnostics, contrast near the limit, colours outside the theme, almost-aligned edges (0.5–4 pt), text outside the safe area, text filling its box, fonts; deck facts |

Without Office the pack still contains the HTML pages and all measured facts.

## 2 · Review (visual-reviewer, Opus)

The checklist is [`library/references/visual-qa.md`](../../library/references/visual-qa.md):

1. **Parity** — visible red/cyan shapes: moved lines, different wraps, missing frame parts.
2. **Template conformance** — theme frame, tokens, fonts, palette; the right exhibit for the
   storyline beat; titles and bodies start where every other slide starts.
3. **Layout craft** — grid alignment, rhythm, balance, clipping, overlaps, edges, widows.
4. **Colour** — one accent for the insight, semantic positive/negative, WCAG contrast.
5. **Typography** — hierarchy, consistent sizes, numbers and units, glyph coverage.
6. **Charts and tables** — legibility, zero baselines, highlighted series = the claim, sources.
7. **Meaning** — the title is a claim the body proves; one message; numbers agree; the ask.
8. **Readiness** — `ready`, `ready-with-notes` or `not-ready`.

Fix policy: recurring defects (wraps, offsets, renderer differences) are fixed in shared code
with a generic test; content and design choices in the deck YAML; long text through
`slidecraft fix`. Generated files are never edited by hand. At most three rounds.

## 3 · Record the round → user report

```sh
slidecraft visual-qa slidecraft/<id>/deck.yaml --record dist/visual-qa/findings-1.json
```

The findings file is JSON (`verdict`, `summary`, `findings[]` with `slide`, `severity`,
`area`, `issue`, `fix`, `status: fixed | open | needs-user`); a template is in
[`examples/orchestration/templates/`](../../examples/orchestration/templates/).
Recording appends to `record.json` and rewrites **`dist/visual-qa/REPORT.md`**:

- verdict in plain words;
- **Needs your attention** — what the reviewer judged wrong or uncertain and could not settle;
- **Fixed during review** — what was corrected and how;
- **Changes made during review** — which source files changed in each round.

`ready` is refused while a blocker or major is open. `visual_review` in the manifest stays
`false` until a person has looked at every slide.

## 4 · Review log

Every change made during checking is logged next to `deck.yaml`:

- `review-log.jsonl` — machine-readable entries;
- `REVIEW-LOG.md` — the same, readable: each `slidecraft fix --apply` rewrite with the field,
  the value before and after; each review pack (parity per slide, snapshot of the sources);
  each recorded round with verdict, findings and a line diff of `deck.yaml` and the section
  files since the pack was built.

## In Claude Code

`/slidecraft:new` and `/slidecraft:review` run this stage automatically after the automated
checks (`visual-qa` skill → **visual-reviewer** agent). In Codex and other agents follow step
6b of [`AGENTS.md`](../../AGENTS.md). A worked example with every intermediate file is in
[`examples/orchestration/`](../../examples/orchestration/).
