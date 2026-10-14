import { Command } from 'commander';
import { registerCodexCommands } from './codex.ts';
import { registerCommands } from './commands.ts';
import { registerInstallCommands } from './install.ts';
import { registerBrandCommands, registerWorkflowCommands } from './workflow.ts';

/**
 * Safety net for scripts and agents: AGENTS.md tells them to pass `--json` everywhere, so no
 * command may fail on it. Every leaf command without its own `--json` gets an accepted-and-ignored
 * one; parent commands (`codex`, `theme`, `library`) only group subcommands and get nothing.
 */
export function ensureJsonOption(cmd: Command): void {
  if (cmd.commands.length) {
    for (const c of cmd.commands) ensureJsonOption(c);
    return;
  }
  if (cmd.options.some((o) => o.long === '--json')) return;
  cmd.option('--json', 'accepted for scripts and agents; this command prints plain text');
}

/** The whole `slidecraft` command tree (the entry point runs it; docs and tests inspect it). */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name('slidecraft')
    .description(
      'Describe the goal. Pick a look. Ship a partner-ready deck.\nBuild editable PPTX, vector PDF, PNG previews and HTML decks from deck.yaml.',
    )
    .showHelpAfterError();

  registerCommands(program);
  registerWorkflowCommands(program);
  registerCodexCommands(program);
  registerBrandCommands(program);
  registerInstallCommands(program);

  for (const c of program.commands) ensureJsonOption(c);
  return program;
}
