# Visual QA pack

Deck: `examples/orchestration/run/pitch-deck/deck.yaml` · theme `modern-pitch` · renderer: Microsoft PowerPoint via AppleScript (jobs run in its sandbox container: no access prompts).
Checklist: `library/references/visual-qa.md` in the SlideCraft package. Record findings with `slidecraft visual-qa <deck> --record findings.json`.

Deck facts: title top spread 0 pt · 8 colours in use · 9 page(s) below 95.0% PowerPoint↔HTML parity.

## 1 · cover — Fabrikam turns idle truck space into same-day freight

Layout `title`. Fonts: Arial.

Images: [PowerPoint](01-cover-pptx.png) · [HTML](01-cover-html.png) · [difference](01-cover-diff.png)
Parity 96.1%.

- warning SC-COVER-001: The cover has no visual — it was not chosen from options

## 2 · problem — Every third truck on the road is driving with empty space

Layout `big-statement`. Fonts: Arial.

Images: [PowerPoint](02-problem-pptx.png) · [HTML](02-problem-html.png) · [difference](02-problem-diff.png)
Parity 93.3%; hotspots: row 3, column 1 (93.3%).

- almost aligned (left, 2.9 pt): Every third truck on the road is driving with em [title] ↔ 31% [hero-number]

## 3 · solution — Shippers book spare space in minutes and it moves the same day

Layout `process-steps`. Fonts: Arial.

Images: [PowerPoint](03-solution-pptx.png) · [HTML](03-solution-html.png) · [difference](03-solution-diff.png)
Parity 94.5%; hotspots: row 4, column 4 (94.5%).

- no measured issues

## 4 · market — Regional part-load freight is a €14B market in our first three countries

Layout `kpi-tiles`. Fonts: Arial.

Images: [PowerPoint](04-market-pptx.png) · [HTML](04-market-html.png) · [difference](04-market-diff.png)
Parity 83.3%; hotspots: row 2, column 1 (83.3%), row 2, column 2 (94.3%), row 2, column 3 (89.3%), row 2, column 4 (89.4%), row 4, column 4 (94.0%).

- no measured issues

## 5 · traction — Monthly bookings grew eight-fold in nine months with no paid marketing

Layout `chart-takeaway`. Fonts: Arial.

Images: [PowerPoint](05-traction-pptx.png) · [HTML](05-traction-html.png) · [difference](05-traction-diff.png)
Parity 88.7%; hotspots: row 1, column 3 (90.9%), row 4, column 2 (89.9%), row 4, column 3 (88.7%).

- colours outside the theme: #A3A4B5

## 6 · competition — We are the only player that is both instant and built for small shippers

Layout `matrix-2x2`. Fonts: Arial.

Images: [PowerPoint](06-competition-pptx.png) · [HTML](06-competition-html.png) · [difference](06-competition-diff.png)
Parity 91.5%; hotspots: row 1, column 2 (94.8%), row 1, column 3 (92.8%), row 3, column 1 (94.3%), row 3, column 2 (93.4%), row 3, column 3 (91.5%), row 4, column 4 (94.2%).

- warning SC-SRC-001: Slide shows numbers but cites no source
- contrast 5.08:1 (needs 4.5:1) — OUR SPACE
- almost aligned (top, 2.2 pt): ellipse [item] ↔ Fabrikam
- almost aligned (top, 3.2 pt): ellipse [item] ↔ Local brokers
- almost aligned (top, 2.2 pt): ellipse [item] ↔ Tailspin Board
- almost aligned (top, 3.2 pt): ellipse [item] ↔ Contoso Freight
- almost aligned (top, 3.2 pt): ellipse [item] ↔ Large forwarders

## 7 · model — Each load earns a 21% take rate and pays back acquisition in two months

Layout `data-table`. Fonts: Arial.

Images: [PowerPoint](07-model-pptx.png) · [HTML](07-model-html.png) · [difference](07-model-diff.png)
Parity 93.4%; hotspots: row 2, column 1 (93.4%), row 4, column 4 (94.3%).

- no measured issues

## 8 · team — A team that has built marketplaces and run fleets

Layout `team-cards`. Fonts: Arial.

Images: [PowerPoint](08-team-pptx.png) · [HTML](08-team-html.png) · [difference](08-team-diff.png)
Parity 93.1%; hotspots: row 1, column 2 (93.1%), row 4, column 4 (93.8%).

- no measured issues

## 9 · ask — €3M seed takes us to three countries and break-even in 2028

Layout `next-steps`. Fonts: Arial.

Images: [PowerPoint](09-ask-pptx.png) · [HTML](09-ask-html.png) · [difference](09-ask-diff.png)
Parity 94.0%; hotspots: row 1, column 4 (94.0%), row 3, column 1 (94.0%), row 4, column 4 (94.0%).

- contrast 1.06:1 (needs 4.5:1) — Illustrative data.  Source:  Fabrikam platform m [source]

## 10 · close — Let's fill the empty space together

Layout `title`. Fonts: Arial.

Images: [PowerPoint](10-close-pptx.png) · [HTML](10-close-html.png) · [difference](10-close-diff.png)
Parity 73.4%; hotspots: row 2, column 1 (81.7%), row 2, column 2 (81.4%), row 2, column 3 (80.7%), row 2, column 4 (89.0%), row 3, column 1 (73.4%), row 3, column 2 (94.4%), row 3, column 3 (91.9%), row 3, column 4 (89.1%).

- no measured issues

