# Use icons

> **Audience:** deck authors · **Last reviewed:** 2026-10-12

SlideCraft bundles a curated set of 114 outline icons from [Tabler Icons](https://tabler.io/icons)
(MIT). They are drawn as **native, editable shapes**: a freeform in PowerPoint (recolour or
resize it like any shape), a path in HTML and PDF — never a picture.

```yaml
- id: profile
  layout: key-points
  variant: columns
  title: The profile combines production engineering, applied AI and customer judgement
  points:
    - { icon: server, heading: Production engineering, body: … }
    - { icon: brain, heading: Applied AI, body: … }
    - { icon: heart-handshake, heading: Customer judgement, body: … }
```

| Layout | Field | Where the icon goes |
|---|---|---|
| `key-points` | `points[].icon` | above the heading (columns, cards), left of it (list) |
| `process-steps` | `steps[].icon` | under the chevron or the number; the highlighted step's icon takes the accent |

`slidecraft icons` lists the names (`--json` for agents). The colour is the theme accent; muted
for steps that are not highlighted.

**Rules.** Give every item an icon or none. Pick icons that name the idea, not decorate it — a
`database` for data access, not a `star` for "quality". Consulting themes use them sparingly:
one row of icons per slide at most.

To add an icon: put its Tabler name in `scripts/icons.ts` and run `npm run icons`.
