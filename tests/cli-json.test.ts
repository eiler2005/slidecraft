import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildProgram } from '../src/cli/program.ts';

const ROOT = join(import.meta.dirname, '..');
const dirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'sc-json-'));
  dirs.push(d);
  return d;
};

function leaves(cmd: Command, prefix = ''): { name: string; cmd: Command }[] {
  return cmd.commands.flatMap((c) => {
    const name = `${prefix} ${c.name()}`.trim();
    return c.commands.length ? leaves(c, name) : [{ name, cmd: c }];
  });
}

/** Run a command in-process and return what it printed on stdout. */
async function run(...args: string[]): Promise<string> {
  let out = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    out += String(chunk);
    return true;
  });
  await buildProgram().parseAsync(['node', 'slidecraft', ...args]);
  vi.restoreAllMocks();
  return out;
}

describe('--json on every command', () => {
  it('is accepted by every leaf command (AGENTS.md tells agents to pass it everywhere)', () => {
    const all = leaves(buildProgram());
    // the commands that failed with "unknown option '--json'" in a real agent run
    for (const name of [
      'schema',
      'choose',
      'scaffold',
      'gallery',
      'site',
      'gen',
      'library check',
      'theme import',
      'theme from',
      'uninstall',
      'mcp',
      'codex install',
      'codex uninstall',
      'install',
    ])
      expect(
        all.map((l) => l.name),
        name,
      ).toContain(name);
    const missing = all.filter((l) => !l.cmd.options.some((o) => o.long === '--json'));
    expect(missing.map((l) => l.name)).toEqual([]);
  });

  it('parent commands only group subcommands and get no --json of their own', () => {
    const parents = buildProgram().commands.filter((c) => c.commands.length);
    expect(parents.map((c) => c.name()).sort()).toEqual(['codex', 'library', 'theme']);
    for (const p of parents) expect(p.options.some((o) => o.long === '--json')).toBe(false);
  });

  it('choose --json then scaffold --json print parseable results', async () => {
    const dir = tmp();
    const brief = join(dir, 'brief.yaml');
    copyFileSync(join(ROOT, 'examples/strategy-recommendation/brief.yaml'), brief);

    const chosen = JSON.parse(await run('choose', '--brief', brief, '--option', 'B', '--json'));
    expect(chosen.ok).toBe(true);
    expect(chosen.choice.option).toBe('B');
    expect(chosen.choice.storyline).toEqual(expect.any(String));
    expect(chosen.choice.theme).toEqual(expect.any(String));
    expect(chosen.brief).toContain('brief.yaml');

    const scaffolded = JSON.parse(await run('scaffold', '--brief', brief, '--json'));
    expect(scaffolded.ok).toBe(true);
    expect(scaffolded.slides).toBeGreaterThan(0);
    expect(scaffolded.deck).toContain('deck.yaml');
    expect(existsSync(join(dir, 'deck.yaml'))).toBe(true);
    expect(readFileSync(join(dir, 'deck.yaml'), 'utf8')).toContain(
      `storyline: ${chosen.choice.storyline}`,
    );
  });

  it('codex install --json and codex uninstall --json list what they touched', async () => {
    const dir = join(tmp(), 'skills');
    const installed = JSON.parse(await run('codex', 'install', '--dir', dir, '--json'));
    expect(installed.ok).toBe(true);
    expect(installed.dir).toBe(dir);
    expect(installed.installed.length).toBeGreaterThan(0);
    for (const d of installed.installed) expect(existsSync(join(d, 'SKILL.md'))).toBe(true);

    const removed = JSON.parse(await run('codex', 'uninstall', '--dir', dir, '--json'));
    expect(removed.ok).toBe(true);
    expect([...removed.removed].sort()).toEqual([...installed.installed].sort());
    for (const d of removed.removed) expect(existsSync(d)).toBe(false);
  });

  it('uninstall --json reports per-target steps', async () => {
    const r = JSON.parse(await run('uninstall', '--only', 'no-such-app', '--json'));
    expect(r).toEqual({ ok: true, steps: [] });
  });

  it('a plain-text command accepts --json from the command line instead of failing', () => {
    const out = join(tmp(), 'schemas');
    const stdout = execFileSync(
      process.execPath,
      ['--import', 'tsx', join(ROOT, 'src/cli/main.ts'), 'schema', '--out', out, '--json'],
      { encoding: 'utf8', cwd: ROOT },
    );
    expect(stdout).toContain('deck.v1.json');
    expect(existsSync(join(out, 'deck.v1.json'))).toBe(true);
  });
});
