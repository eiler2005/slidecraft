# Fix overflow and check errors

> **Audience:** deck authors and agents · **Last reviewed:** 2026-10-11

## The fit-fix loop

```sh
slidecraft fix deck.yaml --json
```

The command lists every field that is too long: text that does not fit its box (`SC-FIT-*`) and text over a layout's character limit. For each field you get:
- `pointer` — the field;
- `file` — the YAML that holds it, deck.yaml or a section file;
- `text` and `length`;
- `budget` — the longest length that fits. It is measured by re-laying-out the slide with shorter text, or taken from the contract.

Rewrite each text within its budget (never truncate), put the rewrites in a file:

```json
[{ "pointer": "/slides/3/points/0/body", "text": "Both resellers signed and want to start before summer" }]
```

and apply them:

```sh
slidecraft fix deck.yaml --apply fixes.json
```

The rewrites go into the right file, and comments and formatting are kept. The deck is re-checked, and anything still too long is listed again. In the plugin, the review loop does this automatically with the copy-fitter agent.

Every layout is tested so that every field at its contract maximum fits (`tests/fit.test.ts`). In practice, text that passes validation fits; what remains are lists with many long items, and freeform HTML (`SC-FIT-004/005`).

```sh
node dist/slidecraft.mjs check deck.yaml          # human-readable
node dist/slidecraft.mjs check deck.yaml --json   # for agents
```

Each diagnostic has a code, a JSON pointer (`/slides/4/points/1`), measured vs limit and a hint. Full list: [diagnostic codes](../reference/error-codes.gen.md).

| You see | Do |
|---|---|
| `SC-FIT-001` "Cut about 40 characters (+1 line)" | Rewrite the field shorter (keep numbers and the claim); split the point; move detail to `notes`. Never truncate. |
| `SC-FIT-002` text shrunk | Optional: tighten so it renders at the body size. |
| `SC-FIT-003` word too long | Hyphenate/abbreviate, or choose a layout with wider columns. |
| `SC-TITLE-001` title over two lines | One claim, 8–14 words. |
| `SC-TITLE-002` topic-like title | Rewrite as a sentence with a verb ([action-title-writer](../../skills/action-title-writer/SKILL.md)). |
| `SC-SPEC-001` "Unrecognized key: \"direct later\"" | A comma inside `{ … }` split your value — quote it: `summary: "Two resellers, direct later"`. |
| `SC-SPEC-002` unknown id | Typo in a theme, layout, variant or source id — see `themes`, `layouts`, deck `sources:`. |
| `SC-SRC-001` | Add `sources:` ([cite sources](cite-sources.md)). |
| `SC-GEOM-002` overlap | Usually too much content for the layout — cut or split. If not, report a layout bug. |
| `SC-CONTRAST-001` | Change the highlight or the theme colours. |

In the plugin the **copy-fitter** agent fixes `SC-FIT-*` and `SC-TITLE-001/003` automatically during review.
