---
name: storyline-architect
description: Build the argument of a deck before any slide exists — governing thought, Situation-Complication-Resolution, a MECE key line and the evidence each point needs — using the Pyramid Principle. Use when shaping or fixing the storyline of a presentation, memo or pitch.
---

# Storyline architect

The storyline is the deck. Slides only prove it. Full method: `${CLAUDE_PLUGIN_ROOT}/library/references/writing-standard.md` (pyramid, SCR, MECE) and, for talks, `storytelling.md`.

## Method

1. **Question.** Write the one question the audience needs answered ("Should we enter Germany, and how?"). If you cannot, ask the user.
2. **Governing thought.** Answer it in one sentence a board member could repeat. It becomes the cover title and the summary resolution.
3. **SCR.** Situation (what they already accept), Complication (what changed / why now), Resolution (the governing thought). Keep each to one or two sentences.
4. **Key line.** 2–4 reasons or steps that together prove the governing thought. Test MECE: no overlaps, nothing missing for a sceptic. Prefer reasons ("why") for decisions and steps ("how") for plans.
5. **Evidence.** For each key-line point list the exhibits and data needed; mark what you have, what is assumed, what is unknown. Unknowns become questions to the user, not invented numbers.
6. **Map to the storyline template.** Fit the key line into the chosen storyline's sections and slots (`sc storylines --json`). Drop optional slots that add nothing; repeat evidence slots as needed.
7. **Title chain.** Write the action title for every slide (see `action-title-writer`). Read them top to bottom: they must argue the whole case.

## Output — `storyline.md`

```
# <governing thought>
Question: …
Situation: … / Complication: … / Resolution: …
Key line:
1. <reason> — evidence: … (have / assumed / missing)
2. …
Title chain:
01 <cover title>
02 <summary title>
…
Open questions for the user: …
```

For storytelling decks replace SCR with hook → stakes → journey → turning point → insight → call to action, keeping one idea the audience should remember.
