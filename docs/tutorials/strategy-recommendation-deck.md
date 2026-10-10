# A strategy recommendation, the consulting way

> **Audience:** anyone preparing a decision deck for a board or executive team · **Prerequisites:** [first deck](first-deck-in-10-minutes.md) · **Last reviewed:** 2026-10-10

We rebuild the example in [`examples/strategy-recommendation/`](../../examples/strategy-recommendation/) — Northwind (fictional) asks its board to approve a partner-led entry into Germany — and explain each decision.

## 1. The brief: decision, audience, worry

```yaml
goal: The board approves a partner-led entry into the German mid-market and a €6M phase-1 budget.
ask: Approve the €6M phase-1 budget and the partner shortlist at the 14 November board meeting
audience:
  who: Northwind board of directors
  knows: The UK business is profitable and growing 18% a year
  cares: Capital at risk, distraction from the UK core, and how quickly a bad bet can be stopped
usage: [edit-together, send-pdf]
```

`cares` matters most: the deck must answer *risk* and *reversibility*, not only *upside*. `send-pdf` makes SlideCraft recommend a PowerPoint-rendered PDF.

## 2. The storyline: answer first

The `strategy-recommendation` storyline is SCR → answer → three reasons → plan → risks → ask. The governing thought — "Entering Germany now captures a €40M window before two rivals scale" — goes on slide 2 so a board member who reads only that page can decide.

The key line has to be MECE: *why now* (market window), *why this way* (partner-led beats build and buy), *why it is worth it* (value), then *how* (plan, risks). Each reason gets its own slide with its own evidence.

## 3. The title chain (checkpoint 3)

```
01 Entering the German mid-market can add €40M revenue by 2028
02 Entering Germany now captures a €40M window before two rivals scale
03 The UK business is profitable, growing and ready to fund a second market
04 The German mid-market is three times our UK base and still under-served
05 A partner-led entry beats direct build and acquisition on speed and risk
06 Partners cut time to first revenue from 18 to 7 months
07 Germany adds €40M by 2028 on top of a growing UK base
08 Localisation is the critical path; direct sales scale only after Gate 2
09 Three risks matter most, and each has an owner and an early signal
10 Decision today: approve phase 1 so partners can be signed by January
```

Read it aloud: it argues the whole case. Each title carries its number; each will be proved by one exhibit.

## 4. Exhibits that prove each title

| Slide | Claim | Exhibit | Why |
|---|---|---|---|
| 03 | Ready to fund | `kpi-tiles` | Four agreed numbers; free cash flow highlighted because it answers "can we afford it" |
| 04 | Three times the base | `chart-takeaway` · column | Comparison of markets; Germany highlighted |
| 05 | Partner-led wins | `options-comparison` · text | Same criteria for every option; recommended column tinted; verdict band |
| 06 | 18 → 7 months | `chart-takeaway` · bar | Sorted comparison; the answer highlighted |
| 07 | +€40M | `waterfall` · with-takeaway | A bridge from today to target; the numbers add up (42 + 31 + 28 + 12 + 4 − 9 = 108) |
| 08 | Critical path | `timeline` · gantt | Workstreams on one axis with gates; today marker |
| 10 | Decision | `next-steps` · decision | The ask, owners and dates |

## 5. Build, check, review

```sh
node dist/slidecraft.mjs check examples/strategy-recommendation/deck.yaml   # 0 diagnostics
node dist/slidecraft.mjs build examples/strategy-recommendation/deck.yaml --pdf-engine pptx-convert
```

Every number cites a source id; the sources are marked `illustrative: true`, so every source line starts with "Illustrative data." — honest about what the reader sees.

## What to take away

- The brief's *cares* shapes the storyline as much as the goal.
- The title chain is the deck; exhibits only prove it.
- Same criteria for every option, numbers that add up, a source for every figure, and an explicit ask.
