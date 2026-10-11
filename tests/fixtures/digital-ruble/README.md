# Digital Ruble regression corpus

The repository owner explicitly authorised including this corpus in Git on
2026-10-11. This is a specific exception, not permission to commit other client
material. Test assets are outside the npm package's `files` list.

- `Digital_Ruble_Explainer_RU_v3.pptx`: immutable, authoritative original.
- `reference.html`: frozen historical HTML redesign; owns the redesigned look.
- `baseline.json`: SHA-256 locks and provenance. Do not update it to accept a failing export.
- `deck.yaml`, `sections/`, `theme/`: candidate input to improve, not a golden output.

The original PPTX owns text, data and speaker notes. Its visual distance is also
reported, but not used as a simultaneous pixel-style requirement: the original
and the approved HTML redesign are different designs. Both current HTML → PPTX
and historical HTML → PPTX must pass the visual gate.

The historical HTML originally embedded Apple's system SFNS font. The public
reference replaces **only** those font data URLs with a local font URL; no Apple
font binary is redistributed. Both historical and public-reference hashes are
recorded. The faithful integration run requires macOS with that font installed,
Chrome, PowerPoint (or explicitly selected LibreOffice) and Poppler. It fails
clearly when these are unavailable; it does not silently substitute fonts or
pretend that a skipped renderer passed.

```sh
npm ci
npm test -- tests/deck-regression.test.ts
npm run test:digital-ruble
```

The fast test runs on CI without Office. The full, opt-in integration run creates
`tests/.output/digital-ruble/report.json`, original and candidate Office PDFs,
historical/current HTML PDFs and per-page RGB rasters. Outputs remain ignored.
Exit code **1 means acceptance failed**, even when PPTX generation succeeded.
Detailed deltas contain deck content; don't publish reports without reviewing them.

The visual signal is RGB absolute difference plus detail-edge difference in a
4×4 grid, measured at 1600 px without alignment or resizing that could hide drift.
Each slide's worst region must reach 0.95. This is an explicit engineering
threshold, **not a calibrated claim of 95% perceived quality**. The gate also
requires exact case/punctuation-sensitive token counts, no missing note tokens,
native shapes and no slide pictures. Token counts tolerate text-box splits but
do not establish word order or semantic correctness. Manual slide review remains
required, and is never set to true automatically.

Re-registration is deliberately separate from testing:
`scripts/prepare-digital-ruble-fixture.ts` requires three explicit source paths.
Only use it after reviewing and approving a genuine baseline change.
