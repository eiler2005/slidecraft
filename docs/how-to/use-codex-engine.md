# Use the Codex artifact-tool engine

> **Audience:** Codex users · **Prerequisites:** the Codex runtime installed locally · **Last reviewed:** 2026-10-10

**License first.** `@oai/artifact-tool` is proprietary (OpenAI): *internal evaluation and testing only*; no distribution, no production or commercial use. SlideCraft never copies or bundles it — the adapter calls the copy that ships with your Codex runtime. Decide whether your use fits that license.

## Detection

1. `SLIDECRAFT_ARTIFACT_TOOL=/path/to/@oai/artifact-tool` if set;
2. otherwise `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool`.

Version ≥ 2.7.3 is required. `node dist/slidecraft.mjs doctor` shows what was found.

## Use

```sh
node dist/slidecraft.mjs build deck.yaml -f pptx --pptx-engine artifact-tool
```

To prefer it everywhere (not only inside Codex), set `export SLIDECRAFT_PPTX_ENGINE=artifact-tool`; builds fall back to `pptxgenjs` when the runtime is missing, and an explicit `--pptx-engine pptxgenjs` still wins — use that for client deliverables.

Inside Codex, `auto` picks it automatically when available (detected via `CODEX_HOME`/`CODEX_SANDBOX`, or force with `SLIDECRAFT_IN_CODEX=1`). The build prints a license notice and `manifest.json` records `license: proprietary`.

## Differences from pptxgenjs

- Footer, page numbers and decor are drawn on each slide (no slide master).
- The runtime lays out chart plot areas; stacked-chart totals and waterfall connector lines are omitted; waterfall labels are per-point overrides.
- Bullet hanging indents are approximate.
- Geometry is rounded to whole pixels (< 0.5 px).

For a PDF, combine with `--pdf-engine native` or `pptx-convert`.
