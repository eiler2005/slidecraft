# Use SlideCraft with any AI agent

> **Audience:** people using Cursor, Gemini CLI, Aider, Copilot agents, Windsurf, Continue, or their own LLM scripts · **Prerequisites:** Node ≥ 22.12 and a clone of the repo · **Last reviewed:** 2026-10-11

SlideCraft is a CLI with machine-readable output. An agent that can run shell commands and read files can drive the whole workflow. Claude Code and Codex get packaged skills on top of this; everything else uses [`AGENTS.md`](../../AGENTS.md).

**Apps that speak MCP** (Claude Desktop, Cursor, VS Code, Windsurf, Gemini CLI) can use the SlideCraft MCP server instead: `npx @eiler2005/slidecraft install`, then ask in plain words. See [use with MCP apps](use-with-mcp.md).

## Set up

```sh
git clone https://github.com/eiler2005/slidecraft && cd slidecraft
node dist/slidecraft.mjs doctor          # engines available on this machine
```

Tell your agent where the instructions are:

| Agent | How |
|---|---|
| Cursor | Add a rule: "For decks, follow AGENTS.md in the slidecraft folder", or open the repo as the workspace |
| Gemini CLI | `GEMINI.md` → "Follow AGENTS.md for presentations" (or symlink `AGENTS.md` to `GEMINI.md`) |
| Aider | `aider --read AGENTS.md` |
| GitHub Copilot agent mode, Windsurf, Continue | Add AGENTS.md to the context or the project rules |
| Your own script | Call the CLI; every command takes `--json` |

Then ask in plain words: *"Follow AGENTS.md and make a 6-slide deck for the board on entering Germany; output PPTX and PDF."*

## What the agent runs

| Stage | Command | The agent reads |
|---|---|---|
| Brief | `sc new <slug> --json` | the brief questions; writes `brief.yaml` |
| Templates | `sc templates -b <brief> --json`, then `sc choose -b <brief> --option A` | three storyline × theme options |
| Ghost deck | `sc scaffold -b <brief>` | `deck.yaml` with one ghost slide per slot |
| Contracts | `sc layouts <layout> --json` | JSON Schema and an example for each layout |
| Validate | `sc validate <deck> --json` | `SC-*` diagnostics with JSON pointers and fixes |
| Fit loop | `sc fix <deck> --json` then `--apply fixes.json` | each too-long field with its character budget |
| Material | `sc ingest <files> --deck <deck>`, `sc find "<phrase>" --json` | sources with page references |
| Edits back | `sc sync <deck> <edited.pptx> --json` then `--apply` | the fields changed in PowerPoint |
| Build | `sc build <deck> --json` | output files and the manifest |

`sc` = `node dist/slidecraft.mjs`. Exit codes: 0 ok, 1 deck errors, 2 usage error, 3 engine failure.

## Model tiering without Claude Code

The workflow has hard and easy parts. If your tool lets you choose models:
- use the strongest model for the storyline (governing thought, action-title chain) and for the final review;
- use a faster model for writing slide content against contracts and for the fit loop.

The checkpoints are the same everywhere: brief, template, title chain, review. The agent should stop at each one and ask you.
