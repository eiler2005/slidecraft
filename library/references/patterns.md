> **Audience:** storyline and layout contributors · **Used by:** storyline-architect, exhibit-chooser · **Last reviewed:** 2026-10-10

# Management and visual patterns

Two independent catalogues. A **management pattern (M)** is the decision a material supports — the reader's question and the inputs needed to answer it. A **visual pattern (V)** is the relationship an exhibit shows. Choose the M first, then the V that makes its answer visible, then the layout that renders it, then the theme. Keeping them separate is what lets one storyline work in any look and one layout serve many decisions.

## Management patterns

| Id | Pattern | Reader's question | Required inputs | SlideCraft today |
|---|---|---|---|---|
| M01 | Initiative charter and problem understanding | Which problem and boundaries do we agree on? | Goal, scenarios, scope, what is confirmed vs unknown | `key-points` (list), `data-table`; storyline `client-proposal` |
| M02 | Executive summary | What must I understand or decide? | Conclusion, reasons, consequences, decision | `exec-summary` (scr, key-messages) |
| M03 | Status: plan, actual, forecast | What changed and what intervention is needed? | Cut-off date, baseline plan, actual, forecast, decision | `kpi-tiles`, `timeline` (gantt); storyline `executive-update` |
| M04 | Stage readiness and gates | On what evidence does the next stage open? | Stage output, condition, evidence, deciding role | `gate-matrix` |
| M05 | Options and conditional recommendation | How do we choose under known constraints? | Options, shared criteria, unknowns, decision rule | `options-comparison` (text, rating) |
| M06 | Pilot and value case | What will we test and how do we measure value? | Hypothesis, baseline, metric, measurement method | `kpi-tiles`, `waterfall`, `before-after`, `issue-tree` (driver) |
| M07 | Acceptance and launch decision | What proves quality and what authorises launch? | Scenarios, criteria with status, test results, deciding role | `data-table`, `next-steps` (decision) |
| M08 | Roadmap, dependencies and escalation | When is the result available and what blocks it? | Work items, dependencies, milestones, plan and forecast | `timeline` (gantt, milestones) |
| M09 | Accountability and decision rights | Who decides, on what basis, within which limits? | Components or roles, boundaries, grounds, deciding role | `raci` |
| M10 | Decomposition, priorities and cadence | How do levels of work connect to decision horizons? | Levels, definitions, horizons, roles, outputs | `maturity-model` (staircase), `funnel` (pyramid), `org-chart`, `data-table` |

## Visual patterns

| Id | Pattern | Question it answers | Inputs | SlideCraft today |
|---|---|---|---|---|
| V01 | Summary → reasons → decision | Which decision, and why now? | Conclusion, reasons, consequences, decision | Implemented via `exec-summary` |
| V02 | Stages and gate matrix | What opens the next stage? | Stages, outputs, conditions, evidence, role | Implemented via `gate-matrix` |
| V03 | Status on a date with a shared calendar | What is the forecast and what needs intervention? | Cut-off, baseline, forecast, risk, decision | Implemented via `timeline` (gantt, `today`) + `kpi-tiles` |
| V04 | Comparable criteria × options | How do the options differ? | Options, shared criteria, values, unknowns | Implemented via `options-comparison` |
| V05 | Current vs proposed process | What changes in the work? | Shared outcome, comparable steps, roles, changed action | Implemented via `process-compare` |
| V06 | Architecture with a linked register | Where is the problem and which control is needed? | Components, boundaries, request/response, ids, actions | Implemented via `architecture` |
| V07 | Work and milestones on one time axis | When does the result become available? | Work items, milestones, plan, forecast, result | Implemented via `timeline` |
| V08 | Evidence chain | What is the answer based on? | Condition, source, check, result, exception | Implemented via `evidence-chain` |
| V09 | Value drivers and metrics | How does an action become measurable value? | Action, result, baseline, metric, measurement | Implemented via `issue-tree` (driver) and `waterfall` |
| V10 | Hierarchy, meaning and horizon | How do levels of work connect? | Levels, definitions, horizons, results, roles | Implemented via `maturity-model` (staircase), `funnel` (pyramid) and `org-chart` |
| V11 | Role calendar and cadence | Who takes part when, regularly? | Roles, cycles, scale, events, outputs | Implemented via `cadence` |
| V12 | Two conditions, four actions (2×2) | How do conditions change the preferred approach? | Axis definitions, categories, actions, choice rule | Implemented via `matrix-2x2` |
| V13 | Coverage map with stable geometry | Where did the state of the same functions change? | Stable objects and ids, snapshots, status definitions, evidence | Implemented via `coverage-map` |
| V14 | Diagnostic tree and next step | Which step follows from a yes, borderline or unknown answer? | Questions with criteria, labelled branches, actions, stop rule | Implemented via `issue-tree` (issue) |
| V15 | Action, callout and result check | How does the reader find the object, act and verify? | Steps, target object, role, expected result, check | Partly via `text-image` + `process-steps`; backlog (M4) |

## Rules that travel with every pattern

- Compare with identical criteria, rows, axes or ids. A shared key is what makes two exhibits comparable.
- In a process, label both the action and its result. In an architecture, distinguish the request from the data returned.
- Gates sit on stage boundaries and are tied to a check, evidence and a deciding role. Acceptance criteria, definitions of ready and done have agreed scopes; they are not an automatic cumulative ladder.
- Circle size, area and bar length need an explainable quantity.
- Decorative panels never replace a shared axis, aligned rows or a linked register.
- Split a material when cells turn into essays or text falls below the format's minimum size.

## Further reading (public sources reviewed for these patterns)

- McKinsey — *Seizing the agentic AI advantage*, exhibits 3–4: https://www.mckinsey.com/capabilities/quantumblack/our-insights/seizing-the-agentic-ai-advantage
- Bain — *Technology Report 2025* (figures on pp. 28, 29, 68, 72): https://www.bain.com/globalassets/noindex/2025/bain_report_technology_report_2025.pdf
- BCG — *Building Enterprise AI Agents in Regulated Industries*, exhibit 3: https://www.bcg.com/publications/2026/building-enterprise-ai-agents-in-regulated-industries
- Accenture — *Beyond the Hype*, figure 2: https://www.accenture.com/en/blogs/ai-data/beyond-hype-why-agentic-ai-closer-than-you-think
- *The Scrum Guide 2020*, Definition of Done: https://scrumguides.org/scrum-guide.html

These sources were studied for exhibit mechanics (shared axes, gate placement, status on one calendar), not copied; no visuals or text are reproduced.

Adapted from the author's earlier internal methodology (client-ai-agents) — generalised and translated.
