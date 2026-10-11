---
name: review
description: Review a built SlideCraft deck like a partner — automated checks, copy-fitting, visual inspection of every slide and a prioritised fix list — then fix and rebuild. Checkpoint 4.
argument-hint: "[path to deck.yaml]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Agent, Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs *)
---

# Review

`sc` = `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"`. Deck: $ARGUMENTS. Procedure reference: `${CLAUDE_PLUGIN_ROOT}/library/references/review.md`; codes: `${CLAUDE_PLUGIN_ROOT}/docs/reference/error-codes.gen.md`.

## Loop (max 3 rounds)

1. `sc check <deck> --json`.
2. **Mechanical fixes → copy-fitter (Haiku).** `sc fix <deck> --json` lists every too-long field with an exact character budget. Send copy-fitter the deck path plus any `SC-TITLE-001/003`. It rewrites within budget and applies with `sc fix <deck> --apply fixes.json`, looping until `remaining` is empty.
3. **Sources.** For `SC-SRC-*` add `sources:` ids that exist in the deck, or ask the user. Never invent a source.
4. **Consistency.** `SC-CONSIST-001` names a metric with different values on different slides. Ask which is right (or read the source), then put it in `facts:` and use `{{id}}` everywhere.
5. `sc build <deck> -f png,pptx --json` and re-check until 0 errors.

## Partner review (Opus)

6. Launch **partner-reviewer** with the deck path, the brief, and `dist/previews/`. It reads every PNG and the title chain and returns Blockers / Majors / Minors with slide ids.
7. Fix blockers and majors (edit the section files or deck.yaml directly; use slide-writer for rewrites of whole slides). Rebuild all formats.
8. **Look at every preview PNG yourself.** Check: nothing clipped or overlapping, one message per slide, the highlight is the insight, source lines present.

## Visual QA (final LLM stage)

9. Run the `visual-qa` skill: PowerPoint + HTML renders and their difference for every slide, the **visual-reviewer** verdict, fixes and rebuild (max 3 rounds), then `sc visual-qa <deck> --record …` writes `dist/visual-qa/REPORT.md`.

## ✅ CP4 — show the user

- One-line verdict (review-ready or not).
- What changed in this review (3–6 bullets).
- Remaining minors, if any, and the **Needs your attention** list from `dist/visual-qa/REPORT.md`.
- Files: PPTX, PDF, HTML, previews, manifest. `visual_review` stays `false` until they confirm they looked at every slide.
