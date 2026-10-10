# 0002 — TypeScript single runtime, committed zero-install bundle

**Status:** Accepted · 2026-10-10

## Context
The plugin runs inside Claude Code, Codex and CI on users' machines. Plugin installs from git do not reliably run `npm install`; Python + Node mixes double the setup; native modules and browser downloads break in sandboxes.

## Decision
Everything is TypeScript on Node ≥ 22.12. Dependencies are pure JS or WebAssembly (zod, yaml, commander, fontkit, pdfkit, pptxgenjs, jszip, resvg-wasm). esbuild produces **`dist/slidecraft.mjs` + `dist/resvg.wasm`, committed** to the repo. Skills call `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"`. CI rebuilds the bundle and fails on drift. TypeScript (7.x) is used for type-checking only.

## Consequences
- Install = clone or `/plugin install`; no network, no build step for users.
- The bundle is ~4 MB in git; regenerated on every release.
- pdfkit's dynamic standard-font requires are rewritten to static imports by a small esbuild plugin.
- Optional engines that need external software (Chrome, PowerPoint, LibreOffice, Codex) are detected at runtime, never installed by SlideCraft.
