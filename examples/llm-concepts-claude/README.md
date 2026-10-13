# Key concepts for LLMs and AI agents — Claude Code from one prompt

The same prompt as [`../llm-concepts`](../llm-concepts/README.md) (made by Codex), run in
**Claude Code** headless in an empty folder: [`prompt.txt`](prompt.txt). Claude Code ran twice;
this folder keeps the second run, unedited.

**Open the result:** [PowerPoint](../../docs/showcase/llm-concepts-claude/llm-ai-agents-vocabulary.pptx) · [PDF](../../docs/showcase/llm-concepts-claude/llm-ai-agents-vocabulary.pdf) · [HTML](../../docs/showcase/llm-concepts-claude/llm-ai-agents-vocabulary.html) · [PowerPoint renders](../../docs/showcase/llm-concepts-claude/previews-office/) · [independent review](../../docs/showcase/llm-concepts-claude/visual-qa/REPORT.md)

## Run 1 — a deck of sketches

Claude Code wrote real content but left `status: ghost` on the deck and on every slide, built it,
and reported "deck complete". All 13 slides rendered as dashed placeholders. SlideCraft 0.7.0
let it pass silently. Since 0.7.1 every such slide reports `SC-GHOST-001`, and `AGENTS.md`
defines done: no ghosts, `check` clean, previews looked at, the slide count the user asked for.

## Run 2 — a real deck

12 slides, as asked:
- a framing slide in situation–complication–resolution form;
- key points with proof numbers;
- two numbered processes (RAG, the agent loop);
- a comparison table (prompting, RAG, fine-tuning);
- a decision slide;
- every slide sourced.

The independent review says *ready, with notes*:

- **Fixed in shared code:** the numbers of the steps that are not highlighted were too pale
  (2.46:1).
- **For the author:**
  - the cover has no visual, because the cover choice was skipped;
  - two slides carry about 170 words;
  - specific figures such as context window sizes and a 44% survey figure should be checked
    against their sources before external use.

## Codex and Claude Code side by side

| | Codex ([`llm-concepts`](../llm-concepts/README.md)) | Claude Code (this folder) |
|---|---|---|
| Delivered on the first run | yes | no — ghost slides (now caught) |
| Slides asked / delivered | 10–12 / 12 | 10–12 / 13, then 12 |
| Cover chosen from options | yes (network motif) | no (plain cover) |
| Sources | every slide, primary docs and papers | every slide, more specific figures to verify |
| `slidecraft check` | clean | two density warnings |
