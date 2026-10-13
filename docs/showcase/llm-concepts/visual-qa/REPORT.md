# Visual review report

**Ready, with points for you to check.** Independent review of the deck Codex made from one prompt, unedited: 12 slides as asked, an action-title chain, every concept sourced, icons and native exhibits, no check findings. Notes are about choices, not defects.

Rounds: 1 · reviewer: visual-reviewer (Claude Opus 5.5). Rules, calibration and Office parity ran first; this review covers what rules cannot judge.

## Needs your attention

| Slide | Severity | Area | What the reviewer saw | Suggested action |
|---|---|---|---|---|
| all | minor | parity | Key-point headings sit about 1 px apart in PowerPoint and the browser; glyph-edge fringes elsewhere | known shared gap (calibration open item); invisible at normal size |
| tokens-context, training-inference, hallucinations, evals-guardrails | minor | layout | Key points fill the upper half; the lower half is empty | Accept as whitespace, or add one example per concept |

## Fixed during review

| Slide | Severity | Area | Issue | Fix |
|---|---|---|---|---|
| deck | minor | template | Codex chose the project-kickoff storyline for an explainer — the recommender of 0.7.0 had no explainer words | shared: explainer, primer and key-concepts words now rank training-workshop first |
| cover | minor | template | Network motif chosen over a 97 ppi stock photo | Right call: the photo was soft and generic |

## Changes made during review

No source files were edited.

Field-by-field before/after and full diffs: `REVIEW-LOG.md` next to deck.yaml.

`visual_review` in the manifest stays false until you have looked at every slide yourself.
