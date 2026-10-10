# Design principles

> **Audience:** contributors and curious users · **Prerequisites:** none · **Last reviewed:** 2026-10-10

1. **The argument comes first.** Tools serve the storyline: brief → governing thought → title chain → exhibits. We never generate slides before the title chain is agreed.
2. **Contracts over prompts.** Every layout publishes what fits (JSON Schema limits) and the engine proves it (measurement). Agents get precise errors, not vibes.
3. **Never lie with a slide.** No invented numbers, no truncated text, no chart that implies more than the data. Illustrative data is labelled.
4. **Editable by default.** Real PowerPoint objects — text, tables, charts, notes, masters. Raster only for decoration.
5. **Same deck everywhere.** One Scene IR; every engine draws the same geometry.
6. **Open by default, proprietary by choice.** The default path is MIT and works offline; proprietary engines are optional, called in place, never shipped.
7. **Deterministic and inspectable.** Same input, same bytes; a manifest records engines, hashes, checks and limitations.
8. **The human signs off.** Four checkpoints; `visual_review` is never set by a machine.
9. **Small, independent pieces.** Storyline, layout, theme and format change independently; the harness tests every combination.
10. **Docs are part of the product.** Generated reference cannot drift; guides are task-shaped.
