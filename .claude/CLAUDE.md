# SlideCraft — notes for contributors working with Claude Code

User-facing workflow: see @../AGENTS.md. This file is for developing SlideCraft itself.

- Run from source: `npx tsx src/cli/main.ts <command>`; the plugin uses the bundle `dist/slidecraft.mjs`.
- Before committing: `npm run check`, `npm run gen` (reference docs, schemas, catalog), `npm run build` (bundle). CI fails on drift in `dist/`, `docs/reference/*.gen.md`, `schemas/`.
- Repo rule: fix defects only in shared modules (text measurement, Scene, backends, importer, QA) so every future editable PPTX benefits; a client deck such as Digital Ruble is verification evidence, never a special case. Document each new rule in the general workflow.
- PowerPoint text rules are data (`src/engine/office-rules.gen.ts`); regenerate with `npm run calibrate -- --stage probe --write` (needs PowerPoint, Chrome, Poppler; on demand only), verify with `--stage corpus`. Final stage of a deck: `slidecraft visual-qa` (reviewer model) → `REPORT.md`, changes → `REVIEW-LOG.md`.
- Layers are independent: storyline (YAML) × theme (JSON) × layout (TS, zod contract) × format. Layouts emit Scene IR only (`src/engine/scene.ts`); engines translate it (`src/backends/`).
- New layout: `docs/how-to/add-layout.md`; the harness in `tests/layouts.test.ts` runs every example in every theme. Look at previews in a light and a dark theme before finishing.
- Text never truncates; fit problems surface as `SC-FIT-*` with a pointer. Keep diagnostic codes stable (`src/qa/codes.ts`).
- Fonts: only Arial / Georgia / Times New Roman are measurable (metric-compatible OFL fonts in `fonts/`). Gelasio has no Cyrillic.
- PDF determinism: embed each image once per document (pdfkit decodes PNGs asynchronously).
- `@oai/artifact-tool` is proprietary: call it at runtime only, never copy, vendor or bundle it.
- Scratch output goes to `tests/.output/` (git-ignored). Client material never enters the repo.
