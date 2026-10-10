> **Audience:** deck authors, storyline architects, reviewers · **Used by:** storyline-architect, action-title-writer, ghost-deck-skeleton, partner-review-checklist, deck-spec · **Last reviewed:** 2026-10-10

# Writing standard

How a SlideCraft deck argues. Layout and colour come later; if the words do not carry a decision, no exhibit will rescue the slide.

## 1. Answer first: the Pyramid Principle

State the answer, then the reasons, then the evidence. The reader should be able to stop at any level and still hold a correct, shorter version of the argument.

| Level | What it is | Where it lives |
|---|---|---|
| Governing thought | The one answer to the audience's question, with its condition | Executive summary, closing slide |
| Key lines | 2–5 reasons that together prove the governing thought | Section titles, summary messages |
| Evidence | Facts, analyses, examples under each key line | Slide bodies, exhibits, backup |

**Governing thought test.** It is one sentence, it answers a question the audience actually asked, it can be disagreed with, and it names an action or a choice ("Approve a 12-week pilot in two regions before committing to a national rollout"). "We analysed the options" is a topic, not a governing thought.

**Grouping rules.**
- Reasons under one parent are the same kind of thing (all causes, all steps, all options).
- Reasons are MECE: mutually exclusive (no overlap) and collectively exhaustive (nothing the argument needs is missing). Test by asking "could one fact belong in two boxes?" and "what would a sceptic add?".
- Order reasons by a stated logic: importance, time, structure, or degree. Never "as they came to mind".
- Two to five reasons per parent. Seven bullets are a list, not an argument; find the grouping.

## 2. Situation, Complication, Resolution (SCR / SCQA)

Use SCR to open a deck or an executive summary when the audience needs context before the answer.

| Part | Job | Test |
|---|---|---|
| Situation | What the audience already accepts as true | Nobody in the room would argue |
| Complication | What changed, or what is at risk, so that the situation is no longer enough | It creates the need to act now |
| (Question) | The question the complication raises (SCQA makes this explicit) | The answer below answers exactly this |
| Resolution | The answer: your governing thought | It resolves the complication, not a neighbouring problem |

If the audience already knows the context and wants the answer, lead with the resolution and keep S and C to one line each. In SlideCraft, `exec-summary` (variant `scr`) is this structure; variant `key-messages` is the pyramid's second level.

## 3. One message per slide

A slide has one title, the title is one claim, and everything on the slide proves that claim. If two claims compete, split the slide. If a slide proves nothing the argument needs, move it to the appendix or delete it.

Split slides instead of shrinking text. A dense slide is a sign of two messages, not a reason for a smaller font.

## 4. Action titles

An action title is a full sentence, with a verb, that states the so-what. The body proves it. Aim for 8–14 words and one line; two lines is the hard ceiling. No trailing full stop.

| Topic label (weak) | Action title (strong) | Why it works |
|---|---|---|
| Market overview | The addressable market grows 9% a year, but only mid-market buyers are growing | Verb, number, contrast |
| Customer churn | Churn concentrates in the first 90 days, where onboarding fails | A claim someone could dispute |
| Pricing analysis | We price 12–18% below competitors in every tier, leaving margin unclaimed | Carries the headline number on the slide |
| Options | Option B reaches break-even a year earlier than A at similar risk | States the comparison result |
| Next steps | We need a decision on the data-access request by 31 October to hold the March launch | Names the decision, the date, the consequence |
| Risks | Two of five risks threaten the launch date; the rest can be absorbed | Prioritises instead of listing |

**Method.**
1. Ask: if the reader saw only this slide for five seconds, what single thing must they take away?
2. Write it as a claim, not a subject.
3. Use a verb of movement or consequence: drives, erodes, concentrates, doubles, depends on, fails to.
4. Put the headline number in the title only if it is on the slide. Never invent a number for a title.
5. Cut hedges and filler ("various", "key", "in order to", "it is important to note").
6. Check that the body proves exactly what the title claims. A trend chart does not prove causation; either soften the title or add the evidence.

**Titles that are not enough:** "Overview", "Background", "Update", "Discussion", "Summary of findings", any noun phrase without a verb.

## 5. The title-chain test

Read only the slide titles, in order, as a paragraph. It must work as the whole argument: situation, complication, answer, supporting reasons, ask. Check three things.
- **No gaps.** Each title follows from the previous one without a missing step.
- **No orphans.** A slide whose title advances nothing is cut or moved to backup.
- **No echoes.** Two titles saying the same thing mean one slide is redundant, or the message is not yet sharp.

Run the chain test before any design work (see the ghost-deck-skeleton skill). If the chain fails, fix the storyline, not the slides.

## 6. Management template versus visual relationship

Decide what the reader must understand or decide before deciding how it looks. Keep two choices separate.

- **Management template:** the question, the evidence needed, the deciding role, the output. Example: "Which option do we choose, and under which assumptions?"
- **Visual relationship:** the shape of the evidence. Example: same criteria in rows, options in columns.

The same template can need several slides; the same visual can serve different decisions. A completed diagram, a filled table or a green status mark does not mean a decision has been made. The catalogue of both is in [patterns.md](patterns.md); the mapping from relationship to layout is in [exhibit-selection.md](exhibit-selection.md).

If evidence is too thin to recommend, the honest output of the slide is a concrete question or a request for the missing evidence, and why a choice cannot be made without it. Never simulate a justified recommendation.

## 7. Fact, interpretation, proposal, unknown

Four kinds of statement look alike on a slide and must be told apart in words.

| Kind | Marker in text | Rule |
|---|---|---|
| Fact | Stated plainly, with source | Traceable to a document, dataset or measurement |
| Interpretation | "We read this as…", "This suggests…" | Names the evidence it rests on |
| Proposal | "We propose…", "Recommended:" | Does not become a requirement or an approved design until agreed |
| Unknown | "Not yet known: …", "To be confirmed by <role>" | Never rendered as zero, blank or a green tick |

An unconfirmed goal, boundary or scenario is shown as unconfirmed on its slide. A preliminary design is not an approved architecture. Completion of work, acceptance of a result and permission to launch are three different events.

## 8. Decisions and next steps

Every ask has: the subject, the limits of the permission, the deciding role, the owner of the next action, a date or trigger, and a verifiable output. "Investigate data" is not a next step; "Data owner supplies an agreed extract of 12 months of orders by 15 November" is.

Status slides separate plan (the approved baseline), actual, and forecast. A forecast is not a new commitment, and the baseline is not rewritten to make a variance disappear. A status needs a cut-off date, the reason for each variance and the response.

## 9. Sourcing and number formatting

Every number carries **unit, period, base and source**. If any is missing, the number is not ready.

- **Unit and scale:** "EUR 4.2M", "38%", "14 days". Do not mix millions and thousands in one exhibit.
- **Period:** "FY2025", "Q3 2026", "last 12 months to 30 June".
- **Base:** what the percentage is a percentage of; what the comparison is against ("vs. FY2024", "vs. plan").
- **Source:** a footnote under the exhibit: "Source: Finance ledger, FY2025; team analysis". Mark estimates and illustrative data as such.
- **Rounding:** one rule per deck; round consistently; totals must sum or carry "figures may not sum due to rounding".
- **Percentages and points:** write "up 4 points" for a change in a percentage, "up 4%" for a relative change.
- **Thresholds and targets:** state whether they are agreed or proposed.
- **Comparisons:** same period, same definition, same scope. A different cost horizon is a different row.
- **Results from other cases** are illustrations, not promises to this audience.

SlideCraft flags unsourced figures (`SC-SRC-001`, and `SC-SRC-002` for final decks).

## 10. Words to avoid

| Avoid | Why | Say instead |
|---|---|---|
| transformation, synergy, efficiency (alone) | Names no change | Name the process change and the metric |
| leverage, unlock, optimise (alone) | Verb with no object | Say what changes, by how much |
| key, various, several, robust, holistic | Filler | Count them, or name them |
| significant, substantial | Hides the number | Give the number |
| we believe, we feel | Weakens a supported claim | State the claim; keep hedging for real uncertainty |
| "AI-powered", "next-generation" | Marketing, not information | Describe what the tool does |
| risk of "etc." and "and more" | Unfinished thought | Complete the list or delete |
| passive without an actor ("it was decided") | Hides ownership | Name the role |

Prefer short sentences, concrete nouns, the reader's vocabulary, and one term per concept throughout the deck.
