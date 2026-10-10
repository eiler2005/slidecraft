# Privacy

> **Audience:** everyone handling client material · **Last reviewed:** 2026-10-10

- Your decks live in `./slidecraft/<deck>/` (or `./work/`), both git-ignored. Keep client material there.
- The CLI performs no network requests. HTML decks embed fonts and images.
- Optional engines run software already on your machine; nothing is uploaded by SlideCraft.
- `npm run hooks` enables the privacy check on commit and push; `.githooks/privacy-check tree` audits the repository.
- Examples use fictional companies (Northwind, Contoso, Fabrikam, Tailspin) and illustrative data only.

Details and incident steps: [SECURITY.md](../../SECURITY.md).
