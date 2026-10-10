import type { Diagnostic } from '../qa/codes.ts';

export const EXIT = { ok: 0, deckErrors: 1, usage: 2, engine: 3 } as const;

export function wantsJson(flag?: boolean): boolean {
  return flag === true || (flag !== false && !process.stdout.isTTY);
}

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
export const red = (s: string) => paint('31', s);
export const yellow = (s: string) => paint('33', s);
export const green = (s: string) => paint('32', s);
export const dim = (s: string) => paint('2', s);
export const bold = (s: string) => paint('1', s);

export function formatDiagnostic(d: Diagnostic): string {
  const icon =
    d.severity === 'error' ? red('✖') : d.severity === 'warning' ? yellow('▲') : dim('ℹ');
  const where = [d.slide ? `[${d.slide}]` : '', d.pointer ?? ''].filter(Boolean).join(' ');
  let s = `${icon} ${bold(d.code)} ${dim(where)}\n    ${d.message}`;
  if (d.measured || d.limit)
    s += dim(`\n    measured: ${d.measured ?? '—'}   limit: ${d.limit ?? '—'}`);
  if (d.hint) s += `\n    ${dim('fix:')} ${d.hint}`;
  return s;
}

export function summary(ds: Diagnostic[]): string {
  const e = ds.filter((d) => d.severity === 'error').length;
  const w = ds.filter((d) => d.severity === 'warning').length;
  const i = ds.filter((d) => d.severity === 'info').length;
  const head = e ? red(`${e} error${e === 1 ? '' : 's'}`) : green('0 errors');
  return `${head}, ${w} warning${w === 1 ? '' : 's'}, ${i} note${i === 1 ? '' : 's'}`;
}

export function printJson(v: unknown): void {
  process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
}
