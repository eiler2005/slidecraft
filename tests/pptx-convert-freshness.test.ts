import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToPdf } from '../src/backends/pptx-convert.ts';

const state = vi.hoisted(() => ({ write: true, jobs: [] as string[] }));
vi.mock('node:child_process', () => ({
  spawnSync: () => ({ status: 0, stdout: '/fake/soffice\n' }),
  execFileSync: (_bin: string, args: string[]) => {
    const dir = args[args.indexOf('--outdir') + 1]!;
    const input = args.at(-1)!;
    state.jobs.push(input);
    if (state.write)
      writeFileSync(join(dir, basename(input).replace(/\.pptx$/, '.pdf')), '%PDF-1.7\nfresh');
    return Buffer.from('');
  },
}));
afterEach(() => vi.unstubAllEnvs());

describe('Office conversion freshness', () => {
  it('uses isolated jobs and replaces an old PDF only with a newly produced PDF', () => {
    vi.stubEnv('SLIDECRAFT_CONVERTER', 'libreoffice');
    vi.stubEnv('SOFFICE_PATH', '');
    const dir = mkdtempSync(join(tmpdir(), 'sc-fresh-test-'));
    try {
      const input = join(dir, 'client.pptx');
      const output = join(dir, 'existing.pdf');
      writeFileSync(input, 'input bytes');
      writeFileSync(output, '%PDF-1.7\nold');
      state.write = true;
      convertToPdf(input, output);
      expect(readFileSync(output, 'utf8')).toBe('%PDF-1.7\nfresh');
      convertToPdf(input, output);
      expect(state.jobs.at(-1)).not.toBe(state.jobs.at(-2));
      expect(state.jobs.at(-1)).not.toBe(input);
      expect(readFileSync(input, 'utf8')).toBe('input bytes');
      state.write = false;
      expect(() => convertToPdf(input, output)).toThrow('no fresh valid PDF');
      expect(readFileSync(output, 'utf8')).toBe('%PDF-1.7\nfresh');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
