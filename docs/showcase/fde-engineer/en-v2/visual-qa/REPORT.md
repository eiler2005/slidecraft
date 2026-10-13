# Visual review report

**Ready, with points for you to check.** Round 3: sharp cover photo (1920 px CC0, Wikimedia Commons) cropped on the laptop screen with imageFocus: left — identical in PowerPoint and the browser. Placeholders (illustrative plan) stay with the author.

Rounds: 3 · reviewer: visual-reviewer (Claude Opus 5.5). Rules, calibration and Office parity ran first; this review covers what rules cannot judge.

## Needs your attention

| Slide | Severity | Area | What the reviewer saw | Suggested action |
|---|---|---|---|---|
| organisation, pilot-plan, budget | minor | meaning | 7S ratings, pilot targets and budget are planning assumptions, labelled illustrative | Replace with your organisation's assessment, targets and rates before use |

## Fixed during review

| Slide | Severity | Area | Issue | Fix |
|---|---|---|---|---|
| budget | blocker | meaning | Total for month 2 was $69k while the items add up to $67k (SC-CONSIST-002, also the $206k cross-check) | content: total row corrected to $67k |
| cover | major | parity | PowerPoint stretched the cover photo to the panel; HTML cropped it — pptxgenjs crops from the box aspect, not the file's | shared: images are exported with their own aspect, so cover/contain crop the same in every engine |
| organisation | major | meaning | Structure showed two bullets: an unquoted comma inside [ ] split one point in two | content: quoted the point |
| value-chain | minor | color | MARGIN label in the accent on the tinted arrow had 4.2:1 contrast with the sampled theme | shared: the label darkens the accent to 4.5:1 on the tint |
| all | minor | parity | Remaining PowerPoint/HTML differences are sub-pixel glyph edges and JPEG edges; no moved line, wrap or shape | none needed |
| cover | major | other | Cover photo was 1024 px wide (91 ppi on the panel) and soft on a projector; the top stock candidate listed 7360 px but served a 1024 px preview | Stock downloads are measured (shared fix); --stock auto took a 1920 px CC0 photo |
| cover | minor | layout | On the tall panel the centred crop showed a book, not the code on the laptop screen | imageFocus: left (shared feature: same crop window in PPTX, PDF and HTML) |

## Changes made during review

- Round 1: `deck.yaml` +2 −2 lines

Field-by-field before/after and full diffs: `REVIEW-LOG.md` next to deck.yaml.

`visual_review` in the manifest stays false until you have looked at every slide yourself.
