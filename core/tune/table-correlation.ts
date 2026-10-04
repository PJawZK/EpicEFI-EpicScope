import type { NumericChannelRange } from '../log-model/log-types';
import type { TuneModel } from './tune-model';

export interface TuneTable2D {
  readonly name: string;
  readonly units: string | undefined;
  readonly xAxisName: string;
  readonly yAxisName: string;
  readonly xAxis: readonly number[];
  readonly yAxis: readonly number[];
  readonly values: readonly number[];
  readonly rows: number;
  readonly cols: number;
}

export interface TuneTablePoint {
  readonly xLowerIndex: number;
  readonly xUpperIndex: number;
  readonly yLowerIndex: number;
  readonly yUpperIndex: number;
  readonly xFraction: number;
  readonly yFraction: number;
  readonly nearestCol: number;
  readonly nearestRow: number;
  readonly interpolatedTuneValue: number;
}

export interface TuneTableCellEvidence {
  readonly row: number;
  readonly col: number;
  readonly tuneValue: number;
  readonly sampleCount: number;
  readonly observedMean: number | undefined;
  readonly observedMin: number | undefined;
  readonly observedMax: number | undefined;
  readonly observedStandardDeviation: number | undefined;
  readonly meanInterpolatedTuneValue: number | undefined;
  readonly meanError: number | undefined;
}

export interface TuneTableCorrelationOptions {
  readonly sampleIndices?: ArrayLike<number>;
  readonly complete?: boolean;
  readonly valueRelation?: 'none' | 'observed-minus-tune';
}

export interface TuneTableCorrelationResult {
  readonly table: TuneTable2D;
  readonly cells: readonly TuneTableCellEvidence[];
  readonly inputSampleCount: number;
  readonly mappedSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly complete: boolean;
}

function monotonic(values: readonly number[]): boolean {
  if (values.length < 2) return values.length === 1;
  let direction = 0;
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index]! - values[index - 1]!;
    if (delta === 0) continue;
    const nextDirection = delta > 0 ? 1 : -1;
    if (direction !== 0 && direction !== nextDirection) return false;
    direction = nextDirection;
  }
  return direction !== 0;
}

export function createTuneTable2D(
  model: TuneModel,
  definition: { readonly tableName: string; readonly xAxisName: string; readonly yAxisName: string },
): TuneTable2D {
  const table = model.byName.get(definition.tableName);
  const xAxis = model.byName.get(definition.xAxisName);
  const yAxis = model.byName.get(definition.yAxisName);
  if (!table?.numericValues || table.kind !== 'table') throw new RangeError(`Tune table is unavailable or not 2D: ${definition.tableName}`);
  if (!xAxis?.numericValues) throw new RangeError(`Tune X axis is unavailable or non-numeric: ${definition.xAxisName}`);
  if (!yAxis?.numericValues) throw new RangeError(`Tune Y axis is unavailable or non-numeric: ${definition.yAxisName}`);
  if (xAxis.numericValues.length !== table.cols) throw new RangeError('Tune X axis length does not match table columns.');
  if (yAxis.numericValues.length !== table.rows) throw new RangeError('Tune Y axis length does not match table rows.');
  if (table.numericValues.length !== table.rows * table.cols) throw new RangeError('Tune table value count does not match rows × columns.');
  if (!monotonic(xAxis.numericValues) || !monotonic(yAxis.numericValues)) throw new RangeError('Tune table axes must be strictly monotonic apart from repeated adjacent values.');
  return {
    name: table.name,
    units: table.units,
    xAxisName: xAxis.name,
    yAxisName: yAxis.name,
    xAxis: xAxis.numericValues,
    yAxis: yAxis.numericValues,
    values: table.numericValues,
    rows: table.rows,
    cols: table.cols,
  };
}

function bracket(axis: readonly number[], value: number): { lower: number; upper: number; fraction: number; nearest: number } {
  const ascending = axis.length < 2 || axis[axis.length - 1]! >= axis[0]!;
  const ordered = ascending ? axis : [...axis].reverse();
  let lowerOrdered = 0;
  let upperOrdered = 0;
  let fraction = 0;
  if (value <= ordered[0]!) {
    lowerOrdered = upperOrdered = 0;
  } else if (value >= ordered[ordered.length - 1]!) {
    lowerOrdered = upperOrdered = ordered.length - 1;
  } else {
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const a = ordered[index]!;
      const b = ordered[index + 1]!;
      if (value < a || value > b) continue;
      lowerOrdered = index;
      upperOrdered = index + 1;
      fraction = b === a ? 0 : (value - a) / (b - a);
      break;
    }
  }
  const toOriginal = (index: number): number => ascending ? index : axis.length - 1 - index;
  const lower = toOriginal(lowerOrdered);
  const upper = toOriginal(upperOrdered);
  const nearest = fraction <= 0.5 ? lower : upper;
  return { lower, upper, fraction, nearest };
}

function tableValue(table: TuneTable2D, row: number, col: number): number {
  return table.values[row * table.cols + col]!;
}

export function locateTuneTablePoint(table: TuneTable2D, x: number, y: number): TuneTablePoint {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Tune table coordinates must be finite.');
  const bx = bracket(table.xAxis, x);
  const by = bracket(table.yAxis, y);
  const v00 = tableValue(table, by.lower, bx.lower);
  const v10 = tableValue(table, by.lower, bx.upper);
  const v01 = tableValue(table, by.upper, bx.lower);
  const v11 = tableValue(table, by.upper, bx.upper);
  const top = v00 + (v10 - v00) * bx.fraction;
  const bottom = v01 + (v11 - v01) * bx.fraction;
  return {
    xLowerIndex: bx.lower,
    xUpperIndex: bx.upper,
    yLowerIndex: by.lower,
    yUpperIndex: by.upper,
    xFraction: bx.fraction,
    yFraction: by.fraction,
    nearestCol: bx.nearest,
    nearestRow: by.nearest,
    interpolatedTuneValue: top + (bottom - top) * by.fraction,
  };
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  return Number.isSafeInteger(index) && index >= 0 && index < range.values.length && index < range.validity.length ? index : undefined;
}

interface MutableCell {
  count: number;
  mean: number;
  m2: number;
  min: number;
  max: number;
  tuneMean: number;
  errorMean: number;
}

export function correlateNumericSamplesToTuneTable(
  table: TuneTable2D,
  xRange: NumericChannelRange,
  yRange: NumericChannelRange,
  observedRange: NumericChannelRange,
  options: TuneTableCorrelationOptions = {},
): TuneTableCorrelationResult {
  const relation = options.valueRelation ?? 'none';
  const mutable = Array.from({ length: table.rows * table.cols }, (): MutableCell => ({
    count: 0, mean: 0, m2: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, tuneMean: 0, errorMean: 0,
  }));
  const sampleIndices = options.sampleIndices
    ? Array.from({ length: options.sampleIndices.length }, (_, index) => options.sampleIndices![index]!)
    : Array.from({ length: xRange.values.length }, (_, index) => xRange.startSampleIndex + index);
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;
  let mappedSampleCount = 0;

  for (const sampleIndex of sampleIndices) {
    const xi = localIndex(xRange, sampleIndex);
    const yi = localIndex(yRange, sampleIndex);
    const oi = localIndex(observedRange, sampleIndex);
    if (xi === undefined || yi === undefined || oi === undefined) { unavailableSampleCount += 1; continue; }
    const x = xRange.values[xi];
    const y = yRange.values[yi];
    const observed = observedRange.values[oi];
    if (xRange.validity[xi] !== 1 || yRange.validity[yi] !== 1 || observedRange.validity[oi] !== 1
      || x === undefined || y === undefined || observed === undefined
      || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(observed)) {
      invalidSampleCount += 1;
      continue;
    }
    const point = locateTuneTablePoint(table, x, y);
    const cell = mutable[point.nearestRow * table.cols + point.nearestCol]!;
    cell.count += 1;
    const delta = observed - cell.mean;
    cell.mean += delta / cell.count;
    cell.m2 += delta * (observed - cell.mean);
    cell.min = Math.min(cell.min, observed);
    cell.max = Math.max(cell.max, observed);
    cell.tuneMean += (point.interpolatedTuneValue - cell.tuneMean) / cell.count;
    if (relation === 'observed-minus-tune') {
      const error = observed - point.interpolatedTuneValue;
      cell.errorMean += (error - cell.errorMean) / cell.count;
    }
    mappedSampleCount += 1;
  }

  const cells = mutable.map((cell, index): TuneTableCellEvidence => ({
    row: Math.floor(index / table.cols),
    col: index % table.cols,
    tuneValue: table.values[index]!,
    sampleCount: cell.count,
    observedMean: cell.count ? cell.mean : undefined,
    observedMin: cell.count ? cell.min : undefined,
    observedMax: cell.count ? cell.max : undefined,
    observedStandardDeviation: cell.count ? (cell.count === 1 ? 0 : Math.sqrt(cell.m2 / (cell.count - 1))) : undefined,
    meanInterpolatedTuneValue: cell.count ? cell.tuneMean : undefined,
    meanError: relation === 'observed-minus-tune' && cell.count ? cell.errorMean : undefined,
  }));

  return {
    table,
    cells,
    inputSampleCount: sampleIndices.length,
    mappedSampleCount,
    invalidSampleCount,
    unavailableSampleCount,
    complete: options.complete === true && unavailableSampleCount === 0,
  };
}
