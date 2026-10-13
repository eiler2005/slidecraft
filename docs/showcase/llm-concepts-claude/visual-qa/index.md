# Visual QA pack

Deck: `examples/llm-concepts-claude/deck.yaml` · theme `consulting-classic` · renderer: Microsoft PowerPoint via AppleScript (jobs run in its sandbox container: no access prompts).
Checklist: `library/references/visual-qa.md` in the SlideCraft package. Record findings with `slidecraft visual-qa <deck> --record findings.json`.

Deck facts: title top spread 0 pt · 9 colours in use · 12 page(s) below 95.0% PowerPoint↔HTML parity.

## 1 · cover — Key concepts for LLMs and AI agents: the shared vocabulary your first project needs

Layout `title`. Fonts: Arial.

Images: [PowerPoint](01-cover-pptx.png) · [HTML](01-cover-html.png) · [difference](01-cover-diff.png)
Parity 78.1%; hotspots: row 1, column 1 (94.1%), row 1, column 2 (89.1%), row 1, column 3 (78.1%), row 1, column 4 (78.1%), row 2, column 1 (92.1%), row 2, column 2 (93.9%), row 3, column 1 (92.1%), row 3, column 2 (93.1%).

- contrast 5.45:1 (needs 4.5:1) — A one-hour session for mixed project teams befor [subtitle]
- contrast 5.45:1 (needs 4.5:1) — Strategy & Engineering   ·   October 2026 [meta]

## 2 · why-now — Agree on ten concepts before kickoff, or re-litigate them in change-requests later

Layout `exec-summary`. Fonts: Arial.

Images: [PowerPoint](02-why-now-pptx.png) · [HTML](02-why-now-html.png) · [difference](02-why-now-diff.png)
Parity 82.2%; hotspots: row 1, column 2 (94.1%), row 3, column 1 (92.4%), row 3, column 2 (86.7%), row 3, column 3 (87.0%), row 3, column 4 (87.8%), row 4, column 1 (82.2%).

- contrast 5.45:1 (needs 4.5:1) — SITUATION [label]
- contrast 5.45:1 (needs 4.5:1) — COMPLICATION [label]
- contrast 5.45:1 (needs 4.5:1) — Source:  McKinsey Global Survey on AI 2024 (2024 [source]
- almost aligned (top, 2.9 pt): SITUATION [label] ↔ Our team is preparing its first AI project. Mana [body]
- almost aligned (top, 2.9 pt): COMPLICATION [label] ↔ The same words mean different things across the  [body]
- almost aligned (top, 2.9 pt): RESOLUTION [label] ↔ Spend one hour now aligning on ten concepts — ea [answer]

## 3 · how-to-read — One concept per slide, each tied to the project decision it drives

Layout `exec-summary`. Fonts: Arial.

Images: [PowerPoint](03-how-to-read-pptx.png) · [HTML](03-how-to-read-html.png) · [difference](03-how-to-read-diff.png)
Parity 88.6%; hotspots: row 1, column 3 (88.6%), row 1, column 4 (92.5%), row 4, column 1 (92.9%), row 4, column 2 (94.1%).

- contrast 5.45:1 (needs 4.5:1) — Slides 4–5 cover the context window and training [detail]
- contrast 5.45:1 (needs 4.5:1) — Slides 6–8 cover RAG, fine-tuning versus prompti [detail]
- contrast 5.45:1 (needs 4.5:1) — Slides 9–10 cover function calling and the agent [detail]
- contrast 5.45:1 (needs 4.5:1) — Slides 11–12 cover test-set evaluation, guardrai [detail]
- contrast 5.45:1 (needs 4.5:1) — Source:  The Minto Pyramid Principle: Logic in W [source]
- almost aligned (top, 1.4 pt): 1 [number] ↔ How an LLM works: tokens and training shape what [headline]
- almost aligned (top, 1.4 pt): 1 [number] ↔ Slides 4–5 cover the context window and training [detail]
- almost aligned (top, 1.4 pt): 2 [number] ↔ How you shape its behaviour: retrieval, promptin [headline]
- almost aligned (top, 1.4 pt): 2 [number] ↔ Slides 6–8 cover RAG, fine-tuning versus prompti [detail]
- almost aligned (top, 1.4 pt): 3 [number] ↔ How you extend it into an agent: function calls  [headline]
- almost aligned (top, 1.4 pt): 3 [number] ↔ Slides 9–10 cover function calling and the agent [detail]
- almost aligned (top, 1.4 pt): 4 [number] ↔ How you ship it responsibly: evaluation, guardra [headline]
- almost aligned (top, 1.4 pt): 4 [number] ↔ Slides 11–12 cover test-set evaluation, guardrai [detail]

## 4 · tokens-context — The context window caps what the model reads at once, so it caps your document and prompt design

Layout `key-points`. Fonts: Arial.

Images: [PowerPoint](04-tokens-context-pptx.png) · [HTML](04-tokens-context-html.png) · [difference](04-tokens-context-diff.png)
Parity 72.1%; hotspots: row 1, column 2 (93.7%), row 1, column 3 (94.9%), row 2, column 1 (80.1%), row 2, column 2 (80.0%), row 2, column 3 (72.4%), row 2, column 4 (72.1%), row 4, column 1 (82.6%), row 4, column 2 (82.6%), row 4, column 3 (82.3%), row 4, column 4 (94.3%).

- contrast 5.45:1 (needs 4.5:1) — Source:  OpenAI platform documentation — models  [source]

## 5 · train-vs-inference — Training is a sunk cost you rarely pay; inference is the per-request bill you always pay

Layout `key-points`. Fonts: Arial.

Images: [PowerPoint](05-train-vs-inference-pptx.png) · [HTML](05-train-vs-inference-html.png) · [difference](05-train-vs-inference-diff.png)
Parity 65.1%; hotspots: row 1, column 2 (93.5%), row 2, column 1 (78.7%), row 2, column 2 (80.7%), row 2, column 3 (72.4%), row 2, column 4 (65.1%), row 4, column 1 (82.6%), row 4, column 2 (82.5%), row 4, column 3 (81.8%).

- contrast 5.45:1 (needs 4.5:1) — Source:  OpenAI platform documentation — models  [source]

## 6 · rag — Retrieval, not re-training, is the default way to put your data in front of the model

Layout `process-steps`. Fonts: Arial.

Images: [PowerPoint](06-rag-pptx.png) · [HTML](06-rag-html.png) · [difference](06-rag-diff.png)
Parity 83.3%; hotspots: row 1, column 3 (92.7%), row 4, column 1 (83.3%), row 4, column 2 (83.5%), row 4, column 3 (83.5%), row 4, column 4 (84.4%).

- contrast 3.02:1 (needs 3:1) — 01
- contrast 5.45:1 (needs 4.5:1) — Data pipeline
- contrast 3.02:1 (needs 3:1) — 02
- contrast 5.45:1 (needs 4.5:1) — Application
- contrast 3.02:1 (needs 3:1) — 03
- contrast 5.45:1 (needs 4.5:1) — Application
- contrast 5.45:1 (needs 4.5:1) — Application
- contrast 3.02:1 (needs 3:1) — 05
- contrast 5.45:1 (needs 4.5:1) — Application
- contrast 5.45:1 (needs 4.5:1) — Source:  Retrieval-Augmented Generation for Know [source]
- colours outside the theme: #7796C6

## 7 · ft-vs-prompting — Try prompting first; fine-tune only when prompting plateaus on a stable task

Layout `options-comparison`. Fonts: Arial.

Images: [PowerPoint](07-ft-vs-prompting-pptx.png) · [HTML](07-ft-vs-prompting-html.png) · [difference](07-ft-vs-prompting-diff.png)
Parity 90.1%; hotspots: row 3, column 2 (90.1%), row 3, column 3 (94.8%), row 3, column 4 (90.6%), row 4, column 1 (91.6%), row 4, column 2 (91.2%).

- contrast 5.11:1 (needs 4.5:1) — RECOMMENDED
- contrast 4.57:1 (needs 4.5:1) — Instructions in text only
- contrast 5.45:1 (needs 4.5:1) — Retrieval adds live data to each prompt
- contrast 5.45:1 (needs 4.5:1) — Model weights updated on your examples
- contrast 1.12:1 (needs 4.5:1) — Source:  OpenAI platform documentation — models  [source]
- colours outside the theme: #23364F
- almost aligned (top, 1.4 pt): What it changes ↔ Instructions and examples in text
- almost aligned (top, 1.4 pt): What it changes ↔ Adds relevant docs at request time
- almost aligned (top, 1.4 pt): What it changes ↔ Model weights retrained on labelled pairs
- almost aligned (top, 1.4 pt): Setup time ↔ Hours to days
- almost aligned (top, 1.4 pt): Setup time ↔ Days to weeks (pipeline build)
- almost aligned (top, 1.4 pt): Setup time ↔ Weeks (labelling + training run)
- almost aligned (top, 1.4 pt): Update cost when data changes ↔ Edit a text file; instant
- almost aligned (top, 1.4 pt): Update cost when data changes ↔ Re-embed changed documents
- almost aligned (top, 1.4 pt): Update cost when data changes ↔ Re-run training; high cost
- almost aligned (top, 1.4 pt): When to use ↔ Always try first
- almost aligned (top, 1.4 pt): When to use ↔ Data changes; facts must stay current
- almost aligned (top, 1.4 pt): When to use ↔ Prompting plateaued; stable high-volume task

## 8 · hallucinations — Treat confident wrong answers as a product risk and mitigate with retrieval, structure and checks

Layout `key-points`. Fonts: Arial.

Images: [PowerPoint](08-hallucinations-pptx.png) · [HTML](08-hallucinations-html.png) · [difference](08-hallucinations-diff.png)
Parity 84.5%; hotspots: row 3, column 1 (94.8%), row 3, column 4 (94.5%), row 4, column 1 (84.5%), row 4, column 2 (85.3%).

- warning SC-DENSITY-001: 172 words on one slide (aim for under 120)
- contrast 4.98:1 (needs 4.5:1) — Source:  OpenAI platform documentation — models  [source]

## 9 · tools-function-calling — Function calling turns the model from a writer into an actor on your systems

Layout `process-steps`. Fonts: Arial.

Images: [PowerPoint](09-tools-function-calling-pptx.png) · [HTML](09-tools-function-calling-html.png) · [difference](09-tools-function-calling-diff.png)
Parity 85.6%; hotspots: row 1, column 3 (94.2%), row 1, column 4 (90.8%), row 2, column 1 (94.5%), row 2, column 4 (94.8%), row 4, column 1 (85.6%), row 4, column 2 (86.0%).

- contrast 5.45:1 (needs 4.5:1) — User
- contrast 5.45:1 (needs 4.5:1) — Model
- contrast 5.45:1 (needs 4.5:1) — Application
- contrast 5.45:1 (needs 4.5:1) — Application
- contrast 5.45:1 (needs 4.5:1) — Model
- contrast 5.45:1 (needs 4.5:1) — Source:  OpenAI platform documentation — models  [source]
- almost aligned (left, 3.6 pt): HOW YOU EXTEND IT [tracker] ↔ A user asks something requiring live data or an 
- almost aligned (left, 3.6 pt): HOW YOU EXTEND IT [tracker] ↔ User
- almost aligned (left, 3.6 pt): Function calling turns the model from a writer i [title] ↔ A user asks something requiring live data or an 
- almost aligned (left, 3.6 pt): Function calling turns the model from a writer i [title] ↔ User
- almost aligned (left, 3.6 pt): polygon [chevron] ↔ A user asks something requiring live data or an 
- almost aligned (left, 3.6 pt): polygon [chevron] ↔ User
- almost aligned (left, 3.6 pt): A user asks something requiring live data or an  ↔ Source:  OpenAI platform documentation — models  [source]
- almost aligned (left, 3.6 pt): User ↔ Source:  OpenAI platform documentation — models  [source]
- almost aligned (left, 3.6 pt): polygon [chevron] ↔ Given available functions with descriptions, the
- almost aligned (left, 3.6 pt): polygon [chevron] ↔ Model
- almost aligned (left, 3.6 pt): polygon [chevron] ↔ Your application code receives the call, validat
- almost aligned (left, 3.6 pt): polygon [chevron] ↔ Application

## 10 · agents-loop — An agent is a loop that plans, acts and checks itself; memory decides how far it can go

Layout `process-steps`. Fonts: Arial.

Images: [PowerPoint](10-agents-loop-pptx.png) · [HTML](10-agents-loop-html.png) · [difference](10-agents-loop-diff.png)
Parity 82.3%; hotspots: row 1, column 3 (88.5%), row 4, column 1 (82.3%), row 4, column 2 (82.4%), row 4, column 3 (82.3%).

- contrast 3.02:1 (needs 3:1) — 01
- contrast 3.02:1 (needs 3:1) — 02
- contrast 3.02:1 (needs 3:1) — 03
- contrast 3.02:1 (needs 3:1) — 05
- contrast 5.45:1 (needs 4.5:1) — Source:  ReAct: Synergizing Reasoning and Acting [source]
- colours outside the theme: #7796C6

## 11 · evaluation — If you cannot measure quality on a fixed test set, you cannot ship or improve the system

Layout `key-points`. Fonts: Arial.

Images: [PowerPoint](11-evaluation-pptx.png) · [HTML](11-evaluation-html.png) · [difference](11-evaluation-diff.png)
Parity 92.0%; hotspots: row 1, column 2 (94.9%), row 1, column 3 (94.1%), row 4, column 1 (92.0%), row 4, column 2 (93.5%).

- warning SC-DENSITY-001: 174 words on one slide (aim for under 120)
- contrast 5.45:1 (needs 4.5:1) — Source:  Stanford HAI AI Index Report 2024 (2024 [source]
- almost aligned (top, 1.4 pt): Build a frozen test set before writing any promp [heading] ↔ Fixed Q&A pairs created before build are your on [body]
- almost aligned (top, 1.4 pt): Mix automated metrics with human review [heading] ↔ Automated checks — exact match, semantic similar [body]
- almost aligned (top, 1.4 pt): Run the test set before every change, not just a [heading] ↔ Prompt changes, model upgrades and new data can  [body]
- almost aligned (top, 1.4 pt): Monitor production quality after launch [heading] ↔ A static test set cannot cover the full distribu [body]

## 12 · ship-gates — Guardrails, cost and latency are the three gates every AI feature passes before launch

Layout `next-steps`. Fonts: Arial.

Images: [PowerPoint](12-ship-gates-pptx.png) · [HTML](12-ship-gates-html.png) · [difference](12-ship-gates-diff.png)
Parity 84.5%; hotspots: row 1, column 2 (93.9%), row 3, column 1 (85.2%), row 3, column 2 (91.2%), row 4, column 1 (84.5%), row 4, column 2 (88.7%), row 4, column 3 (91.9%).

- contrast 5.45:1 (needs 4.5:1) — Product lead · Before kickoff [meta]
- contrast 5.45:1 (needs 4.5:1) — Engineering lead · Before kickoff [meta]
- contrast 5.45:1 (needs 4.5:1) — Engineering lead · Before kickoff [meta]
- contrast 5.45:1 (needs 4.5:1) — Project sponsor · Before launch [meta]
- contrast 5.45:1 (needs 4.5:1) — To be named · At launch [meta]
- contrast 1.12:1 (needs 4.5:1) — Source:  OpenAI platform documentation — models  [source]
- almost aligned (top, 2.4 pt): Confirm alignment on these ten concepts, assign  [decision] ↔ Set inference cost budget per request; configure [action]
- text fills 100% of its box: Define guardrails: prompt injection tests, PII m [action]
- text fills 100% of its box: Set inference cost budget per request; configure [action]
- text fills 100% of its box: Agree latency SLA and identify caching or fallba [action]
- text fills 100% of its box: Schedule pre-launch eval review against frozen t [action]
- text fills 100% of its box: Assign on-call owner for post-launch monitoring  [action]

