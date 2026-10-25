# Troubleshooting

> **Audience:** everyone · **Last reviewed:** 2026-10-10

| Symptom | Cause and fix |
|---|---|
| `node: command not found` / syntax errors | Node ≥ 22.13 required: `node --version`. |
| `Unrecognized key` in validate | A comma or colon inside a `{ … }` YAML value — quote it. |
| `SC-FIT-001` everywhere | Content written for a bigger box; check the layout's limits with `layouts <id> --json` and rewrite. |
| PowerPoint shows different line breaks | Arial/Georgia not installed on that machine (Keynote on a Mac without Office substitutes fonts). Use a theme with Arial, or deliver the PDF. |
| `pptx-convert` hangs, error -1712 | PowerPoint is waiting for **Grant Access** — click it and rerun. Allow Automation for your terminal in System Settings → Privacy. |
| `html` PDF engine unavailable | Install Chrome/Chromium/Edge or set `CHROME_PATH`. |
| `artifact-tool` unavailable | Codex runtime not installed; set `SLIDECRAFT_ARTIFACT_TOOL` or use `pptxgenjs`. |
| Cyrillic shows as boxes | Use a theme with a Cyrillic override (all bundled themes have one) — `SC-GLYPH-001` explains which font lacks glyphs. |
| Image looks soft | `SC-IMG-001`: provide ≥ 144 ppi at placed size. |
| Two builds differ | Native PPTX/PDF are reproducible; `html` and `pptx-convert` PDFs are not. Set `SOURCE_DATE_EPOCH` to control timestamps. |
| Plugin skills do not appear | `/plugin` → check `slidecraft` is enabled; restart Claude Code after install. |

Still stuck? Open an issue with `slidecraft doctor` output and the deck (with client data removed).
