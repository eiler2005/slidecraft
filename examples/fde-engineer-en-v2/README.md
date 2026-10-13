# Forward Deployed Engineers — second edition: new techniques at work

The English briefing from [`../fde-engineer-en`](../fde-engineer-en/README.md), extended to nine
slides and made through the whole workflow again to exercise what SlideCraft 0.7 adds.

**Open the results:** [PowerPoint](../../docs/showcase/fde-engineer/en-v2/fde-engineer-en-v2.pptx) · [PDF](../../docs/showcase/fde-engineer/en-v2/fde-engineer-en-v2.pdf) · [HTML](../../docs/showcase/fde-engineer/en-v2/fde-engineer-en-v2.html) · [PowerPoint renders](../../docs/showcase/fde-engineer/en-v2/previews-office/) · [review report](../../docs/showcase/fde-engineer/en-v2/visual-qa/REPORT.md) · [review log](REVIEW-LOG.md)

| Technique | Slide | How |
|---|---|---|
| Stock photo with licence credit | cover | `imageQuery` → `slidecraft images --stock --list`, then `--stock auto` (Wikimedia Commons, CC0, 1920 px); credit on the picture, in the notes and in the manifest |
| Theme from a sample | all | `slidecraft theme from <photo> --id fde-desk` → [`theme/fde-desk.json`](theme/fde-desk.json): the accent and chart colours come from the first cover photo |
| Value chain | 3 | `layout: value-chain` — where pilots stall |
| Icons | 4, 5 | `icon:` on process steps and key points (Tabler, native shapes) |
| McKinsey 7S | 6 | `layout: seven-s` — what has to change around the role |
| Combo chart | 7 | `chart-takeaway` · `combo`: users (bars) and automation rate (line), native and editable |
| Totals check | 8 | budget table with a total row and column (`SC-CONSIST-002`) |

**What the review found** (round 1, see [`REVIEW-LOG.md`](REVIEW-LOG.md)):

- **Budget.** The month-2 total did not add up; a deliberately planted error to prove the new check. `SC-CONSIST-002` caught it, and the total was corrected.
- **7S.** An unquoted comma split one point in two.
- **Cover photo.** PowerPoint stretched it. A shared fix: images keep their aspect when cropped.
- **Value chain.** The margin label lacked contrast with the sampled colours. A shared fix.

Round 2: ready, with notes.

Round 3: the first cover photo was 1024 px wide and soft on a projector (`SC-IMG-001`, 91 ppi).
`--stock auto` now measures each download — the top candidate listed 7360 px but served a 1024 px
preview, so it moved on to a 1920 px CC0 photo from Wikimedia Commons. On the tall cover panel
the centred crop showed a book, so `imageFocus: left` keeps the laptop screen with code in view
(a shared feature: the same crop in PowerPoint, PDF and HTML). Three shared fixes came out of it:
measured download sizes, the focal point, and photo detection in `theme from` — this darker
photo was taken for a screenshot and gave a dark theme. Sampled again, it gives a muted olive
accent; the theme keeps the brighter accent sampled from the first photo.

Open points: the 7S ratings, pilot targets and budget are planning assumptions (labelled
illustrative).

| Stage | File |
|---|---|
| 1 · Brief | [`brief.yaml`](brief.yaml) |
| 3 · Storyline | [`storyline.md`](storyline.md) |
| 5 · Slides | [`deck.yaml`](deck.yaml), [`assets/cover.jpg`](assets/cover.jpg), [`theme/`](theme/) |
| 6b · Reviewer findings | [`findings-1.json`](findings-1.json), [`findings-2.json`](findings-2.json), [`findings-3.json`](findings-3.json) |
| Every change made while checking | [`REVIEW-LOG.md`](REVIEW-LOG.md) |
