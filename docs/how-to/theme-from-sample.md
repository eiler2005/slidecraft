# Create a theme from a sample

> **Audience:** anyone who needs a deck to look like something that already exists · **Last reviewed:** 2026-10-12

No `.potx` template? Point SlideCraft at a sample: a reference deck or brand guide as **PDF**, a
**screenshot** (PNG/JPEG) or a **website**.

```sh
slidecraft theme from brand-guide.pdf --id acme
slidecraft theme from https://acme.example --id acme
slidecraft theme from slide-screenshot.png --id acme --heading-font "Georgia" --body-font "Arial"
slidecraft theme from assets/cover.jpg --id acme-photo     # a photograph: only its colours
```

| Sample | Colours | Fonts | Margins |
|---|---|---|---|
| PDF | filled areas (largest = background) and text colours, weighted by area and glyphs | font names in the file; the largest size is the heading font | text extent → a page format |
| Screenshot of a slide or page | pixel clusters; the flat background, the dark text, the most vivid colour | not readable — pass `--heading-font` / `--body-font` | content box → a page format |
| Photograph | accent and chart palette from its most present vivid colours; page and text stay light and dark | — | — |
| Website | CSS of the page and its stylesheets: `body` background and colour, `--brand`/`--primary` variables, `<meta name="theme-color">` | `font-family` of `body` and headings | — |

The result is a theme JSON in `slidecraft-theme/` (`-o` to change) on top of Consulting Classic
(or Midnight when the background is dark), and `<id>.format.json` with the sample's margins when
it had them. Use them in a deck:

```yaml
theme: slidecraft-theme/acme.json
format: slidecraft-theme/acme.format.json   # optional
```

- The accent is darkened (lightened on dark pages) until small text in it reads at 4.5:1.
- Fonts SlideCraft cannot measure map to the closest of Arial, Georgia and Times New Roman, with
  a note; give the real files with `--font-dir` to measure them exactly, as in
  [apply your brand](apply-brand.md).
- Check the result: `slidecraft pick` contact sheets or a build, then edit the JSON by hand if
  a colour is off. A website's CSS may hold many unrelated colours.
- Sampling a brand you do not own is fine for a mood; do not present the result as that brand.

Example: [`examples/fde-engineer-en-v2/theme/fde-desk.json`](../../examples/fde-engineer-en-v2/theme/fde-desk.json)
was sampled from the deck's cover photo.
