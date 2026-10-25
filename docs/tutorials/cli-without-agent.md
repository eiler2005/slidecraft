# Build a deck with the CLI only

> **Audience:** people who prefer writing YAML, CI pipelines, other agents · **Prerequisites:** Node ≥ 22.13, a clone of the repo · **Last reviewed:** 2026-10-10

```sh
git clone https://github.com/eiler2005/slidecraft && cd slidecraft
alias sc="node $PWD/dist/slidecraft.mjs"
```

## 1. Scaffold

```sh
sc new q3-review --goal "The leadership team agrees the Q3 priorities" --audience "Leadership team"
```

This writes `slidecraft/q3-review/brief.yaml` and a two-slide ghost `deck.yaml`. Or start from a storyline:

```sh
sc templates --brief slidecraft/q3-review/brief.yaml
sc choose --brief slidecraft/q3-review/brief.yaml --option A
sc scaffold --brief slidecraft/q3-review/brief.yaml --force
```

## 2. Write slides

Find a layout and its contract:

```sh
sc layouts                      # catalogue
sc layouts kpi-tiles            # purpose, variants and an example
sc layouts kpi-tiles --json     # JSON Schema with limits
```

Edit `deck.yaml` (your editor can validate it with `schemas/deck.v1.json`):

```yaml
  - id: status
    layout: kpi-tiles
    variant: tiles
    tracker: Status
    title: Revenue grew 12% while cost stayed flat, lifting margin three points
    tiles:
      - { value: "€18.2M", label: Revenue Q3, delta: "+12% YoY", trend: up }
      - { value: "€11.0M", label: Operating cost, delta: "flat", trend: flat }
      - { value: "39%", label: Operating margin, delta: "+3 pts", trend: up }
    highlight: 2
    sources: [finance-q3]
```

Remove `status: ghost` from slides you have filled (or set the deck to `status: draft`).

## 3. Check and build

```sh
sc validate slidecraft/q3-review/deck.yaml
sc check slidecraft/q3-review/deck.yaml          # fit, titles, sources, geometry, contrast
sc build slidecraft/q3-review/deck.yaml          # PPTX + PDF + PNG previews
sc build slidecraft/q3-review/deck.yaml -f html  # browser deck
```

Exit codes: `0` ok, `1` deck errors, `2` usage. Pipe to `jq` — output is JSON when not a terminal.

## 4. In CI

```yaml
- run: node dist/slidecraft.mjs check decks/q3/deck.yaml
- run: SOURCE_DATE_EPOCH=1767225600 node dist/slidecraft.mjs build decks/q3/deck.yaml -o out
```

Builds are byte-reproducible with a fixed `SOURCE_DATE_EPOCH`.
