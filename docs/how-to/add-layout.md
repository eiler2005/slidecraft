# Add a layout

> **Audience:** contributors adding an exhibit type · **Prerequisites:** Node 22, `npm install` · **Last reviewed:** 2026-10-10

A layout is one exhibit type — an executive summary, a waterfall, a 2×2. It owns two things:

1. a **content contract**: a zod schema whose limits (characters, item counts) keep text inside the boxes;
2. a **compose function** that turns validated content into Scene IR nodes.

Layouts never talk to PowerPoint, PDF or SVG directly. Every engine renders the same nodes, so a layout written once works in every output format. See [concepts](../explanation/concepts.md) for the four layers.

## The 10-minute version

```sh
cp src/layouts/chart-takeaway.ts src/layouts/my-layout.ts   # start from a reference
# edit id, name, group, purpose, schema, examples, compose
# register it in src/layouts/index.ts (keep catalog order)
npx vitest run tests/layouts.test.ts                         # contract harness, all themes
npx tsx src/cli/main.ts build tests/fixtures/skeleton/deck.yaml   # or your own deck
```

The harness in `tests/layouts.test.ts` picks your layout up automatically: every example must validate, compose without errors in **every theme**, and stay inside the slide.

## Anatomy

```ts
import { z } from 'zod';
import { cols, rows } from '../engine/format.ts';
import type { LayoutDef } from './types.ts';

const schema = z
  .object({
    points: z.array(z.string().max(140)).min(2).max(4).describe('One claim per point'),
  })
  .strict();

export const keyPoints: LayoutDef<typeof schema> = {
  id: 'key-points',                 // kebab-case, stable forever
  name: 'Key points',
  group: 'message',                 // frame | message | numbers | decide | sequence | people | close
  purpose: 'Use for 2–4 parallel points that together prove the title.',
  useWhen: ['…'],
  avoidWhen: ['…'],                 // name the better layout for that case
  variants: ['columns', 'cards'],   // first is the default
  frame: 'standard',                // the frame draws tracker, action title, lead and source line
  master: 'content',                // content | cover | divider
  schema,
  examples: [{ title: 'A full-sentence action title that the body proves', variant: 'columns', content: { points: ['…'] } }],
  compose(ctx, c) {
    const parts = cols(ctx.body, c.points.length, 0.35);
    c.points.forEach((p, i) => ctx.text(p, parts[i]!, { size: 'body', field: `points/${i}` }));
  },
};
```

### The context API (`ctx`)

| Member | Use |
|---|---|
| `ctx.body` | Content box for `frame: 'standard'` (already below the title/lead, above the source line). |
| `ctx.page` | Full page box, for `frame: 'none'` layouts. |
| `ctx.colors`, `ctx.theme`, `ctx.fonts` | Theme tokens. **Never hard-code colors or fonts.** |
| `ctx.slide.title`, `ctx.variant` | Common fields and the resolved variant. |
| `ctx.text(content, box, opts)` | Lays out text with copy-fitting (steps down to `theme.type.minBody`), records `SC-FIT-*` diagnostics. `opts.field` must point at the deck field (`'points/2'`) so agents can fix the right string. Use `maxLines` for single-line labels and `fixed: true` for labels that must not shrink. |
| `ctx.paragraphs(items, { bullet, spaceBefore })` | Bulleted / spaced paragraph lists. |
| `ctx.rect`, `ctx.ellipse`, `ctx.line` | Shapes. Rect `radius` in inches. Strokes in pt. |
| `ctx.table(spec, box)` | Native table with fitting, header rule, highlight column/row. |
| `ctx.chart(spec, box)` | Native chart + vector fallback (`bar`, `column`, `stacked-column`, `stacked-bar`, `line`, `waterfall`). |
| `ctx.image(box, src, alt, opts)` | Image slot; renders a labelled placeholder when empty (`SC-IMG-002`). |
| `ctx.issue(diag(...))` | Report a content problem (e.g. variant-specific field missing → `SC-SPEC-001`). |

Geometry helpers in `src/engine/format.ts`: `cols(box, weights, gap)`, `rows(box, weights, gap)`, `columns(box, n, gutter)`, `inset(box, d)`. All units are inches; the page is 13.333 × 7.5.

## Rules that keep decks partner-grade

1. **One message per slide.** The layout proves the action title; it never needs a second headline. Use `takeaway` / `headline` fields only for the interpretation of an exhibit.
2. **Capacity is part of the contract.** Set `.max()` on every string and `.min()/.max()` on every array. Derive limits from the box: characters ≈ `lines × box width / (0.5 × size in inches) × 0.85`. Then confirm with the harness — the measurer is the source of truth, `.max()` is the early warning agents see in the JSON Schema.
3. **Never truncate.** If text does not fit, `ctx.text` reports `SC-FIT-001` with the overflow; the author or the `copy-fitter` agent rewrites. Do not add ellipses or clip.
4. **One accent.** Use `colors.accent` for the single thing the eye must find (the recommended option, the highlighted bar, the answer). Everything else is `ink`, `muted`, `rule`, `surface`.
5. **Direct labels, no legends where avoidable**, no value axis on bar/column charts, a baseline at zero.
6. **Grid discipline.** Align to `ctx.body` edges; use gaps of 0.25–0.4 in; keep labels on a shared baseline across columns.
7. **Variants are content shapes, not styles.** A variant changes what the content is (SCR vs key messages), never the color. Colors come from themes.
8. **Examples are fictional but realistic.** Use plausible numbers and the fictional companies *Northwind*, *Contoso*, *Fabrikam*, *Tailspin*. Any example with numbers lists `sources` (the harness provides an illustrative source).
9. **Purpose-first description.** `purpose` starts with "Use for…". `avoidWhen` names the better layout.
10. **Fields are agent-friendly.** Short names, `.describe()` on every field explaining what good content looks like.

## Checklist before opening a PR

- [ ] Registered in `src/layouts/index.ts` in catalog order.
- [ ] One example per variant; all compose cleanly in every theme (`npx vitest run`).
- [ ] Looked at the PNG previews in at least two themes (light and dark).
- [ ] `npm run gen` regenerated `docs/reference/layouts.gen.md` and the gallery.
- [ ] No hard-coded colors, fonts or sizes outside theme tokens (sizes may be relative: `theme.type.body + 2`).
