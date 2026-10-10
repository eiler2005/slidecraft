# A storytelling talk

> **Audience:** speakers preparing a keynote, a conference talk or an all-hands story · **Prerequisites:** [first deck](first-deck-in-10-minutes.md) · **Last reviewed:** 2026-10-10

We follow [`examples/narrative-story/`](../../examples/narrative-story/): a finance team (fictional) shares how a two-day month-end close became a morning routine.

## 1. Ask for a story, not a recommendation

```text
/slidecraft:new A 15-minute conference talk sharing how our finance team made the month-end close a non-event
```

SlideCraft ranks `narrative-story` first (hook → stakes → journey → turning point → insight → call to action) and suggests the `midnight`, `editorial` or `modern-pitch` looks. At CP1 say you will **present live** — the output plan then includes the HTML deck.

## 2. The arc

| Beat | Slide | Layout |
|---|---|---|
| Hook | "Every month, forty people stopped work for two days…" — **2 days** | `big-statement` · hero-number |
| Stakes | The COO's quote | `big-statement` · quote |
| Journey | Forty sources of truth; four decisions over eighteen months | `text-image`, `timeline` · milestones |
| Turning point | "The close got fast the day we stopped treating it as an event" | `big-statement` · statement |
| Results | 4 hours, 0 audit requests, 9 people | `kpi-tiles` · strip |
| Insight | Three lessons that travel | `key-points` · cards |
| Proof | Daily reconcilers close three times faster | `chart-takeaway` · bar |
| Call to action | "Tomorrow morning: reconcile one account before lunch" | `title` · closing |

Story slides carry one idea each; the detail lives in speaker notes. See [storytelling](../../library/references/storytelling.md).

## 3. Images

`text-image` needs a picture that carries meaning. The example uses an original abstract illustration (`assets/reconciliation.png`); use your own photos with permission. Missing images render as labelled placeholders (`SC-IMG-002`).

## 4. Present from the browser

```sh
node dist/slidecraft.mjs build examples/narrative-story/deck.yaml -f html,pdf --pdf-engine html
open examples/narrative-story/dist/close-in-a-morning.html
```

Keys: **← →** navigate · **N** presenter notes · **F** fullscreen · `#5` in the URL jumps to slide 5. Print from the browser or use the Chrome-printed PDF.
