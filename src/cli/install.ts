/**
 * `slidecraft install`: connect SlideCraft to every AI app found on this machine.
 *   Claude Code → plugin · Codex → skills · Claude Desktop, Cursor, VS Code (Copilot),
 *   Windsurf, Gemini CLI → the SlideCraft MCP server.
 * JSON configs are backed up before they are changed; `--dry-run` only prints the plan.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Command } from 'commander';
import { serve } from '../mcp/server.ts';
import { ROOT } from '../paths.ts';
import { installCodex, uninstallCodex } from './codex.ts';
import { dim, green, printJson, wantsJson } from './output.ts';

// resolved per call, so HOME/APPDATA overrides (tests, portable setups) are honoured
const home = () => homedir();
const userConfig = (...p: string[]) =>
  process.platform === 'darwin'
    ? join(home(), 'Library', 'Application Support', ...p)
    : process.platform === 'win32'
      ? join(process.env.APPDATA ?? join(home(), 'AppData', 'Roaming'), ...p)
      : join(home(), '.config', ...p);
const win = process.platform === 'win32';

interface McpTarget {
  id: string;
  name: string;
  /** Config file to edit. */
  file: string;
  /** The app is present when this folder exists. */
  detect: string;
  key: 'mcpServers' | 'servers';
}

export function mcpTargets(): McpTarget[] {
  return [
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      file: join(userConfig('Claude'), 'claude_desktop_config.json'),
      detect: userConfig('Claude'),
      key: 'mcpServers',
    },
    {
      id: 'cursor',
      name: 'Cursor',
      file: join(home(), '.cursor', 'mcp.json'),
      detect: join(home(), '.cursor'),
      key: 'mcpServers',
    },
    {
      id: 'vscode',
      name: 'VS Code (Copilot)',
      file: join(userConfig('Code', 'User'), 'mcp.json'),
      detect: userConfig('Code', 'User'),
      key: 'servers',
    },
    {
      id: 'windsurf',
      name: 'Windsurf',
      file: join(home(), '.codeium', 'windsurf', 'mcp_config.json'),
      detect: join(home(), '.codeium', 'windsurf'),
      key: 'mcpServers',
    },
    {
      id: 'gemini',
      name: 'Gemini CLI',
      file: join(home(), '.gemini', 'settings.json'),
      detect: join(home(), '.gemini'),
      key: 'mcpServers',
    },
  ];
}

/** How an app should start the server: this Node and this package, or npx for a temporary npx copy. */
export function serverCommand(): { command: string; args: string[] } {
  const script = join(ROOT, 'dist', 'slidecraft.mjs');
  if (/[\\/]_npx[\\/]/.test(ROOT)) {
    const npx = join(dirname(process.execPath), win ? 'npx.cmd' : 'npx');
    return { command: existsSync(npx) ? npx : 'npx', args: ['-y', '@eiler2005/slidecraft', 'mcp'] };
  }
  return { command: process.execPath, args: [script, 'mcp'] };
}

function editJson(file: string, edit: (j: Record<string, unknown>) => void): void {
  const j = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8') || '{}') as Record<string, unknown>)
    : {};
  if (existsSync(file)) copyFileSync(file, `${file}.bak`);
  edit(j);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(j, null, 2)}\n`);
}

export interface InstallStep {
  target: string;
  action: string;
  done: boolean;
  detail?: string;
}

function hasClaudeCli(): boolean {
  return spawnSync(win ? 'where' : 'which', ['claude'], { encoding: 'utf8' }).status === 0;
}

export function install(
  opts: { dryRun?: boolean; only?: string[]; uninstall?: boolean } = {},
): InstallStep[] {
  const steps: InstallStep[] = [];
  const want = (id: string) => !opts.only || opts.only.includes(id);
  const server = serverCommand();

  if (want('claude-code') && hasClaudeCli()) {
    const cmds = opts.uninstall
      ? [['plugin', 'uninstall', 'slidecraft@slidecraft']]
      : [
          ['plugin', 'marketplace', 'add', 'eiler2005/slidecraft'],
          ['plugin', 'install', 'slidecraft@slidecraft'],
        ];
    let ok = true;
    if (!opts.dryRun)
      for (const c of cmds)
        ok = spawnSync('claude', c, { encoding: 'utf8', shell: win }).status === 0 && ok;
    steps.push({
      target: 'Claude Code',
      action: opts.uninstall ? 'remove plugin' : 'plugin',
      done: !opts.dryRun && ok,
      detail: cmds.map((c) => `claude ${c.join(' ')}`).join(' && '),
    });
  }
  const codexHome = process.env.CODEX_HOME ?? join(home(), '.codex');
  if (want('codex') && existsSync(codexHome)) {
    const dir = join(codexHome, 'skills');
    if (!opts.dryRun) {
      if (opts.uninstall) uninstallCodex(dir);
      else installCodex(dir);
    }
    steps.push({
      target: 'Codex',
      action: opts.uninstall ? 'remove skills' : 'skills',
      done: !opts.dryRun,
      detail: dir,
    });
  }
  for (const t of mcpTargets()) {
    if (!want(t.id) || !existsSync(t.detect)) continue;
    if (!opts.dryRun)
      editJson(t.file, (j) => {
        const servers = ((j[t.key] as Record<string, unknown> | undefined) ?? {}) as Record<
          string,
          unknown
        >;
        if (opts.uninstall) delete servers.slidecraft;
        else servers.slidecraft = t.key === 'servers' ? { type: 'stdio', ...server } : server;
        j[t.key] = servers;
      });
    steps.push({
      target: t.name,
      action: opts.uninstall ? 'remove MCP server' : 'MCP server',
      done: !opts.dryRun,
      detail: t.file,
    });
  }
  return steps;
}

export function registerInstallCommands(program: Command): void {
  program
    .command('install')
    .description(
      'Connect SlideCraft to the AI apps on this machine (Claude Code, Codex, Claude Desktop, Cursor, VS Code, Windsurf, Gemini CLI)',
    )
    .option(
      '--only <apps>',
      'comma-separated: claude-code,codex,claude-desktop,cursor,vscode,windsurf,gemini',
    )
    .option('--dry-run', 'show what would change')
    .option('--json', 'machine-readable output')
    .action((o: { only?: string; dryRun?: boolean; json?: boolean }) => {
      const steps = install({
        ...(o.dryRun ? { dryRun: true } : {}),
        ...(o.only ? { only: o.only.split(',') } : {}),
      });
      if (wantsJson(o.json)) return printJson({ steps, server: serverCommand() });
      if (!steps.length)
        console.log('No supported AI app found. See docs/how-to/use-with-any-agent.md');
      for (const s of steps)
        console.log(
          `${s.done ? green('✔') : dim('·')} ${s.target} — ${s.action}${s.detail ? dim(`  ${s.detail}`) : ''}`,
        );
      if (!o.dryRun && steps.some((s) => s.action.includes('MCP')))
        console.log(dim('\nRestart those apps; then ask: "Use SlideCraft to make a deck that …"'));
    });

  program
    .command('uninstall')
    .description('Remove SlideCraft from the AI apps it was connected to')
    .option('--only <apps>', 'comma-separated app ids')
    .action((o: { only?: string }) => {
      for (const s of install({ uninstall: true, ...(o.only ? { only: o.only.split(',') } : {}) }))
        console.log(`${green('✔')} ${s.target} — ${s.action}`);
    });

  program
    .command('mcp')
    .description(
      'Run the SlideCraft MCP server on stdio (for Claude Desktop, Cursor, VS Code and other MCP clients)',
    )
    .action(() => serve());
}
