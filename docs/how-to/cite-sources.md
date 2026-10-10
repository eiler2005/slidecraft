# Cite sources

> **Audience:** deck authors · **Last reviewed:** 2026-10-10

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
