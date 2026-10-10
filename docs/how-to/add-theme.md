# Add a theme

> **Audience:** contributors and brand owners · **Prerequisites:** `npm install` · **Last reviewed:** 2026-10-10

A theme is a JSON file of tokens in `library/themes/<id>.json` — no geometry, no code. Schema: `schemas/theme.v1.json`; reference: [themes](../reference/themes.gen.md).

```sh
cp library/themes/consulting-classic.json library/themes/my-brand.json
```

Edit:

- **colors** — `background`, `surface`, `ink`, `muted`, `accent` (the one highlight), `accentText` (text on accent), `accentSoft`, `rule`, `positive`, `negative`, optional `titleInk`.
- **chart** — 4–10 colours; index 0 is the highlight, the rest recede.
- **fonts** — `heading` and `body`, each `{ family, measure }`. Measurable today: Arial (`liberation-sans`), Georgia (`gelasio`), Times New Roman (`liberation-serif`). Georgia has no Cyrillic in Gelasio → add `"cyrillic": { "heading": { "family": "Times New Roman", "measure": "liberation-serif" } }`.
- **type** — sizes in pt; `minBody` is the floor copy-fitting may use; `lineHeight` is exact spacing as a multiple.
- **decor** — `none | rule | wave | glow | geo | gradient | paper`, colours, intensity, `onContent`.
- **chrome** — `titleRule`, `accentBar`, `pageNumbers`, `tracker`, default `footer`.
- `dark: true` for dark backgrounds; `prefers: "html"` if the theme looks best in the browser.

Verify:

```sh
npx vitest run tests/layouts.test.ts                  # every layout example in your theme
npx tsx src/cli/main.ts gallery --themes my-brand     # contact sheets
npm run gen
```

Zero `SC-CONTRAST-001`; look at a light content slide, a chart, the cover and the closing slide.
