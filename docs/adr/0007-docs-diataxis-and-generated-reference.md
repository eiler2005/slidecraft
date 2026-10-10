# 0007 — Diátaxis docs; reference generated from code

**Status:** Accepted · 2026-10-10

## Context
The predecessor restated the same rules across many documents and its reference drifted from code. SlideCraft has many users with different needs: first-time deck makers, CLI users, contributors, agents.

## Decision
Docs follow [Diátaxis](https://diataxis.fr/): **tutorials** (learn by doing), **how-to** (solve a task), **reference** (exact facts), **explanation** (why). Rules live once in `library/references/` and are linked, not copied. Reference that can be derived from code — layouts with contracts and thumbnails, themes, storylines, engines, diagnostic codes, CLI, JSON Schemas, catalog — is **generated** by `slidecraft gen` into `*.gen.md`, and CI fails on drift. Every page states audience, prerequisites and last-reviewed date.

## Consequences
- Adding a layout updates its documentation automatically.
- Hand-written pages stay short and task-focused.
