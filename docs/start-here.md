# Start here

> **Audience:** first-time users — consultants, managers, founders, speakers · **Prerequisites:** an AI assistant that can run commands (Claude Code, Codex, Cursor or similar) and Node 22 · **Last reviewed:** 2026-10-11

SlideCraft makes the deck with your AI assistant; you make the decisions. A first deck takes about ten minutes of your time.

## 1. Install it once

| Your assistant | Do this |
|---|---|
| Claude Code | `/plugin marketplace add eiler2005/slidecraft`, then `/plugin install slidecraft@slidecraft` |
| OpenAI Codex | `git clone https://github.com/eiler2005/slidecraft`, then `node slidecraft/dist/slidecraft.mjs codex install` |
| Cursor, Gemini CLI, Aider, others | Clone the repo and tell the assistant to follow `AGENTS.md` — see [use with any agent](how-to/use-with-any-agent.md) |

## 2. Say what the deck must achieve

One or two sentences are enough. Name the audience and what you need from them. A good request answers *who decides what, by when*:

| Instead of | Say |
|---|---|
| "Make a deck about Germany" | "The board should approve a partner-led entry into Germany at the 14 November meeting; they will read it as a PDF" |
| "Status update slides" | "Steering committee update for the ERP programme: we are on budget but six weeks late and need two decisions" |
| "Pitch deck" | "Seed pitch for investors: we turn idle truck space into same-day freight; we are raising €2M" |
| "Slides for my talk" | "A 15-minute conference talk on how our finance team closes the books in a morning instead of five days" |

Add what you have: numbers, a document, last quarter's deck, your company template. The assistant asks for anything else it needs.

## 3. Approve four checkpoints

| Checkpoint | You see | You decide |
|---|---|---|
| **1 · Brief** | Audience, the decision you want, length, and the formats you need (for example PowerPoint for your team, PDF for the board) | "Yes", or correct it |
| **2 · Template** | Three options, each a contact sheet of real slides: the shape of the argument × the look | Pick A, B or C |
| **3 · Titles** | The deck as a list of action titles — read them top to bottom and you have the argument | Approve, or rewrite a title |
| **4 · Review** | The built deck, a partner-style review and what was fixed | Send it, or ask for changes |

Everything between the checkpoints — writing slides, drawing charts, fitting text, checking sources — happens without you.

## 4. Get your files

They land in `slidecraft/<your-deck>/dist/`:

- `<deck>.pptx` — editable PowerPoint: real text, tables and charts;
- `<deck>.pdf` — for sending;
- `previews/` — an image of every slide;
- and, if you asked for them: `<deck>.html` for presenting from a browser, `<deck>-onepager.pdf` for a one-page summary, `<deck>.docx` for a Word pre-read.

## 5. Change it

Two ways, and both are fine:

- **Edit the PowerPoint** like any deck. Everything is editable.
- **Ask the assistant**: *"Make slide 4 a waterfall from FY25 to FY28"*, *"Shorten the titles on slides 6–8"*, *"Add a slide on risks with owners"*. It edits `deck.yaml` and rebuilds, and the checks run again.

## Next

- [What you can do with SlideCraft](features.md) — every capability, by job to be done
- [Example library](examples.md) — six finished decks to start from
- [Apply your brand](how-to/apply-brand.md) — your template, colours, fonts and logo
- [Import an existing PowerPoint](how-to/import-pptx.md) — restyle an old deck
