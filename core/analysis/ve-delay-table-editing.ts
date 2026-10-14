import type { VeDelayTable } from './ve-delay-table';

function cellIndex(table: VeDelayTable, row: number, col: number): number {
  if (row < 0 || row >= table.rows || col < 0 || col >= table.cols) {
    throw new RangeError('VE delay edit is outside the table geometry.');
  }
  return row * table.cols + col;
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
  if (workingMs !== undefined && (!Number.isFinite(workingMs) || workingMs < 0)) {
    throw new RangeError('VE delay user edit must be a finite non-negative delay or undefined.');
  }
  const index = cellIndex(table, row, col);
  return {
    ...table,
    cells: table.cells.map((cell, cellIndexValue) => {
      if (cellIndexValue !== index) return cell;
      if (matchesDisplayedRecommendation(workingMs, cell.recommendedMs)) {
        return {
          ...cell,
          workingMs: cell.recommendedMs,
          workingProvenance: recommendationProvenance(cell),
        };
      }
      return {
        ...cell,
        workingMs,
        // Clearing an originally empty/insufficient cell restores its untouched
        // state. Clearing a cell that has a recommendation remains an explicit
        // user override because it suppresses known delay authority.
        workingProvenance: workingMs === undefined && cell.recommendedMs === undefined
          ? undefined
          : 'user-edited',
      };
    }),
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
      workingProvenance: recommendationProvenance(cell),
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
