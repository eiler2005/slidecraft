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
   - Numbers from the client: define each number once in `facts:` (`value`, `format`, or `from: { file, sheet, cell }`) and write `{{id}}` in text. Charts and tables read ranges directly: `chart: { from: { file: model.xlsx, sheet: Plan, range: A1:C6 } }`, `rows: { from: …, header: true }`. Never retype a client number.
   - Starting from an existing PowerPoint: `sc import <file.pptx> --render --json`, read `original.pdf`, then redesign each slide (steps in `skills/import/SKILL.md`).
6. **Review ✅** — `sc check <deck> --json`; fix length problems with the loop: `sc fix <deck> --json` gives each too-long field a character budget; rewrite within it (never truncate), write `[{pointer, text}]` to fixes.json, then `sc fix <deck> --apply fixes.json` until nothing remains, `SC-SRC-*` with real sources only. `SC-CONSIST-001` means one metric shows different values on different slides — use one value (a fact) everywhere. Open every `dist/previews/*.png`. Apply `skills/partner-review-checklist` and `library/references/review.md`. Present verdict + fixes to the user.
7. **Deliver** — paths to PPTX / PDF / HTML / previews / manifest. Never send or publish.
8. **After hand edits** — if the user edited the PPTX in PowerPoint, Keynote or Google Slides: `sc sync <deck> <edited.pptx> --json`, show the changes, then `--apply`. Rebuild afterwards; skipped items (capitals, `{{facts}}`, tables) are edited in `deck.yaml` by hand.

## Engines

`auto` picks `pptxgenjs` for PPTX and the native vector PDF, including inside Codex. All agents use the same themes, components and Scene IR. Codex may additionally use an available OpenAI presentation skill; the local `@oai/artifact-tool` adapter is an explicit option (`--pptx-engine artifact-tool`) for internal evaluation/testing only, never production, commercial use or benchmarking. Do not bundle OpenAI skills or runtime. For an Office-rendered PDF use `--pdf-engine pptx-convert`; for browser decks `-f html`. `resvg` previews are not proof of PowerPoint fidelity. `sc doctor` lists availability. Guide: `docs/how-to/choose-output-engine.md`.

## Hard rules

- Every number cites a `sources:` id or `source:` text; illustrative data is labelled. Never invent figures or sources.
- Action titles are full-sentence claims, ≤ 2 lines; one message per slide.
- Quote YAML values containing `, ` or `: ` inside `{ … }`.
- Client material stays in `slidecraft/` (git-ignored). Never commit it.

## Developing SlideCraft itself

- `npm install`, `npm run check` (biome, tsc, vitest), `npm run gen` after library/CLI changes, `npm run build` before committing (CI checks `dist/` drift).
- Architecture: `docs/explanation/architecture.md`; ADRs in `docs/adr/`; add layouts/themes/storylines via `docs/how-to/`.
- Stage explicit paths when committing; never `git add .` with client files around.
