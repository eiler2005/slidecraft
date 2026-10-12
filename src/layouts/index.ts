import { agenda } from './agenda.ts';
import { architecture } from './architecture.ts';
import { beforeAfter } from './before-after.ts';
import { bigStatement } from './big-statement.ts';
import { bubbleChart } from './bubble-chart.ts';
import { businessModelCanvas } from './business-model-canvas.ts';
import { cadence } from './cadence.ts';
import { callout } from './callout.ts';
import { chartTakeaway } from './chart-takeaway.ts';
import { composition } from './composition.ts';
import { coverageMap } from './coverage-map.ts';
import { dataTable } from './data-table.ts';
import { evidenceChain } from './evidence-chain.ts';
import { evidencePanorama } from './evidence-panorama.ts';
import { execSummary } from './exec-summary.ts';
import { fiveForces } from './five-forces.ts';
import { footballField } from './football-field.ts';
import { freeform } from './freeform.ts';
import { freeformCanvas } from './freeform-canvas.ts';
import { funnel } from './funnel.ts';
import { gateMatrix } from './gate-matrix.ts';
import { issueTree } from './issue-tree.ts';
import { keyPoints } from './key-points.ts';
import { kpiTiles } from './kpi-tiles.ts';
import { marimekko } from './marimekko.ts';
import { matrix2x2 } from './matrix-2x2.ts';
import { maturityModel } from './maturity-model.ts';
import { nativeCanvas } from './native-canvas.ts';
import { nextSteps } from './next-steps.ts';
import { optionsComparison } from './options-comparison.ts';
import { orgChart } from './org-chart.ts';
import { pestel } from './pestel.ts';
import { processCompare } from './process-compare.ts';
import { processSteps } from './process-steps.ts';
import { raci } from './raci.ts';
import { riskMatrix } from './risk-matrix.ts';
import { sevenS } from './seven-s.ts';
import { swot } from './swot.ts';
import { teamCards } from './team-cards.ts';
import { text } from './text.ts';
import { textImage } from './text-image.ts';
import { timeline } from './timeline.ts';
import { title } from './title.ts';
import { tornado } from './tornado.ts';
import type { LayoutDef } from './types.ts';
import { valueChain } from './value-chain.ts';
import { waterfall } from './waterfall.ts';

/**
 * Layout registry. Order is the catalog order shown to users and agents
 * (frame → message → numbers → decide → sequence → people → close).
 */
export const LAYOUTS: LayoutDef[] = [
  title,
  agenda,
  execSummary,
  keyPoints,
  composition,
  bigStatement,
  textImage,
  text,
  beforeAfter,
  freeform,
  freeformCanvas,
  nativeCanvas,
  kpiTiles,
  evidencePanorama,
  chartTakeaway,
  waterfall,
  bubbleChart,
  marimekko,
  tornado,
  footballField,
  funnel,
  dataTable,
  optionsComparison,
  matrix2x2,
  swot,
  fiveForces,
  pestel,
  businessModelCanvas,
  valueChain,
  sevenS,
  issueTree,
  maturityModel,
  coverageMap,
  architecture,
  evidenceChain,
  riskMatrix,
  processSteps,
  timeline,
  gateMatrix,
  processCompare,
  cadence,
  callout,
  teamCards,
  orgChart,
  raci,
  nextSteps,
] as unknown as LayoutDef[];

export function getLayout(id: string): LayoutDef | undefined {
  return LAYOUTS.find((l) => l.id === id);
}
