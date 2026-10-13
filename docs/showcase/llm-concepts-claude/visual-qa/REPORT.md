# Visual review report

**Ready, with points for you to check.** Independent review of the deck Claude Code made from one prompt on its second run (the first run delivered ghost slides): 12 sourced slides with a clear title chain, dense on two slides, a plain cover, and specific numbers whose sources the user should confirm.

Rounds: 1 · reviewer: visual-reviewer (Claude Opus 5.5). Rules, calibration and Office parity ran first; this review covers what rules cannot judge.

## Needs your attention

| Slide | Severity | Area | What the reviewer saw | Suggested action |
|---|---|---|---|---|
| cover | minor | template | The cover has no visual: the cover choice step was skipped | Run `slidecraft covers` and choose; the rule is in AGENTS.md |
| hallucinations, evaluation | minor | layout | 172 and 174 words on one slide (SC-DENSITY-001) | Move detail to the notes or split the slide |
| why-now, tokens-context, ship-gates | minor | meaning | Specific figures (token sizes, context windows, a 44% survey figure, OWASP ranking) are attributed to vendor pages and reports the reviewer cannot verify | Check each figure against its source before external use |
| all | minor | parity | Key-point headings sit about 1 px apart in PowerPoint and the browser | known shared gap (calibration open item) |

## Fixed during review

| Slide | Severity | Area | Issue | Fix |
|---|---|---|---|---|
| rag, agents-loop | major | color | Numbers of the steps that are not highlighted had 2.46:1 contrast (SC-CONTRAST-001) | shared: numbered process steps keep their large numbers at 3:1 while they recede |

## Changes made during review

No source files were edited.

Field-by-field before/after and full diffs: `REVIEW-LOG.md` next to deck.yaml.

`visual_review` in the manifest stays false until you have looked at every slide yourself.
