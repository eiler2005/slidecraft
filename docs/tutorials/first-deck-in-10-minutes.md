# Your first deck in 10 minutes

> **Audience:** first-time users · **Prerequisites:** Claude Code, Node ≥ 22.12 · **Last reviewed:** 2026-10-10

You will install the plugin, describe a deck in one sentence, approve four checkpoints and get an editable PowerPoint and a PDF.

## 1. Install (1 minute)

```text
/plugin marketplace add eiler2005/slidecraft
/plugin install slidecraft@slidecraft
```

Check the engines on your machine (optional):

```text
! node ~/.claude/plugins/cache/*/slidecraft/*/dist/slidecraft.mjs doctor
```

## 2. Describe the deck (1 minute)

Open Claude Code in an empty folder and type:

```text
/slidecraft:new Our leadership team should approve moving customer support to a follow-the-sun model next quarter
```

Claude creates `slidecraft/<deck-id>/brief.yaml` and asks at most four questions — the decision, the audience, what you will do with the deck (edit it together, send as PDF, present live…) and the length.

**✅ CP1** — read the brief summary and say yes (or correct it).

## 3. Pick a template (1 minute)

A page opens with three contact sheets, A, B and C — two looks for the best-fitting story shape and one alternative story shape. Answer with a letter, or mix: "A's story with C's look".

**✅ CP2**

## 4. Approve the title chain (3 minutes)

Claude (on Opus) writes the storyline and a ghost deck. You see the governing thought and a numbered list of action titles — the whole argument in 10–14 lines. Ask for changes until the chain reads like the case you want to make.

**✅ CP3** — this is the most valuable minute: changing the story now is free.

## 5. Build and review (3 minutes)

Slides are written in parallel and rendered. Automated checks run, text is copy-fitted, and a partner-style review looks at every slide image. You get a verdict and the list of fixes made.

**✅ CP4** — open the files:

```text
slidecraft/<deck-id>/dist/<deck-id>.pptx
slidecraft/<deck-id>/dist/<deck-id>.pdf
slidecraft/<deck-id>/dist/previews/
```

Everything in the PPTX is editable: text, tables and charts are native PowerPoint objects.

## Next

- Want the PDF to look exactly like PowerPoint? [Export PDF](../how-to/export-pdf.md).
- Presenting from a browser? [Export an HTML deck](../how-to/export-html-deck.md).
- Learn the method behind it: [Strategy recommendation tutorial](strategy-recommendation-deck.md).
