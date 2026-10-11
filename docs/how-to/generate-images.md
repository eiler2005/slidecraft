# Generate images for empty image slots

> **Audience:** storytelling and pitch authors · **Prerequisites:** an OpenAI-compatible images API key, or Codex · **Last reviewed:** 2026-10-11

Describe the picture on the slide and leave `image` empty:

```yaml
- id: market
  layout: text-image
  title: Mornings at Campo de' Fiori set the pace of a Roman day
  body: [Stalls open at seven; by ten the square belongs to tourists.]
  alt: Market stalls with vegetables in a Roman square
  imagePrompt: Morning market stalls with vegetables in a sunny Roman piazza
```

The placeholder reads "Image to generate". Then:

```sh
slidecraft images deck.yaml --dry-run   # list what would be sent; sends nothing
slidecraft images deck.yaml             # generate, save to assets/<slide-id>.png, write image: back
```

- **Provider.** `OPENAI_API_KEY` is required. `OPENAI_BASE_URL` points to any compatible endpoint. `SLIDECRAFT_IMAGE_MODEL` defaults to `gpt-image-1`. Images are 1536 × 1024.
- **Style.** Every prompt gets a suffix that keeps pictures slide-friendly: photographic, calm, croppable, and no text, logos or watermarks.
- **Re-runs.** Slots that already have an image file are skipped; `--force` regenerates them. The prompt stays in the deck as provenance.
- **YAML.** Comments and formatting in `deck.yaml` and included section files are preserved.
- **Privacy.** Prompts leave your machine. Keep client names and confidential details out of them, and check with `--dry-run`.

**In Codex:** the agent can use its own image tool. It saves the file to `assets/<slide-id>.png` and sets `image:` — same result, no API key.

Generated pictures are illustrations. Never use them as evidence: a "photo" of a customer site that was never taken does not belong in a case study.
