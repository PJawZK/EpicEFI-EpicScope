import type { VeDelayTable } from './ve-delay-table';

function cellIndex(table: VeDelayTable, row: number, col: number): number {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= table.rows || col < 0 || col >= table.cols) {
    throw new RangeError('VE delay edit is outside the table geometry.');
  }
  return row * table.cols + col;
}

export interface VeDelayCellPosition {
  readonly row: number;
  readonly col: number;
}

export type VeDelayEdit =
  | { readonly kind: 'set'; readonly workingMs: number | undefined }
  | { readonly kind: 'revert' };

/** Validate the entire selection, then update it in one immutable table pass. */
export function editVeDelayCells(
  table: VeDelayTable,
  positions: readonly VeDelayCellPosition[],
  edit: VeDelayEdit,
): VeDelayTable {
  if (edit.kind === 'set' && edit.workingMs !== undefined && (!Number.isFinite(edit.workingMs) || edit.workingMs < 0)) {
    throw new RangeError('VE delay user edit must be a finite non-negative delay or undefined.');
  }
  const indices = new Set(positions.map(({ row, col }) => cellIndex(table, row, col)));
  if (indices.size === 0) return table;
  let changed = false;
  const cells = table.cells.map((cell, index) => {
    if (!indices.has(index)) return cell;
    const value = edit.kind === 'revert' ? cell.recommendedMs : edit.workingMs;
    const restore = edit.kind === 'revert' || matchesDisplayedRecommendation(value, cell.recommendedMs);
    const workingMs = restore ? cell.recommendedMs : value;
    const workingProvenance = restore ? recommendationProvenance(cell)
      : value === undefined && cell.recommendedMs === undefined ? undefined : 'user-edited';
    if (cell.workingMs === workingMs && cell.workingProvenance === workingProvenance) return cell;
    changed = true;
    return { ...cell, workingMs, workingProvenance };
  });
  return changed ? { ...table, cells } : table;
}

function recommendationProvenance(cell: VeDelayTable['cells'][number]): VeDelayTable['cells'][number]['workingProvenance'] {
  if (cell.recommendedMs === undefined) return undefined;
  return cell.state === 'measured' ? 'measured-recommendation' : 'interpolated-recommendation';
}

function matchesDisplayedRecommendation(workingMs: number | undefined, recommendedMs: number | undefined): boolean {
  if (workingMs === undefined || recommendedMs === undefined) return workingMs === recommendedMs;
  // Delay cells are displayed to whole milliseconds. Treat a value that resolves
  // to the same displayed millisecond as the generated recommendation as a revert,
  // rather than retaining a visually indistinguishable user-edit marker.
  return Math.round(workingMs) === Math.round(recommendedMs);
}

/**
 * Set or explicitly clear one user-editable working delay value while preserving
 * the raw discovered recommendation/evidence in recommendedMs and sourceEvents.
 * Entering the generated value again restores recommendation provenance.
 */
export function setVeDelayWorkingCell(
  table: VeDelayTable,
  row: number,
  col: number,
  workingMs: number | undefined,
): VeDelayTable {
  return editVeDelayCells(table, [{ row, col }], { kind: 'set', workingMs });
}

/** Restore the editable value to the immutable evidence recommendation. */
export function revertVeDelayCellToRecommendation(table: VeDelayTable, row: number, col: number): VeDelayTable {
  return editVeDelayCells(table, [{ row, col }], { kind: 'revert' });
}

/**
 * Promote a recommendation to working authority without throwing away any user
 * edits made while reviewing the recommendation table.
 */
export function activateVeDelayRecommendation(table: VeDelayTable): VeDelayTable {
  return {
    ...table,
    cells: table.cells.map((cell) => ({ ...cell, sourceEvents: [...cell.sourceEvents] })),
  };
}
