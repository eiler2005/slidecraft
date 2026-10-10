# Storyline spec

> **Audience:** storyline authors · **Schema:** [`schemas/storyline.v1.json`](../../schemas/storyline.v1.json) · **Catalogue:** [storylines](storylines.gen.md) · **Guide:** [add a storyline](../how-to/add-storyline.md) · **Last reviewed:** 2026-10-10

| Field | Meaning |
|---|---|
| `id`, `name`, `summary`, `arc` | Identity and the one-line shape shown at checkpoint 2 |
| `bestFor[]` | Task words for ranking (single words or phrases) |
| `audiences[]` | Whole phrases matched against `audience.who` |
| `themes[]` | Recommended themes, best first |
| `ordered` | Slots follow a fixed order |
| `length` | `{ min, max }` slides |
| `tone[]`, `principles[]` | Writing guidance applied by the strategist |
| `sections[]` | `{ id, name, slots[] }` |
| `slots[]` | `{ id, purpose, layouts[] (best first), required, repeat? {min,max}, guidance?, inputs[] }` |

`slidecraft scaffold` creates one ghost slide per slot (`repeat.min` copies), using the first layout, the section name as tracker, and `guidance` as speaker notes.
