# Theme spec

> **Audience:** theme authors · **Schema:** [`schemas/theme.v1.json`](../../schemas/theme.v1.json) · **Catalogue:** [themes](themes.gen.md) · **Guide:** [add a theme](../how-to/add-theme.md) · **Last reviewed:** 2026-10-10

| Group | Fields |
|---|---|
| Identity | `schemaVersion`, `id`, `name`, `description`, `bestFor[]`, `mood[]`, `dark`, `prefers` (`pptx` \| `html`) |
| `colors` | `background`, `surface`, `ink`, `muted`, `accent`, `accentText`, `accentSoft`, `rule`, `positive`, `negative`, `titleInk?` — all `#RRGGBB` |
| `chart` | 4–10 colours, index 0 = highlight |
| `fonts` | `heading`, `body`: `{ family, measure }` with `measure` ∈ `liberation-sans` (Arial), `liberation-serif` (Times New Roman), `gelasio` (Georgia); `cyrillic?` overrides |
| `type` (pt) | `cover`, `title`, `subtitle`, `heading`, `body`, `minBody`, `small`, `source`, `lineHeight`, `titleWeight` |
| `decor` | `kind` (`none`, `rule`, `wave`, `glow`, `geo`, `gradient`, `paper`), `colors[]`, `intensity` 0–1, `onContent` |
| `chrome` | `titleRule`, `accentBar`, `pageNumbers`, `footer?`, `tracker` |
