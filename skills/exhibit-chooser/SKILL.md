---
name: exhibit-chooser
description: Choose the right exhibit (SlideCraft layout and variant) for a slide's message — comparison, trend, bridge, prioritisation, options, timeline, single number, quote. Use when deciding how to show a point on a slide.
---

# Exhibit chooser

Storyline chooses the deck's argument; theme chooses its look. They are independent: a storyline's recommended themes are not an allowlist. For a preserved client deck, keep its approved argument and wording.

Start with `sc exhibits --json`: semantic relationships route to the existing library. Use `sc components --json` for composable native body exhibits and their real schemas. Prefer a single complete layout; when one message needs several complementary exhibits, use `layout: composition` and `components: [{id, layout, variant, box: {x, y, w, h}, content}]`. Boxes are fractions of the available body. The shared frame owns title, sources, page number and `bottomLine`; components must not duplicate them. Extend the existing library with native primitives and tests when no contract fits.

Pick the exhibit from the **relationship** the title claims, not from the data you happen to have. Full guide with mistakes to avoid: `${CLAUDE_PLUGIN_ROOT}/library/references/exhibit-selection.md`. Contracts: `sc layouts --json` (`sc` = `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"`).

| The title claims… | Layout · variant |
|---|---|
| A ranking or comparison of items | `chart-takeaway` · bar (sorted, insight highlighted) |
| A change over time | `chart-takeaway` · column (few periods) or line (many) |
| A volume and a rate over the same periods | `chart-takeaway` · combo |
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
| Where value is made or lost along the business | `value-chain` |
| Organisation readiness for a change | `seven-s` |
| Macro trends with their impact | `pestel` |
| The business model on one page | `business-model-canvas` |
| One metric motivating four parallel explanations | `evidence-panorama` |
| Complementary existing exhibits supporting one message | `composition` |
| A bespoke visual no layout covers, with a native PPT equivalent | `freeform` (editable bridge required for unsupported CSS) |
| Text that is genuinely text (definitions, scope in/out) | `text` · bullets / paragraphs / two-column |

Rules: one message per slide; highlight only the insight (`highlight`); every number sourced; if the data cannot prove the title, change the title or flag the gap — never stretch the chart.

Native diagrams: use `sc layouts <id> --json` for heatmap, treemap, Sankey, fishbone, architecture-delta, swimlane, flowchart, sequence, state-machine, journey/blueprint and model contracts. Existing charts also offer dumbbell, slopegraph, bump, ridgeline, streamgraph and beeswarm. See `${CLAUDE_PLUGIN_ROOT}/library/references/diagram-patterns.md` for behavior-rich patterns. Keep graph connections, quantities and evidence distinct; Venn areas are qualitative and radar axes share one scale. Deck-level `readability: present` raises typography and can require fewer elements. Never flatten these exhibits to a picture for PowerPoint.
