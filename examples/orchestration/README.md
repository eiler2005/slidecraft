# Orchestration — templates and a complete example run

**Open the results:** [PPTX](../../docs/showcase/orchestration-run/fabrikam-seed.pptx) · [PDF](../../docs/showcase/orchestration-run/fabrikam-seed.pdf) · [HTML](../../docs/showcase/orchestration-run/fabrikam-seed.html) · [one-pager](../../docs/showcase/orchestration-run/fabrikam-seed-onepager.pdf) · [PowerPoint renders](../../docs/showcase/orchestration-run/previews-office/) · [review report](../../docs/showcase/orchestration-run/visual-qa/REPORT.md) · [review log](run/pitch-deck/REVIEW-LOG.md)

Everything an orchestrator (Claude Code `/slidecraft:new`, Codex, or any agent following
[`AGENTS.md`](../../AGENTS.md)) hands from stage to stage, and what one real run produces in
every output format. Fictional content: Fabrikam Freight and all figures are invented.

```
examples/orchestration/
├── plan/                     the orchestration plan in three formats
│   ├── orchestration.yaml    source of truth: stages, agents, model tiers, commands, outputs
│   ├── orchestration.json    same, for programs
│   ├── orchestration.md      same, as a table
│   └── render.ts             yaml → json + md
├── templates/                one file per hand-off, in the format the stage writes
│   ├── 01-brief.yaml                 stage 1 · brief (CP1)
│   ├── 02-choice.yaml                stage 2 · storyline × theme (CP2)
│   ├── 03-storyline.md               stage 3 · storyline (deck-strategist · Opus)
│   ├── 03-deck-strategist.prompt.md  hand-off prompt
│   ├── 04-ghost-deck.yaml            stage 4 · ghost deck (CP3)
│   ├── 05-section.yaml               stage 5 · one section (slide-writer · Sonnet)
│   ├── 05-slide-writer.prompt.md
│   ├── 06-fixes.json                 stage 6 · fit-fix rewrites (copy-fitter · Haiku)
│   ├── 06-copy-fitter.prompt.md
│   ├── 06-partner-review.md          stage 6 · partner review output (Opus)
│   ├── 06b-visual-qa-findings.json   stage 6b · reviewer findings (visual-reviewer · Opus, CP4)
│   ├── 06b-visual-reviewer.prompt.md
│   └── 07-delivery.md                stage 7 · message to the user
└── run/                      a complete run of the pitch-deck example
    ├── reproduce.sh          recreates everything below from scratch
    ├── findings-round-1.json, findings-round-2.json   the reviewer's two rounds
    └── pitch-deck/
        ├── brief.yaml, storyline.md, deck.yaml        stage inputs (illustrative)
        └── REVIEW-LOG.md, review-log.jsonl            every change made while checking

docs/showcase/orchestration-run/     the run's outputs (binaries are kept under docs/showcase/)
            ├── fabrikam-seed.pptx            editable PowerPoint (native shapes, charts, notes)
            ├── fabrikam-seed.pdf             vector PDF
            ├── fabrikam-seed.html            self-contained HTML deck (keys ←/→, N notes, F full screen)
            ├── fabrikam-seed-onepager.pdf    A4 summary
            ├── fabrikam-seed.docx            Word memo (local only: created by reproduce.sh; .docx stays out of git)
            ├── previews/                     Scene PNGs
            ├── previews-office/              the PPTX as PowerPoint renders it
            ├── manifest.json                 engines, checks, limitations, visual_review
            └── visual-qa/
                ├── REPORT.md                 verdict · needs your attention · fixed · changes
                ├── index.md, qa.json         per-slide parity, hotspots and measured facts
                ├── NN-<slide>-pptx.png / -html.png / -diff.png
                ├── record.json, findings-1.json, findings-2.json
                └── baseline/                 sources as they were when the last pack was built
```

## Model routing

| Work | Agent | Model tier (current id) |
|---|---|---|
| Argument, title chain, partner review, visual review | deck-strategist, partner-reviewer, visual-reviewer | `opus` (claude-opus-5-5) |
| Writing slides against a layout contract | slide-writer | `sonnet` (claude-sonnet-5-5) |
| Shortening text to a character budget | copy-fitter | `haiku` (claude-haiku-5-5) |
| Conversation, checkpoints, delivery | orchestrator | main session |

Sections can be written in parallel; one after another gives the same result with fewer
simultaneous tokens. Sub-agents never talk to the user; the orchestrator owns every checkpoint.

## What happened in the example run

1. **Round 1** — the reviewer found an empty third next to the competition matrix and a
   one-word line in a panel heading; both were fixed in `deck.yaml` (see the diff in
   `REVIEW-LOG.md`).
2. **Round 2** — the rebuilt pack showed the y-axis arrow pointing the other way in
   PowerPoint; the cause was in PPTX line export and was fixed in shared code for every deck.
3. **Report** — `ready-with-notes`: three items need the user (empty lower halves on two
   slides, a long decision panel) and one engine item stays open (native chart labels ~1 px).

Rebuild after changing anything: `bash examples/orchestration/run/reproduce.sh`. To compare originals and results for the whole calibration corpus: `npm run comparison` → `comparison/index.html` ([guide](../../docs/how-to/see-results.md)).
