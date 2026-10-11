<!-- Hand-off: orchestrator → deck-strategist (model: opus). Paste with paths filled in. -->
Build the storyline and ghost deck for this SlideCraft presentation.

- Brief: `slidecraft/<id>/brief.yaml` (approved at CP1; choice recorded at CP2)
- Materials: `slidecraft/<id>/materials/*.md` (cite as `sources: [<id>#p<page>]`)
- Method: `library/references/storytelling.md`, `writing-standard.md`, `exhibit-selection.md`

Write `slidecraft/<id>/storyline.md` (template `03-storyline.md`), then run
`sc scaffold --brief slidecraft/<id>/brief.yaml --force` and refine `deck.yaml`: one action title per
slide (full-sentence claim, ≤ 2 lines), the exhibit and the data each slide needs, confidence.
Never invent numbers or sources; mark gaps as `data: needed`. Do not ask the user anything —
return the numbered title chain and open questions to the orchestrator.
