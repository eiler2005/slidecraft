---
name: visual-qa
description: Final LLM visual review of a built SlideCraft deck — renders through PowerPoint and Chrome, has the visual-reviewer look at every slide (parity, template, layout, colour, typography, charts, meaning), fixes what it finds, rebuilds, and writes a user report of what still needs attention. Runs after the automated checks and before checkpoint 4.
argument-hint: "[path to deck.yaml]"
allowed-tools: Read, Write, Edit, Glob, Agent, Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs *)
---

# Visual QA

`sc` = `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"`. Deck: $ARGUMENTS. Checklist and record
format: `${CLAUDE_PLUGIN_ROOT}/library/references/visual-qa.md`.

Rules and calibration bring HTML and the editable PPTX to PowerPoint's own layout; this stage
judges what rules cannot. It is part of the workflow, not optional.

## Loop (max 3 rounds)

1. `sc check <deck> --json` must have no errors (otherwise run the `review` loop first).
2. `sc visual-qa <deck> --json` → `dist/visual-qa/` (PowerPoint, HTML and difference images per
   slide, measured facts in `index.md`). Without PowerPoint/LibreOffice it still reviews HTML.
3. Launch **visual-reviewer** (Opus) with the deck path and `dist/visual-qa/`. It returns findings
   JSON and a verdict.
4. Fix, following the fix policy: content and design choices in `deck.yaml`/`sections/*.yaml`;
   too-long text via `sc fix`; anything that would recur on other decks is a SlideCraft defect —
   report it (with the slide, the image and the rule) instead of nudging the slide. Never edit
   generated files.
5. Set each finding's `status` (`fixed`, `open`, `needs-user`), write the round to
   `dist/visual-qa/findings-<n>.json` and run `sc visual-qa <deck> --record dist/visual-qa/findings-<n>.json`.
6. Rebuild and repeat from 2 while blockers or majors remain and a fix is in reach.

## Hand-off

Open `dist/visual-qa/REPORT.md` and give the user: the verdict, the **Needs your attention** table
(those are judgement calls or decisions only they can make), and what was fixed. `visual_review`
stays `false` until the user confirms they looked at every slide.
