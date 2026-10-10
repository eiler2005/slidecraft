# Export an HTML deck

> **Audience:** presenters and anyone sharing a link · **Prerequisites:** a buildable deck · **Last reviewed:** 2026-10-10

```sh
node dist/slidecraft.mjs build deck.yaml -f html
open dist/<id>.html
```

One self-contained file: fonts and images are embedded, there are no network requests, so it works offline and can be attached or hosted anywhere.

| Key | Action |
|---|---|
| → / Space / PageDown | next slide |
| ← / PageUp | previous slide |
| Home / End | first / last |
| N | presenter notes overlay |
| F | fullscreen |
| `#7` in the URL | open at slide 7 |

Printing from the browser gives one slide per page at 16:9; for a file, use `--pdf-engine html`. Slides are inline SVG with accessible labels (`Slide n: title`).
