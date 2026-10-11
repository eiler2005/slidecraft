# Skills and agents

> **Audience:** plugin users and integrators · **Last reviewed:** 2026-10-11

## Skills

| Skill | Invoke | Purpose |
|---|---|---|
| `new` | `/slidecraft:new <goal>` or just ask for a deck | Orchestrates the whole workflow and the four checkpoints |
| `pick` | `/slidecraft:pick [brief]` | Checkpoint 2: contact sheets A/B/C and the choice |
| `build` | `/slidecraft:build [deck]` | Parallel slide writing and rendering |
| `review` | `/slidecraft:review [deck]` | Checks, copy-fit, partner review, fixes — checkpoint 4 |
| `visual-qa` | `/slidecraft:visual-qa [deck]` | Final reviewer-model stage: PowerPoint/HTML/difference images, fixes, `REPORT.md`, `REVIEW-LOG.md` |
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
| `visual-reviewer` | Opus, high effort | nothing — returns findings JSON and a verdict | edits files, reports sub-pixel fringes |

Tiers resolve to the newest model of each tier (Opus 5.5, Sonnet 5.5, Haiku 5.5 on 2026-10-11). Sections may run one after another instead of in parallel; the result is the same. Hand-off templates and a complete run: [`examples/orchestration/`](../../examples/orchestration/README.md).

Rationale: [ADR 0006](../adr/0006-model-tiering-and-checkpoints.md).
