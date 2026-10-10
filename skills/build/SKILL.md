---
name: build
description: Fill a SlideCraft ghost deck with content and render it to PPTX, PDF, PNG previews and HTML with the chosen engines.
argument-hint: "[path to deck.yaml] [--format pptx,pdf,png,html]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Agent, Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs *)
---

# Build the deck

`sc` = `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"`. Deck: $ARGUMENTS.

1. **Contracts.** `sc layouts --json` gives every layout's JSON Schema, limits and an example. Writers must stay within `maxLength` / `maxItems`.
2. **Fill in parallel.** Group ghost slides by `tracker` (section). Launch one **slide-writer** agent per section with: deck path, the slide ids, the brief, materials, and the contracts for the layouts used. Each writes `sections/<section>.yaml` (a YAML list of complete slides that keep their `id`).
3. **Assemble.** In `deck.yaml`, replace each section's ghost slides with `- include: sections/<section>.yaml`; set deck `status: draft`.
4. **Validate.** `sc validate <deck> --json` — fix every `SC-SPEC-*` at its pointer (typos, unknown source ids, YAML commas inside `{ }`).
5. **Render.** `sc build <deck> --json` (outputs from `output:` in deck.yaml; override with `-f`, `--pptx-engine`, `--pdf-engine`). Engines and when to use them: `${CLAUDE_PLUGIN_ROOT}/docs/how-to/choose-output-engine.md`. `sc doctor` shows what is installed.
6. Continue with the `review` skill. Never hand over a deck that has not been reviewed.

Outputs land in `<deck dir>/dist/`: `<id>.pptx`, `<id>.pdf`, `<id>.html`, `previews/NN-<slide>.png`, `manifest.json` (engines, sha256, checks, limitations).
