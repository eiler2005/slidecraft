# 0006 — Model tiering for agents; user checkpoints stay in the main session

**Status:** Accepted · 2026-10-10

## Context
Deck work mixes high-judgement steps (the argument, the partner review) with parallelisable writing and mechanical fixes. Using the strongest model everywhere is slow and costly; using a small model for the argument produces generic decks. Sub-agents that ask the user questions fragment the conversation.

## Decision
Plugin agents pin models in frontmatter: `deck-strategist` and `partner-reviewer` on **Opus** (effort high), `slide-writer` on **Sonnet** (one per section, in parallel, writing `sections/*.yaml` only), `copy-fitter` on **Haiku** (rewrites only fields named by `SC-FIT-*`/`SC-TITLE-*` pointers). The orchestrating `new` skill runs in the main session and owns the four checkpoints (brief, pick, title chain, review); sub-agents produce files and never talk to the user.

## Consequences
- Parallel writers cannot collide (separate files); deterministic CLI checks gate every hand-off.
- Codex and other agents follow the same stages sequentially (`AGENTS.md`) without model pinning.
