# What you can do with SlideCraft

> **Audience:** people who present to decision-makers and want to know what SlideCraft does for them · **Last reviewed:** 2026-10-11

Grouped by what you are trying to get done. Each item says what it means for you and how to ask for it.

## Make the deck

| You want to | SlideCraft does | Ask for it |
|---|---|---|
| Start from a goal, not a blank slide | Turns two sentences into a brief, a storyline and a ghost deck of action titles for you to approve | "Make a deck: the board should approve…" |
| Use the right structure for the task | 14 storylines: strategy recommendation, executive update, client proposal, business case, pitch, product overview, case study, research readout, kickoff, post-mortem, training, sales QBR, investment memo, story talk | "It's a business case for the CFO" |
| Show each point the right way | 40 slide types chosen from what the title claims: charts, waterfalls, 2×2s, options tables, issue trees, timelines, risk matrices, org charts, RACI, maturity models and more | "Show the options side by side", or let it choose |
| Use the classic frameworks | SWOT with implications, Porter's five forces, PESTEL, the business model canvas | "Do a five-forces view of German freight" |
| Show numbers the way consultants do | Bubble charts and growth-share portfolios, marimekko market maps, tornado sensitivity charts, football-field valuation ranges | "Which assumptions move the NPV most?" |
| Bring your own material | Reads your PDFs, Word files, old decks and spreadsheets, and registers each as a source; flags what is missing instead of inventing it | "Use the annual report and the model" |
| Use the numbers in your spreadsheet | Charts and tables read straight from Excel or CSV; each number is defined once and used everywhere — change the file, rebuild, every slide updates | "Take the chart from the Plan sheet" |
| Get pictures for story slides | Uses your photos, or generates an image from a description (with an image API key, or inside Codex) | "Add a photo of a busy market for slide 3" |
| Make a one-off creative slide | Freeform HTML slides for keynotes, checked like every other slide | "Design a custom visual for the turning point" |

## Make it look right

| You want to | SlideCraft does | Ask for it |
|---|---|---|
| A professional look straight away | 6 themes, from the consulting classic to a dark keynote style | Pick at checkpoint 2 |
| Your company's look | Imports your PowerPoint template: colours, fonts, logo, background art and layouts. PowerPoint files are built inside your template | "Use our brand template" |
| A deck people can still edit | Native PowerPoint text, tables and charts — no pictures of text | Built in |
| Text that fits | Every line is measured as PowerPoint will show it; nothing overflows or shrinks into unreadable type | Built in |

## Trust the content

| You want to | SlideCraft does |
|---|---|
| A clear argument | Answer first; one claim per slide; titles that read as a storyline |
| Every number traceable | Sources on every slide that shows a number — down to the page ("Annual report 2025, p. 14") — with links in PDF and PowerPoint |
| The same number everywhere | A check flags a metric that shows €40M on one slide and €42M on another |
| A second pair of eyes | A partner-style review of the title chain and every slide before you send |
| Accessible files | Slide titles, alt text for pictures and charts, and colour contrast are checked; the PDF is tagged for screen readers |

## Send and present

| You need | You get |
|---|---|
| A deck the team will edit | PowerPoint (`.pptx`) |
| Something to send to a board | A PDF that matches the PowerPoint, optionally rendered by PowerPoint itself |
| A pre-read for people who will not open slides | A Word memo with the titles as headings, plus a one-page summary of the whole argument |
| To present from a browser or share a link | A single-file HTML deck with presenter notes |
| A printed version | The same deck in A4 |

## Reuse and improve

| You want to | SlideCraft does | Ask for it |
|---|---|---|
| Restyle an old deck | Imports a PowerPoint, looks at the original slides, rewrites the titles as claims and rebuilds the charts from the data | "Restyle board-q3.pptx in our template" |
| Change one thing quickly | Edits only what you ask, then re-checks the whole deck | "Make slide 5 a waterfall" |
| Keep edits made in PowerPoint | Reads the edited PPTX and writes the changed titles, bullets and notes back into the deck, so a rebuild keeps them | "Bring back the edits from the partner's file" |
| Fix text that is too long | Tells the assistant exactly how many characters each field may have and applies the rewrites | Happens in the review |
| Start from a proven deck | Six complete [examples](examples.md) to copy | "Use the executive update example as a start" |

## Work where you work

| You use | How |
|---|---|
| Claude Code | A plugin with skills and specialised agents |
| OpenAI Codex | Installable skills |
| Claude Desktop, Cursor, VS Code, Windsurf, Gemini CLI | An MCP server; `npx @eiler2005/slidecraft install` connects every app it finds |
| Aider and other assistants | The same workflow via `AGENTS.md` |
| No assistant | Write `deck.yaml` yourself and build it |

Open source and MIT-licensed. SlideCraft runs on your machine and sends nothing anywhere; your AI assistant sees what you give it.
