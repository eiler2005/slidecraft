import { agenda } from './agenda.ts';
import { bigStatement } from './big-statement.ts';
import { chartTakeaway } from './chart-takeaway.ts';
import { dataTable } from './data-table.ts';
import { execSummary } from './exec-summary.ts';
import { keyPoints } from './key-points.ts';
import { kpiTiles } from './kpi-tiles.ts';
import { matrix2x2 } from './matrix-2x2.ts';
import { nextSteps } from './next-steps.ts';
import { optionsComparison } from './options-comparison.ts';
import { processSteps } from './process-steps.ts';
import { teamCards } from './team-cards.ts';
import { textImage } from './text-image.ts';
import { timeline } from './timeline.ts';
import { title } from './title.ts';
import type { LayoutDef } from './types.ts';
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
  bigStatement,
  textImage,
  kpiTiles,
  chartTakeaway,
  waterfall,
  dataTable,
  optionsComparison,
  matrix2x2,
  processSteps,
  timeline,
  teamCards,
  nextSteps,
] as unknown as LayoutDef[];

export function getLayout(id: string): LayoutDef | undefined {
  return LAYOUTS.find((l) => l.id === id);
}
