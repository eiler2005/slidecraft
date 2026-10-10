/**
 * `slidecraft codex install` — package SlideCraft's skills for OpenAI Codex.
 *
 * Codex reads skills from ~/.codex/skills/<name>/SKILL.md (+ agents/openai.yaml for display).
 * Claude-specific frontmatter (allowed-tools, disable-model-invocation, argument-hint) is
 * dropped and ${CLAUDE_PLUGIN_ROOT} is replaced with this checkout's absolute path, so the
 * skills call the same zero-install CLI.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import type { Command } from 'commander';
import { ROOT } from '../paths.ts';
import { dim, green } from './output.ts';

/** Knowledge skills shared with the Claude plugin (the Claude-only entry skills are replaced by `slidecraft`). */
export const CODEX_SHARED = [
  'storyline-architect',
  'action-title-writer',
  'ghost-deck-skeleton',
  'exhibit-chooser',
  'deck-spec',
  'partner-review-checklist',
];

const PREFIX = 'slidecraft-';

function transform(md: string, root: string, rename?: string): string {
  let out = md.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, root).replace(/\{\{SLIDECRAFT_ROOT\}\}/g, root);
  out = out.replace(/^---\n([\s\S]*?)\n---\n/, (_m, fm: string) => {
    const keep = fm
      .split('\n')
      .filter((l) => !/^(allowed-tools|disable-model-invocation|argument-hint):/.test(l))
      .map((l) => (rename && l.startsWith('name:') ? `name: ${rename}` : l));
    return `---\n${keep.join('\n')}\n---\n`;
  });
  return out;
}

function openaiYaml(display: string, short: string): string {
  return `interface:\n  display_name: "${display}"\n  short_description: "${short.replace(/"/g, "'")}"\n`;
}

function description(md: string): string {
  return /\ndescription: (.*)\n/.exec(md)?.[1]?.slice(0, 120) ?? 'SlideCraft skill';
}

export function installCodex(dir: string, root = ROOT): string[] {
  const written: string[] = [];
  mkdirSync(dir, { recursive: true });
  const main = readFileSync(join(root, 'codex', 'skills', 'slidecraft', 'SKILL.md'), 'utf8');
  const targets: [string, string, string][] = [['slidecraft', transform(main, root), 'SlideCraft']];
  for (const s of CODEX_SHARED) {
    const md = readFileSync(join(root, 'skills', s, 'SKILL.md'), 'utf8');
    const name = `${PREFIX}${s}`;
    const body = transform(md, root, name).replace(
      /`(storyline-architect|action-title-writer|ghost-deck-skeleton|exhibit-chooser|deck-spec|partner-review-checklist)`( skill)?/g,
      '`slidecraft-$1`$2',
    );
    targets.push([name, body, `SlideCraft · ${s.replace(/-/g, ' ')}`]);
  }
  for (const [name, body, display] of targets) {
    const d = join(dir, name);
    rmSync(d, { recursive: true, force: true });
    mkdirSync(join(d, 'agents'), { recursive: true });
    writeFileSync(join(d, 'SKILL.md'), body);
    writeFileSync(join(d, 'agents', 'openai.yaml'), openaiYaml(display, description(body)));
    written.push(d);
  }
  return written;
}

export function uninstallCodex(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const removed: string[] = [];
  for (const n of readdirSync(dir)) {
    if (n === 'slidecraft' || n.startsWith(PREFIX)) {
      rmSync(join(dir, n), { recursive: true, force: true });
      removed.push(join(dir, n));
    }
  }
  return removed;
}

export function registerCodexCommands(program: Command): void {
  const codex = program.command('codex').description('Use SlideCraft from OpenAI Codex');
  const defaultDir = () => join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'skills');
  codex
    .command('install')
    .description('Install SlideCraft skills into Codex (~/.codex/skills)')
    .option(
      '--dir <dir>',
      'Codex skills directory (default: $CODEX_HOME/skills or ~/.codex/skills)',
    )
    .action((o: { dir?: string }) => {
      const dir = resolve(o.dir ?? defaultDir());
      for (const d of installCodex(dir)) console.log(`${green('✔')} ${d}`);
      console.log(
        dim(
          `\nSkills point at ${ROOT}. Re-run after moving or updating SlideCraft.\nIn Codex: "Using SlideCraft, make a deck that …"`,
        ),
      );
    });
  codex
    .command('uninstall')
    .description('Remove SlideCraft skills from Codex')
    .option('--dir <dir>', 'Codex skills directory')
    .action((o: { dir?: string }) => {
      const dir = resolve(o.dir ?? defaultDir());
      for (const d of uninstallCodex(dir))
        console.log(`${green('✔')} removed ${relative(process.cwd(), d) || d}`);
    });
}
