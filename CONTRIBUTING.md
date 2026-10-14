# Contributing to SlideCraft

Thanks for helping. SlideCraft is built so contributions stay small and safe: layouts, themes and storylines are independent, and the test harness checks every combination.

## Setup

```sh
git clone https://github.com/eiler2005/slidecraft && cd slidecraft
npm install
npm run hooks          # enables .githooks (privacy check, lint, types)
npm run check          # biome + tsc + vitest
```

Node ≥ 22.12. Run the CLI from source with `npx tsx src/cli/main.ts <command>`.

## Ground rules

- **New behaviour needs a test.** Rules in `check` get a test that triggers them; layouts are covered by the harness automatically.
- **No client material in the repo.** Work in `./slidecraft/` or `./work/` (git-ignored). The privacy hook blocks binaries outside allowlisted folders, secrets and email addresses other than example domains and the maintainer's published contact.
- **Keep the layers independent.** Layouts never hard-code colours or fonts; themes never contain geometry; storylines reference layouts by id only.
- **Generated files are generated.** After changing layouts, themes, storylines, CLI or codes run `npm run gen` (reference docs, schemas, catalog) and, if previews changed, `npx tsx src/cli/main.ts gallery --hero`.
- **The bundle is committed.** Run `npm run build` before your final commit; CI fails if `dist/` is stale.
- **Pixels are guarded.** `tests/visual.test.ts` compares PNG hashes of every layout example in `consulting-classic` and `midnight` with `tests/golden/visual.json`. When a visual change is intended, look at the renders in `tests/.output/visual/`, then accept them with `UPDATE_GOLDEN=1 npx vitest run tests/visual.test.ts` and commit the updated JSON.
- **The gallery site is not committed.** `slidecraft site` (and the Pages workflow) renders the full matrix; `docs/gallery/` keeps only the images the README and docs embed.

## By type of change

### A new layout
Follow [docs/how-to/add-layout.md](docs/how-to/add-layout.md). One example per variant, register it in `src/layouts/index.ts`, look at its previews in a light and a dark theme, update `exhibit-selection.md` if it answers a new relationship.

### A new theme
Follow [docs/how-to/add-theme.md](docs/how-to/add-theme.md). Only Arial, Georgia and Times New Roman are measurable today; Georgia needs a Cyrillic override. Zero `SC-CONTRAST-001` on the harness.

### A new storyline
Follow [docs/how-to/add-storyline.md](docs/how-to/add-storyline.md). `npx tsx src/cli/main.ts library check` must pass; add an example deck under `examples/<id>/` when you can.

### A new engine
Implement `Engine` (`src/backends/types.ts`), register it in `src/backends/extra.ts`, make `detect()` never throw, add a `skipIf` test. Read [ADR 0001](docs/adr/0001-scene-ir-pluggable-engines.md). Proprietary software may only be *called* at runtime, never copied or bundled ([ADR 0003](docs/adr/0003-pptxgenjs-default-artifact-tool-optional.md)).

### Docs
Docs follow [Diátaxis](docs/adr/0007-docs-diataxis-and-generated-reference.md): tutorials, how-to, reference, explanation. Every page starts with audience · prerequisites · last reviewed.

## Pull requests

- One topic per PR; describe the user-visible change.
- Fill the checklist in the PR template.
- Commits: conventional style (`feat(layouts): …`, `fix(engine): …`, `docs: …`).

By contributing you agree that your work is released under the project licence ([PolyForm Shield 1.0.0](LICENSE)), that the author may also offer it under other licence terms (for example a commercial licence), and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
