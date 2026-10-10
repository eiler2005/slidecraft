# Add images

> **Audience:** deck authors · **Last reviewed:** 2026-10-10

Layouts with image slots: `text-image` (`image:`), `team-cards` (`people[].image`). Paths are relative to `deck.yaml`:

```yaml
  - id: journey
    layout: text-image
    variant: image-right
    title: The real problem was not speed but forty sources of truth
    body: [Every subsidiary kept its own bank feed…]
    image: assets/reconciliation.png
    alt: Abstract illustration of forty reconciliation sheets with one highlighted
    caption: Forty sources of truth, one of them always wrong
```

- PNG or JPEG; images are cropped to cover the slot (`fit: cover`).
- Aim for ≥ 144 ppi at the placed size (a 5.5 in wide slot → ≥ 800 px). Smaller images raise `SC-IMG-001`.
- Always write `alt` — it is used in PPTX, PDF and HTML.
- Missing images render a labelled placeholder and `SC-IMG-002` (info) so the deck still builds.
- Use images you have the right to use; SlideCraft bundles no stock photos.
