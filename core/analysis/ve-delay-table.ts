import { veAnalysisAxisIssue } from './ve-axis-validation';
import type { AfrDelayEvent } from './afr-delay-analyzer';

export type VeDelayCellState = 'measured' | 'interpolated' | 'insufficient';
export type VeDelayConfidence = 'none' | 'limited' | 'moderate' | 'strong';
export type VeDelayWorkingProvenance = 'measured-recommendation' | 'interpolated-recommendation' | 'user-edited';
export type VeDelayTableOrigin = 'log-discovery' | 'saved-file';

export interface VeDelaySourceEvent {
  readonly commandTimeMs: number;
  readonly responseTimeMs: number;
  readonly onsetDelayMs: number;
  readonly rpm: number | undefined;
  readonly load: number | undefined;
  readonly commandDelta: number;
  readonly responseDeltaAfr: number;
}

export interface VeDelayTableCell {
  readonly row: number;
  readonly col: number;
  readonly state: VeDelayCellState;
  readonly recommendedMs: number | undefined;
  readonly workingMs: number | undefined;
  readonly workingProvenance: VeDelayWorkingProvenance | undefined;
  readonly eventCount: number;
  readonly p10Ms: number | undefined;
  readonly p90Ms: number | undefined;
  readonly spreadMs: number | undefined;
  readonly confidence: VeDelayConfidence;
  /** Direct delay-discovery events assigned to this cell, including sparse local events
   * retained when its recommendation is interpolated from neighboring cells. */
  readonly sourceEvents: readonly VeDelaySourceEvent[];
}

export interface VeDelayTable {
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly VeDelayTableCell[];
  readonly origin: VeDelayTableOrigin;
  /** Optional human-readable origin, for example the source log or saved file name. */
  readonly originLabel?: string;
}

export interface VeDelayTableConfig {
  readonly minimumMeasuredEvents?: number;
  readonly interpolationNeighbors?: number;
  /** Maximum normalized RPM/load distance for an interpolation source. */
  readonly maximumInterpolationDistance?: number;
  /** Reduce oversized VE geometry to a dedicated evidence-sized delay grid. Default true. */
  readonly adaptiveGeometry?: boolean;
  /** Optional source-log label retained with the recommendation. */
  readonly originLabel?: string;
}

export interface VeDelayAxes {
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
}

function percentile(values: readonly number[], fraction: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.max(0, Math.min(1, fraction)) * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const lowValue = sorted[low]!;
  const highValue = sorted[high]!;
  return low === high ? lowValue : lowValue + (highValue - lowValue) * (position - low);
}

function confidence(eventCount: number, spreadMs: number | undefined): VeDelayConfidence {
  if (eventCount === 0) return 'none';
  if (eventCount < 3) return 'limited';
  if (eventCount < 6) return 'moderate';
  if (spreadMs !== undefined && spreadMs <= 200) return 'strong';
  return 'moderate';
}

function nearestIndex(value: number, bins: readonly number[]): number | undefined {
  if (!Number.isFinite(value) || bins.length === 0) return undefined;
  if (value < bins[0]! || value > bins[bins.length - 1]!) return undefined;
  let best = 0;
  let distance = Math.abs(value - bins[0]!);
  for (let index = 1; index < bins.length; index += 1) {
    const next = Math.abs(value - bins[index]!);
    if (next < distance) {
      best = index;
      distance = next;
    }
  }
  return best;
}

function normalizedDistance(
  rowA: number,
  colA: number,
  rowB: number,
  colB: number,
  rpmBins: readonly number[],
  loadBins: readonly number[],
): number {
  const rpmSpan = Math.max(1, rpmBins[rpmBins.length - 1]! - rpmBins[0]!);
  const loadSpan = Math.max(1, loadBins[loadBins.length - 1]! - loadBins[0]!);
  const dr = (rpmBins[colA]! - rpmBins[colB]!) / rpmSpan;
  const dl = (loadBins[rowA]! - loadBins[rowB]!) / loadSpan;
  return Math.hypot(dr, dl);
}

function downsampleAxis(values: readonly number[], count: number): number[] {
  if (values.length <= count) return [...values];
  if (count <= 1) return [values[0]!];
  const picked: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.round(index * (values.length - 1) / (count - 1));
    const value = values[sourceIndex]!;
    if (picked[picked.length - 1] !== value) picked.push(value);
  }
  return picked;
}

function eventSummary(event: AfrDelayEvent): VeDelaySourceEvent {
  return {
    commandTimeMs: event.commandTimeMs,
    responseTimeMs: event.responseTimeMs,
    onsetDelayMs: event.onsetDelayMs,
    rpm: event.rpm,
    load: event.load,
    commandDelta: event.commandDelta,
    responseDeltaAfr: event.responseDeltaAfr,
  };
}

/**
 * Delay evidence is much sparser than VE evidence. Derive a dedicated delay grid
 * from the available event count instead of copying every VE node.
 */
export function deriveVeDelayAxes(
  veRpmBins: readonly number[],
  veLoadBins: readonly number[],
  usableEventCount: number,
  minimumMeasuredEvents = 3,
): VeDelayAxes {
  if (veRpmBins.length === 0 || veLoadBins.length === 0) throw new RangeError('VE delay axes require non-empty source axes.');
  const minEvents = Math.max(1, Math.floor(minimumMeasuredEvents));
  const usable = Math.max(0, Math.floor(usableEventCount));
  const desiredCells = Math.max(16, Math.min(100, Math.round(usable / (minEvents + 1))));
  const side = Math.max(4, Math.min(10, Math.round(Math.sqrt(desiredCells))));
  return {
    rpmBins: downsampleAxis(veRpmBins, Math.min(side, veRpmBins.length)),
    loadBins: downsampleAxis(veLoadBins, Math.min(side, veLoadBins.length)),
  };
}

export function buildVeDelayTable(
  events: readonly AfrDelayEvent[],
  rpmBins: readonly number[],
  loadBins: readonly number[],
  config: VeDelayTableConfig = {},
): VeDelayTable {
  for (const [name, axis] of [['Delay RPM', rpmBins], ['Delay load', loadBins]] as const) {
    const issue = veAnalysisAxisIssue(axis);
    if (issue) throw new RangeError(`${name}: ${issue}`);
  }
  const minimumMeasuredEvents = Math.max(1, Math.floor(config.minimumMeasuredEvents ?? 3));
  const interpolationNeighbors = Math.max(2, Math.floor(config.interpolationNeighbors ?? 4));
  const maximumInterpolationDistance = config.maximumInterpolationDistance ?? 0.35;
  if (!Number.isFinite(maximumInterpolationDistance) || maximumInterpolationDistance <= 0) throw new RangeError('VE delay interpolation distance must be finite and > 0.');

  const adaptive = config.adaptiveGeometry !== false && rpmBins.length * loadBins.length > 144;
  const axes = adaptive ? deriveVeDelayAxes(rpmBins, loadBins, events.length, minimumMeasuredEvents) : { rpmBins: [...rpmBins], loadBins: [...loadBins] };
  const tableRpmBins = axes.rpmBins;
  const tableLoadBins = axes.loadBins;
  const rows = tableLoadBins.length;
  const cols = tableRpmBins.length;
  const buckets: AfrDelayEvent[][] = Array.from({ length: rows * cols }, () => []);

  for (const event of events) {
    if (event.rpm === undefined || event.load === undefined || !Number.isFinite(event.onsetDelayMs) || event.onsetDelayMs < 0) continue;
    const col = nearestIndex(event.rpm, tableRpmBins);
    const row = nearestIndex(event.load, tableLoadBins);
    if (row === undefined || col === undefined) continue;
    buckets[row * cols + col]!.push(event);
  }

  const cells: VeDelayTableCell[] = buckets.map((eventsInCell, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const values = eventsInCell.map((event) => event.onsetDelayMs);
    const p10Ms = percentile(values, 0.10);
    const p90Ms = percentile(values, 0.90);
    const spreadMs = p10Ms !== undefined && p90Ms !== undefined ? p90Ms - p10Ms : undefined;
    const medianMs = percentile(values, 0.50);
    const measured = values.length >= minimumMeasuredEvents && medianMs !== undefined;
    return {
      row,
      col,
      state: measured ? 'measured' : 'insufficient',
      recommendedMs: measured ? medianMs : undefined,
      workingMs: measured ? medianMs : undefined,
      workingProvenance: measured ? 'measured-recommendation' : undefined,
      eventCount: values.length,
      p10Ms,
      p90Ms,
      spreadMs,
      confidence: measured ? confidence(values.length, spreadMs) : values.length > 0 ? 'limited' : 'none',
      sourceEvents: eventsInCell.map(eventSummary),
    };
  });

  const measured = cells.filter((cell) => cell.state === 'measured' && cell.recommendedMs !== undefined);
  if (measured.length > 1) {
    const minMeasuredRow = Math.min(...measured.map((cell) => cell.row));
    const maxMeasuredRow = Math.max(...measured.map((cell) => cell.row));
    const minMeasuredCol = Math.min(...measured.map((cell) => cell.col));
    const maxMeasuredCol = Math.max(...measured.map((cell) => cell.col));

    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index]!;
      if (cell.state === 'measured') continue;
      if (cell.row < minMeasuredRow || cell.row > maxMeasuredRow || cell.col < minMeasuredCol || cell.col > maxMeasuredCol) continue;

      const neighbors = measured
        .map((candidate) => ({ candidate, distance: normalizedDistance(cell.row, cell.col, candidate.row, candidate.col, tableRpmBins, tableLoadBins) }))
        .filter((entry) => entry.distance > 0 && entry.distance <= maximumInterpolationDistance)
        .sort((left, right) => left.distance - right.distance)
        .slice(0, interpolationNeighbors);
      if (neighbors.length < 2) continue;

      let weighted = 0;
      let weight = 0;
      for (const neighbor of neighbors) {
        const w = 1 / Math.max(1e-6, neighbor.distance * neighbor.distance);
        weighted += neighbor.candidate.recommendedMs! * w;
        weight += w;
      }
      if (!(weight > 0)) continue;
      const interpolatedMs = weighted / weight;
      cells[index] = {
        ...cell,
        state: 'interpolated',
        recommendedMs: interpolatedMs,
        workingMs: interpolatedMs,
        workingProvenance: 'interpolated-recommendation',
        confidence: 'limited',
      };
    }
  }

  return {
    rpmBins: [...tableRpmBins],
    loadBins: [...tableLoadBins],
    rows,
    cols,
    cells,
    origin: 'log-discovery',
    ...(config.originLabel ? { originLabel: config.originLabel } : {}),
  };
}

export function resetVeDelayWorkingToRecommendation(table: VeDelayTable): VeDelayTable {
  return {
    ...table,
    cells: table.cells.map((cell) => ({
      ...cell,
      workingMs: cell.recommendedMs,
      workingProvenance: cell.recommendedMs === undefined
        ? undefined
        : cell.state === 'measured' ? 'measured-recommendation' : 'interpolated-recommendation',
    })),
  };
}

export function editVeDelayWorkingCell(table: VeDelayTable, row: number, col: number, workingMs: number): VeDelayTable {
  if (!Number.isFinite(workingMs) || workingMs < 0) throw new RangeError('VE delay user edit must be a finite non-negative delay.');
  if (row < 0 || row >= table.rows || col < 0 || col >= table.cols) throw new RangeError('VE delay user edit is outside the table geometry.');
  const index = row * table.cols + col;
  return {
    ...table,
    cells: table.cells.map((cell, cellIndex) => cellIndex === index ? { ...cell, workingMs, workingProvenance: 'user-edited' } : cell),
  };
}

export function revertVeDelayWorkingCell(table: VeDelayTable, row: number, col: number): VeDelayTable {
  if (row < 0 || row >= table.rows || col < 0 || col >= table.cols) throw new RangeError('VE delay revert is outside the table geometry.');
  const index = row * table.cols + col;
  return {
    ...table,
    cells: table.cells.map((cell, cellIndex) => cellIndex === index ? {
      ...cell,
      workingMs: cell.recommendedMs,
      workingProvenance: cell.recommendedMs === undefined
        ? undefined
        : cell.state === 'measured' ? 'measured-recommendation' : 'interpolated-recommendation',
    } : cell),
  };
}

function bracket(value: number, bins: readonly number[]): { low: number; high: number; fraction: number } | undefined {
  if (!Number.isFinite(value) || bins.length === 0 || value < bins[0]! || value > bins[bins.length - 1]!) return undefined;
  if (bins.length === 1 || value === bins[0]) return { low: 0, high: 0, fraction: 0 };
  const last = bins.length - 1;
  if (value === bins[last]) return { low: last, high: last, fraction: 0 };
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (value < bins[mid]!) high = mid;
    else low = mid;
  }
  if (value === bins[low]) return { low, high: low, fraction: 0 };
  const span = bins[high]! - bins[low]!;
  if (!(span > 0)) return undefined;
  return { low, high, fraction: (value - bins[low]!) / span };
}

export function interpolateVeDelayTable(table: VeDelayTable, rpm: number, load: number): number | undefined {
  if (table.rows !== table.loadBins.length || table.cols !== table.rpmBins.length || table.cells.length !== table.rows * table.cols) return undefined;
  const x = bracket(rpm, table.rpmBins);
  const y = bracket(load, table.loadBins);
  if (!x || !y) return undefined;
  const at = (row: number, col: number) => table.cells[row * table.cols + col]?.workingMs;
  const v00 = at(y.low, x.low);
  if (v00 === undefined || !Number.isFinite(v00)) return undefined;
  if (x.low === x.high && y.low === y.high) return v00;
  const v10 = at(y.low, x.high);
  const v01 = at(y.high, x.low);
  const v11 = at(y.high, x.high);
  if (v10 === undefined || v01 === undefined || v11 === undefined || !Number.isFinite(v10) || !Number.isFinite(v01) || !Number.isFinite(v11)) return undefined;
  const top = x.low === x.high ? v00 : v00 + (v10 - v00) * x.fraction;
  const bottom = x.low === x.high ? v01 : v01 + (v11 - v01) * x.fraction;
  return y.low === y.high ? top : top + (bottom - top) * y.fraction;
}
