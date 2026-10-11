import type { ChartNode } from './scene.ts';

const fmt = (v: number) => String(+v.toFixed(2));

/**
 * Alt text for a chart in reader terms (screen readers, PDF Figure, PPTX descr): helper
 * series (highlight "(other)", "(below zero)", the waterfall base) fold back into the
 * values the reader sees.
 */
export function chartAlt(n: ChartNode): string {
  const visible = n.series.filter((s) => !s.invisible);
  const base = (name: string) => name.replace(/ \((other|below zero)\)$/, '');
  let body: string;
  if (n.type === 'waterfall') {
    const sum = (re: RegExp, i: number) =>
      visible.filter((s) => re.test(s.name)).reduce((a, s) => a + (s.values[i] ?? 0), 0);
    body = n.categories
      .map((c, i) => {
        const tot = sum(/^Total/, i);
        const inc = sum(/^Increase/, i);
        const dec = sum(/^Decrease/, i);
        return `${c} ${tot ? fmt(tot) : inc ? `+${fmt(inc)}` : dec ? `−${fmt(dec)}` : '0'}`;
      })
      .join(', ');
  } else {
    const groups = new Map<string, number[]>();
    for (const s of visible) {
      const g = groups.get(base(s.name)) ?? n.categories.map(() => 0);
      s.values.forEach((v, i) => {
        g[i] = (g[i] ?? 0) + v;
      });
      groups.set(base(s.name), g);
    }
    body = [...groups]
      .map(
        ([name, vals]) =>
          `${name} — ${n.categories.map((c, i) => `${c} ${fmt(vals[i] ?? 0)}`).join(', ')}`,
      )
      .join('; ');
  }
  return `Chart: ${body}`.slice(0, 1000);
}
