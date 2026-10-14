#!/usr/bin/env node
import '../backends/extra.ts';
import { buildProgram } from './program.ts';

buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    process.stderr.write(`slidecraft: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  });
