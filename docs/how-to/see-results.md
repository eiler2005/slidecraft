# See results and compare them with references

> **Audience:** users and reviewers · **Prerequisites:** none · **Last reviewed:** 2026-10-11

Where to open what SlideCraft produced, and how to put it next to the reference it must match.

## Your own deck

| What | Where |
|---|---|
| Editable PowerPoint, PDF, HTML deck | `slidecraft/<id>/dist/<id>.pptx`, `.pdf`, `.html` |
| One-pager, Word memo | `dist/<id>-onepager.pdf`, `dist/<id>.docx` (`-f onepager,docx`) |
| Slide previews | `dist/previews/` (Scene) · `dist/previews-office/` (the PPTX as PowerPoint draws it, `--png-engine pptx-convert`) |
| **Review report** — verdict, what needs your attention, what was fixed | `dist/visual-qa/REPORT.md` |
| PowerPoint vs HTML for every slide, with a difference image | `dist/visual-qa/NN-<slide>-pptx.png`, `-html.png`, `-diff.png` and `index.md` |
| **Every change made while checking** (field before → after, diffs) | `slidecraft/<id>/REVIEW-LOG.md` |
| Engines used, checks, limitations | `dist/manifest.json` |

Produce the review files with `slidecraft visual-qa <deck.yaml>` ([guide](visual-qa.md)).

## Ready-made examples in the repository

| What | Where |
|---|---|
| SlideCraft's own deck in PPTX, PDF, one-pager and a contact sheet | [`docs/showcase/`](../showcase/) |
| A complete run in every format — PPTX, PDF, HTML, one-pager, PowerPoint renders, review report | [`docs/showcase/orchestration-run/`](../showcase/orchestration-run/) |
| One deck in English and Russian, made through the whole workflow: PPTX, PDF, HTML, PowerPoint renders, review report | [`docs/showcase/fde-engineer/`](../showcase/fde-engineer/) · sources in [`examples/fde-engineer-en`](../../examples/fde-engineer-en/) and [`-ru`](../../examples/fde-engineer-ru/) |
| The same deck's second edition with stock photo, sampled theme, value chain, icons, 7S, combo chart and the totals check | [`docs/showcase/fde-engineer/en-v2/`](../showcase/fde-engineer/en-v2/) · [how it was made](../../examples/fde-engineer-en-v2/README.md) |
| The README's one prompt, run by Codex and by Claude Code, unedited, with independent reviews | [`docs/showcase/llm-concepts/`](../showcase/llm-concepts/) · [`llm-concepts-claude/`](../showcase/llm-concepts-claude/) |
| How that run was orchestrated: plan, hand-off templates per stage, review log | [`examples/orchestration/`](../../examples/orchestration/README.md) |
| Source decks of all examples | [`examples/*/deck.yaml`](../../examples/) — build with `slidecraft build examples/<name>/deck.yaml -f pptx,pdf,html` (output in `examples/<name>/dist/`, not committed) |
| How PowerPoint was measured and how close we are | [`calibration/REPORT.md`](../../calibration/REPORT.md), [`calibration/RULES.md`](../../calibration/RULES.md) |

## References and results side by side

```sh
npm run comparison              # from the last calibration corpus run
npm run comparison -- --refresh # rerun the corpus first (PowerPoint, Chrome, Poppler; ~10 min)
```

Open **`comparison/index.html`**. The folder is built locally and stays out of git — it holds the
approved integration corpus and ~80 MB of images.

```
comparison/
├── index.html            viewer: summary table, then every page of every deck side by side
├── README.md             the same summary with links
├── calibration/          REPORT.md, RULES.md and corpus.json of that run
└── <deck>/
    ├── reference/        what the result must match
    ├── result/           what SlideCraft produced: editable PPTX, HTML, PDFs
    ├── source/           deck YAML (generated decks)
    ├── pages/            NN-reference.png, NN-pptx.png / NN-html.png, NN-diff-*.png
    └── report.md         scores per page
```

What "reference" means depends on the deck:

| Deck kind | Reference | Result | Example |
|---|---|---|---|
| `rebuild` — an existing PowerPoint made editable | the **original PPTX** as PowerPoint renders it (plus its historical HTML, for diagnosis only) | the rebuilt editable PPTX and the HTML deck | `digital-ruble` |
| `generated` — a deck written in YAML | how PowerPoint renders the generated editable PPTX (`reference/*.pdf`) | the **editable PPTX** and the HTML deck from the same source (`result/`) | the six examples and three theme variants |

**Reading the images.** In a difference image grey means both agree, **red** is ink only in the
reference, **cyan** only in the result. Coloured fringes along glyph edges are sub-pixel
differences; a red and a cyan copy of a whole word or line is a real shift or a different wrap.

**Reading the scores.** Each page gets the worst of 16 regions (4×4), each the lower of RGB
similarity and edge-detail similarity, at 1600 px. Green is ≥ 95 % (the target), amber 90–95 %,
red below 90 %. The metric is strict on purpose — a 1 px shift of a text line costs several
points — so read it together with the images and the review report.

On the run of 2026-10-13 the Digital Ruble rebuild met the target on all 22 pages
(98.5–99.8 %); the generated decks averaged 87 % per page (90 % across all 103 pages), visually close at normal size,
with sub-pixel glyph edges and native chart labels as the remaining differences.
