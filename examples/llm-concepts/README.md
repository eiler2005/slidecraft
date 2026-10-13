# Key concepts for LLMs and AI agents — made from one prompt

This deck was made by **Codex** (OpenAI's coding agent), unedited. It received only the
prompt from the README, in an empty folder, with no other context:

```text
Study the repository https://github.com/eiler2005/slidecraft (read AGENTS.md first) and use
SlideCraft to make me an editable PowerPoint deck.
Topic: Key concepts for understanding LLMs and AI agents
For whom and why: managers and engineers new to AI who need a shared vocabulary …
Length: 10–12 slides · Language: English · Style: calm consulting look
…
I can't answer questions in this session: at every checkpoint choose yourself …
```

Full prompt: [`prompt.txt`](prompt.txt).

**Open the result:** [PowerPoint](../../docs/showcase/llm-concepts/llm-ai-agents-vocabulary.pptx) · [PDF](../../docs/showcase/llm-concepts/llm-ai-agents-vocabulary.pdf) · [HTML](../../docs/showcase/llm-concepts/llm-ai-agents-vocabulary.html) · [PowerPoint renders](../../docs/showcase/llm-concepts/previews-office/) · [independent review](../../docs/showcase/llm-concepts/visual-qa/REPORT.md)

What Codex did on its own:
- cloned the repository and read `AGENTS.md`;
- wrote the brief, the storyline and a ghost deck (`ghost-deck.md`);
- chose the cover from `slidecraft covers` (the network motif over a soft stock photo);
- built 12 slides with icons, a comparison table, a 2×2 and three process flows;
- cited a primary source on every slide (OpenAI and Anthropic guides, the Transformer and RAG
  papers, NIST AI RMF);
- returned the `.pptx` and PDF.

`slidecraft check` reports nothing; the independent visual review says *ready, with notes*.

| Stage | File |
|---|---|
| Brief | [`brief.yaml`](brief.yaml) |
| Storyline | [`storyline.md`](storyline.md) |
| Ghost deck (title chain) | [`ghost-deck.md`](ghost-deck.md) |
| Slides | [`deck.yaml`](deck.yaml) |
| Independent review | [`findings-1.json`](findings-1.json), [`REVIEW-LOG.md`](REVIEW-LOG.md) |

**What this run taught us** (fixed in shared code):
- the cover options were rendered as sketches while the deck was still a ghost deck — options now always show finished covers;
- the template recommender had no words for an explainer — Codex picked `project-kickoff`; explainers now rank `training-workshop` first.
