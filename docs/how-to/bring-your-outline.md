# Bring your own outline

> **Audience:** people who already know what each slide should say · **Last reviewed:** 2026-10-10

If you have an outline, notes or an old deck's text, give it to the plugin:

```text
/slidecraft:new Use the outline in notes/q3-outline.md for our Q3 steering committee
```

The orchestrator puts the file under `materials:` in the brief. The deck-strategist then maps each outline point to a storyline slot and an exhibit (`exhibit-chooser`), turns headings into **action titles**, and shows you the title chain at checkpoint 3 — so you see where your outline was restructured and why.

Tips:
- One outline bullet ≈ one slide. Mark the claim and the evidence: `Claim: … / Data: …`.
- Put numbers in Markdown tables; they become charts or tables with sources.
- If you want your order kept exactly, say so — SlideCraft will keep it and only flag gaps (missing answer up front, missing ask).

Without an agent: write `deck.yaml` directly ([CLI tutorial](../tutorials/cli-without-agent.md)).
