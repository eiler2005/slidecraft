# The workflow

> **Audience:** users of the Claude Code plugin and agent integrators · **Prerequisites:** [concepts](concepts.md) · **Last reviewed:** 2026-10-10

Seven stages, four user checkpoints. The orchestrator (`/slidecraft:new`) runs in your Claude Code session; sub-agents do focused work and write files; the CLI checks every hand-off.

| # | Stage | Who | Model | Produces | Checkpoint |
|---|---|---|---|---|---|
| 1 | **Brief** — goal, ask, audience, what you will do with the deck | orchestrator + you | main session | `brief.yaml`, output plan | ✅ CP1 — confirm the brief |
| 2 | **Pick** — three templates as contact sheets | CLI + orchestrator | main session | `picker.html`, `brief.yaml#choice` | ✅ CP2 — choose A/B/C |
| 3 | **Storyline** — governing thought, SCR, MECE key line, evidence | `deck-strategist` | **Opus** (high effort) | `storyline.md` | — |
| 4 | **Ghost deck** — action-title chain, exhibit sketches, data needed | `deck-strategist` | **Opus** | `deck.yaml` (ghost) | ✅ CP3 — approve the title chain |
| 5 | **Build** — slides written per section in parallel, rendered | `slide-writer` × N, CLI | **Sonnet** | `sections/*.yaml`, `dist/*` | — |
| 6 | **Review** — checks, copy-fitting, partner review, fixes | `copy-fitter`, `partner-reviewer` | **Haiku** → **Opus** | fixed deck, review notes | ✅ CP4 — accept |
| 7 | **Deliver** | orchestrator | main session | PPTX · PDF · HTML · previews · manifest | — |

## Why checkpoints where they are

- **CP1** — a wrong goal or audience wastes everything after it.
- **CP2** — the story shape and the look are personal and organisational choices; contact sheets make them concrete.
- **CP3** — the title chain *is* the argument. Changing it here costs minutes; after build it costs hours.
- **CP4** — a human must look at every slide before it leaves (`visual_review` stays `false` until then).

## Why model tiering

The argument and the final judgement need the strongest reasoning; writing slide bodies against a fixed contract parallelises well on a fast model; shortening a sentence by 40 characters is mechanical. Sub-agents never ask you questions — the orchestrator owns the conversation ([ADR 0006](../adr/0006-model-tiering-and-checkpoints.md)).

## Without Claude Code

Codex and other agents follow the same stages from [`AGENTS.md`](../../AGENTS.md). You can also run everything by hand with the CLI: [tutorial](../tutorials/cli-without-agent.md).
