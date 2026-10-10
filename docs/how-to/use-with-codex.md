# Use SlideCraft from OpenAI Codex

> **Audience:** Codex users · **Prerequisites:** Codex CLI, a clone of SlideCraft, Node ≥ 22.12 · **Last reviewed:** 2026-10-10

## Install the skills

```sh
git clone https://github.com/eiler2005/slidecraft && cd slidecraft
node dist/slidecraft.mjs codex install
```

This writes seven skills into `$CODEX_HOME/skills` (default `~/.codex/skills`): `slidecraft` (the workflow orchestrator for Codex) and the method skills `slidecraft-storyline-architect`, `slidecraft-action-title-writer`, `slidecraft-ghost-deck-skeleton`, `slidecraft-exhibit-chooser`, `slidecraft-deck-spec`, `slidecraft-partner-review-checklist`. They point at this checkout's `dist/slidecraft.mjs`; re-run after moving or updating it. Remove with `codex uninstall`.

## Use

```text
codex "Using SlideCraft, make a 5-slide board update that …"
```

Codex runs the same seven stages as the Claude Code plugin, sequentially, and stops at the four checkpoints to ask you. PPTX uses the local `artifact-tool` runtime when present (`SLIDECRAFT_IN_CODEX=1`), else the open `pptxgenjs` engine — see [the Codex engine](use-codex-engine.md) for the license note.

## Verified

A full non-interactive run (`codex exec`, model `gpt-5.6-sol`) produced a five-slide deck with zero diagnostics using the artifact-tool engine; the issues it surfaced (missing `--json` on `new`, scaffold ignoring the slide budget, YAML comma hints, a panel-overflow blind spot) are fixed in the CLI.

Other agents: point them at [`AGENTS.md`](../../AGENTS.md).
