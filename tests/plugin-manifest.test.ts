import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

// The Claude plugin directory reads the listing from .claude-plugin/: a version and a square icon.
describe('Claude plugin manifest', () => {
  it('carries the package version', () => {
    expect(json('.claude-plugin/plugin.json').version).toBe(json('package.json').version);
  });

  it('ships a square PNG icon of 512–2048 px under 2 MB', () => {
    const png = readFileSync('.claude-plugin/icon.png');
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    expect(w).toBe(h);
    expect(w).toBeGreaterThanOrEqual(512);
    expect(w).toBeLessThanOrEqual(2048);
    expect(png.length).toBeLessThan(2 * 1024 * 1024);
  });

  it('the MCP Registry entry names the package version', () => {
    const server = json('server.json');
    const pkg = json('package.json');
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0].version).toBe(pkg.version);
    expect(server.name).toBe(pkg.mcpName);
  });
});
