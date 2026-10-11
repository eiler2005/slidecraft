# Keep the edits someone made in PowerPoint

> **Audience:** anyone whose deck gets edited outside SlideCraft — by a colleague, a partner, or you in PowerPoint · **Prerequisites:** the deck's `deck.yaml` and the edited `.pptx` · **Last reviewed:** 2026-10-11

You built the deck and sent the PPTX. A partner rewrote two titles and a bullet in PowerPoint and sent it back. Rebuilding from `deck.yaml` would lose those edits. `slidecraft sync` reads the edited file and writes the text changes back into `deck.yaml`. The next build keeps them, with every check run again.

```sh
slidecraft sync slidecraft/germany/deck.yaml ~/Downloads/germany-partner-edits.pptx
```

```
market title
  - Regional part-load freight is a €14B market in our first three countries
  + Regional part-load freight is a €15B market in our first three countries
traction takeaway/points
  - 68% of bookings come from returning shippers | Gross margin per load reached 21% in September
  + 70% of bookings come from returning shippers | Gross margin per load reached 21% in September | Referrals bring one in four new shippers
· Slides were reordered in the PPTX: cover, solution, problem, …. Reorder deck.yaml if intended.

Run again with --apply to write these changes.
```

Check the list, then write it:

```sh
slidecraft sync slidecraft/germany/deck.yaml ~/Downloads/germany-partner-edits.pptx --apply
slidecraft build slidecraft/germany/deck.yaml
```

`--apply` writes into `deck.yaml`, or into the section file that holds the slide, keeping comments and formatting. It then reports any field that is now too long, with a character budget for `slidecraft fix`.

## What comes back

| Edited in PowerPoint | Synced |
|---|---|
| Titles, kickers, leads, bullets, labels, notes in boxes — any text that came from a deck field | ✅ to that field, also after slides were moved |
| Bullets added or removed in a list | ✅ the list grows or shrinks |
| Speaker notes, edited or added | ✅ |
| A slide moved or deleted | reported — change the order in `deck.yaml` if you agree |
| A new text box or a new slide | reported — copy it into the deck by hand |
| Table cells | reported — edit the table in the deck |
| Chart data | not synced — change the numbers (or the spreadsheet) in the deck |
| Text the deck shows transformed: labels in capitals, numbers from `{{facts}}` | reported, never overwritten — change the fact or the field yourself |
| Colours, positions, fonts | not synced: the theme and the layout own the look |

## How it knows which field changed

Every text box SlideCraft writes is named after its field, for example `sc:market/tiles/0/value`. You can see the names in PowerPoint's Selection Pane. The names survive editing text and reordering slides.

Keynote and Google Slides may drop shape names when they export a PPTX. Then SlideCraft matches slides by their order and text boxes by their position, and says so at the top of the report. Check the list before `--apply`.

## With an AI assistant

Ask *"Bring back the edits from germany-partner-edits.pptx"*. The assistant runs `sync` (MCP tool `sync_pptx`), shows you the changes, and applies them when you agree.
