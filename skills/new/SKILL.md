---
name: new
description: Create a presentation, slide deck, pitch deck, board update, proposal, keynote or story talk from a goal. Runs the full SlideCraft workflow — brief, template pick, storyline, ghost deck, build to editable PPTX / PDF / HTML, and partner-grade review — with the user approving four checkpoints. Use whenever someone asks for a deck or slides, even without naming SlideCraft.
argument-hint: "[what the deck must achieve, for whom]"
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion, Agent, Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs *), Bash(open *), Bash(mkdir *)
---

# SlideCraft — new deck

You run the whole workflow in this session. Sub-agents produce files; **every checkpoint (✅) is a conversation with the user here** — never skip one, never let a sub-agent ask the user.

CLI (zero install): `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs" <command>` — below written as `sc <command>`. All commands accept `--json`.

Workspace: `./slidecraft/<deck-id>/` in the user's current directory (`brief.yaml`, `storyline.md`, `deck.yaml`, `sections/`, `dist/`). Never write client material anywhere else.

## 1 · Brief ✅ CP1

1. `sc new <deck-id> --goal "<goal>" --audience "<who>"` scaffolds `brief.yaml` and a ghost `deck.yaml`.
2. Fill `brief.yaml` from what the user said ($ARGUMENTS) and their materials. Ask only what is missing, in **one** AskUserQuestion round (max 4 questions):
   - **Decision / ask** — what should the audience decide or do?
   - **Audience** — who, what they already accept, what they worry about.
   - **What will you do with the deck?** → `usage`: `edit-together` (default), `send-pdf`, `present-live`, `web-link`, `automation`, `codex`.
   - Length, language, brand footer if relevant.
3. Run `sc templates --brief slidecraft/<id>/brief.yaml --json` and tell the user, in two lines, the recommended outputs and engines with the reason (from `output.rationale`). Details: `${CLAUDE_PLUGIN_ROOT}/docs/how-to/choose-output-engine.md`.
4. Show the brief back in 4–6 bullets and get a yes. **Do not proceed without it.**

## 2 · Pick a template ✅ CP2

Use the `pick` skill procedure: `sc pick --brief … --json` renders options A/B/C as contact sheets and opens `picker.html`. **Read the three PNGs yourself** (Read tool) so you can describe them. Ask with AskUserQuestion: options A, B, C — label = storyline · theme, description = the arc and why; `preview` = an ASCII outline of the first 6 slide titles. Then `sc choose --brief … --option <A|B|C>` (or `--storyline/--theme` if they mixed).

## 3 · Storyline (Opus)

Delegate to the **deck-strategist** agent: give it the brief path, the chosen storyline id and the materials. It writes `storyline.md` (governing thought, SCR, key line, MECE check) and runs `sc scaffold --brief … --force` then rewrites `deck.yaml` titles as action titles with ghost exhibits. Method: `storyline-architect` and `ghost-deck-skeleton` skills.

## 4 · Ghost deck ✅ CP3

Show the user the **title chain only** (numbered action titles, one line each) plus the governing thought. Ask: approve, or which titles/sections to change. Iterate until approved. This is the cheapest moment to change the story. `sc build slidecraft/<id>/deck.yaml -f png` renders ghost slides if they want to see them.

## 5 · Build (Sonnet, parallel)

Split slides by section. For each section, launch a **slide-writer** agent (in parallel) with: deck path, slide ids, the layout contracts (`sc layouts <id> --json`), the brief and materials. Each writes `slidecraft/<id>/sections/<section>.yaml` (a YAML list of complete slides) — never deck.yaml. Then replace those ghost slides in `deck.yaml` with `- include: sections/<section>.yaml` entries, set `status: draft`, and run:

`sc build slidecraft/<id>/deck.yaml --json` (formats/engines from the brief's output plan; flags `--pptx-engine`, `--pdf-engine`).

**Cover choice ✅ (repo rule).** Never default the cover. `sc covers <deck> --json` (add `--stock` when the cover has an `imageQuery`) renders 2–3 options — the motifs that fit the title best and a photo — to `.slidecraft/covers/` with a picker page and facts. Compare them yourself against the deck's message and look: does it say what the deck is about, does it fit the theme colours, is the title still the first thing seen, is a photo sharp (≥ 144 ppi), licensed, free of private people and logos? Recommend one with a one-line reason per option, show the picker to the user, then `sc covers <deck> --choose <A|B|C>`.

## 6 · Review ✅ CP4

Use the `review` skill procedure:
1. `sc check … --json` → if any `SC-FIT-*`, `SC-TITLE-*`, `SC-SRC-*`: launch **copy-fitter** with the diagnostics (it edits only the pointed fields). Rebuild. Max 3 rounds.
2. Launch **partner-reviewer** with the deck and PNG previews (`dist/previews/`). It returns Blockers / Majors / Minors.
3. Fix blockers and majors (yourself or via slide-writer), rebuild, re-check.
4. **Visual QA (final LLM stage).** Run the `visual-qa` skill: `sc visual-qa … --json`, the **visual-reviewer** agent judges every PowerPoint/HTML/difference image (parity, template, layout, colour, typography, charts, meaning, readiness), you fix and rebuild (max 3 rounds), and `--record` writes `dist/visual-qa/REPORT.md`.
5. Look at every image yourself, then present: verdict, top fixes made, the report's **Needs your attention** list, file list. Ask for approval or changes.

## 7 · Deliver

Give paths to PPTX / PDF / HTML / previews and `manifest.json`. Remind: `visual_review: false` until a human has looked at every slide. Never publish or send anything.

## Rules

- Action titles: full-sentence claims, ≤ 2 lines, the body proves the title (`action-title-writer`).
- Every number has a source (`sources:` ids or `source:`); mark illustrative data `illustrative: true`. Never invent figures — ask, or mark the slide speculative.
- Respect capacity: fix overflow by rewriting, never by shrinking below the theme minimum (the engine refuses anyway).
- Quote YAML values that contain `, ` or `: ` inside `{ … }` flow maps.
- If a proprietary engine (`artifact-tool`) is chosen, tell the user its license is internal-evaluation only.
