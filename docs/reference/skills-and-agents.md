# Skills and agents

> **Audience:** plugin users and integrators · **Last reviewed:** 2026-10-10

## Skills

| Skill | Invoke | Purpose |
|---|---|---|
| `new` | `/slidecraft:new <goal>` or just ask for a deck | Orchestrates the whole workflow and the four checkpoints |
| `pick` | `/slidecraft:pick [brief]` | Checkpoint 2: contact sheets A/B/C and the choice |
| `build` | `/slidecraft:build [deck]` | Parallel slide writing and rendering |
| `review` | `/slidecraft:review [deck]` | Checks, copy-fit, partner review, fixes — checkpoint 4 |
| `storyline-architect` | auto | Pyramid / SCR / MECE method for the argument |
| `ghost-deck-skeleton` | auto | Ghost deck of action titles and exhibit sketches |
| `action-title-writer` | auto | Turn topics into claims; title-chain test |
| `exhibit-chooser` | auto | Message → layout and variant |
| `deck-spec` | auto | Writing `deck.yaml` correctly |
| `partner-review-checklist` | auto | Blockers / majors / minors review |

Skills call the CLI as `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"` with pre-approved permissions.

## Agents

| Agent | Model | Writes | Never |
|---|---|---|---|
| `deck-strategist` | Opus, high effort | `storyline.md`, ghost `deck.yaml` | talks to the user, invents numbers |
| `slide-writer` | Sonnet (one per section, parallel) | `sections/<section>.yaml` | edits `deck.yaml`, changes approved titles |
| `copy-fitter` | Haiku | only the fields named by `SC-FIT-*`/`SC-TITLE-*` pointers | changes meaning or numbers |
| `partner-reviewer` | Opus, high effort | nothing — returns the review | edits files |

Rationale: [ADR 0006](../adr/0006-model-tiering-and-checkpoints.md).
