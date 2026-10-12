# Use your numbers: facts, Excel and CSV

> **Audience:** anyone whose deck uses numbers from a model, a report or a spreadsheet · **Prerequisites:** a deck (`slidecraft new`) · **Last reviewed:** 2026-10-11

The numbers in a deck come from somewhere: a financial model, a survey export, a plan. Retyping them is how decks end up saying "€40M" on slide 2 and "€42M" on slide 7. SlideCraft avoids that in three ways:

1. **Facts:** each number is written once and used everywhere by name.
2. **Ranges:** charts and tables read straight from `.xlsx` or `.csv` files.
3. **The consistency check:** it flags any metric that still shows two different values.

## 1. Facts: write a number once

```yaml
facts:
  revenue-2028:
    value: 40000000
    divide: 1000000
    format: "€0M"                   # → €40M
    label: Revenue from Germany by 2028
    source: finance-fy25
  churn:
    from: { file: data/model.xlsx, sheet: KPIs, cell: B6 }
    format: "0.0%"                  # 0.052 → 5.2%
slides:
  - id: answer
    layout: big-statement
    variant: hero-number
    title: Entering Germany can add {{revenue-2028}} by 2028
    number: "{{revenue-2028}}"
    label: new revenue by 2028
```

- `{{id}}` works in any text on a slide, and in the deck `title`, `subtitle` and `footer`.
- A fact has either a `value` or a `from` cell. When it comes from a cell, SlideCraft reads the value the workbook last calculated, formulas included.
- `format` follows Excel's style:
  - `#,##0` adds grouping;
  - `0.0` sets the decimals;
  - a prefix or suffix is copied as written (`€0M`, `0.0x`);
  - `%` multiplies by 100.

  Use `divide` to show millions or thousands.
- An unknown `{{id}}` is an error (`SC-DATA-003`), so a typo never reaches the slide.

## 2. Charts and tables straight from a spreadsheet

```yaml
  - id: trend
    layout: chart-takeaway
    variant: column
    title: The UK business grew 40% in two years and funds the next market
    chart:
      from: { file: data/model.xlsx, sheet: Plan, range: A1:C6 }
      highlight: [4]                # chart options sit next to `from`
    takeaway: { headline: Growth is organic, points: [No acquisitions since 2023] }
    sources: [finance-fy25]

  - id: costs
    layout: data-table
    title: Three cost lines make up 80% of the entry budget
    rows:
      from: { file: data/costs.csv, range: A1:D9, header: true, format: "€#,##0" }
```

- **Charts:**
  - the first column of the range becomes the categories, and the header row names the series;
  - `series: rows` reads a range laid out the other way round;
  - chart options such as `decimals`, `highlight` and `unit` sit next to `from`.
- **Tables:**
  - `header: true` takes the first row as the table header;
  - `format` formats the number cells;
  - `header`, `values` and `categories` can each come from their own `from:` too.
- **CSV:** the delimiter (`,`, `;` or tab) is detected automatically, so European exports work as they are.
- Paths are relative to `deck.yaml`. Keep client files in the deck folder, which is git-ignored.

## 3. What the build records

`manifest.json` gains a `data` section with:
- each file used and its sha256;
- every fact with its value and its display text.

The manifest lets a reviewer confirm which version of the model the deck was built from, and spot the slide that went stale after the model changed.

## The consistency check

`slidecraft check` compares every amount on every slide. It treats two mentions as the same metric when they:
- share the same unit;
- share at least two significant words;
- name the same year, if they name one at all.

```
SC-CONSIST-001  "revenue germany 2028" is €40M on answer; €42M on plan
```

Rounding is allowed: "€40M" and "€40.2M" agree, because €40M is how €40.2M is written at that precision. Fix a report by deciding which value is right, putting it in `facts:` and writing `{{id}}` in both places.

Two more checks run on every deck:

| Code | Catches | Example |
|---|---|---|
| `SC-CONSIST-002` | **Totals that do not add up** — a "Total" row or column in a table, a "Total" category in a chart, a waterfall total that differs from the running sum; tolerance is one unit of the last digit shown | `Total row, Month 2: total $69k, parts add up to $67k` |
| `SC-CONSIST-003` | **One figure, another period or currency** — the same metric and value labelled 2027 on one slide and 2028 on another, or € here and $ there | `"germany revenue" €40M/€40M: period 2027 on a, 2028 on b` |

Shares are checked only when the total is 100%; growth rates in a total row are left alone.
Subtotal rows are allowed: the total may equal the sum of the subtotals instead.

## When something cannot be read

| Code | Meaning |
|---|---|
| `SC-DATA-001` | File not found, not a spreadsheet, or the sheet does not exist |
| `SC-DATA-002` | The range does not fit the field: a missing `range` or `cell`, text where a chart needs numbers, a field that cannot be filled from a range |
| `SC-DATA-003` | Unknown `{{id}}` |

Every diagnostic carries the JSON pointer of the field and a suggested fix ([all codes](../reference/error-codes.gen.md)).
