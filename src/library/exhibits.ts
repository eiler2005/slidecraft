/** Semantic routing into the existing layout library, not a second template system. */
import { getLayout } from '../layouts/index.ts';

export const EXHIBITS = [
  {
    id: 'comparison',
    question: 'How do items compare on the same basis?',
    layouts: ['chart-takeaway', 'options-comparison', 'data-table', 'before-after'],
    guard: 'Use the same criteria, units and period.',
  },
  {
    id: 'trend',
    question: 'What changes over time?',
    layouts: ['chart-takeaway', 'timeline'],
    guard: 'Use a shared time axis; do not imply causation from correlation.',
  },
  {
    id: 'bridge',
    question: 'Which drivers connect a starting value to an ending value?',
    layouts: ['waterfall'],
    guard: 'The signed drivers must reconcile the start and end totals.',
  },
  {
    id: 'composition',
    question: 'What makes up the whole?',
    layouts: ['chart-takeaway', 'marimekko', 'funnel', 'treemap'],
    guard: 'Use meaningful parts, consistent bases and a complete total.',
  },
  {
    id: 'headline-evidence',
    question: 'Which headline observation supports distinct parallel explanations?',
    layouts: ['kpi-tiles', 'big-statement', 'evidence-panorama'],
    guard: 'Card area does not encode magnitude; a metric with four categories is not a ranking.',
  },
  {
    id: 'parallel-points',
    question: 'Which independent points support the message?',
    layouts: ['key-points', 'text', 'exec-summary'],
    guard: 'Do not draw arrows between points that have no sequential relationship.',
  },
  {
    id: 'process',
    question: 'What happens in sequence and what changes?',
    layouts: [
      'process-steps',
      'process-compare',
      'timeline',
      'gate-matrix',
      'cadence',
      'swimlane',
      'flowchart',
      'sequence',
      'state-machine',
      'loop',
      'kanban',
      'story-map',
    ],
    guard: 'Distinguish steps, dates, hand-offs and decision gates.',
  },
  {
    id: 'architecture',
    question: 'Which components connect, and across which boundaries?',
    layouts: [
      'architecture',
      'architecture-delta',
      'dependency-graph',
      'layer-stack',
      'nested',
      'coverage-map',
      'callout',
      'er-diagram',
      'database-schema',
      'uml-class',
    ],
    guard: 'Connections and identifiers must retain their meaning and endpoints.',
  },
  {
    id: 'causes-and-evidence',
    question: 'What drives a result or supports an answer?',
    layouts: ['issue-tree', 'evidence-chain', 'tornado', 'fishbone'],
    guard: 'Distinguish a hypothesis, a measured contribution and verified evidence.',
  },
  {
    id: 'prioritisation',
    question: 'Where should attention or investment go?',
    layouts: [
      'matrix-2x2',
      'bubble-chart',
      'risk-matrix',
      'maturity-model',
      'football-field',
      'radar',
      'wardley-map',
    ],
    guard: 'Define axes and scoring; label uncertainty and range assumptions.',
  },
  {
    id: 'ownership',
    question: 'Who performs, decides or is accountable?',
    layouts: ['raci', 'org-chart', 'team-cards', 'next-steps'],
    guard: 'Reporting lines are not decision rights.',
  },
  {
    id: 'flow-quantities',
    question: 'Where does a conserved quantity split and merge?',
    layouts: ['sankey'],
    guard: 'Use one unit and scale, balance intermediate nodes, and name losses explicitly.',
  },
  {
    id: 'matrix-pattern',
    question: 'Which categorical row and column combinations stand out?',
    layouts: ['heatmap', 'security-matrix'],
    guard: 'Distinguish numeric magnitude, missing observations and categorical access rights.',
  },
  {
    id: 'experience',
    question: 'Where does an experience fail and what happens behind it?',
    layouts: ['user-journey', 'service-blueprint'],
    guard: 'Source sentiment and distinguish customer-visible from backstage actions.',
  },
  {
    id: 'spatial-structure',
    question: 'How do parts fit in space or through containment?',
    layouts: ['nested', 'venn', 'exploded-axonometric', 'axonometric-plan'],
    guard: 'Do not imply quantitative areas for qualitative overlap; preserve spatial dimensions.',
  },
  {
    id: 'cyclic-magnitude',
    question: 'How does magnitude vary across an ordered cycle?',
    layouts: ['polar'],
    guard:
      'Preserve category order and use a common linear radius; a circle alone does not establish a cycle.',
  },
  {
    id: 'strategic-framework',
    question: 'Which factors shape a strategic choice?',
    layouts: ['swot', 'pestel', 'five-forces', 'business-model-canvas', 'value-chain', 'seven-s'],
    guard: 'Use evidence and implications, not boxes filled for completeness.',
  },
] as const;

export function exhibitRoutes(id?: string) {
  return EXHIBITS.filter((entry) => !id || entry.id === id).map((entry) => ({
    ...entry,
    reference: 'library/references/exhibit-selection.md',
    layouts: entry.layouts.map((id) => {
      const layout = getLayout(id);
      if (!layout) throw new Error(`Semantic route references missing layout ${id}`);
      return {
        id,
        variants: layout.variants,
        purpose: layout.purpose,
        useWhen: layout.useWhen,
        avoidWhen: layout.avoidWhen,
        contractCommand: `slidecraft layouts ${id} --json`,
      };
    }),
  }));
}
