# Visual review report

**Ready, with points for you to check.** Round 2: totals add up, the cover photo crops identically in PowerPoint and the browser, icons, value chain, 7S and the combo chart match between engines. Content placeholders (illustrative plan) stay with the author.

Rounds: 2 · reviewer: visual-reviewer (Claude Opus 5.5). Rules, calibration and Office parity ran first; this review covers what rules cannot judge.

## Needs your attention

| Slide | Severity | Area | What the reviewer saw | Suggested action |
|---|---|---|---|---|
| cycle, profile, budget | minor | layout | Content sits in the upper half; the lower half is empty | Accept as whitespace, or add an example, a result line or a bottom line |
| organisation, pilot-plan, budget | minor | meaning | 7S ratings, pilot targets and budget are planning assumptions, labelled illustrative | Replace with your organisation's assessment, targets and rates before use |
| why-now | minor | meaning | Growth figures for FDE postings differ by dataset; the deck uses the FT figure reported by Fast Company | Check the FT article before external use |

## Fixed during review

| Slide | Severity | Area | Issue | Fix |
|---|---|---|---|---|
| budget | blocker | meaning | Total for month 2 was $69k while the items add up to $67k (SC-CONSIST-002, also the $206k cross-check) | content: total row corrected to $67k |
| cover | major | parity | PowerPoint stretched the cover photo to the panel; HTML cropped it — pptxgenjs crops from the box aspect, not the file's | shared: images are exported with their own aspect, so cover/contain crop the same in every engine |
| organisation | major | meaning | Structure showed two bullets: an unquoted comma inside [ ] split one point in two | content: quoted the point |
| value-chain | minor | color | MARGIN label in the accent on the tinted arrow had 4.2:1 contrast with the sampled theme | shared: the label darkens the accent to 4.5:1 on the tint |
| all | minor | parity | Remaining PowerPoint/HTML differences are sub-pixel glyph edges and JPEG edges; no moved line, wrap or shape | none needed |

## Changes made during review

- Round 1: `deck.yaml` +2 −2 lines

Field-by-field before/after and full diffs: `REVIEW-LOG.md` next to deck.yaml.

`visual_review` in the manifest stays false until you have looked at every slide yourself.
