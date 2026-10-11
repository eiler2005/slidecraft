# Orchestration plan

Generated from `orchestration.yaml`. Templates are in `../templates/`; a complete run is in `../run/`.

| # | Stage | Agent | Model | Template / hand-off | Outputs | Checkpoint |
|---|---|---|---|---|---|---|
| 1 | Brief | orchestrator | main | [01-brief.yaml](../templates/01-brief.yaml) | brief.yaml, output plan | CP1 — confirm the brief |
| 2 | Pick | orchestrator | main | [02-choice.yaml](../templates/02-choice.yaml) | picker.html, option-A.png, option-B.png, option-C.png, brief.yaml#choice | CP2 — choose storyline × theme |
| 3 | Storyline | deck-strategist | opus (claude-opus-5-5) | [03-storyline.md](../templates/03-storyline.md)<br>[03-deck-strategist.prompt.md](../templates/03-deck-strategist.prompt.md) | storyline.md | — |
| 4 | Ghost deck | deck-strategist | opus (claude-opus-5-5) | [04-ghost-deck.yaml](../templates/04-ghost-deck.yaml) | deck.yaml (ghost) | CP3 — approve the title chain |
| 5 | Build | slide-writer | sonnet (claude-sonnet-5-5) | [05-section.yaml](../templates/05-section.yaml)<br>[05-slide-writer.prompt.md](../templates/05-slide-writer.prompt.md) | sections/*.yaml, dist/*.pptx, dist/*.pdf, dist/*.html, dist/previews/*.png, dist/manifest.json | — |
| 6 | Review — checks, fit-fix, partner review | copy-fitter → partner-reviewer | haiku (claude-haiku-5-5) → opus (claude-opus-5-5) | [06-fixes.json](../templates/06-fixes.json)<br>[06-copy-fitter.prompt.md](../templates/06-copy-fitter.prompt.md) | fixed YAML, review notes, REVIEW-LOG.md | — |
| 7 | Visual QA — final reviewer model | visual-reviewer | opus (claude-opus-5-5) | [06b-visual-qa-findings.json](../templates/06b-visual-qa-findings.json)<br>[06b-visual-reviewer.prompt.md](../templates/06b-visual-reviewer.prompt.md) | dist/visual-qa/REPORT.md, dist/visual-qa/record.json, REVIEW-LOG.md | CP4 — accept, decide the items in "Needs your attention" |
| 8 | Deliver | orchestrator | main | [07-delivery.md](../templates/07-delivery.md) | message to the user with file paths | — |

## Policy

- **orchestrator** — main session — owns the conversation and every checkpoint; sub-agents never ask the user anything.
- **routing** — complex reasoning → opus; contract-bound writing → sonnet; mechanical edits → haiku.
- **parallelism** — sections may run in parallel; run them one after another when saving tokens matters (same result).
- **fixes** — recurring defects go to shared code with a test; content fixes go to YAML; generated files are never edited.
- **logging** — every check-stage change is appended to review-log.jsonl / REVIEW-LOG.md next to deck.yaml.

## Commands per stage

- Brief: `sc new "<goal>" --audience "<who>"`, `sc templates --brief <brief> --json`
- Pick: `sc pick --brief <brief> --json`, `sc choose --brief <brief> --option A`
- Ghost deck: `sc scaffold --brief <brief> --force`, `sc validate <deck>`
- Build: `sc layouts <layout> --json`, `sc build <deck> --json`
- Review — checks, fit-fix, partner review: `sc check <deck> --json`, `sc fix <deck> --json`, `sc fix <deck> --apply fixes.json`
- Visual QA — final reviewer model: `sc visual-qa <deck> --json`, `sc visual-qa <deck> --record findings.json`
