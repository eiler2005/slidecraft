<!-- Hand-off: orchestrator → copy-fitter (model: haiku). Mechanical; loops until nothing is too long. -->
Deck: `slidecraft/<id>/deck.yaml`. Run `sc fix <deck> --json`. For each task rewrite the pointed text
within its character budget — keep meaning, numbers, units and sources; never truncate. Save
`[{ "pointer": …, "text": … }]` (template `06-fixes.json`) and run `sc fix <deck> --apply fixes.json`.
Repeat until `remaining` is empty. Every applied rewrite is logged (field, before, after) in
`REVIEW-LOG.md`. Return the list of changed pointers.
