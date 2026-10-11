<!-- Hand-off: orchestrator → visual-reviewer (model: opus). After `sc visual-qa <deck> --json`. -->
Final review of `slidecraft/<id>/deck.yaml`. Pack: `slidecraft/<id>/dist/visual-qa/` (index.md, qa.json and
for every slide `NN-<slide>-pptx.png`, `-html.png`, `-diff.png`). Brief: `slidecraft/<id>/brief.yaml`.

Open every image. Follow `library/references/visual-qa.md` in order: parity → template conformance →
layout craft → colour → typography → charts/tables → meaning → readiness. Ignore sub-pixel glyph fringes.
Return JSON in the shape of `06b-visual-qa-findings.json` (status `open`), then three lines: the most
important fix, what you are unsure about, and whether the deck can be shown to the user now.
Do not edit files — the orchestrator fixes, rebuilds, sets statuses and records the round with
`sc visual-qa <deck> --record dist/visual-qa/findings-<n>.json`.
