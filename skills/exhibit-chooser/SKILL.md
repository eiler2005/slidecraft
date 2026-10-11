---
name: exhibit-chooser
description: Choose the right exhibit (SlideCraft layout and variant) for a slide's message — comparison, trend, bridge, prioritisation, options, timeline, single number, quote. Use when deciding how to show a point on a slide.
---

# Exhibit chooser

Pick the exhibit from the **relationship** the title claims, not from the data you happen to have. Full guide with mistakes to avoid: `${CLAUDE_PLUGIN_ROOT}/library/references/exhibit-selection.md`. Contracts: `sc layouts --json` (`sc` = `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"`).

| The title claims… | Layout · variant |
|---|---|
| A ranking or comparison of items | `chart-takeaway` · bar (sorted, insight highlighted) |
| A change over time | `chart-takeaway` · column (few periods) or line (many) |
| Composition / mix | `chart-takeaway` · stacked |
| How we get from A to B (bridge, variance) | `waterfall` · full / with-takeaway |
| 2–4 headline numbers | `kpi-tiles` · tiles / strip |
| One number that changes the room | `big-statement` · hero-number |
| Options judged on the same criteria | `options-comparison` · text / rating |
| Prioritisation on two dimensions | `matrix-2x2` · plot / quadrants |
| Exact values people will look up | `data-table` · plain / with-takeaway |
| Steps in order, no dates | `process-steps` · chevrons / numbered |
| Dated milestones or a roadmap | `timeline` · milestones / gantt |
| 2–4 parallel points | `key-points` · columns / cards / list |
| The whole argument on one page | `exec-summary` · scr / key-messages |
| A memorable sentence or a voice | `big-statement` · statement / quote |
| A moment, a place, a product | `text-image` · image-right / image-left |
| Who does it | `team-cards` · cards / compact |
| What we ask and what happens next | `next-steps` · decision / actions |
| Where we are in the deck | `agenda` · agenda / section-divider |
| A problem broken into causes / hypotheses | `issue-tree` · issue |
| A metric broken into drivers | `issue-tree` · driver |
| Where volume is lost / levels that build | `funnel` · funnel / pyramid |
| Who decides what | `raci` |
| Stages and the evidence that opens the next | `gate-matrix` |
| How a process changes | `process-compare` |
| Risks by likelihood and impact | `risk-matrix` |
| Today vs target level on a maturity scale | `maturity-model` · grid / staircase |
| The state of many functions on one map | `coverage-map` |
| A change told as two states | `before-after` · panels |
| Who reports to whom | `org-chart` · tree |
| Where in a system a problem sits, with a numbered register | `architecture` · zones |
| What the answer rests on: checks, sources, results | `evidence-chain` |
| Who meets or decides when | `cadence` |
| Where to click or look, what to expect, how to check | `callout` |
| Items on two measured axes (bubble size for a third) | `bubble-chart` · scatter / bubble |
| A portfolio by growth and share, with quadrant names | `bubble-chart` · portfolio |
| Segment size × share of each player | `marimekko` |
| Which assumptions move the result most | `tornado` |
| Value ranges by method vs an offer or bid | `football-field` |
| Strengths, weaknesses, opportunities, threats and the so-what | `swot` · grid / with-implications |
| Industry attractiveness | `five-forces` |
| Macro trends with their impact | `pestel` |
| The business model on one page | `business-model-canvas` |
| A bespoke visual no layout covers (story decks; a picture in PPTX) | `freeform` |
| Text that is genuinely text (definitions, scope in/out) | `text` · bullets / paragraphs / two-column |

Rules: one message per slide; highlight only the insight (`highlight`); every number sourced; if the data cannot prove the title, change the title or flag the gap — never stretch the chart.
