/** Reject a release whose tag, manifests or committed main history disagree. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const pkg = json('package.json');
const tag = process.env.RELEASE_TAG;
assert.equal(tag, `v${pkg.version}`, 'Release tag must exactly match package.json');
assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const lock = json('package-lock.json');
const server = json('server.json');
for (const actual of [
  lock.version,
  lock.packages[''].version,
  json('.claude-plugin/plugin.json').version,
  server.version,
  server.packages.find((p) => p.identifier === pkg.name)?.version,
  json('library/catalog.json').version,
])
  assert.equal(actual, pkg.version, 'Release metadata must use one version');
const git = process.platform === 'darwin' && existsSync('/usr/bin/git') ? '/usr/bin/git' : 'git';
execFileSync(git, ['merge-base', '--is-ancestor', 'HEAD', 'origin/main']);
assert.equal(
  execFileSync(process.execPath, ['dist/slidecraft.mjs', '--version'], { encoding: 'utf8' }).trim(),
  pkg.version,
);
console.log(`${pkg.name}@${pkg.version}: tag, metadata, bundle and main ancestry verified`);
