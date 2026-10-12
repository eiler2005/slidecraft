# AGENTS.md — SlideCraft for any coding agent (Codex, Claude Code, others)

SlideCraft turns a goal into a consulting-grade deck: brief → template → storyline → ghost deck → build → review. In Claude Code use the plugin (`/slidecraft:new`). Any other agent follows this file. Run commands from the repo root.

`sc` below means `slidecraft` after `npm i -g @eiler2005/slidecraft`, or `node dist/slidecraft.mjs` in a clone (Node ≥ 22.12, no dependencies). The skills and references named below ship with the package (`$(npm root -g)/@eiler2005/slidecraft/`). **Codex:** run `sc codex install` once to get the `slidecraft` skills in `~/.codex/skills`. **Every AI app at once:** `sc install` connects Claude Code (plugin), Codex (skills) and Claude Desktop, Cursor, VS Code, Windsurf and Gemini CLI (MCP server, `sc mcp`). Every command accepts `--json`; non-TTY output is JSON by default.

## The workflow — stop at each ✅ and ask the user

1. **Brief ✅** — `sc new "<the goal in one sentence>" --audience "…"` creates `slidecraft/<id>/brief.yaml` and a ghost `deck.yaml`. Fill the brief (decision/ask, audience knows/cares, task, `usage`: edit-together | send-pdf | present-live | web-link | automation | codex). `sc templates --brief <brief> --json` returns three template options and the recommended outputs/engines with reasons. Confirm the brief with the user.
2. **Pick ✅** — `sc pick --brief <brief> --json` writes `.slidecraft/picker.html` and `option-A|B|C.png`. Show/describe them; record the choice with `sc choose --brief <brief> --option A`.
   - Client material (PDF, DOCX, PPTX, XLSX, CSV, MD): `sc ingest <files…> --deck <deck>` writes `materials/<id>.md` with page markers and registers each file in `sources:`. `sc find "<phrase>" --deck <deck> --json` returns the page; cite it on the slide as `sources: [annual-report#p14]`.
3. **Storyline** — follow `skills/storyline-architect/SKILL.md`; write `storyline.md` (governing thought, SCR, MECE key line, evidence status). Methods: `library/references/writing-standard.md`, `storytelling.md`.
4. **Ghost deck ✅** — `sc scaffold --brief <brief> --force`, then write final action titles (`skills/action-title-writer`), refine `ghost.exhibit / data / confidence`, pick layouts (`skills/exhibit-chooser`). Show the user the numbered title chain; iterate until approved.
5. **Build** — fill each slide against its contract (`sc layouts <layout> --json`; rules in `skills/deck-spec/SKILL.md`). Put sections in `sections/*.yaml` and include them from `deck.yaml`. `sc validate`, then `sc build <deck> --json`. Extra outputs: `-f onepager` (A4 summary), `-f docx` (Word memo); `format: a4-landscape` for printed decks. Empty `text-image` slots with `imagePrompt`: `sc images <deck> --dry-run`, then `sc images <deck>` (needs `OPENAI_API_KEY`), or generate with your own image tool and save to `assets/<slide-id>.png`.
   - **Cover visual.** The cover (`layout: title`, `variant: cover`) carries the topic on a right-hand panel: `art: auto` (or a motif — `network` AI/data/tech · `growth` money/markets · `flow` process/plans · `orbit` customers/people · `layers` architecture/risk · `grid` products/operations), drawn as editable shapes in the theme accent; or a picture: `image:` (the user's photo) or `imagePrompt:` + `sc images`. Until the picture exists the motif is drawn. Guide: `docs/how-to/design-the-cover.md`.
   - **Language.** Set `language:` (`en`, `ru`, `de`…). SlideCraft's own labels, number format (1 234,5), Russian typography (no-break spaces after short words and before dashes) and PowerPoint's proofing language follow it; content is never translated. Notes get a `[Sources]` block from `sources:`.
   - Numbers from the client: define each number once in `facts:` (`value`, `format`, or `from: { file, sheet, cell }`) and write `{{id}}` in text. Charts and tables read ranges directly: `chart: { from: { file: model.xlsx, sheet: Plan, range: A1:C6 } }`, `rows: { from: …, header: true }`. Never retype a client number.
   - Starting from an existing PowerPoint: `sc import <file.pptx> --render --json`, read `original.pdf`, then redesign each slide (steps in `skills/import/SKILL.md`).
6. **Review ✅** — `sc check <deck> --json`; fix length problems with the loop: `sc fix <deck> --json` gives each too-long field a character budget; rewrite within it (never truncate), write `[{pointer, text}]` to fixes.json, then `sc fix <deck> --apply fixes.json` until nothing remains, `SC-SRC-*` with real sources only. `SC-CONSIST-001` means one metric shows different values on different slides — use one value (a fact) everywhere. Open every `dist/previews/*.png`. Apply `skills/partner-review-checklist` and `library/references/review.md`. Present verdict + fixes to the user.
6b. **Visual QA (final LLM stage) ✅** — `sc visual-qa <deck> --json` renders the PPTX in PowerPoint and the HTML in Chrome and writes `dist/visual-qa/` (per-slide PowerPoint, HTML and difference images plus measured facts). Review every image against `library/references/visual-qa.md` (parity, template conformance, layout, colour, typography, charts, meaning, readiness), fix content in YAML and report recurring defects as engine issues, rebuild (max 3 rounds), then `sc visual-qa <deck> --record findings.json` writes `dist/visual-qa/REPORT.md` — show its **Needs your attention** list to the user.
7. **Deliver** — paths to PPTX / PDF / HTML / previews / manifest. Never send or publish.
8. **After hand edits** — if the user edited the PPTX in PowerPoint, Keynote or Google Slides: `sc sync <deck> <edited.pptx> --json`, show the changes, then `--apply`. Rebuild afterwards; skipped items (capitals, `{{facts}}`, tables) are edited in `deck.yaml` by hand.

## Engines

`auto` picks `pptxgenjs` for PPTX and the native vector PDF, including inside Codex. All agents use the same themes, components and Scene IR. Codex may additionally use an available OpenAI presentation skill; the local `@oai/artifact-tool` adapter is an explicit option (`--pptx-engine artifact-tool`) for internal evaluation/testing only, never production, commercial use or benchmarking. Do not bundle OpenAI skills or runtime. For an Office-rendered PDF use `--pdf-engine pptx-convert`; for browser decks `-f html`. `resvg` previews are not proof of PowerPoint fidelity. `sc doctor` lists availability. Guide: `docs/how-to/choose-output-engine.md`.

## Hard rules

- Every number cites a `sources:` id or `source:` text; illustrative data is labelled. Never invent figures or sources.
- Action titles are full-sentence claims, ≤ 2 lines; one message per slide.
- Quote YAML values containing `, ` or `: ` inside `{ … }`.
- Client material stays in `slidecraft/` (git-ignored). Never commit it.
  - Explicit owner-approved exception: `tests/fixtures/digital-ruble/` is the public regression corpus based on `Digital_Ruble_Explainer_RU_v3`. Do not extend this exception to other client data. Do not redistribute locally licensed system fonts. Generated regression reports stay in ignored `tests/.output/`.
- Project architecture diagrams and their labels use English; client deck content retains its original language.

## Developing SlideCraft itself

- **Repo rule (owner, 2026-10-11): every fix lands in shared modules — text measurement, Scene, composition, backends, importer, QA — so it works for every future editable PPTX deck. Any one client deck (Digital Ruble included) is only a verification example; never special-case it. Record each new rule in the general workflow and docs.**
- Fix presentation defects in reusable modules (composition, theme, text/layout, importer, renderer or QA), not branches keyed to one deck, title or slide number. Add a generic regression test; keep Digital Ruble as integration evidence. Apply every new rendering rule consistently to HTML and editable PPTX, and verify exported artifacts before claiming fidelity.
- Text placement follows PowerPoint's measured rules in `src/engine/office-rules.gen.ts` (generated; explained in `docs/explanation/office-rendering-rules.md`). Change them only through `npm run calibrate -- --stage probe --write`, then rerun the probe and the corpus (`--stage corpus`) and commit `calibration/RULES.md`/`REPORT.md`. Calibration is slow and needs real Office: run it when rendering/export changes materially or Office updates, not after every change.
- The final stage of every deck is the reviewer-model visual QA (`slidecraft visual-qa`, `library/references/visual-qa.md`); a recurring finding becomes a shared rule with a test. Changes made while checking are logged in `REVIEW-LOG.md`.
- `npm install`, `npm run check` (biome, tsc, vitest), `npm run gen` after library/CLI changes, `npm run build` before committing (CI checks `dist/` drift).
- Architecture: `docs/explanation/architecture.md`; ADRs in `docs/adr/`; add layouts/themes/storylines via `docs/how-to/`.
- Stage explicit paths when committing; never `git add .` with client files around.
