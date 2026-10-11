/**
 * prepublishOnly: lint, types and tests, a fresh bundle, and proof that the committed
 * dist/ matches it. Uses /usr/bin/git on macOS when present (a stale /usr/local/bin/git
 * can be built for another CPU), like the git hooks.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const git = process.platform === 'darwin' && existsSync('/usr/bin/git') ? '/usr/bin/git' : 'git';

run('npm', ['run', 'check']);
run(process.execPath, ['scripts/bundle.mjs']);
try {
  run(git, ['diff', '--exit-code', 'dist/']);
} catch {
  console.error('dist/ is stale: commit the rebuilt bundle before publishing.');
  process.exit(1);
}
