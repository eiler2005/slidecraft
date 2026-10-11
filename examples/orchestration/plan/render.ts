// Renders orchestration.yaml into orchestration.json and orchestration.md (same folder).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

interface Stage {
  id: string;
  title: string;
  agent: string | string[];
  model: string | string[];
  commands: string[];
  outputs: string[];
  template: string;
  handoff?: string;
  checkpoint?: string;
}
const dir = import.meta.dirname;
const plan = YAML.parse(readFileSync(join(dir, 'orchestration.yaml'), 'utf8')) as {
  models: Record<string, { id: string; use: string }>;
  policy: Record<string, string>;
  stages: Stage[];
};
writeFileSync(join(dir, 'orchestration.json'), `${JSON.stringify(plan, null, 2)}\n`);
const list = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
const model = (m: string) => (plan.models[m] ? `${m} (${plan.models[m]!.id})` : m);
const md = [
  '# Orchestration plan',
  '',
  'Generated from `orchestration.yaml`. Templates are in `../templates/`; a complete run is in `../run/`.',
  '',
  '| # | Stage | Agent | Model | Template / hand-off | Outputs | Checkpoint |',
  '|---|---|---|---|---|---|---|',
  ...plan.stages.map(
    (s, i) =>
      `| ${i + 1} | ${s.title} | ${list(s.agent).join(' → ')} | ${list(s.model).map(model).join(' → ')} | ${[
        s.template,
        s.handoff,
      ]
        .filter(Boolean)
        .map((t) => `[${t!.split('/').pop()}](../${t})`)
        .join('<br>')} | ${s.outputs.join(', ')} | ${s.checkpoint ?? '—'} |`,
  ),
  '',
  '## Policy',
  '',
  ...Object.entries(plan.policy).map(([k, v]) => `- **${k}** — ${v}`),
  '',
  '## Commands per stage',
  '',
  ...plan.stages.flatMap((s) =>
    s.commands.length ? [`- ${s.title}: ${s.commands.map((c) => `\`${c}\``).join(', ')}`] : [],
  ),
  '',
];
writeFileSync(join(dir, 'orchestration.md'), md.join('\n'));
console.log('orchestration.json + orchestration.md written');
