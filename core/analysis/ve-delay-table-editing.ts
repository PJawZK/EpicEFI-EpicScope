import type { VeDelayTable } from './ve-delay-table';

function cellIndex(table: VeDelayTable, row: number, col: number): number {
  if (row < 0 || row >= table.rows || col < 0 || col >= table.cols) {
    throw new RangeError('VE delay edit is outside the table geometry.');
  }
  return row * table.cols + col;
}

/**
 * Set or explicitly clear one user-editable working delay value while preserving
 * the raw discovered recommendation/evidence in recommendedMs and sourceEvents.
 */
export function setVeDelayWorkingCell(
  table: VeDelayTable,
  row: number,
  col: number,
  workingMs: number | undefined,
): VeDelayTable {
  if (workingMs !== undefined && (!Number.isFinite(workingMs) || workingMs < 0)) {
    throw new RangeError('VE delay user edit must be a finite non-negative delay or undefined.');
  }
  const index = cellIndex(table, row, col);
  return {
    ...table,
    cells: table.cells.map((cell, cellIndexValue) => cellIndexValue === index ? {
      ...cell,
      workingMs,
      // Clearing an originally empty/insufficient cell restores its untouched
      // state. Clearing a cell that has a recommendation remains an explicit
      // user override because it suppresses known delay authority.
      workingProvenance: workingMs === undefined && cell.recommendedMs === undefined
        ? undefined
        : 'user-edited',
    } : cell),
  };
}

/** Restore the editable value to the immutable evidence recommendation. */
export function revertVeDelayCellToRecommendation(table: VeDelayTable, row: number, col: number): VeDelayTable {
  const index = cellIndex(table, row, col);
  return {
    ...table,
    cells: table.cells.map((cell, cellIndexValue) => cellIndexValue === index ? {
      ...cell,
      workingMs: cell.recommendedMs,
      workingProvenance: cell.recommendedMs === undefined
        ? undefined
        : cell.state === 'measured' ? 'measured-recommendation' : 'interpolated-recommendation',
    } : cell),
  };
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
