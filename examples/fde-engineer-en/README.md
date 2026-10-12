# Forward Deployed Engineers — an example made through the full workflow

A six-slide briefing on a new AI role, in **English** (this folder) and
**[Russian](../fde-engineer-ru/)**. Same storyline (research readout), theme (Consulting
Classic) and sources; the Russian deck shows what `language: ru` changes.

**Open the results:** [EN PowerPoint](../../docs/showcase/fde-engineer/en/fde-engineer-en.pptx) · [PDF](../../docs/showcase/fde-engineer/en/fde-engineer-en.pdf) · [HTML](../../docs/showcase/fde-engineer/en/fde-engineer-en.html) · [PowerPoint renders](../../docs/showcase/fde-engineer/en/previews-office/) · [review report](../../docs/showcase/fde-engineer/en/visual-qa/REPORT.md)
— [RU PowerPoint](../../docs/showcase/fde-engineer/ru/fde-engineer-ru.pptx) · [PDF](../../docs/showcase/fde-engineer/ru/fde-engineer-ru.pdf) · [HTML](../../docs/showcase/fde-engineer/ru/fde-engineer-ru.html) · [PowerPoint renders](../../docs/showcase/fde-engineer/ru/previews-office/) · [отчёт проверки](../../docs/showcase/fde-engineer/ru/visual-qa/REPORT.md)

| Stage | File |
|---|---|
| 1 · Brief | [`brief.yaml`](brief.yaml) |
| 3 · Storyline | [`storyline.md`](storyline.md) |
| 4–5 · Ghost deck → slides | [`deck.yaml`](deck.yaml) — cover `art: auto` picks the network motif from "AI" |
| 6b · Reviewer findings | [`findings-1.json`](findings-1.json) |
| Every change made while checking | [`REVIEW-LOG.md`](REVIEW-LOG.md), [`review-log.jsonl`](review-log.jsonl) |

Every number cites a source; the speaker notes of each slide end with a `[Sources]` block
listing them with links. Rebuild:

```sh
node dist/slidecraft.mjs build examples/fde-engineer-en/deck.yaml -f pptx,pdf,html
node dist/slidecraft.mjs visual-qa examples/fde-engineer-en/deck.yaml   # needs PowerPoint and Chrome
```

The figures are from public reporting (Fast Company citing Financial Times data, MIT NANDA,
Paraform) as of 2025–2026; check them before reusing.
