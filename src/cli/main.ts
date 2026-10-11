#!/usr/bin/env node
import { Command } from 'commander';
import '../backends/extra.ts';
import { registerCodexCommands } from './codex.ts';
import { registerCommands } from './commands.ts';
import { registerInstallCommands } from './install.ts';
import { registerBrandCommands, registerWorkflowCommands } from './workflow.ts';

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

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`slidecraft: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
