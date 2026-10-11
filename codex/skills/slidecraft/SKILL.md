---
name: slidecraft
description: Create a presentation, slide deck, pitch deck, board update, proposal, keynote or story talk from a goal with SlideCraft — brief, template pick, storyline, ghost deck, build to editable PPTX / PDF / HTML and partner-grade review, with the user approving four checkpoints. Use whenever someone asks for a deck or slides.
---

# SlideCraft for Codex

SlideCraft lives at `{{SLIDECRAFT_ROOT}}`. CLI (zero install, Node ≥ 22.12):

```sh
sc() { node "{{SLIDECRAFT_ROOT}}/dist/slidecraft.mjs" "$@"; }
```

All commands accept `--json`. Workspace: `./slidecraft/<deck-id>/` in the user's current directory. Methods: `{{SLIDECRAFT_ROOT}}/library/references/` and the companion skills `slidecraft-storyline-architect`, `slidecraft-action-title-writer`, `slidecraft-ghost-deck-skeleton`, `slidecraft-exhibit-chooser`, `slidecraft-deck-spec`, `slidecraft-partner-review-checklist`.

Codex has no sub-agents here: run the stages yourself, in order, and **stop at every ✅ to ask the user in chat**. Never skip a checkpoint.

## Engines in Codex

Inside Codex prefer the local artifact-tool runtime for PPTX: prefix builds with `SLIDECRAFT_IN_CODEX=1` (falls back to the open `pptxgenjs` engine if the runtime is missing). Tell the user once: artifact-tool is proprietary, licensed for internal evaluation and testing only — for client deliverables rebuild with `--pptx-engine pptxgenjs`. PDF: `native`, or `--pdf-engine pptx-convert` when the PDF goes to readers. HTML with `-f html` for presenting; `-f onepager` and `-f docx` for pre-reads. For `text-image` slides with `imagePrompt` and no `image`, generate the picture with your image tool, save it to `assets/<slide-id>.png` next to the deck and set `image:`. To restyle an existing deck: `sc import <file.pptx> --render --json`, look at `original.pdf`, then redesign slide by slide. Details: `{{SLIDECRAFT_ROOT}}/docs/explanation/engines-compared.md`.

## 1 · Brief ✅

`sc new <deck-id> --goal "…" --audience "…"`, then fill `slidecraft/<id>/brief.yaml`: ask, audience knows/cares, task, `usage` (edit-together | send-pdf | present-live | web-link | automation | codex), length, language. Ask only what is missing, in one message. `sc templates --brief <brief> --json` → tell the user the recommended outputs and why. Confirm the brief.

## 2 · Pick ✅

`sc pick --brief <brief> --json` writes `.slidecraft/picker.html` and `option-A|B|C.png`. Look at the PNGs, describe A/B/C in one line each, ask the user to choose (they may mix story and look). `sc choose --brief <brief> --option <X>` (or `--storyline/--theme`).

## 3 · Storyline

Follow `slidecraft-storyline-architect`: write `storyline.md` (question, governing thought, SCR, MECE key line with evidence status, open questions).

## 4 · Ghost deck ✅

`sc scaffold --brief <brief> --force`; write final action titles on every slide (`slidecraft-action-title-writer`), refine `ghost.exhibit / data / confidence`, change layouts where the message needs it (`slidecraft-exhibit-chooser`). Show the numbered title chain; iterate until approved.

## 5 · Build

For each slide: `sc layouts <layout> --json` for the contract, write the content fields, keep id and title, remove `status: ghost` (or set the deck `status: draft`). Rules: `slidecraft-deck-spec`. Then `sc validate <deck>` and `SLIDECRAFT_IN_CODEX=1 sc build <deck> --json`.

## 6 · Review ✅

`sc check <deck> --json`: `sc fix <deck> --json` lists too-long fields with a character budget; rewrite within it (keep numbers, never truncate), save `[{pointer, text}]` to fixes.json and run `sc fix <deck> --apply fixes.json` until nothing remains, fix titles, add real sources for `SC-SRC-*`. Open every `dist/previews/*.png`. Apply `slidecraft-partner-review-checklist`; fix blockers and majors; rebuild. Present the verdict, the fixes and the files.

## 7 · Deliver

Paths to PPTX / PDF / HTML / previews / `manifest.json`. `visual_review` stays false until the user has looked at every slide. Never send or publish anything.

## Hard rules

- Every number cites a `sources:` id or `source:`; illustrative data is labelled. Never invent figures or sources.
- Action titles: full-sentence claims, ≤ 2 lines; one message per slide.
- Quote YAML values that contain `, ` or `: ` inside `{ … }`.
