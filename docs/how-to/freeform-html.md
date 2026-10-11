# Freeform HTML slides

> **Audience:** story and keynote authors, agents designing a one-off visual · **Prerequisites:** Chrome or Chromium for PPTX/PDF/PNG output · **Last reviewed:** 2026-10-11

Most slides should use a layout: layouts are editable in PowerPoint and follow the theme exactly. When a story needs a visual no layout covers, use `freeform`. The slide keeps SlideCraft's frame (action title, tracker, source line); you write the body in HTML and CSS.

```yaml
- id: numbers
  layout: freeform
  title: Three numbers tell the story of the first year
  sources: [ops]
  alt: Three large numbers — 1 day onboarding, 80% automated checks, 2.1× more applications
  css: |
    .row  { display: flex; gap: 28px; height: 100%; }
    .cell { flex: 1; background: var(--surface); border-top: 6px solid var(--accent); padding: 28px; }
    .n    { font-family: var(--font-heading); font-weight: 700; font-size: 64pt; color: var(--accent); }
  html: |
    <div class="row">
      <div class="cell"><div class="n">1 day</div>to onboard a standard client</div>
      <div class="cell"><div class="n">80%</div>of checks run automatically</div>
      <div class="cell"><div class="n">2.1×</div>more applications per adviser</div>
    </div>
```

## Theme tokens

The fragment sees the theme as CSS variables, so it changes with the theme:

| Variables | What they hold |
|---|---|
| `--ink` `--muted` `--accent` `--accent-text` `--accent-soft` `--surface` `--rule` `--bg` `--positive` `--negative` | Colours |
| `--font-heading` `--font-body` | Font families |
| `--size-title` `--size-heading` `--size-body` `--size-small` | Type sizes |

CSS is scoped to the slide. The container is exactly the slide body and clips overflow, which the check reports.

## How each output shows it

| Output | Freeform slide |
|---|---|
| HTML deck, Chrome PDF (`--pdf-engine html`) | Live HTML |
| PPTX, native PDF, PNG previews, DOCX, one-pager | A picture rendered by Chrome at 2×, with `alt` as alt text (tagged as a Figure in the PDF) |

Without Chrome, the non-HTML outputs show a placeholder and the build warns.

## Checks

| Code | Meaning |
|---|---|
| `SC-FIT-004` | The content is larger than the slide body (error) |
| `SC-FIT-005` | Text is smaller than the theme's small size (warning) |
| `SC-HTML-001` | Something was removed: scripts, event handlers, frames, `@import`, remote URLs (warning) |

Images next to the deck, referenced by a relative path in `src`, are inlined. Remote URLs are removed, so decks render offline and send nothing anywhere.

## When not to use it

- **The audience will edit the deck.** In PowerPoint this slide is a picture.
- **A layout fits the message.** Use `exhibit-chooser` first; freeform is for the remaining few.
