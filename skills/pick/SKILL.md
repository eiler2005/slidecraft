---
name: pick
description: Show template options (storyline × theme) for a SlideCraft brief as contact sheets and record the user's choice. Checkpoint 2 of the SlideCraft workflow.
argument-hint: "[path to brief.yaml]"
disable-model-invocation: true
allowed-tools: Read, AskUserQuestion, Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs *), Bash(open *)
---

# Pick a template

`sc` = `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"`. Brief: $ARGUMENTS (default: the only `slidecraft/*/brief.yaml`).

1. `sc pick --brief <brief> --json` → writes `.slidecraft/picker.html` and `option-A|B|C.png` next to the brief and opens the page (local sessions). In remote sessions give the user the path.
2. **Read the three PNG contact sheets** with the Read tool. Describe each in one line: story shape, look, what it emphasises.
3. AskUserQuestion, single select:
   - options `A`, `B`, `C` — label `"<A>: <Storyline> · <Theme>"`, description = arc + why (from JSON);
   - `preview` = an ASCII outline: the first 6 slots as `01 Title …` lines.
   - The user may answer "Other" — e.g. "A's story with C's look": map it to `--storyline` + `--theme`.
4. `sc choose --brief <brief> --option <X>` (or `--storyline <id> --theme <id>`).
5. Confirm in one line. Next step: storyline (see the `new` skill).

All storylines: `sc storylines`. All themes: `sc themes`. Gallery: `${CLAUDE_PLUGIN_ROOT}/docs/reference/storylines.gen.md`.
