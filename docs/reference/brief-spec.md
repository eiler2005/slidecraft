# Brief spec (`brief.yaml`)

> **Audience:** users and agents · **Schema:** [`schemas/brief.v1.json`](../../schemas/brief.v1.json) · **Last reviewed:** 2026-10-10

| Field | Required | Meaning |
|---|---|---|
| `schemaVersion`, `id` | ✅ | `1`, kebab-case deck id |
| `goal` | ✅ | What must be true after the audience sees the deck (10–400 chars) |
| `ask` | | The decision or action requested |
| `audience.who` | ✅ | Who reads or hears it |
| `audience.knows`, `audience.cares` | | What they accept; what they worry about — shapes the storyline |
| `task` | | Plain-words kind of deck ("board update", "keynote story") — strongest ranking signal |
| `context` | | Background, constraints |
| `materials` | | Paths to source files (relative to the brief) |
| `length` | | `{ slides?, minutes? }` |
| `language`, `tone` | | Defaults `en`, `[]` |
| `brand` | | `{ theme?, footer?, logo? }` — `theme` forces the look |
| `usage` | | `edit-together` (default), `send-pdf`, `present-live`, `web-link`, `automation`, `codex` — drives engine recommendations |
| `output` | | Explicit `formats` / `engines` override |
| `choice` | | `{ storyline, theme, option }` — written at checkpoint 2 by `slidecraft choose` |

`slidecraft templates --brief brief.yaml --json` returns `options` (A/B/C), `output` (formats, engines, rationale) and `ranked` (all storylines with scores and matched words).
