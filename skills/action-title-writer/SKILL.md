---
name: action-title-writer
description: Rewrites slide headlines into single-sentence action titles that state the so-what, so the deck reads as an argument when skimmed by titles alone.
---

# Action Title Writer

## When to use
Use this when a slide carries a topic label ("Revenue overview", "Market trends") instead of a conclusion. Use it before any partner or client review, because the first thing a senior reader does is read titles top to bottom. Use it when someone says the deck "does not tell a story" even though every slide is individually fine.

## What it does
It converts each slide headline into an action title: one complete sentence that states the single most important takeaway of that slide. Read in sequence, the action titles form the spine of the argument. The body of the slide then only has to prove the title.

## Method
Action titles follow the Pyramid Principle convention that the title is the answer, and the body is the support. Run this method per slide.

1. Find the one message. Ask: if the reader saw only this slide for five seconds, what is the single thing they must take away? Force exactly one idea. If two ideas compete, the slide should be split.

2. State it as a claim, not a topic. A topic names a subject ("Customer churn"). A claim makes an assertion that could be argued ("Churn is concentrated in the first 90 days, where onboarding fails"). Always write the claim.

3. Make it a full sentence with a verb. No fragments. The verb carries the so-what. Prefer verbs of movement and consequence: drives, erodes, concentrates, doubles, shifts, depends on, fails to.

4. Quantify when the body supports it. If the slide shows a number, the title should carry the headline number ("Top 3 segments hold 78 percent of profit"). Never invent a number that is not on the slide. If the slide has no number, keep the title qualitative.

5. Keep it to one line. Aim for 8 to 14 words, under roughly 90 characters, so it fits on one line at title size. If it runs two lines, cut adjectives and hedge words first.

6. Cut hedges and filler. Remove "various", "several", "key", "in order to", "it is important to note". Remove "we believe" unless the uncertainty is the point.

7. Test the title chain. Lay the titles end to end and read them as a paragraph. They should argue a case: situation, complication, resolution, supporting points, recommendation. If a title does not advance the argument, the slide may not belong.

8. Match the title to the body. The body must prove exactly what the title claims. If the chart shows trend but the title claims causation, either soften the title or add the evidence.

## Inputs
- The current slide titles, or the slide content if titles do not exist yet.
- The overall recommendation the deck is making, so titles can be checked against the spine.
- Any headline numbers already present on each slide.

## Output format
Return a two-column list: the original title, then the rewritten action title. After the list, print the full action-title chain as a single paragraph so the reader can sense-check the storyline. Flag any slide whose title cannot be supported by its current body, and say what evidence is missing.

## Example
Input title: "Pricing analysis"
Slide body: a chart showing competitor prices 12 to 18 percent above ours across three tiers.

Output action title: "We price 12 to 18 percent below competitors in every tier, leaving margin on the table."

Chain check: the prior slide claims demand is inelastic in the mid tier, this slide claims we underprice, the next slide claims a targeted increase recovers 4 points of margin. The three titles argue a coherent case, so the sequence holds.

## In SlideCraft
- Titles live in `title:` on every slide of `deck.yaml`. The engine enforces at most two lines at the theme's title size (`SC-TITLE-001`), flags topic-like titles under five words (`SC-TITLE-002`) and trailing periods (`SC-TITLE-003`).
- Print the chain quickly: `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs" check <deck> --json` lists every slide; or read `title:` lines in order.
- Writing rules and examples: `${CLAUDE_PLUGIN_ROOT}/library/references/writing-standard.md`.
