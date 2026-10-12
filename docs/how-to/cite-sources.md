# Cite sources

> **Audience:** deck authors · **Last reviewed:** 2026-10-12

Every number on a slide needs a source. Declare sources once, reference them by id:

```yaml
sources:
  - { id: finance-fy25, title: Management accounts FY2025, date: Jan 2026 }
  - { id: survey, title: Customer survey (n = 412), publisher: Contoso Research, date: Sep 2026 }
  - { id: model, title: Strategy team market model, illustrative: true }
slides:
  - id: baseline
    layout: kpi-tiles
    title: …
    sources: [finance-fy25]
```

The source line ("Source: Management accounts FY2025 (Jan 2026)") is drawn at the bottom of the slide. Free text works too: `source: Company filings, 2025`.

- `illustrative: true` prefixes the line with "Illustrative data." — use it for examples and estimates you have not sourced.
- `check` raises `SC-SRC-001` (warning) for numbers without a source; with deck `status: final` it is an error (`SC-SRC-002`).
- Dates, owners, indices and positions do not count as claims.
- Never invent a source to silence the check — ask for it or label the data illustrative.

## Sources in the speaker notes

Every exported deck (PPTX, HTML, Word memo) also lists the slide's sources in its speaker notes,
after your own notes, so the presenter can say where a number comes from:

```text
Growth figures differ by dataset; all show a several-fold rise.

[Sources]
- Postings for this AI job are up 800% — Fast Company, citing Financial Times data — 2025 — https://www.fastcompany.com/…
- The GenAI Divide: State of AI in Business 2025 — MIT NANDA — Aug 2025
```

Each line is title — publisher — date — place (`report#p14` → "p. 14") — link (a PDF link opens at
that page) or file, with "illustrative data" where it applies. The block is generated from
`sources:` on every build: edit the registry, not the notes. `slidecraft sync` ignores it, so
notes edited in PowerPoint come back into `deck.yaml` without it.
