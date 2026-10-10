import { chartTakeaway } from './chart-takeaway.ts';
import { execSummary } from './exec-summary.ts';
import { title } from './title.ts';
import type { LayoutDef } from './types.ts';

/**
 * Layout registry. Order is the catalog order shown to users and agents
 * (frame → message → numbers → decide → sequence → people → close).
 */
export const LAYOUTS: LayoutDef[] = [title, execSummary, chartTakeaway] as unknown as LayoutDef[];

export function getLayout(id: string): LayoutDef | undefined {
  return LAYOUTS.find((l) => l.id === id);
}
