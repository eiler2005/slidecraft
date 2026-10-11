# Presentation tools landscape and ideas for SlideCraft

> **Audience:** the maintainer and contributors deciding what to build next · **Date:** 11 October 2026 · **Status:** research note, not a commitment — the [ROADMAP](../../ROADMAP.md) is the plan

## Summary

1. **The centre of gravity has moved to AI skills for agents.** The fastest-growing open projects are not HTML frameworks any more. They are workflows that run inside Claude Code, Codex, Cursor and similar tools:
   - [ppt-master](https://github.com/hugohe3/ppt-master): 59.7k stars since Dec 2025;
   - [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI): 31.8k since Mar 2026;
   - [frontend-slides](https://github.com/zarazhangrui/frontend-slides): 30.4k since Jan 2026;
   - [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill): 27.6k since Apr 2026.

   SlideCraft is in the right category.
2. **"Editable PowerPoint" is now table stakes.** Microsoft Copilot (agent mode, GA April 2026), Gemini in Google Slides (native, editable decks, 2026) and Claude (pptx skill and PowerPoint add-in, GA May 2026) all produce editable decks inside the apps people already use. Generating a deck is no longer a differentiator.
3. **What is still missing everywhere is consulting quality.** Independent tests report AI decks with no action titles, generic bar charts where a waterfall was needed, and 15–30 minutes of reformatting per deck to meet firm standards. SlideCraft's core — answer first, action titles, the right exhibit, sources, measured fit, partner review — is exactly that gap. **Lead with it.**
4. **Consultants pay for three things today:**
   - charts linked to Excel that update (think-cell, UpSlide);
   - brand and consistency checks (UpSlide AI Consistency Check, Macabacus Deck Check);
   - a library of reusable slides.

   SlideCraft has brand and checks, but not live data or a cross-slide consistency check.
5. **Reach comes from distribution, not features:**
   - a one-line install into every agent;
   - an MCP server;
   - a live demo viewer;
   - a short video.

   The top repos all have these.

## How this was researched

- **GitHub:** search by topic (`presentation`, `slides`, `pptx`, `powerpoint`) and by query (`ai presentation`, `ppt agent`, `slides llm`), sorted by stars, then the READMEs of the 16 most relevant projects. Star counts are as of 11 Oct 2026.
- **Commercial tools:** recent comparison reviews of Gamma, Beautiful.ai, Canva, Pitch, Plus AI and Copilot, and of consultant-focused generators.
- **Platform vendors:** Microsoft, Google and Anthropic announcements and docs on native deck generation.
- **Consulting add-ins:** think-cell, UpSlide and Macabacus, mostly vendor pages and vendor-affiliated comparisons. They are treated as marketing claims.
- No Reddit or forum threads surfaced in search. User sentiment below comes from review articles, which are often written by vendors, so it is biased.

## The landscape

### Open-source AI deck generators and agent skills

| Project | Stars | Since | What it is | What users get | Licence |
|---|---|---|---|---|---|
| [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) | 59.7k | 2025-12 | Agent skill (Python): documents → native PPTX | "Native depth": masters/layouts, native shapes and connectors, data-backed charts, transitions, animations, narration. Fill an existing PPTX while keeping its design; distil templates from references; image search with licence handling | MIT |
| [iOfficeAI/OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) | 31.8k | 2026-03 | Single-binary CLI that lets agents read and edit Word, Excel and PowerPoint | `officecli install` puts a skill into every detected agent; `watch` live preview; renders to HTML/PNG "to give AI eyes"; path-based edits | Apache-2.0 |
| [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides) | 30.4k | 2026-01 | Claude Code skill for single-file HTML decks | Style discovery from visual previews; "anti-AI-slop" curated styles; PPT → web conversion | MIT |
| [op7418/guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) | 27.6k | 2026-04 | Agent skill for HTML decks in two strong visual systems | 22 locked layouts; presenter mode with rehearsal timer and recovery; scripted layout QA with Playwright; social covers | AGPL-3.0 |
| [Anionex/banana-slides](https://github.com/Anionex/banana-slides) | 15.7k | 2025-11 | Desktop/web app, image-model-first slides | Per-slide templates from uploaded images; region edit by selection or voice; editable PPTX export; narration video | AGPL-3.0 |
| [presenton/presenton](https://github.com/presenton/presenton) | 11.0k | 2025-05 | Self-hosted generator and API (Gamma alternative) | Docker / desktop app; many model providers; MCP; custom HTML templates | Apache-2.0 |
| [chuspeeism/dashi-ppt-skill](https://github.com/chuspeeism/dashi-ppt-skill) | 9.4k | 2026-06 | Agent skill: browser-editable decks | 12 themes, 1,020 layouts; **analysis frameworks (SWOT, Porter, PEST, business model canvas)**; radar, waterfall, treemap, Sankey, heatmap, Gantt; control panel; PPTX export | AGPL-3.0 |
| [genspark-ai/genoffice](https://github.com/genspark-ai/genoffice) | 9.2k | 2026-07 | Local AI office suite | Byte-preserving edits; AI edits as tracked changes and diffs; CLI, skill and MCP | Apache-2.0 |
| [open-slide/open-slide](https://github.com/open-slide/open-slide) | 9.2k | 2026-04 | Slide framework built for agents | `/create-slide` with four scoping questions; in-browser inspector; asset manager; export HTML/PDF/PPTX | MIT |
| [icip-cas/PPTAgent](https://github.com/icip-cas/PPTAgent) | 5.1k | 2025-01 | Research framework (EMNLP 2025, ACL 2026) | Reflective generation with **visual review by a vision model**; deep-research integration; skill and MCP | MIT |
| [allweonedev/presentation-ai](https://github.com/allweonedev/presentation-ai) | 3.0k | 2025-03 | Web app (Gamma alternative) | Outline-first; 38 themes; local models | MIT |
| [ningzimu/image-to-editable-ppt-skill](https://github.com/ningzimu/image-to-editable-ppt-skill) | 2.9k | 2026-05 | Codex skill: slide images/PDF → editable PPTX | Measured text size and position; native tables and curves | MIT |
| [LearnPrompt/humanize-ppt](https://github.com/LearnPrompt/humanize-ppt) | 1.0k | 2026-05 | Story-planning layer on top of other generators | "Audience state transfer" outline from TED talks; cover gallery before outlining; **automatic talk check** for hidden text; speaker mode | — |

Pattern: almost every top project ships as a skill for several agents. They advertise "runs locally, your model, no subscription", and they are judged by how *native* the PowerPoint is.

### Classic open-source presentation frameworks

| Project | Stars | What it is known for |
|---|---|---|
| [reveal.js](https://github.com/hakimel/reveal.js) | 72.4k | The HTML presentation framework |
| [Slidev](https://github.com/slidevjs/slidev) | 49.0k | Markdown slides for developers; presenter mode, drawing, recording, export to PDF/PPTX |
| [Marp](https://github.com/marp-team/marp) | 12.6k | Markdown → slides ecosystem |
| [PPTist](https://github.com/pipipi-pikachu/PPTist) | 9.4k | PowerPoint-like editor in the browser |
| [PptxGenJS](https://github.com/gitbrent/PptxGenJS) | 6.3k | The library SlideCraft uses for PPTX |

These are tools for authors who code. They matter as engines and as sources of presenter-mode ideas, not as competitors for business users.

### Commercial AI deck tools

| Tool | Strength reviewers agree on | Weakness reviewers report |
|---|---|---|
| Gamma (~70M users per one review) | Fastest from prompt to deck | PPTX export shifts layouts and substitutes fonts |
| Beautiful.ai | Layout discipline; best PPTX export fidelity in one ranking | Weak at writing the content |
| Canva | Non-designers, free tier | Marketing look; export cleanup |
| Pitch | Sales decks shared as tracked links | — |
| Plus AI | Add-in for Google Slides and PowerPoint | — |

### The platform vendors

| Vendor | What shipped in 2026 | Implication for SlideCraft |
|---|---|---|
| Microsoft Copilot | Agent mode in PowerPoint GA and default (Apr 2026). Asks clarifying questions, outline first, keeps template and branding. Grounding in SharePoint, OneDrive and Teams content rolling out | Generating inside PowerPoint is now free with M365. Compete on quality and method, not on access |
| Google Gemini in Slides | Native, editable multi-slide decks; grounded in Drive; matches another deck's style; outline approval (2026, English first) | Same |
| Anthropic Claude | pptx skill (API, Claude Code, claude.ai) and the PowerPoint add-in, GA May 2026. Anthropic advises human review for client deliverables | SlideCraft can sit on top: the method, the checks and the review that the generic skill lacks |

### Consulting and finance add-ins (what professionals pay for)

| Tool | Core value | AI in 2026 |
|---|---|---|
| think-cell (vendor: 1.3M users, all top-10 consulting firms) | Charts consultants need — waterfall, Mekko, Gantt, butterfly, scatter — linked to Excel and auto-updating | think-cell Assist (paid add-on): drafts titles, summarises, translates, generates charts |
| UpSlide | Excel-to-PowerPoint linking, brand compliance, slide libraries | AI Consistency Check: flags contradicting numbers across slides |
| Macabacus | Formatting, model auditing, slide QA | Writing assistant, Deck Check for slide QA and brand standards, AI on private Azure |

Their customers do not want a deck generator. They want **numbers that stay right**, **slides that meet the firm standard**, and **less formatting**.

## What users value and what they complain about

| Theme | Evidence | SlideCraft today |
|---|---|---|
| Export breaks layouts | The most common complaint about web-first tools (Gamma: font substitutions, shifted layouts) | ✅ Strong: native PPTX, line-by-line measured fit, verified in PowerPoint |
| "Editable" is not "usable" | Tests: the fastest tool needed the most rework; the real test is whether structure survives edits | ⚠️ Partial: native objects, but edits in PowerPoint do not flow back into deck.yaml |
| No consulting structure | Copilot and Claude produced zero action titles in one test; bar chart instead of waterfall | ✅ Strong: action titles, exhibit chooser, waterfall, options on shared criteria, partner review (no Mekko yet) |
| Reformatting to the firm standard | 15–30 min per Copilot deck | ✅ Brand template import and template-mode PPTX |
| Generic "AI look" | "Anti-AI-slop" is a selling point (frontend-slides) | ⚠️ 6 themes; restrained by design, but few |
| Numbers that contradict | UpSlide built a product feature for it | ❌ Missing: sources are checked, consistency is not |
| Data from Excel | think-cell and UpSlide's core | ❌ Missing |
| Seeing the result while working | OfficeCLI `watch`, open-slide inspector, dashi console | ❌ Missing: build, then open the files |
| Presenting | Presenter modes with timers and rehearsal (guizang, Slidev) | ⚠️ HTML deck with notes; no rehearsal timer or phone remote |
| Install friction | One-line installers that detect every agent (OfficeCLI); Windows guides (ppt-master) | ⚠️ Per-agent instructions; Windows works (CI smoke) but has no guide |

## Where SlideCraft is different

No other open project combines these:
- a **consulting method** built in: answer first, action titles, the exhibit chosen from the claim, sources on every number, partner review;
- **measured fit** verified against real PowerPoint, with exact character budgets;
- **one spec, many outputs**: PPTX, accessible PDF, HTML, one-pager, DOCX;
- **brand templates** with PPTX built inside the customer's template;
- **deterministic, CI-tested** builds: visual regression, contract capacity tests;
- **works with any agent** and with no runtime dependencies.

The weak side is reach. The top projects have tens of thousands of stars, a live demo viewer, a walkthrough video, a one-line install, and Chinese or English READMEs for the two biggest communities.

## Opportunities, ranked by value to users

Value: what it does for someone making a real deck. Effort: S ≤ 1 day, M 2–4 days, L a week or more.

| # | Idea | Why it matters (evidence) | Value | Effort |
|---|---|---|---|---|
| 1 | **Cross-slide consistency check.** A deck-level claim ledger that flags the same metric shown with different values ("€40M" on slide 2, "€42M" on slide 7), mismatched periods and units, and totals that do not add up | UpSlide sells it; the most embarrassing error in front of a board; it extends our "every number sourced" rule | High | M |
| 2 | **Excel / CSV linked data.** `chart: { from: model.xlsx, sheet, range }`; refresh rebuilds charts and tables; the manifest records the values used | think-cell and UpSlide's core; consultants live in Excel | High | M |
| 3 | **Edits flow back.** Import the edited PPTX into deck.yaml (titles, text, table cells), so manual edits survive the next rebuild | "Editable is not usable"; genoffice's byte-preserving edits; ppt-master fills existing decks | High | M–L |
| 4 | **Consulting frameworks and charts pack.** SWOT, Porter's five forces, PESTEL, value chain, business model canvas, 7S, BCG growth–share (bubble); Marimekko, scatter/bubble, tornado / sensitivity, football field, combo bar + line | dashi-ppt-skill ships frameworks; think-cell's chart list is what consultants expect | High | M (per 3–4 layouts) |
| 5 | **MCP server and one-line install into every agent.** `slidecraft install` detects Claude Code, Codex, Cursor, Windsurf, Copilot and Gemini CLI; plus `slidecraft mcp` for Claude Desktop and other chat apps | OfficeCLI's installer; PPTAgent, genoffice and presenton all offer MCP; reaches people who never open a terminal | High (reach) | S + M |
| 6 | **Document intake with page-cited sources.** Read PDFs, Word and Excel attachments, and register every number with file and page ("Annual report 2025, p. 14") | Copilot and Gemini ground in Drive and SharePoint; MinerU and docling (68–81k stars) show the demand; strengthens sourcing | High | M |
| 7 | **Live preview with click-to-change.** `slidecraft preview --watch`: hot reload of the HTML deck with diagnostics overlay; click a slide element to copy its pointer for the assistant | OfficeCLI `watch`, open-slide inspector | Medium–high | M |
| 8 | **Public benchmark.** "Consulting deck benchmark": the same 5 briefs through Copilot, Gemini, Claude, Gamma and SlideCraft, scored on action titles, exhibit fit, sourced numbers, overflow and rework time | Reviews already score "action titles: zero"; turns our difference into evidence; strong for marketing | High (growth) | M |
| 9 | **Presenter tools.** Rehearsal timer, next-slide preview, phone remote, and a time budget per slide in the HTML deck | guizang, Slidev | Medium | S–M |
| 10 | **Stock images with licence tracking.** Openverse, Wikimedia, Pexels and Pixabay; credit lines go to the source line and the manifest | ppt-master's image chain; already in ROADMAP 0.5 | Medium | S |
| 11 | **Template from a reference deck or screenshot.** A theme from a PDF, PNG or website (colours, type, spacing) via vision | ppt-master distils templates; banana-slides per-page templates from images | Medium | M |
| 12 | **Content in more languages.** Russian and German first (the fonts already cover Cyrillic); title and length rules per language. README in Russian and Chinese for reach | Huge Chinese community around skills; the author's audience in CIS | Medium | M |
| 13 | **Talk video.** Narration from speaker notes (TTS) plus slides → MP4 for asynchronous updates | banana-slides, ResearchStudio-Reel, humanize-ppt | Medium–low | M |
| 14 | **Native transitions and animations** | ppt-master advertises them | Low for consulting decks | M |
| 15 | **Desktop or web app** | banana-slides, AionUi, genoffice | Low now; MCP plus Claude Desktop covers most of it | L |

### Growth: cheap things that move adoption

- A **30–60 second walkthrough video or GIF** at the top of the README: brief → template → title chain → PPTX opening in PowerPoint. Every top repo has one.
- A **live example viewer** on the Pages site: page through each example deck in the browser, not only download it.
- **Listings:** Claude Code plugin directories, skills registries, awesome-claude-code, awesome-codex, awesome-mcp-servers (once MCP exists), and Product Hunt with the showcase deck.
- **Positioning line** for every listing: *"Consulting-grade decks from any AI assistant: action titles, the right chart, sources on every number — as an editable PowerPoint."*
- **Star history and a "used by" section** once there are users. **Discussions** enabled for questions and showcase decks.

## Recommended next steps

1. **v0.5 — numbers you can trust:** consistency check (#1), Excel/CSV linked data (#2), page-cited document intake (#6).
2. **v0.5 — reach:** one-line installer plus MCP (#5), walkthrough video and live viewer.
3. **v0.6 — consulting depth:** frameworks and charts pack (#4), edits flow back (#3), benchmark (#8).
4. **Later:** live preview (#7), presenter tools (#9), stock images (#10), languages (#12).

This puts SlideCraft where neither the platforms nor the open generators are: **decks a partner would sign off, built from the client's own numbers, that stay right when the numbers change.**

## Risks

- **The platforms improve.** Copilot, Gemini and Claude will add better structure. The defence is the method, the checks and the brand/template depth, which are hard to bolt onto a general assistant.
- **Licences:** several popular skills are AGPL-3.0, so ideas are fine but code must not be copied. Proprietary runtimes stay optional (see ADR 0003).
- **Scope creep:** a GUI app or image-first decks would pull the project away from its strength.

## Sources

- GitHub repositories listed above (READMEs and repository metadata, 11 Oct 2026).
- Commercial tools: [Dupple — best AI for PowerPoint 2026](https://dupple.com/learn/best-ai-for-powerpoint-presentations) · [guptadeepak — Gamma vs Beautiful.ai vs Pitch](https://guptadeepak.com/tools/top-5-ai-presentation-tools-2026/) · [Storyflow — 12 best AI presentation tools](https://storyflow.so/blog/best-ai-presentation-tools-2026) · [AI Tools Recap — export fidelity test](https://aitoolsrecap.com/Blog/best-ai-tools-powerpoint-presentations-2026) · [FuturePicker — Gamma vs Beautiful.ai vs Canva vs Copilot](https://futurepicker.com/en/ai-presentation-tools-gamma-beautifulai-canva-powerpoint-copilot-2026-2/).
- Consultant-focused reviews (often vendor-written): [Perceptis — AI slide generators for consultants](https://perceptis.ai/blog/best-ai-slide-generators-for-consultants-10-tools-compared-2026) · [Perceptis — AI PowerPoint add-ins for consultants](https://perceptis.ai/blog/ai-powerpoint-add-ins-for-consultants-tested-ranked-(2026)) · [Deckary — AI PowerPoint tools compared](https://deckary.com/blog/ai-powerpoint-tools-compared) · [Slideworks — specialised generators vs ChatGPT/Claude](https://slideworks.io/resources/specialized-ai-slide-generator-vs-chatgpt-claude) · [Deckary — PowerPoint MCP servers compared](https://deckary.com/blog/powerpoint-mcp-servers-compared).
- Platform vendors: [Microsoft — Copilot agentic capabilities GA](https://www.microsoft.com/en-us/copilot/blog/2026/04/22/copilots-agentic-capabilities-in-word-excel-and-powerpoint-are-generally-available/) · [Microsoft support — create a presentation with Copilot](https://support.microsoft.com/en-us/powerpoint/copilot/create-a-new-presentation-with-copilot-in-powerpoint) · [Google Workspace Updates — native editable decks with Gemini](https://workspaceupdates.googleblog.com/2026/06/create-fully-native-and-editable-presentations-with-Gemini-in-Google-Slides.html) · [Claude Platform — Agent Skills quickstart](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/quickstart) · [PYMNTS — Anthropic Excel and PowerPoint skills](https://www.pymnts.com/news/artificial-intelligence/2026/anthropic-automates-excel-powerpoint-workflows-with-one-click-skills/).
- Consulting add-ins: [think-cell — management consulting](https://www.think-cell.com/en/product/management-consulting) · [think-cell Assist](https://www.think-cell.com/en/resources/content-hub/think-cell-assist-7-ai-tools-to-improve-your-powerpoint-slides) · [Macabacus vs think-cell](https://macabacus.com/lp/macabacus-vs-think-cell) · [Macabacus vs UpSlide](https://macabacus.com/lp/macabacus-vs-upslide) · [UpSlide vs Macabacus](https://upslide.com/the-best-alternative-to-macabacus/) · [Deliverables.ai — AI tools for investment banking presentations](https://deliverables.ai/guides/best-ai-tools-for-investment-banking-presentations-2026).
