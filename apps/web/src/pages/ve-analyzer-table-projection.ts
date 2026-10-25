import type { VeEvidenceMapResult } from '../../../../core/analysis/ve-evidence-map';
import type { VeProposalResult } from '../../../../core/analysis/ve-proposal';
import type { VeCellMetrics } from './ve-analyzer-result-view';

/** Working values come from the review owner, never from formatted table text. */
export function veWorkingCellMetrics(original: number | undefined, working: number | undefined) {
  const value = working !== undefined && Number.isFinite(working) ? working : undefined;
  const change = value !== undefined && original !== undefined && Number.isFinite(original) ? value - original : undefined;
  return { value, change, changePercent: change !== undefined && original !== undefined && original !== 0 ? change / original * 100 : undefined };
}

export interface VeTableProjection {
  /** Borrowed immutable tune values for presentation comparisons, not edit/revert authority. */
  readonly originalValues: readonly number[];
  readonly rows: number;
  readonly cols: number;
  readonly rpmBins: readonly number[] | undefined;
  readonly loadBins: readonly number[] | undefined;
  readonly cells: readonly VeCellMetrics[];
  readonly heatRange: { readonly min: number; readonly max: number } | undefined;
}

/** Source/generated metrics only. Editable review values retain their own owner. */
export function projectVeTable(
  values: readonly number[], rows: number, cols: number,
  rpmBins?: readonly number[], loadBins?: readonly number[],
  evidence?: Pick<VeEvidenceMapResult, 'cells'>, proposal?: Pick<VeProposalResult, 'cells'>,
): VeTableProjection {
  let min = Infinity, max = -Infinity;
  const cells: VeCellMetrics[] = [];
  for (let index = 0; index < rows * cols; index++) {
    const raw = values[index];
    const current = raw !== undefined && Number.isFinite(raw) ? raw : undefined;
    if (current !== undefined) { min = Math.min(min, current); max = Math.max(max, current); }
    const candidate = proposal?.cells[index];
    const measured = evidence?.cells[index];
    const retained = measured && measured.totalWeight > 0 ? measured : undefined;
    cells.push({
      state: candidate?.state ?? 'no-evidence', current,
      proposed: candidate?.proposedValue, evidenceCandidate: candidate?.evidenceCandidate,
      changeValue: candidate?.changeValue, changePercent: candidate?.changePercent,
      correctionPercent: retained?.correctionPercent, spreadPercent: retained?.correctionSpreadPercent,
      confidence: retained?.confidence, weight: retained?.totalWeight, samples: retained?.sampleCount,
    });
  }
  return { originalValues: values, rows, cols, rpmBins, loadBins, cells, heatRange: min === Infinity ? undefined : { min, max } };
}

export function veSourceHeatLevel(projection: VeTableProjection, value: number | undefined): string | undefined {
  const range = projection.heatRange;
  if (value === undefined || !Number.isFinite(value) || !range) return undefined;
  return range.min === range.max ? '0.5' : String(Math.max(0, Math.min(1, (value - range.min) / (range.max - range.min))));
}

// A table replacement publishes a new projection. Retired DOM and its projection
// are weakly held; changing Result View neither recalculates nor invalidates it.
const projections = new WeakMap<HTMLTableElement, VeTableProjection>();
export function publishVeTableProjection(table: HTMLTableElement, projection: VeTableProjection): void {
  projections.set(table, projection);
}
export function veTableProjection(table: HTMLTableElement): VeTableProjection | undefined {
  return projections.get(table);
}
