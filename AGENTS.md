# AGENTS.md — SlideCraft for any coding agent (Codex, Claude Code, others)

SlideCraft turns a goal into a consulting-grade deck: brief → template → storyline → ghost deck → build → review. In Claude Code use the plugin (`/slidecraft:new`). Any other agent follows this file. Run commands from the repo root.

`sc` below means `node dist/slidecraft.mjs` (zero install, Node ≥ 22.12). Every command accepts `--json`; non-TTY output is JSON by default.

## The workflow — stop at each ✅ and ask the user

1. **Brief ✅** — `sc new <deck-id> --goal "…" --audience "…"` creates `slidecraft/<id>/brief.yaml` and a ghost `deck.yaml`. Fill the brief (decision/ask, audience knows/cares, task, `usage`: edit-together | send-pdf | present-live | web-link | automation | codex). `sc templates --brief <brief> --json` returns three template options and the recommended outputs/engines with reasons. Confirm the brief with the user.
2. **Pick ✅** — `sc pick --brief <brief> --json` writes `.slidecraft/picker.html` and `option-A|B|C.png`. Show/describe them; record the choice with `sc choose --brief <brief> --option A`.
3. **Storyline** — follow `skills/storyline-architect/SKILL.md`; write `storyline.md` (governing thought, SCR, MECE key line, evidence status). Methods: `library/references/writing-standard.md`, `storytelling.md`.
4. **Ghost deck ✅** — `sc scaffold --brief <brief> --force`, then write final action titles (`skills/action-title-writer`), refine `ghost.exhibit / data / confidence`, pick layouts (`skills/exhibit-chooser`). Show the user the numbered title chain; iterate until approved.
5. **Build** — fill each slide against its contract (`sc layouts <layout> --json`; rules in `skills/deck-spec/SKILL.md`). Put sections in `sections/*.yaml` and include them from `deck.yaml`. `sc validate`, then `sc build <deck> --json`.
6. **Review ✅** — `sc check <deck> --json`; fix `SC-FIT-*` by rewriting shorter (never truncate), `SC-SRC-*` with real sources only. Open every `dist/previews/*.png`. Apply `skills/partner-review-checklist` and `library/references/review.md`. Present verdict + fixes to the user.
7. **Deliver** — paths to PPTX / PDF / HTML / previews / manifest. Never send or publish.

## Engines

`auto` picks `pptxgenjs` for PPTX and the native vector PDF. Inside Codex, `auto` uses the local `@oai/artifact-tool` runtime for PPTX when present (proprietary, internal-evaluation license — tell the user). For a PowerPoint-identical PDF use `--pdf-engine pptx-convert`; for browser decks `-f html`. `sc doctor` lists availability. Guide: `docs/how-to/choose-output-engine.md`.

## Hard rules

- Every number cites a `sources:` id or `source:` text; illustrative data is labelled. Never invent figures or sources.
- Action titles are full-sentence claims, ≤ 2 lines; one message per slide.
- Quote YAML values containing `, ` or `: ` inside `{ … }`.
- Client material stays in `slidecraft/` (git-ignored). Never commit it.

## Developing SlideCraft itself

- `npm install`, `npm run check` (biome, tsc, vitest), `npm run gen` after library/CLI changes, `npm run build` before committing (CI checks `dist/` drift).
- Architecture: `docs/explanation/architecture.md`; ADRs in `docs/adr/`; add layouts/themes/storylines via `docs/how-to/`.
- Stage explicit paths when committing; never `git add .` with client files around.
