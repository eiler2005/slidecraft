# Add a storyline

> **Audience:** contributors · **Last reviewed:** 2026-10-10

A storyline is YAML in `library/storylines/<id>.yaml` (schema `schemas/storyline.v1.json`). Copy a reference: `strategy-recommendation.yaml` (consulting) or `narrative-story.yaml` (story).

Fill:

- `summary`, `arc` — one sentence each; shown to users at checkpoint 2.
- `bestFor` — task words people type ("QBR", "steerco", "RFP response"); used for ranking.
- `audiences` — whole phrases ("board", "executive committee").
- `themes` — recommended looks, best first.
- `principles` — 4–6 concrete writing rules for this kind of deck.
- `sections[].slots[]` — `id`, `purpose` (what the slide must make the reader believe), `layouts` (best first), `required`, `repeat`, `guidance`, `inputs`.

Verify:

```sh
npx tsx src/cli/main.ts library check
npx tsx src/cli/main.ts gallery --storylines <id>
npm run gen
```

Best: add a complete fictional example under `examples/<id>/deck.yaml` — the gallery uses it instead of layout samples.
