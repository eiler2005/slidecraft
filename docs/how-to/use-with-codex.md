# Use SlideCraft from Codex (or any agent)

> **Audience:** Codex and other coding-agent users · **Last reviewed:** 2026-10-10

1. Clone the repository and open it (or add it to your workspace).
2. Point the agent at [`AGENTS.md`](../../AGENTS.md) — it describes the seven stages, the CLI calls and the hard rules.
3. Ask: "Using SlideCraft, make a board deck that …". The agent should stop at the four checkpoints and ask you.

Inside Codex, PPTX uses the local artifact-tool runtime when available ([license notes](use-codex-engine.md)); otherwise the open `pptxgenjs` engine. Everything else is identical to the Claude Code plugin.
