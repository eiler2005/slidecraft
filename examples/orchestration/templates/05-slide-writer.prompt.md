<!-- Hand-off: orchestrator → slide-writer (model: sonnet). One call per section; sequential is fine. -->
Write section `<section>` of `slidecraft/<id>/deck.yaml`: slides `<id-1>, <id-2>, …`.

- Keep every approved action title word for word.
- Fill each layout contract (`sc layouts <layout> --json`); rules: `skills/deck-spec/SKILL.md`.
- Numbers come from `facts:` (`{{fact-id}}`) or data ranges (`from: { file, sheet, range }`); cite `sources:`.
- Write only `slidecraft/<id>/sections/<section>.yaml` (template `05-section.yaml`). Never edit deck.yaml.
- Finish with `sc validate slidecraft/<id>/deck.yaml --json` and report remaining diagnostics.
