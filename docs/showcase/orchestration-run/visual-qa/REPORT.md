# Visual review report

**Ready, with points for you to check.** Both content fixes landed and the matrix now states its conclusion; a reversed axis arrow in PowerPoint was traced to line export and fixed for every deck. Remaining items are design choices for you.

Rounds: 2 · reviewer: visual-reviewer (Claude Opus 5.5). Rules, calibration and Office parity ran first; this review covers what rules cannot judge.

## Needs your attention

| Slide | Severity | Area | What the reviewer saw | Suggested action |
|---|---|---|---|---|
| traction | minor | chart | Native chart axis labels sit about 1 px lower in PowerPoint than in HTML | shared: calibrate native chart label placement (engine issue) |
| solution, team | minor | layout | Content fills only the top half; the lower half is empty | Add a result line, logos or proof points — or accept the whitespace |
| ask | minor | layout | The decision panel repeats the title in five lines and runs down to the source line | Shorten the decision to two lines, e.g. 'Commit €3M on 30 October' |

## Fixed during review

| Slide | Severity | Area | Issue | Fix |
|---|---|---|---|---|
| competition | major | layout | The matrix uses two thirds of the width and leaves the right third empty, so the slide never states its conclusion | deck: add the takeaway panel the layout provides |
| traction | minor | typography | Panel heading breaks as 'repeat-' / 'driven' — a one-word second line | deck: 'Organic, repeat-driven growth' |
| competition | major | parity | The y-axis arrowhead pointed down in PowerPoint and up in HTML | shared: PPTX lines set flipH/flipV from their direction, so arrowheads end where the Scene line ends |

## Changes made during review

- Round 1: `deck.yaml` +2 −1 lines

Field-by-field before/after and full diffs: `REVIEW-LOG.md` next to deck.yaml.

`visual_review` in the manifest stays false until you have looked at every slide yourself.
