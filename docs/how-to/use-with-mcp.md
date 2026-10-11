# Use SlideCraft from Claude Desktop, Cursor, VS Code and other AI apps (MCP)

> **Audience:** people who want decks from the AI app they already use, without a terminal workflow · **Prerequisites:** Node ≥ 22.12 · **Last reviewed:** 2026-10-11

SlideCraft includes an MCP server. MCP (Model Context Protocol) is the standard way AI apps call local tools. Once it is connected, you ask your app for a deck in plain words. The app follows the same workflow and checkpoints as Claude Code, and it sees slide previews as images.

## One command for every app

```sh
npx @eiler2005/slidecraft install --dry-run   # shows what it would change
npx @eiler2005/slidecraft install             # connects every app it finds
```

| App found on this machine | What `install` does |
|---|---|
| Claude Code | adds the plugin (`claude plugin marketplace add eiler2005/slidecraft`, `claude plugin install slidecraft@slidecraft`) |
| OpenAI Codex | installs the skills into `~/.codex/skills` |
| Claude Desktop | adds the `slidecraft` server to `claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| VS Code (Copilot agent mode) | the user `mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Gemini CLI | `~/.gemini/settings.json` |

- Each JSON file is backed up to `<file>.bak` before it changes, and only the `slidecraft` entry is touched.
- Running `install` again is safe.
- `--only cursor,claude-desktop` limits it to some apps.
- `slidecraft uninstall` removes the entries again.
- Restart the apps afterwards.

## Or add it by hand

Any MCP client that starts a local (stdio) server works:

```json
{
  "mcpServers": {
    "slidecraft": { "command": "npx", "args": ["-y", "@eiler2005/slidecraft", "mcp"] }
  }
}
```

VS Code uses `"servers"` instead of `"mcpServers"` and adds `"type": "stdio"`. With a global install (`npm i -g @eiler2005/slidecraft`) the command is simply `slidecraft` with `["mcp"]`.

## Ask for a deck

> *Use SlideCraft to make a deck: the board should approve a partner-led entry into Germany. The data is in ~/Documents/germany/model.xlsx.*

Decks live in a workspace folder, `~/SlideCraft/<deck>/` by default (set `SLIDECRAFT_WORKSPACE` to change it). The app stops at the four checkpoints:
1. the brief;
2. the template;
3. the title chain;
4. the review.

At each one, it asks you before it goes on.

## What the app can do

| Tool | Does |
|---|---|
| `guide` | the workflow and the rules (the app reads it first) |
| `new_deck`, `suggest_templates`, `choose_template`, `scaffold` | brief → three template options → ghost deck |
| `read_deck`, `write_deck`, `list_layouts` | edit `deck.yaml` against each layout's contract; `write_deck` validates at once |
| `check`, `fix_tasks`, `apply_fixes` | every check, and the fit loop with character budgets |
| `preview_slide` | one slide as an image, so the app can look at what it made |
| `build` | PPTX, PDF, HTML, one-pager, DOCX, PNG |
| `ingest`, `find` | client material as sources, and the page where a phrase is |
| `import_pptx` | an existing PowerPoint as a draft to restyle |
| `sync_pptx` | text you edited in PowerPoint, back into the deck |

The prompt `make_deck` starts the whole flow from a goal. The server runs on your machine. It reads and writes only the workspace and the files you name, and sends nothing anywhere.

## Troubleshooting

- **The app does not list SlideCraft:**
  - restart the app;
  - check the config file named in `install`'s output;
  - run `npx @eiler2005/slidecraft mcp` in a terminal. It should wait silently for input, so press Ctrl+C to stop it.
- **"node not found":** the app does not see your Node. Put the absolute path to `node` in `command`, or install Node from nodejs.org.
- **Slow first start:** `npx` downloads the package once. After that it starts in about a second.
