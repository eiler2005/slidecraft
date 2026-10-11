import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { install } from '../src/cli/install.ts';

const ROOT = join(import.meta.dirname, '..');

/** Drive `slidecraft mcp` (tsx by absolute URL: the server runs the CLI from the workspace folder) over stdio the way an MCP client does. */
function client(env: NodeJS.ProcessEnv) {
  const p = spawn(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), join(ROOT, 'src/cli/main.ts'), 'mcp'],
    {
      cwd: ROOT,
      env: { ...process.env, ...env },
    },
  );
  let buf = '';
  const waiting = new Map<number, (v: Record<string, unknown>) => void>();
  p.stdout.on('data', (d: Buffer) => {
    buf += d.toString();
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const m = JSON.parse(line) as { id: number };
      waiting.get(m.id)?.(m as unknown as Record<string, unknown>);
    }
  });
  let id = 0;
  return {
    call(method: string, params: unknown = {}) {
      const n = ++id;
      p.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: n, method, params })}\n`);
      // biome-ignore lint/suspicious/noExplicitAny: JSON-RPC responses are read ad hoc in assertions
      return new Promise<Record<string, any>>((res) => waiting.set(n, res));
    },
    notify(method: string) {
      p.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
    },
    close: () => p.kill(),
  };
}

describe('MCP server', () => {
  it('speaks MCP over stdio: tools, a new deck and a slide preview', async () => {
    const ws = mkdtempSync(join(tmpdir(), 'sc-mcp-ws-'));
    const c = client({ SLIDECRAFT_WORKSPACE: ws });
    try {
      const init = await c.call('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      });
      expect(init.result.serverInfo.name).toBe('slidecraft');
      expect(init.result.capabilities).toHaveProperty('tools');
      expect(init.result.instructions).toContain('action title');
      c.notify('notifications/initialized');

      const tools = await c.call('tools/list');
      const names = tools.result.tools.map((t: { name: string }) => t.name);
      expect(names).toEqual(
        expect.arrayContaining(['guide', 'new_deck', 'check', 'preview_slide', 'build', 'ingest']),
      );
      for (const t of tools.result.tools) expect(t.inputSchema.type).toBe('object');

      const prompts = await c.call('prompts/list');
      expect(prompts.result.prompts[0].name).toBe('make_deck');

      const created = await c.call('tools/call', {
        name: 'new_deck',
        arguments: { goal: 'The board approves entry into Germany', audience: 'Board' },
      });
      expect(created.result.isError).toBeFalsy();
      const deckDir = (await c.call('tools/call', { name: 'list_decks', arguments: {} })).result
        .content[0].text as string;
      const deck = deckDir.split('\n')[0]!;
      expect(existsSync(join(ws, deck, 'brief.yaml'))).toBe(true);

      const shot = await c.call('tools/call', {
        name: 'preview_slide',
        arguments: { deck: join(ROOT, 'examples/pitch-deck'), slide: 'problem' },
      });
      expect(shot.result.content[0].type).toBe('image');
      expect(Buffer.from(shot.result.content[0].data, 'base64').subarray(1, 4).toString()).toBe(
        'PNG',
      );

      const bad = await c.call('tools/call', { name: 'nope', arguments: {} });
      expect(bad.error ?? bad.result.isError).toBeTruthy();
      expect((await c.call('nope/method')).error.code).toBe(-32601);
    } finally {
      c.close();
    }
  }, 120_000);

  it('installs into the AI apps it finds and removes itself again', () => {
    const home = mkdtempSync(join(tmpdir(), 'sc-home-'));
    const prev = {
      HOME: process.env.HOME,
      APPDATA: process.env.APPDATA,
      USERPROFILE: process.env.USERPROFILE,
    };
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    process.env.APPDATA = join(home, 'AppData', 'Roaming');
    try {
      mkdirSync(join(home, '.cursor'));
      const steps = install({ only: ['cursor', 'gemini'] });
      expect(steps.map((s) => s.target)).toEqual(['Cursor']);
      const cfg = JSON.parse(readFileSync(join(home, '.cursor', 'mcp.json'), 'utf8'));
      expect(cfg.mcpServers.slidecraft.args.at(-1)).toBe('mcp');
      install({ only: ['cursor'] }); // idempotent
      install({ only: ['cursor'], uninstall: true });
      const after = JSON.parse(readFileSync(join(home, '.cursor', 'mcp.json'), 'utf8'));
      expect(after.mcpServers).toEqual({});
    } finally {
      Object.assign(process.env, prev);
    }
  });
});
