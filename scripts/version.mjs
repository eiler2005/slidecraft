/** Keep npm, lockfile, Claude plugin and MCP package versions together. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? ''))
  throw new Error('Usage: npm run version:sync -- <stable version, e.g. 0.8.0>');
const paths = ['package.json', 'package-lock.json', '.claude-plugin/plugin.json', 'server.json'];
const [pkg, lock, plugin, server] = paths.map((path) =>
  JSON.parse(readFileSync(join(root, path), 'utf8')),
);
if (!lock.packages?.[''] || !server.packages.some((p) => p.identifier === pkg.name))
  throw new Error('Expected the root lockfile package and matching MCP npm package');
pkg.version = lock.version = lock.packages[''].version = plugin.version = server.version = version;
for (const p of server.packages) if (p.identifier === pkg.name) p.version = version;
for (const [i, data] of [pkg, lock, plugin, server].entries())
  writeFileSync(join(root, paths[i]), `${JSON.stringify(data, null, 2)}\n`);
console.log(
  `Version ${version} synchronized. Run npm run gen, npm run build and npm run showcase.`,
);
