import type { AfrDelayEvent } from './afr-delay-analyzer';

export type VeDelayCellState = 'measured' | 'interpolated' | 'insufficient';
export type VeDelayConfidence = 'none' | 'limited' | 'moderate' | 'strong';

export interface VeDelayTableCell {
  readonly row: number;
  readonly col: number;
  readonly state: VeDelayCellState;
  readonly recommendedMs: number | undefined;
  readonly workingMs: number | undefined;
  readonly eventCount: number;
  readonly p10Ms: number | undefined;
  readonly p90Ms: number | undefined;
  readonly spreadMs: number | undefined;
  readonly confidence: VeDelayConfidence;
}

export interface VeDelayTable {
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly VeDelayTableCell[];
}

export interface VeDelayTableConfig {
  readonly minimumMeasuredEvents?: number;
  readonly interpolationNeighbors?: number;
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

export function buildVeDelayTable(
  events: readonly AfrDelayEvent[],
  rpmBins: readonly number[],
  loadBins: readonly number[],
  config: VeDelayTableConfig = {},
): VeDelayTable {
  if (rpmBins.length === 0 || loadBins.length === 0) throw new RangeError('VE delay table requires non-empty RPM and load axes.');
  const minimumMeasuredEvents = Math.max(1, Math.floor(config.minimumMeasuredEvents ?? 2));
  const interpolationNeighbors = Math.max(1, Math.floor(config.interpolationNeighbors ?? 4));
  const rows = loadBins.length;
  const cols = rpmBins.length;
  const buckets: number[][] = Array.from({ length: rows * cols }, () => []);

  for (const event of events) {
    if (event.rpm === undefined || event.load === undefined || !Number.isFinite(event.onsetDelayMs) || event.onsetDelayMs < 0) continue;
    const col = nearestIndex(event.rpm, rpmBins);
    const row = nearestIndex(event.load, loadBins);
    if (row === undefined || col === undefined) continue;
    buckets[row * cols + col]!.push(event.onsetDelayMs);
  }

  const cells: VeDelayTableCell[] = buckets.map((values, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
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
      eventCount: values.length,
      p10Ms,
      p90Ms,
      spreadMs,
      confidence: measured ? confidence(values.length, spreadMs) : values.length > 0 ? 'limited' : 'none',
    };
  });

  const measured = cells.filter((cell) => cell.state === 'measured' && cell.recommendedMs !== undefined);
  if (measured.length > 1) {
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index]!;
      if (cell.state === 'measured') continue;
      const neighbors = measured
        .map((candidate) => ({ candidate, distance: normalizedDistance(cell.row, cell.col, candidate.row, candidate.col, rpmBins, loadBins) }))
        .filter((entry) => entry.distance > 0)
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
        confidence: 'limited',
      };
    }
  }

  return { rpmBins: [...rpmBins], loadBins: [...loadBins], rows, cols, cells };
}

export function resetVeDelayWorkingToRecommendation(table: VeDelayTable): VeDelayTable {
  return {
    ...table,
    cells: table.cells.map((cell) => ({ ...cell, workingMs: cell.recommendedMs })),
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
  if (v10 === undefined || v01 === undefined || v11 === undefined) return undefined;
  const top = x.low === x.high ? v00 : v00 + (v10 - v00) * x.fraction;
  const bottom = x.low === x.high ? v01 : v01 + (v11 - v01) * x.fraction;
  return y.low === y.high ? top : top + (bottom - top) * y.fraction;
}
