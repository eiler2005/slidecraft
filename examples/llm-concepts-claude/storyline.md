# Storyline — Key concepts for LLMs and AI agents

Deck id: `llm-ai-agents-vocabulary`
Storyline: `research-readout` (chosen because the deck is a sequence of ten atomic concepts, one message per slide, each with a "what it is" claim and a "why it matters" implication; the alternative `product-overview` was rejected because there is no single product being sold)
Audience: managers and engineers new to AI, pre-project
Length: 12 slides
Language: English
Tone: calm, consulting, plain-spoken, mixed audience (non-technical understandable)

## Question the audience is actually asking

"Before we start our first AI project, what do we need to understand in common so we scope, build, test and operate it well?"

## Governing thought (one sentence, disputable, actionable)

Ten concepts — tokens, train vs infer, embeddings and RAG, fine-tuning vs prompting, hallucinations, tools, agents, evaluation, guardrails, cost and latency — carry every scope, risk and budget decision in an AI project; agree on them before writing a single prompt or line of code.

## SCR — Situation, Complication, Resolution

- **Situation.** Our teams are preparing their first AI project; managers own scope, risk and budget while engineers own the build. Both sides read the same vendor material.
- **Complication.** The same words mean different things on each side of the table — a "token" is a billing unit to one person and a model internal to another; "fine-tuning" is sold as a cure and often is not. Projects stall or overspend because scope is set before the vocabulary is shared.
- **(Question raised.)** Which concepts actually drive project choices, and what does each one commit us to?
- **Resolution.** Hold a one-hour alignment on these ten concepts before kickoff. Each concept maps to a specific project decision: context window → data pipeline design; RAG vs fine-tuning → cost and update cadence; evaluation → acceptance criteria; guardrails → launch readiness; cost/latency → architecture and UX.

## Key line — MECE argument chain

The ten concepts are grouped as four pyramid branches under the governing thought. Order: how it works → how you shape it → how you keep it honest → how you ship it.

1. **How an LLM works** (two concepts): tokens/context window, training vs inference. Sets what the model can hold and when the work happens.
2. **How you shape its behaviour** (three concepts): embeddings and retrieval (RAG), fine-tuning vs prompting, hallucinations and mitigations. The levers you have to make it right.
3. **How you extend it into an agent** (two concepts): tool use and function calling, AI agents (plan–act–observe loop and memory). What turns an answer-machine into a worker.
4. **How you ship it responsibly** (three concepts): evaluation, guardrails and safety, cost and latency trade-offs. The operating discipline.

MECE check: each concept belongs in exactly one branch; nothing a first project needs is missing; order is "capability built up from the inside out".

## Title chain (read as a paragraph it must argue)

1. Cover — "Key concepts for LLMs and AI agents: the shared vocabulary your first project needs"
2. Why this matters now — "Agree on ten concepts before kickoff, or re-litigate them in change-requests later"
3. How to read this deck — "One concept per slide, each with the project decision it drives"
4. Tokens and context window — "The context window caps what the model can read at once, so it caps your document and prompt design"
5. Training vs inference — "Training is a sunk cost you rarely pay; inference is the per-request bill you always pay"
6. Embeddings and retrieval (RAG) — "Retrieval, not re-training, is the default way to put your data in front of the model"
7. Fine-tuning vs prompting — "Try prompting first, fine-tune only when prompting plateaus on a stable task"
8. Hallucinations and mitigations — "Treat confident wrong answers as a product risk and mitigate with retrieval, structure and checks"
9. Tool use and function calling — "Function calling turns the model from a writer into an actor on your systems"
10. AI agents: plan–act–observe and memory — "An agent is a loop that plans, acts and checks itself; memory decides how far it can go"
11. Evaluation — "If you cannot measure quality on a fixed test set, you cannot ship or improve the system"
12. Guardrails, safety, cost and latency — "Guardrails, cost and latency are the three gates every AI feature passes before launch"

Title chain narrative read-through: "Agree on ten concepts before kickoff. One per slide, each tied to a project decision. The context window caps your input design; training is sunk, inference is the recurring bill; retrieval is the default way to use your data; prompt first and fine-tune only on stable tasks; treat hallucinations as a product risk; function calls turn the model into an actor; agents loop with memory; measure before you ship; guardrails, cost and latency decide what actually goes live." The chain has no gaps, no echoes, no orphans.

## Evidence status per slide

| # | Slide | Claim type | Evidence available | Status |
|---|---|---|---|---|
| 1 | Cover | Framing | n/a | ready |
| 2 | Why now | Interpretation | SCR argument | ready (no numbers) |
| 3 | How to read | Framing | map of concepts to decisions | ready |
| 4 | Tokens/context | Fact + implication | Public: ~4 chars/token English; context windows now 8K–1M across vendors | needs source citation; use "typical ranges" with vendor-neutral wording |
| 5 | Train vs inference | Fact + implication | Common knowledge; cost-shape claim is directional | directional, no numbers |
| 6 | RAG | Fact + implication | Standard architecture pattern | directional |
| 7 | FT vs prompting | Interpretation | Industry heuristic | directional, flag as rule-of-thumb |
| 8 | Hallucinations | Interpretation | Mitigation list well-established | directional |
| 9 | Tools / function calling | Fact | OpenAI/Anthropic/Google all support it | ready |
| 10 | Agents | Fact + framework | ReAct-style loop is the standard reference | ready, cite "plan–act–observe" as shorthand |
| 11 | Evaluation | Interpretation | Standard practice | directional |
| 12 | Guardrails + cost/latency | Interpretation | Industry heuristic | directional |

## Open questions / to confirm with the sponsor

1. Which model(s) and vendor(s) are being considered first? Right now the deck is deliberately vendor-neutral; naming a vendor would let us put concrete token prices and context window numbers on slide 4 and slide 12.
2. Is there a candidate first use case? With one named use case we can replace generic examples on each slide with the audience's own project.
3. Governance level: does the organisation already have an AI policy, or do we need to flag guardrails as "to be drafted" on slide 12?
4. Preferred time horizon on the roadmap (slide 2 "before kickoff"): is kickoff dated?

No numbers are invented. Slide 4 will use "typical range" wording with a public-source footnote marked "illustrative, vendor documentation". Any concrete figure not sourced goes into open questions, not onto a slide.
