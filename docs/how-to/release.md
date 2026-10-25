# Release SlideCraft

> **Audience:** maintainers · **Prerequisites:** repository push access and npm package ownership · **Last reviewed:** 2026-10-25

Release versions must agree across npm, the lockfile, the Claude plugin, the MCP manifest, the generated catalogue and the committed CLI. A Git commit alone does not update npm or its README.

## Prepare the version

```sh
npm run version:sync -- 0.8.0
npm run gen
npm run build
npm run showcase
npm run check
node scripts/smoke-pdf-reader.mjs
```

`version:sync` updates the four source manifests together. It does not commit, tag or publish. Move the completed changelog items into a dated version section, update availability statements and the roadmap, and keep any unverified Office fidelity limits explicit. Review the rebuilt showcase when content changes.

Inspect the package with `npm pack --dry-run --json`. It must contain the committed bundles, library, schemas, skills, fonts and licences. Client material, credentials, local output and proprietary presentation runtimes must stay outside the package. Commit explicit paths, push `main` and wait for CI.

## Configure npm trusted publishing once

The repository uses `.github/workflows/release.yml` on GitHub-hosted runners. In npm, open **@eiler2005/slidecraft → Settings → Trusted publishing**, authenticate when prompted, and add:

| Field | Value |
|---|---|
| Provider | GitHub Actions |
| Organization or user | `eiler2005` |
| Repository | `slidecraft` |
| Workflow filename | `release.yml` |
| Environment | Leave empty; the workflow does not use a GitHub environment |
| Allowed action | Enable direct `npm publish` |

The publishing job grants `id-token: write`, uses Node 24 and npm's OIDC authentication, and attaches provenance. It needs no long-lived npm secret. npm requires CLI ≥ 11.5.1 and Node ≥ 22.14 for trusted publishing; the package itself supports Node ≥ 22.13. [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Publish and verify

After the release commit is on `main` and CI is green:

```sh
git tag -a v0.8.0 -m "SlideCraft 0.8.0"
git push origin v0.8.0
```

The release job rejects mismatched metadata or a commit outside `main`, checks generated output, runs the prepublish checks, rebuilds the bundle and tests the isolated PDF reader before publishing. GitHub Pages rebuilds separately on the `main` push. A failed run can be retried through **Actions → npm release → Run workflow**, using the existing tag. Do not move a published tag or reuse an npm version for different contents.

Verify the registry before creating the GitHub Release:

```sh
npm view @eiler2005/slidecraft@0.8.0 version engines dist-tags --json
npx -y @eiler2005/slidecraft@0.8.0 --version
```

Create a GitHub Release for the verified tag with the version notes from `docs/releases/`. Check the npm page's version and README, the website's version and downloads, and the MCP manifest's package version. Updating `server.json` does not itself publish a new MCP Registry entry; use the registry publisher separately when needed.

If npm requests a security key or fresh login, the owner must complete that authentication. Do not request an npm token in chat or put one in the repository. A release is complete only after the registry reports the new version; distinguish a prepared release from a published package.
