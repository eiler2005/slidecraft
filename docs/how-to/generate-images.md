# Fill image slots: stock photos or generated pictures

> **Audience:** storytelling and pitch authors · **Prerequisites:** none for Openverse photos; a Pexels or Pixabay key, an OpenAI-compatible images key, or Codex for the others · **Last reviewed:** 2026-10-12

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

## Stock photos with licence and credit

Real photos instead of generated ones: give the slot a search phrase, not a prompt.

```yaml
- id: cover
  layout: title
  title: Forward Deployed Engineers turn AI pilots into working products
  imageQuery: laptop code screen desk
  alt: An engineer's desk with several monitors showing code and a laptop
```

```sh
slidecraft images deck.yaml --stock --list            # candidates per slot: title, author, licence, size, link
slidecraft images deck.yaml --stock --pick 1          # download the chosen one to assets/<slide-id>.jpg
slidecraft images deck.yaml --stock pexels --pick 2   # other providers
```

| Provider | Key | Licence filter |
|---|---|---|
| `openverse` (default) | none | Creative Commons and public domain that allow **commercial use and changes** (crop); no NC/ND |
| `pexels` | `PEXELS_API_KEY` | Pexels License |
| `pixabay` | `PIXABAY_API_KEY` | Pixabay Content License |

The command writes `image:` and `imageCredit:` (author, provider, licence, licence link, page of
the photo) back into the YAML. The credit then appears:

- on the slide — with the sources ("Photo: Yutaka Tsutano / Openverse · Flickr, CC BY 2.0"),
  or on a dark band over the picture on the cover;
- in the speaker notes' `[Sources]` block, with the photo page;
- in `dist/manifest.json` under `imageCredits`.

**Look before you keep.** The first hit is not always right: check `--list`, open the links,
avoid identifiable private people and brand logos, then `--pick`. A long phrase is shortened word
by word until something matches; the result says which query matched. Photos narrower than about
1600 px look soft on a full-height cover panel (`SC-IMG-001`).
