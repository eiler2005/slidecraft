# Editable fidelity: next-agent handoff

Checkpoint: 2026-10-11 (second session). Rules are now **measured and generated**
(calibration), applied in shared code, and followed by a reviewer-model stage. This is not a
blanket 95 % certificate: read the status below.

## Non-negotiable constraints (unchanged)

Fix the reusable library, never one deck: no branches on a client title, slide number or deck
id; Digital Ruble is an integration example. Preserve wording, numbers, punctuation and notes.
Keep text, lines, shapes and diagrams editable; never flatten slides or return a renamed
original. Diagnose unsupported effects instead of dropping them. Keep content, exhibit
selection, themes, composition and backends separate. Never overwrite a frozen baseline,
weaken the metric or bless goldens to pass. Architecture diagrams are in English.

## Where things are

| Concern | Where |
|---|---|
| PowerPoint text rules (data) | `src/engine/office-rules.gen.ts` — generated, do not edit by hand |
| Rules explained, with evidence | `docs/explanation/office-rendering-rules.md`, `calibration/RULES.md` |
| Advances, draw size, baselines, spacing, breaks, balanced titles | `src/engine/fonts.ts`, `src/engine/text.ts`, `src/engine/context.ts` |
| Office font lookup | `src/engine/system-fonts.ts` |
| PPTX export details (end mark, crisp lines, flips, spacing as multiples) | `src/backends/pptxgenjs.ts` |
| HTML/SVG glyph placement, local() fonts, slide numbers | `src/backends/svg.ts`, `src/backends/html.ts` |
| Office conversion (sandbox, recovery) | `src/backends/pptx-convert.ts` |
| Calibration mode | `scripts/calibrate.ts`, `calibration/corpus.json`, `calibration/REPORT.md` |
| Final visual QA, user report, review log | `src/qa/visual-qa.ts`, `src/qa/review-log.ts`, `src/qa/raster.ts`, `library/references/visual-qa.md`, `agents/visual-reviewer.md`, `skills/visual-qa/` |
| Orchestration templates and a full run | `examples/orchestration/` |
| Integration corpus | `tests/fixtures/digital-ruble/`, `npm run test:digital-ruble` |

## Status (fresh runs, PowerPoint for Mac 16.113.4)

- Digital Ruble: text, notes and native objects 22/22; **original ↔ rebuilt editable PPTX
  ≥ 95 % on 22/22 pages** (98.5–99.8 %); original ↔ HTML 88.9–97.0 % (was 69–86 %).
- Calibration probe (~2 200 lines): baselines 0.064–0.066 pt mean for automatic and generated
  spacing, word positions 0.09 pt, drawn sizes exact.
- Corpus of 10 decks: rebuild gate 22/22; nine generated decks mean 89.2 % per page under the
  strict metric (was 78.6 % at the first corpus run).
- Visual QA run on the pitch-deck example found and fixed two shared defects (hyphen breaks,
  reversed arrow flips) and two content issues; see `examples/orchestration/run/`.

## Next work, in priority order

1. **Native chart text.** Axis and data labels are placed by PowerPoint's chart engine ~1 px
   from the Scene primitives. Add chart probes to calibration and model label placement.
2. **Authored exact spacing in imported decks.** Typo-ascent model leaves ±1 pt on some lines;
   probe more (size, pitch) pairs and look for PowerPoint's quantisation rule.
3. **Sub-pixel glyph edges.** Chrome and PowerPoint PDFs differ by ~0.1 pt in glyph origins
   (PowerPoint's 1/300-inch PDF grid). Decide, with human-reviewed examples, whether the
   metric should be calibrated perceptually; never change it silently (see below).
4. **Balance more headings** (panel headings, takeaways) once checked against PowerPoint.
5. Keep running `visual-qa` on the examples; turn every recurring finding into a rule + test.

## Validating "95 %" honestly

Per page, the worst of 16 regions (RGB and edge detail) must reach 0.95 for each required pair.
Do not average pages, align or blur images, or relax the threshold. A metric change needs a
documented rationale, human-reviewed examples and deliberate regressions (removed frame parts,
1–2 pt shifts, wrong wraps, colours, borders), with old and new results side by side. Never set
`visualReview`/`visual_review` true because a script finished.

## Known traps

- Re-exporting to an existing PDF path could return a stale PowerPoint PDF — conversions use a
  fresh job folder inside PowerPoint's sandbox container.
- A modal dialog makes PowerPoint answer `-1712`; unattended runs set
  `SLIDECRAFT_OFFICE_RECOVER=1`. Do not kill a user's PowerPoint by default.
- PptxGenJS shape margins are `[left, right, bottom, top]`; table margins `[top, right, bottom, left]`.
- `kern="0"` disables kerning; the backend writes 100 (on) or 400000 (off).
- Calibration probes must use the backend's own export (paragraph marks with the run font),
  or the measured rules are contaminated by the theme font.
- `tmp/` and `docs/gallery/*--*.png` hold unrelated local files; do not commit them.

## Commands

```sh
npm ci && npm run check && npm run gen && npm run build
npm run test:digital-ruble                      # exits 1 while any slide misses a gate
npm run calibrate -- --stage probe [--write]    # rules (10 min)
npm run calibrate -- --stage corpus             # 10-deck gate (10 min)
slidecraft visual-qa <deck.yaml> --json         # final review pack
bash examples/orchestration/run/reproduce.sh    # example run in every format
npm run comparison                              # references vs results → comparison/index.html
```
