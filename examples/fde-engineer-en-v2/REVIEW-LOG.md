# Review log

Every change made while checking this deck, newest last. Machine-readable: `review-log.jsonl`.

## 2026-10-12 06:08:13 · visual-qa

Review pack for 9 slides (Microsoft PowerPoint via AppleScript (jobs run in its sandbox container: no access prompts)); 9 page(s) below 95 % PowerPoint↔HTML parity. Sources snapshotted: deck.yaml.

## 2026-10-12 06:09:56 · visual-qa-round · visual-reviewer (Claude Opus 5.5)

Round 1: not-ready. Round 1: the new techniques render, but the budget total did not add up, one 7S point split in two, the margin label lacked contrast and PowerPoint stretched the cover photo instead of cropping it. Findings: 6 (4 fixed, 2 for the user).

`deck.yaml` (+2 −2)

```diff
@@ line 115 @@
      strategy: { status: aligned, points: [ AI is among the top company priorities ] }
-     structure: { status: partial, points: [ AI team sits in IT, far from the business ] }
+     structure: { status: partial, points: [ "AI team sits in IT, far from the business" ] }
      systems: { status: aligned, points: [ Data platform and model access in place ] }
@@ line 156 @@
        - [ Evaluation and security review, $10k, $4k, $4k, $18k ]
-       - [ Total, $69k, $69k, $70k, $206k ]
+       - [ Total, $69k, $67k, $70k, $206k ]
      highlightRow: 0
```

## 2026-10-12 06:10:10 · visual-qa

Review pack for 9 slides (Microsoft PowerPoint via AppleScript (jobs run in its sandbox container: no access prompts)); 9 page(s) below 95 % PowerPoint↔HTML parity. Sources snapshotted: deck.yaml.

## 2026-10-12 06:10:23 · visual-qa-round · visual-reviewer (Claude Opus 5.5)

Round 2: ready-with-notes. Round 2: totals add up, the cover photo crops identically in PowerPoint and the browser, icons, value chain, 7S and the combo chart match between engines. Content placeholders (illustrative plan) stay with the author. Findings: 4 (1 fixed, 3 for the user).

## 2026-10-13 11:56:45 · visual-qa

Review pack for 9 slides (Microsoft PowerPoint via AppleScript (jobs run in its sandbox container: no access prompts)); 9 page(s) below 95 % PowerPoint↔HTML parity. Sources snapshotted: deck.yaml.

## 2026-10-13 12:02:56 · visual-qa

Review pack for 9 slides (Microsoft PowerPoint via AppleScript (jobs run in its sandbox container: no access prompts)); 9 page(s) below 95 % PowerPoint↔HTML parity. Sources snapshotted: deck.yaml.

## 2026-10-13 12:03:53 · visual-qa-round · visual-reviewer (Claude Opus 5.5)

Round 3: ready-with-notes. Round 3: sharp cover photo (1920 px CC0, Wikimedia Commons) cropped on the laptop screen with imageFocus: left — identical in PowerPoint and the browser. Placeholders (illustrative plan) stay with the author. Findings: 3 (2 fixed, 1 for the user).

