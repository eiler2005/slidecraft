# Make a deck in another language

> **Audience:** deck authors · **Last reviewed:** 2026-10-12

Write the content in the language you need and set the deck language:

```yaml
schemaVersion: 1
id: fde-engineer-ru
language: ru        # en (default), ru, de — any BCP 47 tag, e.g. pt-BR
```

SlideCraft never translates your content. The language controls everything SlideCraft itself
adds to a slide:

| What | English | Russian |
|---|---|---|
| Labels SlideCraft draws ("Source:", "Decision requested", "Recommended", risk axes…) | Source: · Decision requested | Источник: · Требуется решение |
| Numbers in charts, axes and facts | 1,234.5 | 1 234,5 |
| Typography | — | a one- or two-letter word (в, с, и, на, не…) never ends a line; a dash never starts one (no-break spaces) |
| PowerPoint proofing language of every run, notes and chart | en-US | ru-RU — spell-check works, no red underlines |
| HTML `lang`, Word and PDF document language | en | ru |
| Visual-QA report (`dist/visual-qa/REPORT.md`) | English | Russian |
| Cover motif with `art: auto` | English keywords | Russian keywords too |

## Fonts

Text is measured with metric-compatible fonts so line breaks match PowerPoint. Arial and Times
New Roman have full Cyrillic. Georgia's measurement font (Gelasio) has no Cyrillic, so themes
with Georgia headings declare `fonts.cyrillic`: SlideCraft switches to that face when the deck
text needs it, or raises `SC-GLYPH-001` naming the missing letters.

## Native charts

A native PowerPoint chart formats its numbers with the viewer's Office locale (the format code
is the same in every language). Data labels SlideCraft draws as text follow the deck language.

## Example

[`examples/fde-engineer-ru`](../../examples/fde-engineer-ru/deck.yaml) is the Russian version of
[`examples/fde-engineer-en`](../../examples/fde-engineer-en/deck.yaml) — same storyline, theme
and sources. Results: [`docs/showcase/fde-engineer/`](../showcase/fde-engineer/).
