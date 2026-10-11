/**
 * SlideCraft as an MCP server (stdio): build decks from Claude Desktop, Cursor, VS Code,
 * Windsurf, Gemini CLI or any MCP client.
 *
 *   { "mcpServers": { "slidecraft": { "command": "npx", "args": ["-y", "@eiler2005/slidecraft", "mcp"] } } }
 *
 * Each tool runs the same CLI with --json, so behaviour matches the command line exactly.
 * Decks live in a workspace folder (SLIDECRAFT_WORKSPACE, default ~/SlideCraft), one folder
 * per deck. `preview_slide` returns the slide as an image so the assistant can look at it.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { VERSION } from '../paths.ts';

type Json = Record<string, unknown>;
type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

export const workspace = () =>
  resolve(process.env.SLIDECRAFT_WORKSPACE ?? join(homedir(), 'SlideCraft'));

/** A deck by folder name in the workspace, a deck folder, or a path to deck.yaml. */
function deckPath(deck: string): string {
  const p = isAbsolute(deck) ? deck : resolve(workspace(), deck);
  return /\.ya?ml$/i.test(p) ? p : join(p, 'deck.yaml');
}
const briefPath = (deck: string) => join(deckPath(deck), '..', 'brief.yaml');

/** Run the CLI in a child process (same Node, same loader) and return its output. */
function cli(args: string[]): { ok: boolean; out: string } {
  const r = spawnSync(process.execPath, [...process.execArgv, process.argv[1]!, ...args], {
    encoding: 'utf8',
    cwd: workspace(),
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout ?? ''}${r.status ? `\n${r.stderr ?? ''}` : ''}`.trim();
  return { ok: r.status === 0, out: out || (r.status ? `exit ${r.status}` : 'done') };
}

const text = (t: string): Content[] => [{ type: 'text', text: t }];

const GUIDE = `SlideCraft makes consulting-grade decks: answer first, action titles, the right exhibit, sources on every number, a partner-style review.

Work in this order and stop at each ✅ to ask the user:
1. ✅ Brief — new_deck(goal, audience). Ask what the deck must achieve, for whom, and what they will do with it (send as PDF, edit together, present).
2. ✅ Template — suggest_templates(deck), show the three options, then choose_template(deck, option).
3. ✅ Titles — scaffold(deck), then read_deck/write_deck: write one action title per slide (a full-sentence claim). Show the numbered title chain; revise until approved.
4. Build — for each slide fill the content using list_layouts(layout) contracts; write_deck; check(deck). Put client numbers in \`facts:\` and use {{id}} in text; read spreadsheets with \`from: { file, sheet, range }\`; cite sources as \`id#p14\` (ingest + find).
5. ✅ Review — check(deck) until no errors (use fix_tasks/apply_fixes for long text), preview_slide for each slide, then build(deck) and give the user the file paths.
If the user edited the PPTX by hand, sync_pptx brings the text back before the next build.
Never invent numbers or sources; flag gaps instead.`;

interface Tool {
  name: string;
  description: string;
  inputSchema: Json;
  run: (a: Json) => Promise<Content[]> | Content[];
}

const s = (description: string) => ({ type: 'string', description });
const obj = (properties: Json, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
});

export const TOOLS: Tool[] = [
  {
    name: 'list_exhibits',
    description:
      'Route the intended relationship (comparison, process, architecture, bridge) to existing layout contracts. Storyline and theme are independent choices.',
    inputSchema: obj({ relationship: s('Optional semantic relationship id') }),
    run: (a) =>
      text(cli(['exhibits', ...(a.relationship ? [String(a.relationship)] : []), '--json']).out),
  },
  {
    name: 'list_components',
    description:
      'Existing native body exhibits with schemas and examples. Assemble complementary exhibits using layout: composition; keep title, sources and page numbering in the shared frame.',
    inputSchema: obj({ layout: s('Optional component/layout id') }),
    run: (a) => text(cli(['components', ...(a.layout ? [String(a.layout)] : []), '--json']).out),
  },
  {
    name: 'guide',
    description:
      'How to make a deck with SlideCraft: the steps, the four checkpoints and the rules. Call this first.',
    inputSchema: obj({}),
    run: () => text(`${GUIDE}\n\nWorkspace: ${workspace()}`),
  },
  {
    name: 'list_decks',
    description: 'Decks in the workspace',
    inputSchema: obj({}),
    run: () => {
      const ws = workspace();
      const decks = existsSync(ws)
        ? readdirSync(ws).filter((d) => existsSync(join(ws, d, 'deck.yaml')))
        : [];
      return text(decks.length ? decks.join('\n') : 'No decks yet — use new_deck.');
    },
  },
  {
    name: 'new_deck',
    description:
      'Start a deck from a goal in plain words; creates brief.yaml and deck.yaml in the workspace',
    inputSchema: obj(
      {
        goal: s('What the deck must achieve, e.g. "The board approves entry into Germany"'),
        audience: s('Who it is for'),
      },
      ['goal'],
    ),
    run: (a) => {
      mkdirSync(workspace(), { recursive: true });
      return text(
        cli([
          'new',
          String(a.goal),
          '--dir',
          workspace(),
          ...(a.audience ? ['--audience', String(a.audience)] : []),
          '--json',
        ]).out,
      );
    },
  },
  {
    name: 'suggest_templates',
    description:
      'Three template options (storyline × theme) and recommended outputs for the deck brief',
    inputSchema: obj({ deck: s('Deck folder name or path') }, ['deck']),
    run: (a) => text(cli(['templates', '-b', briefPath(String(a.deck)), '--json']).out),
  },
  {
    name: 'choose_template',
    description: 'Record the chosen option (A, B or C) or an explicit storyline and theme',
    inputSchema: obj(
      {
        deck: s('Deck folder name or path'),
        option: s('A, B or C'),
        storyline: s('storyline id'),
        theme: s('theme id'),
      },
      ['deck'],
    ),
    run: (a) =>
      text(
        cli([
          'choose',
          '-b',
          briefPath(String(a.deck)),
          ...(a.option ? ['--option', String(a.option)] : []),
          ...(a.storyline ? ['--storyline', String(a.storyline)] : []),
          ...(a.theme ? ['--theme', String(a.theme)] : []),
        ]).out,
      ),
  },
  {
    name: 'scaffold',
    description: 'Create the ghost deck (one slide per storyline slot) from the chosen template',
    inputSchema: obj({ deck: s('Deck folder name or path') }, ['deck']),
    run: (a) => text(cli(['scaffold', '-b', briefPath(String(a.deck)), '--force']).out),
  },
  {
    name: 'read_deck',
    description: 'The deck.yaml text',
    inputSchema: obj({ deck: s('Deck folder name or path') }, ['deck']),
    run: (a) => text(readFileSync(deckPath(String(a.deck)), 'utf8')),
  },
  {
    name: 'write_deck',
    description: 'Replace deck.yaml with new YAML, then validate it and return the diagnostics',
    inputSchema: obj({ deck: s('Deck folder name or path'), yaml: s('The complete deck.yaml') }, [
      'deck',
      'yaml',
    ]),
    run: (a) => {
      const p = deckPath(String(a.deck));
      writeFileSync(p, String(a.yaml));
      return text(cli(['validate', p, '--json']).out);
    },
  },
  {
    name: 'list_layouts',
    description:
      'Slide layouts and their content contracts (JSON Schema with limits and an example). Pass a layout id for one.',
    inputSchema: obj({ layout: s('layout id, e.g. chart-takeaway') }),
    run: (a) => text(cli(['layouts', ...(a.layout ? [String(a.layout)] : []), '--json']).out),
  },
  {
    name: 'check',
    description:
      'Lay out the deck and run every check (fit, titles, sources, consistency, contrast); no files written',
    inputSchema: obj({ deck: s('Deck folder name or path') }, ['deck']),
    run: (a) => text(cli(['check', deckPath(String(a.deck)), '--json']).out),
  },
  {
    name: 'fix_tasks',
    description: 'Fields that are too long, each with an exact character budget',
    inputSchema: obj({ deck: s('Deck folder name or path') }, ['deck']),
    run: (a) => text(cli(['fix', deckPath(String(a.deck)), '--json']).out),
  },
  {
    name: 'apply_fixes',
    description: 'Write rewrites by JSON pointer (comments kept) and re-check',
    inputSchema: obj(
      {
        deck: s('Deck folder name or path'),
        fixes: {
          type: 'array',
          items: obj({ pointer: s('/slides/N/field'), text: s('new text') }, ['pointer', 'text']),
        },
      },
      ['deck', 'fixes'],
    ),
    run: (a) => {
      const dir = mkdtempSync(join(tmpdir(), 'sc-mcp-'));
      const f = join(dir, 'fixes.json');
      writeFileSync(f, JSON.stringify(a.fixes));
      try {
        return text(cli(['fix', deckPath(String(a.deck)), '--apply', f, '--json']).out);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  {
    name: 'preview_slide',
    description:
      'Inspect a slide: resvg previews the Scene; pptx-convert renders the actual PPTX through installed Office. Scene previews do not certify PowerPoint fidelity.',
    inputSchema: obj(
      {
        deck: s('Deck folder name or path'),
        slide: s('slide id or number'),
        renderer: {
          type: 'string',
          enum: ['resvg', 'pptx-convert'],
          description: 'Default resvg; pptx-convert requires Office and Poppler',
        },
      },
      ['deck', 'slide'],
    ),
    run: (a) => {
      const dir = mkdtempSync(join(tmpdir(), 'sc-mcp-preview-'));
      const renderer = a.renderer === 'pptx-convert' ? 'pptx-convert' : 'resvg';
      const previewDir = join(dir, renderer === 'pptx-convert' ? 'previews-office' : 'previews');
      try {
        const r = cli([
          'build',
          deckPath(String(a.deck)),
          '-f',
          renderer === 'pptx-convert' ? 'pptx,png' : 'png',
          '-o',
          dir,
          '--preview-width',
          '1280',
          '--png-engine',
          renderer,
          '--json',
        ]);
        const files = existsSync(previewDir) ? readdirSync(previewDir).sort() : [];
        const want = String(a.slide);
        const file = /^\d+$/.test(want)
          ? files[Number(want) - 1]
          : files.find((f) => f.replace(/^\d+-/, '').replace(/\.png$/, '') === want);
        if (!file)
          return text(`No such slide "${want}". ${r.ok ? `Slides: ${files.join(', ')}` : r.out}`);
        return [
          {
            type: 'image',
            data: readFileSync(join(previewDir, file)).toString('base64'),
            mimeType: 'image/png',
          },
          {
            type: 'text',
            text: `${file} · renderer: ${renderer}${renderer === 'resvg' ? ' (Scene preview, not PowerPoint)' : ' (actual exported PPTX)'}`,
          },
        ];
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  {
    name: 'build',
    description: 'Build the deck files (pptx, pdf, html, onepager, docx, png); returns the paths',
    inputSchema: obj(
      { deck: s('Deck folder name or path'), formats: s('comma-separated, e.g. "pptx,pdf"') },
      ['deck'],
    ),
    run: (a) =>
      text(
        cli([
          'build',
          deckPath(String(a.deck)),
          ...(a.formats ? ['-f', String(a.formats)] : []),
          '--json',
        ]).out,
      ),
  },
  {
    name: 'ingest',
    description:
      'Add client documents (PDF, DOCX, PPTX, XLSX, CSV) as sources with page-level references',
    inputSchema: obj(
      {
        deck: s('Deck folder name or path'),
        files: { type: 'array', items: s('absolute file path') },
      },
      ['deck', 'files'],
    ),
    run: (a) =>
      text(
        cli(['ingest', ...(a.files as string[]), '--deck', deckPath(String(a.deck)), '--json']).out,
      ),
  },
  {
    name: 'find',
    description:
      'Find a phrase in the ingested documents; each hit carries the citation to use, e.g. annual-report#p14',
    inputSchema: obj({ deck: s('Deck folder name or path'), query: s('words to look for') }, [
      'deck',
      'query',
    ]),
    run: (a) =>
      text(cli(['find', String(a.query), '--deck', deckPath(String(a.deck)), '--json']).out),
  },
  {
    name: 'import_pptx',
    description: 'Turn an existing PowerPoint into a draft deck in the workspace (to restyle it)',
    inputSchema: obj({ file: s('absolute path to the .pptx') }, ['file']),
    run: (a) =>
      text(
        cli([
          'import',
          String(a.file),
          '--out',
          join(
            workspace(),
            String(a.file)
              .split(/[\\/]/)
              .pop()!
              .replace(/\.pptx$/i, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-'),
          ),
          '--json',
        ]).out,
      ),
  },
  {
    name: 'sync_pptx',
    description:
      'Bring text someone edited in the built PPTX back into deck.yaml. Without apply it only lists the changes — show them to the user, then call again with apply: true',
    inputSchema: obj(
      {
        deck: s('Deck folder name or path'),
        file: s('absolute path to the edited .pptx'),
        apply: { type: 'boolean', description: 'write the changes into deck.yaml' },
      },
      ['deck', 'file'],
    ),
    run: (a) =>
      text(
        cli([
          'sync',
          deckPath(String(a.deck)),
          String(a.file),
          ...(a.apply === true ? ['--apply'] : []),
          '--json',
        ]).out,
      ),
  },
];

const PROMPTS = [
  {
    name: 'make_deck',
    description: 'Make a consulting-grade deck with SlideCraft, step by step',
    arguments: [
      { name: 'goal', description: 'What the deck must achieve and for whom', required: true },
    ],
  },
];

export async function handle(msg: Json): Promise<Json | undefined> {
  const id = msg.id as number | string | undefined;
  const method = String(msg.method ?? '');
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const fail = (code: number, message: string) => ({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
  if (id === undefined) return undefined; // notifications (initialized, cancelled)
  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: (msg.params as Json | undefined)?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {}, prompts: {} },
        serverInfo: { name: 'slidecraft', version: VERSION },
        instructions: GUIDE,
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS.map(({ run: _r, ...t }) => t) });
    case 'tools/call': {
      const p = (msg.params ?? {}) as { name?: string; arguments?: Json };
      const tool = TOOLS.find((t) => t.name === p.name);
      if (!tool) return fail(-32602, `Unknown tool ${p.name}`);
      try {
        return reply({ content: await tool.run(p.arguments ?? {}) });
      } catch (e) {
        return reply({ content: text(String((e as Error).message)), isError: true });
      }
    }
    case 'prompts/list':
      return reply({ prompts: PROMPTS });
    case 'prompts/get': {
      const goal = String(
        ((msg.params as Json | undefined)?.arguments as Json | undefined)?.goal ?? '',
      );
      return reply({
        description: PROMPTS[0]!.description,
        messages: [
          { role: 'user', content: { type: 'text', text: `${GUIDE}\n\nThe deck: ${goal}` } },
        ],
      });
    }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

/** Newline-delimited JSON-RPC over stdin/stdout; logs go to stderr only. */
export function serve(): void {
  const rl = createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg: Json;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`,
      );
      return;
    }
    const res = await handle(msg);
    if (res) process.stdout.write(`${JSON.stringify(res)}\n`);
  });
}
