# Example library

> **Audience:** anyone deciding what SlideCraft can do for their next deck · **Last reviewed:** 2026-10-11

Six complete decks, each built by SlideCraft from the `deck.yaml` next to it. Open the PDF to see the result, or open the PowerPoint to see how editable it is. Then copy the folder that is closest to your task and change the words.

The figures in the examples are fictional or illustrative, and labelled so on the slides. The SlideCraft overview is the exception: its numbers are facts about the product.

| | Example | Task | Look | Slides | Get it |
|---|---|---|---|---|---|
| <img src="https://eiler2005.github.io/slidecraft/examples/slidecraft-overview/cover.png" width="180" alt="Cover of the SlideCraft overview deck"> | **[SlideCraft overview](../examples/slidecraft-overview/deck.yaml)**<br>What SlideCraft does and how it helps — made with SlideCraft | Product overview | Consulting Classic | 12 | [PDF](showcase/slidecraft-overview.pdf) · [PowerPoint](showcase/slidecraft-overview.pptx) · [one-pager](showcase/slidecraft-overview-onepager.pdf) |
| <img src="https://eiler2005.github.io/slidecraft/examples/strategy-recommendation/cover.png" width="180" alt="Cover of the Germany market-entry deck"> | **[Germany market entry](../examples/strategy-recommendation/deck.yaml)**<br>A board recommendation: answer first, three reasons, plan, risks, the ask | Strategy recommendation | Consulting Classic | 11 | [PDF](https://eiler2005.github.io/slidecraft/examples/strategy-recommendation/northwind-germany.pdf) · [PowerPoint](https://eiler2005.github.io/slidecraft/examples/strategy-recommendation/northwind-germany.pptx) |
| <img src="https://eiler2005.github.io/slidecraft/examples/executive-update/cover.png" width="180" alt="Cover of the steering committee update"> | **[ERP steering committee](../examples/executive-update/deck.yaml)**<br>Status against plan, what slipped, two decisions needed | Executive update | Executive | 6 | [PDF](https://eiler2005.github.io/slidecraft/examples/executive-update/contoso-q3-steerco.pdf) · [PowerPoint](https://eiler2005.github.io/slidecraft/examples/executive-update/contoso-q3-steerco.pptx) |
| <img src="https://eiler2005.github.io/slidecraft/examples/pitch-deck/cover.png" width="180" alt="Cover of the seed pitch deck"> | **[Freight start-up seed round](../examples/pitch-deck/deck.yaml)**<br>Problem, solution, market, traction, competition, team, the ask | Pitch deck | Modern Pitch | 10 | [PDF](https://eiler2005.github.io/slidecraft/examples/pitch-deck/fabrikam-seed.pdf) · [PowerPoint](https://eiler2005.github.io/slidecraft/examples/pitch-deck/fabrikam-seed.pptx) |
| <img src="https://eiler2005.github.io/slidecraft/examples/narrative-story/cover.png" width="180" alt="Cover of the finance story talk"> | **[A finance team's story](../examples/narrative-story/deck.yaml)**<br>A talk with a hook, a turning point and lessons — for a conference or an all-hands | Narrative story | Midnight | 10 | [PDF](https://eiler2005.github.io/slidecraft/examples/narrative-story/close-in-a-morning.pdf) · [HTML deck](https://eiler2005.github.io/slidecraft/examples/narrative-story/close-in-a-morning.html) |
| <img src="https://eiler2005.github.io/slidecraft/examples/europe-first-trip/cover.png" width="180" alt="Cover of the European cities guide"> | **[First trip to Europe](../examples/europe-first-trip/deck.yaml)**<br>A short, friendly recommendation with a 2×2, ratings and a budget chart | Recommendation, small | Editorial | 5 | [PDF](https://eiler2005.github.io/slidecraft/examples/europe-first-trip/europe-first-trip.pdf) · [PowerPoint](https://eiler2005.github.io/slidecraft/examples/europe-first-trip/europe-first-trip.pptx) |

Every example is also a one-pager and a Word memo on the [gallery site](https://eiler2005.github.io/slidecraft/#examples).

## Start from an example

Ask your assistant: *"Use examples/executive-update as the starting point for my Q4 steering committee. Here are my numbers…"*

Or by hand:

```sh
cp -r examples/executive-update slidecraft/q4-steerco
# edit slidecraft/q4-steerco/deck.yaml — titles first, then the numbers and sources
node dist/slidecraft.mjs build slidecraft/q4-steerco/deck.yaml
```

## What each example shows

- **SlideCraft overview** — the full method on one product: problem, answer-first summary, how it works, before/after, audiences, a lookup table, KPI tiles and an evidence chain.
- **Germany market entry** — the classic consulting recommendation, with a waterfall bridge, options on shared criteria, a gantt plan and a claim ledger ([`claims.md`](../examples/strategy-recommendation/claims.md)) that traces every number.
- **ERP steering committee** — a short status deck. Plan against actual on one time axis, and the decisions on the last page.
- **Seed pitch** — story-driven, but still one claim per slide. Shows the 2×2 competition map and the unit economics.
- **Finance story** — a keynote-style talk in a dark theme with pictures, a quote and a hero number. Built to be presented from the browser.
- **First trip to Europe** — five slides, made in a live end-to-end run. A good template for a quick recommendation to a non-business audience.
