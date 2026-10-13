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
  alt: A laptop showing code next to a book on a desk by the window
```

```sh
slidecraft images deck.yaml --stock --list            # candidates per slot: title, author, licence, size, link
slidecraft images deck.yaml --stock --pick 1          # download the chosen one to assets/<slide-id>.jpg
slidecraft images deck.yaml --stock wikimedia          # one provider: openverse, wikimedia, pexels, pixabay
```

| Provider | Key | Licence filter |
|---|---|---|
| `auto` (default) | none | Openverse and Wikimedia Commons together; photos ≥ 1600 px wide come first |
| `openverse` | none | Creative Commons and public domain that allow **commercial use and changes** (crop); no NC/ND |
| `wikimedia` | none | Wikimedia Commons originals (a 1920 px rendition is downloaded): CC0, public domain, CC BY, CC BY-SA only |
| `pexels` | `PEXELS_API_KEY` | Pexels License |
| `pixabay` | `PIXABAY_API_KEY` | Pixabay Content License |

The command writes `image:` and `imageCredit:` (author, provider, licence, licence link, page of
the photo) back into the YAML. The credit then appears:

- on the slide — with the sources ("Photo: Ehud Neuhaus paramir / Wikimedia Commons, CC0"),
  or on a dark band over the picture on the cover;
- in the speaker notes' `[Sources]` block, with the photo page;
- in `dist/manifest.json` under `imageCredits`.

**When no photo fits, generate one.** Give the slot both `imageQuery` and `imagePrompt`: if the
stock search finds nothing, `--stock` generates from the prompt (with `OPENAI_API_KEY`). If the
candidates are wrong — off-topic, soft, private people or logos — drop the photo and run
`slidecraft images deck.yaml` for the prompt, or let your assistant's image tool make it and
save it as `assets/<slide-id>.png`. Generated pictures are illustrations, never evidence.

**Look before you keep.** The first hit is not always right: check `--list`, open the links,
avoid identifiable private people and brand logos, then `--pick`. A long phrase is shortened word
by word until something matches; the result says which query matched. Photos narrower than about
1600 px look soft on a full-height cover panel (`SC-IMG-001`).

**Choose what stays in view.** A landscape photo on the tall cover panel loses two thirds of its
width. If the subject is not in the middle, set `imageFocus: left` (or `right`, `top`, `bottom`,
`{ x: 0.2, y: 0.5 }`); PowerPoint, the PDF and the HTML crop the same window.

**Sizes are measured, not trusted.** A listing can show the original's size while its link serves
a 1024 px preview (Rawpixel on Openverse does this). The download is measured: if it is narrower
than 1600 px, the next candidate is tried (up to four) and the widest download is kept. With
`--pick` the chosen photo is taken as it is, so check its size in the result.
