---
name: import
description: Turn an existing PowerPoint into a SlideCraft deck — extract its content, look at the original slides, and redesign each one with action titles and the right exhibits. Optionally keep the brand (colours, fonts, logo, Office theme).
argument-hint: "<file.pptx> [--brand]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs *)
---

# Import and redesign an existing deck

`sc` = `node "${CLAUDE_PLUGIN_ROOT}/dist/slidecraft.mjs"`. Input: $ARGUMENTS.

1. **Extract.** `sc import <file.pptx> --render --json` writes `slidecraft/<name>/deck.yaml` (text, tables, chart data, pictures, notes) and `original.pdf`. Without PowerPoint or LibreOffice, drop `--render` and work from the extracted text only; say so.
2. **Brand (if asked, or the deck is clearly branded).** `sc theme import <file.pptx> --id <brand> -o slidecraft/<name>/theme` and set `theme: theme/<brand>.json` in deck.yaml. The Office theme part comes along, so PowerPoint's Design tab shows the brand.
3. **Look at the original.** Read `original.pdf` page by page. For each slide note: what it claims, which exhibit it really is (comparison, trend, process, matrix…), what is decoration, and anything the extraction missed (text inside pictures, diagrams drawn from shapes, callouts).
4. **Redesign, slide by slide**, keeping the slide `id`:
   - Rewrite the title as an action title (the `action-title-writer` skill).
   - Choose the layout from the relationship the title claims (the `exhibit-chooser` skill). Imported `text` slides are placeholders — most should become `key-points`, `process-steps`, `matrix-2x2`, `before-after` and the like.
   - Rebuild numbers as native charts or tables from the extracted data; never paste a picture of a chart.
   - Lines shortened on import end with " …" and keep the original in the notes. Use the full text, then fit it to the contract.
   - Register sources in `sources:` and cite them on every slide with numbers.
5. **Checkpoint.** Show the user the old → new title chain in a table, plus the slides you merged, split or dropped, and wait for approval.
6. **Build and review.** `sc check <deck> --json`, then the `build` and `review` skills.

What the importer cannot know: speaker intent, data behind pictures, and which shapes form one diagram. That is what the visual pass in step 3 is for.
