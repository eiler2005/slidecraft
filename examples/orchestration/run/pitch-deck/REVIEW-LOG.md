# Review log

Every change made while checking this deck, newest last. Machine-readable: `review-log.jsonl`.

## 2026-10-11 20:29:38 · visual-qa

Review pack for 10 slides (Microsoft PowerPoint via AppleScript (jobs run in its sandbox container: no access prompts)); 9 page(s) below 95 % PowerPoint↔HTML parity. Sources snapshotted: deck.yaml.

## 2026-10-11 20:29:39 · visual-qa-round · visual-reviewer (Claude Opus 5.5)

Round 1: not-ready. On-template, the argument reads well and PowerPoint matches the HTML; two slides need content changes before showing. Findings: 5 (2 fixed, 2 for the user).

`deck.yaml` (+2 −1)

```diff
@@ line 72 @@
      takeaway:
-       headline: Growth is organic and repeat-driven
+       headline: Organic, repeat-driven growth
        points:
@@ line 92 @@
        - { label: Tailspin Board, x: 0.62, y: 0.42 }
+     takeaway: Only Fabrikam books in minutes and is built for shippers moving under 50 loads a month
  
```

## 2026-10-11 20:29:46 · visual-qa

Review pack for 10 slides (Microsoft PowerPoint via AppleScript (jobs run in its sandbox container: no access prompts)); 9 page(s) below 95 % PowerPoint↔HTML parity. Sources snapshotted: deck.yaml.

## 2026-10-11 20:29:46 · visual-qa-round · visual-reviewer (Claude Opus 5.5)

Round 2: ready-with-notes. Both content fixes landed and the matrix now states its conclusion; a reversed axis arrow in PowerPoint was traced to line export and fixed for every deck. Remaining items are design choices for you. Findings: 4 (1 fixed, 2 for the user).

