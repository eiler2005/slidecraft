# Why an editable PowerPoint from one prompt matters — and where the claim stops

> **Audience:** people deciding whether SlideCraft fits their team, and contributors shaping the roadmap · **Last reviewed:** 2026-10-12

## The value

**The deliverable is the file the organisation already runs on.** Board packs, steering
committees, client proposals and sales decks live in PowerPoint. Colleagues comment in it,
legal reviews it, the brand team owns its template, and the CFO changes one number at 11 pm.
An AI tool that ends in a web page or a picture of slides hands the user a second job:
rebuilding it in PowerPoint. SlideCraft ends in a `.pptx` whose text boxes, tables, charts,
notes and icons are native objects, so the work continues where it always continues.

**One prompt, any assistant.** The user writes what the deck must achieve, for whom, and in
what language — in ChatGPT, Claude, Codex or Claude Code. The assistant reads `AGENTS.md`, runs
the CLI on its side and returns the file. No designer, no template hunting, no install for the
user.

**Quality an LLM alone does not produce.** A language model writes good sentences and poor
slides: titles that are topics, numbers without sources, text that overflows or is shrunk to
8 pt, charts that look right in a preview and break in PowerPoint. SlideCraft supplies what the
model lacks:

- a method — answer first, action titles, one message per slide, the right exhibit for the
  claim, 14 storylines for common tasks;
- contracts — 42 layouts with measured limits, so text fits without truncating;
- PowerPoint's own text rules, calibrated against real Office output, so the HTML preview and
  the PPTX break lines the same way;
- checks — sources on every number, the same number everywhere, totals that add up, contrast;
- a final reviewer model that looks at every slide as PowerPoint draws it and reports what still
  needs a human.

**Editable means the deck survives the next round.** Numbers can come from Excel and stay
linked; edits made in PowerPoint flow back with `sync`; the brand template travels inside the
file. The deck is a starting point the team owns, not a screenshot it has to redo.

**Who gains most:** consultants and strategy teams (structure and sourcing), managers preparing
steering committees and board updates (speed, consistency), founders (a credible first pitch),
and anyone writing in a language other than English (labels, typography and spell-check follow
the deck language).

## The critique

**"One click" is a promise about the happy path.**

- **It needs a capable assistant.** The prompt needs an assistant that can run code and fetch
  a repository: ChatGPT in agent mode, Codex, Claude with code execution, or Claude Code. A
  plain chat can only write the `deck.yaml`. Free tiers and locked-down corporate assistants
  often cannot run Node.
- **The checkpoints cost time.** The workflow asks the user to approve the brief, the template,
  the title chain and the cover. That is deliberate — it is where quality comes from — but it
  is not one click. Telling the assistant "don't wait for me" skips them and costs quality.
- **The content is only as good as the input.** Without the user's numbers and sources the
  deck is well structured and thin; illustrative data is labelled as such, never invented.
  The hard part of a board deck is the thinking and the data, not the formatting.

**Editable is not identical everywhere.**

- PowerPoint is the reference. Keynote and Google Slides open the file, but their font
  substitutes and line breaking differ.
- Fonts other than Arial, Georgia and Times New Roman need their files to be measured
  exactly.
- The strict pixel comparison between PowerPoint and HTML averages about 89 % per page on
  generated decks. That looks close at normal size, but it is not pixel-identical.
- Native charts follow PowerPoint's own rendering, and number formats follow the viewer's
  Office locale.

**The look is consulting-grade, not bespoke design.** Forty-two layouts and seven themes (or a
theme sampled from a brand) cover most business decks. A marketing keynote with custom
illustration still needs a designer; `freeform` HTML slides are the escape hatch, with checks
but less editability.

**The market moves.** Microsoft Copilot, Gemini in Slides and Claude's own PowerPoint features
already produce editable decks inside the apps people use. Being editable is now expected
rather than a differentiator. What remains SlideCraft's edge is the method and the checks:
- action titles;
- the right exhibit for each claim;
- sourced numbers that stay consistent;
- text that fits without being shrunk;
- a review before hand-off.

The product story should lead with that, and treat "editable PPTX" as what is expected.

**Licence and reach.** The PolyForm Shield licence keeps use free, including at work, but it
is not open source in the OSI sense. Some companies' policies treat that differently, and
listings that require an OSI licence will not take it.

## What this means for the roadmap

- **Make the one-prompt path work in more places:** a hosted MCP endpoint or a minimal web
  runner for assistants that cannot run code.
- **Show the difference, don't claim it:** the public benchmark of the same briefs through
  Copilot, Gemini, Claude and SlideCraft, scored on action titles, sourcing, fit and rework time.
- **Close the parity gap where people see it:** chart labels and remaining glyph-edge
  differences, measured by the calibration corpus.
