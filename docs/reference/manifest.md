# Build manifest (`dist/manifest.json`)

> **Audience:** reviewers, CI and auditors · **Last reviewed:** 2026-10-10

```json
{
  "tool": "slidecraft", "version": "0.1.0",
  "deck": { "id": "northwind-germany", "title": "…", "status": "review", "theme": "consulting-classic", "storyline": "strategy-recommendation", "slides": 11 },
  "input": { "path": "../deck.yaml", "sha256": "…" },
  "epoch": "2026-01-01T00:00:00.000Z",
  "engines": { "pptx": { "id": "pptxgenjs", "reason": "auto: default (v4.0.1)", "license": "MIT" }, "png": { … }, "pdf": { … } },
  "outputs": [ { "path": "northwind-germany.pptx", "kind": "pptx", "engine": "pptxgenjs", "sha256": "…" } ],
  "checks": { "errors": 0, "warnings": 0, "info": 0, "codes": [] },
  "visual_review": false,
  "limitations": ["…"],
  "slides": [ { "id": "cover", "layout": "title", "variant": "cover", "title": "…" } ]
}
```

- `epoch` — timestamp used inside the files (`SOURCE_DATE_EPOCH`, default 2026-01-01) for reproducible bytes.
- `engines[].license` — `proprietary` engines are flagged.
- `visual_review` — always `false` from the machine; set it to `true` only after a person has looked at every slide.
- `limitations` — what each engine could not do for this build (e.g. overlay labels in waterfalls).
