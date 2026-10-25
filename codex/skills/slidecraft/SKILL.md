---
name: slidecraft
description: Create a presentation, slide deck, pitch deck, board update, proposal, keynote or story talk from a goal with SlideCraft — brief, template pick, storyline, ghost deck, build to editable PPTX / PDF / HTML and partner-grade review, with the user approving four checkpoints. Use whenever someone asks for a deck or slides.
---

# SlideCraft for Codex

SlideCraft lives at `{{SLIDECRAFT_ROOT}}`. CLI (zero install, Node ≥ 22.13):

```sh
sc() { node "{{SLIDECRAFT_ROOT}}/dist/slidecraft.mjs" "$@"; }
```

All commands accept `--json`. Workspace: `./slidecraft/<deck-id>/` in the user's current directory. Methods: `{{SLIDECRAFT_ROOT}}/library/references/` and the companion skills `slidecraft-storyline-architect`, `slidecraft-action-title-writer`, `slidecraft-ghost-deck-skeleton`, `slidecraft-exhibit-chooser`, `slidecraft-deck-spec`, `slidecraft-partner-review-checklist`.

Codex has no sub-agents here: run the stages yourself, in order, and **stop at every ✅ to ask the user in chat**. Never skip a checkpoint.

## Engines in Codex

Use the same SlideCraft themes, layout contracts, `deck.yaml` and Scene IR as other agents. `auto` selects the portable `pptxgenjs` engine even inside Codex. Do not fork the deck or introduce a Codex-only theme.

When the session provides OpenAI's presentation skill, read it and its relevant references for template fidelity and visual review. Its availability is separate from the runtime's availability: do not invent a skill path or claim it ran when absent. Keep the user's reference and selected SlideCraft theme; do not replace them with a skill's default style. Never copy the proprietary skill or runtime into SlideCraft's package.

For **internal evaluation/testing only**, `--pptx-engine artifact-tool` calls an already installed OpenAI runtime. Explain its proprietary licence first: no production, commercial use, benchmarking or redistribution. A missing explicitly selected engine is an error, not a silent switch. The portable export remains available with `--pptx-engine pptxgenjs`; do not use the evaluation engine for client deliverables.

PDF: `native` for quick previews, `--pdf-engine pptx-convert` to inspect the actual Office rendering. HTML with `-f html` for presenting; `-f onepager` and `-f docx` for pre-reads. For `text-image` slides with `imagePrompt` and no `image`, generate the picture with your image tool, save it to `assets/<slide-id>.png` next to the deck and set `image:`. To restyle an existing deck: `sc import <file.pptx> --render --json`, look at `original.pdf`, then redesign slide by slide. Details: `{{SLIDECRAFT_ROOT}}/docs/explanation/engines-compared.md`.

## 1 · Brief ✅

`sc new <deck-id> --goal "…" --audience "…"`, then fill `slidecraft/<id>/brief.yaml`: ask, audience knows/cares, task, `usage` (edit-together | send-pdf | present-live | web-link | automation | codex), length, language. Ask only what is missing, in one message. `sc templates --brief <brief> --json` → tell the user the recommended outputs and why. Confirm the brief. If the user gave files (PDF, DOCX, PPTX, XLSX, CSV, MD): `sc ingest <files…> --deck <deck>` — each becomes a source, and `sc find "<phrase>" --deck <deck>` returns the page to cite (`sources: [report#p14]`).

## 2 · Pick ✅

`sc pick --brief <brief> --json` writes `.slidecraft/picker.html` and `option-A|B|C.png`. Look at the PNGs, describe A/B/C in one line each, ask the user to choose (they may mix story and look). `sc choose --brief <brief> --option <X>` (or `--storyline/--theme`).

## 3 · Storyline

Follow `slidecraft-storyline-architect`: write `storyline.md` (question, governing thought, SCR, MECE key line with evidence status, open questions).

## 4 · Ghost deck ✅

`sc scaffold --brief <brief> --force`; write final action titles on every slide (`slidecraft-action-title-writer`), refine `ghost.exhibit / data / confidence`, change layouts where the message needs it (`slidecraft-exhibit-chooser`). Show the numbered title chain; iterate until approved.

## 5 · Build

Keep the layers separate: storyline → slide relationship → existing components → theme/chrome → Scene → engines. `sc exhibits --json` routes relationships to real layouts; `sc components --json` exposes composable contracts. Use `layout: composition` only when one message needs complementary exhibits; component boxes are body-relative fractions. Sources, page badges, footer and `bottomLine` belong to the common frame, not a pasted component. Extend the shared native library when a needed visual is missing. Any installed theme can pair with a storyline; recommendations do not restrict compatibility.

For each slide: `sc layouts <layout> --json` for the contract, write the content fields, keep id and title, remove `status: ghost` (or set the deck `status: draft`). Client numbers go in `facts:` (or `from: { file, sheet, range }` for charts and tables) and are written as `{{id}}` — never retyped. Rules: `slidecraft-deck-spec`. Then `sc validate <deck>` and `sc build <deck> --json`.

## 6 · Review ✅

`sc check <deck> --json`: `sc fix <deck> --json` lists too-long fields with a character budget; rewrite within it (keep numbers, never truncate), save `[{pointer, text}]` to fixes.json and run `sc fix <deck> --apply fixes.json` until nothing remains, fix titles, add real sources for `SC-SRC-*`, make `SC-CONSIST-001` metrics agree (one fact). Open every `dist/previews/*.png`. Apply `slidecraft-partner-review-checklist`; fix blockers and majors; rebuild. Then the **final visual QA**: `sc visual-qa <deck> --json` renders the PPTX in PowerPoint/LibreOffice and the HTML in Chrome into `dist/visual-qa/`; open every PowerPoint, HTML and difference image and judge them with `{{SLIDECRAFT_ROOT}}/library/references/visual-qa.md` (parity, template conformance, layout, colour, typography, charts, meaning, readiness); fix in YAML, rebuild, max 3 rounds; record the round with `sc visual-qa <deck> --record findings.json` and show `dist/visual-qa/REPORT.md` (**Needs your attention**). Present the verdict, the fixes and the files.

## 7 · Deliver

`resvg` PNGs and native PDFs are Scene previews, not PowerPoint renders. For PPTX visual fidelity, render the built PPTX through Office (`--pdf-engine pptx-convert`), inspect every page, and compare it with the unchanged HTML/reference at matching dimensions. Report the renderer and any unverified limitations; XML editability tests alone do not establish visual similarity.

Paths to PPTX / PDF / HTML / previews / `manifest.json`. `visual_review` stays false until the user has looked at every slide. Never send or publish anything.

If the user later edits the PPTX by hand: `sc sync <deck> <edited.pptx> --json`, show the changes, then `--apply` and rebuild.

## Hard rules

- Every number cites a `sources:` id or `source:`; illustrative data is labelled. Never invent figures or sources.
- Action titles: full-sentence claims, ≤ 2 lines; one message per slide.
- Quote YAML values that contain `, ` or `: ` inside `{ … }`.
