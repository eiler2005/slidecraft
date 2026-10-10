> **Audience:** deck authors and agents choosing how to show a point · **Used by:** exhibit-chooser, deck-spec, partner-review-checklist · **Last reviewed:** 2026-10-10

# Exhibit selection: message → exhibit

Start from the sentence in the title. Identify the **relationship** it claims, then choose the exhibit that shows that relationship most directly. The data you have does not decide the exhibit; the claim does.

## Decision table

| Relationship the title claims | Use (layout · variant) | Not when | Common mistake |
|---|---|---|---|
| **Ranking / comparison** of items | `chart-takeaway` · bar | Fewer than 3 items → `kpi-tiles` | Unsorted bars; highlighting every bar |
| **Trend over time** | `chart-takeaway` · column (≤ 8 periods), line (more) | One before/after pair → `kpi-tiles` with delta | Mixing periods of different length |
| **Composition / mix** | `chart-takeaway` · stacked | More than 4 segments → table | Pie charts with many slices |
| **Bridge / variance** (from A to B) | `waterfall` · full / with-takeaway | No start and end totals → bar chart of drivers | Steps that do not add up |
| **A few headline numbers** | `kpi-tiles` · tiles / strip | Numbers with different periods side by side unlabeled | Five tiles: pick the 2–4 that matter |
| **One number that changes the room** | `big-statement` · hero-number | Several equally important numbers | Using it every other slide |
| **Options on the same criteria** | `options-comparison` · text / rating | Options judged on different criteria (fix the criteria first) | Omitting "do nothing" |
| **Prioritisation on two dimensions** | `matrix-2x2` · plot / quadrants | Only one dimension matters → sorted bar | Unlabelled axes, axes without low/high |
| **Exact values to look up** | `data-table` · plain / with-takeaway | Readers should see a pattern → chart | 15-row tables in the main deck |
| **Steps in order** (method, process) | `process-steps` · chevrons / numbered | Steps have dates → `timeline` gantt | Steps that are really parallel workstreams |
| **Dated milestones, roadmap** | `timeline` · milestones / gantt | No dates yet → `process-steps` | Plan and forecast on different axes |
| **Parallel points** (reasons, lessons) | `key-points` · columns / cards / list | Points are sequential → `process-steps` | Points that overlap (not MECE) |
| **The whole argument** | `exec-summary` · scr / key-messages | — | Listing topics instead of conclusions |
| **A voice or a memorable line** | `big-statement` · quote / statement | Quote that does not support the title | Unattributed quotes |
| **A moment, a place, a product** | `text-image` · image-right / image-left | Image is decoration only | Text that just describes the picture |
| **Who** (team, owners) | `team-cards` · cards / compact | Responsibilities matter more than people → table | Bios longer than two lines |
| **The decision and next steps** | `next-steps` · decision / actions | — | Actions without owners or dates |
| **Navigation** | `agenda` · agenda / section-divider | Decks under ~10 slides | Agendas that list generic topics |
| **Problem structure / root causes** | `issue-tree` · issue | A sequence → `process-steps` | Branches that overlap (not MECE) |
| **Metric decomposition** | `issue-tree` · driver | A bridge over time → `waterfall` | Drivers that do not multiply/add to the root |
| **Where volume is lost** | `funnel` · funnel | Stages that do not narrow → bar chart | Missing conversion rates |
| **Levels that build on each other** | `funnel` · pyramid | Unordered items → `key-points` | Pyramids where order is arbitrary |
| **Decision rights** | `raci` | Who is on the team → `team-cards` | More than one A per row |
| **Stage-gate plan** | `gate-matrix` | Dates matter most → `timeline` | Gates without evidence or a decider |
| **What changes in a process** | `process-compare` | No comparison → `process-steps` | Unchanged steps highlighted |
| **Risks by likelihood × impact** | `risk-matrix` | Risks without assessment → `data-table` | No owners or mitigations |

## Relationship patterns in detail

**Comparison.** Same unit, same period, same base for every item. Sort descending; highlight the item the title names. If the title says "A is twice B", the chart must make that visible (same axis, zero baseline).

**Trend.** Equal time intervals. Mark the event the title refers to (a launch, a price change) in the takeaway or with a highlighted period. Do not imply causation from a trend alone.

**Bridge.** Start total, drivers (positive and negative), end total. Group small drivers into "Other" rather than showing ten slivers. Label deltas with signs (+4, −9).

**Options.** Criteria first, agreed with the audience if possible; identical criteria for every option; show what is unknown as "unknown", not as a guess. The recommendation is conditional when the data is: "Option B, if partner terms hold".

**Prioritisation.** Define both axes in words the audience uses; name the quadrants with the action each implies ("quick wins", "deprioritise"). Item positions must come from a scoring, not from intuition — cite it.

**Plan and status.** Plan, actual and forecast share one time axis so slippage is visible. Gates sit on stage boundaries and name the evidence needed to pass.

**Ownership.** Who decides, who does, who is consulted — with the boundary of each role. A RACI table beats an org chart when the question is accountability.

## When the data cannot prove the title

Change the title to what the data does prove, or flag the gap: `ghost.data: "Needs churn by cohort — not available"`. Never stretch an exhibit to fit a claim.
