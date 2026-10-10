# Security and privacy

## Reporting a vulnerability

Please report security issues privately through [GitHub security advisories](https://github.com/eiler2005/slidecraft/security/advisories/new). Do not open a public issue. You will get an acknowledgement within five working days.

## Where your data lives

| What | Where | In git? |
|---|---|---|
| Your briefs, decks, materials and outputs | `./slidecraft/<deck>/` in your working directory (or `./work/`) | Never — git-ignored, blocked by the privacy hook |
| Library (layouts, themes, storylines, references) | this repository | Yes |
| Example decks | `examples/` — fictional companies and figures only | Yes |
| Fonts, CLI bundle | `fonts/`, `dist/` | Yes |

SlideCraft runs locally. The CLI makes no network requests. The HTML deck is self-contained (fonts and images embedded). Optional engines call software already on your machine (Chrome, PowerPoint, LibreOffice, the Codex runtime) and nothing else.

## Privacy hook

`npm run hooks` enables `.githooks/`. `privacy-check` blocks commits and pushes that contain:

- anything under `slidecraft/`, `work/`, `out/` or path segments named `clients` / `private`;
- binaries (PPTX, PDF, images, archives, keys) outside `fonts/`, `dist/`, `docs/gallery/`, `docs/media/`, `tests/fixtures/`;
- private keys, likely secrets and AWS keys;
- email addresses other than example domains.

Run `.githooks/privacy-check tree` to audit the whole tree. CI runs the same check.

## If something sensitive was committed

1. Do not push. If pushed, treat the data as exposed.
2. Remove it from history (`git filter-repo`), force-push only after coordinating with collaborators.
3. Rotate any credential that leaked.
4. Report the incident to the data owner.
