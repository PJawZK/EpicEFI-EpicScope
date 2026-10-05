import type { NumericChannelRange } from '../log-model/log-types';
import {
  aggregateNumericSamples,
  numericAggregationValue,
  type NumericAggregationMethod,
} from './numeric-aggregation';

export interface NumericHeatmapOptions {
  /** Optional source sample indices, for example qualification output. */
  readonly sampleIndices?: ArrayLike<number>;
  readonly xBinCount?: number;
  readonly yBinCount?: number;
  readonly xMin?: number;
  readonly xMax?: number;
  readonly yMin?: number;
  readonly yMax?: number;
  /** Optional explicit cell-center values. When supplied, irregular midpoint boundaries are used. */
  readonly xAxisValues?: readonly number[];
  readonly yAxisValues?: readonly number[];
  /** Clamp values beyond explicit-axis midpoint bounds into the nearest edge cell. */
  readonly clampExplicitAxisEdges?: boolean;
  /** Cell statistic. Defaults to sample count/density. */
  readonly aggregation?: NumericAggregationMethod;
  /** Required for every aggregation other than count. */
  readonly valueRange?: NumericChannelRange;
}

export interface NumericHeatmapAxisBin {
  readonly index: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  /** Display/table center. Equals the midpoint for uniform bins and the requested breakpoint for explicit axes. */
  readonly centerValue: number;
  readonly includesUpperBound: boolean;
}

export interface NumericHeatmapResult {
  readonly xBins: readonly NumericHeatmapAxisBin[];
  readonly yBins: readonly NumericHeatmapAxisBin[];
  /** Row-major X/Y pair counts: index = yIndex * xBins.length + xIndex. */
  readonly counts: Uint32Array;
  /** Row-major selected aggregation value. Empty/non-computable cells are NaN. */
  readonly cellValues: Float64Array;
  /** Row-major valid value samples contributing to the cell aggregation. */
  readonly cellValueSampleCounts: Uint32Array;
  /** Exact source sample indices contributing X/Y pairs to each row-major cell. */
  readonly cellSampleIndices: readonly Uint32Array[];
  readonly aggregationMethod: NumericAggregationMethod;
  readonly cellValueMin: number | undefined;
  readonly cellValueMax: number | undefined;
  readonly xRangeMin: number | undefined;
  readonly xRangeMax: number | undefined;
  readonly yRangeMin: number | undefined;
  readonly yRangeMax: number | undefined;
  readonly xBinWidth: number | undefined;
  readonly yBinWidth: number | undefined;
  readonly inputSampleCount: number;
  readonly validPairSampleCount: number;
  readonly binnedSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly outsideRangeSampleCount: number;
  readonly xBelowRangeSampleCount: number;
  readonly xAboveRangeSampleCount: number;
  readonly yBelowRangeSampleCount: number;
  readonly yAboveRangeSampleCount: number;
  /** Value-channel evidence among X/Y pairs that landed inside a cell. */
  readonly valueValidSampleCount: number;
  readonly valueInvalidSampleCount: number;
  readonly valueUnavailableSampleCount: number;
  readonly maxCellCount: number;
}

interface PairSample {
  readonly sampleIndex: number;
  readonly x: number;
  readonly y: number;
}

interface PairScan {
  readonly inputSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly validPairs: readonly PairSample[];
  readonly xObservedMin: number | undefined;
  readonly xObservedMax: number | undefined;
  readonly yObservedMin: number | undefined;
  readonly yObservedMax: number | undefined;
}

function normalizedBinCount(value: number | undefined, axis: 'x' | 'y'): number {
  if (value === undefined) return 20;
  if (!Number.isFinite(value)) throw new RangeError(`heatmap ${axis}BinCount must be finite.`);
  return Math.min(256, Math.max(1, Math.floor(value)));
}

function requestedBound(value: number | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) throw new RangeError(`heatmap ${name} must be finite.`);
  return value;
}

function localIndexForSample(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const localIndex = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= range.values.length) return undefined;
  if (localIndex >= range.validity.length) return undefined;
  return localIndex;
}

function forEachSelectedSampleIndex(
  referenceRange: NumericChannelRange,
  sampleIndices: ArrayLike<number> | undefined,
  visitor: (sampleIndex: number) => void,
): number {
  if (sampleIndices) {
    for (let index = 0; index < sampleIndices.length; index += 1) {
      const sampleIndex = sampleIndices[index];
      if (sampleIndex !== undefined) visitor(sampleIndex);
    }
    return sampleIndices.length;
  }

  for (let localIndex = 0; localIndex < referenceRange.values.length; localIndex += 1) {
    visitor(referenceRange.startSampleIndex + localIndex);
  }
  return referenceRange.values.length;
}

function scanPairs(
  xRange: NumericChannelRange,
  yRange: NumericChannelRange,
  sampleIndices: ArrayLike<number> | undefined,
): PairScan {
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;
  let xObservedMin = Number.POSITIVE_INFINITY;
  let xObservedMax = Number.NEGATIVE_INFINITY;
  let yObservedMin = Number.POSITIVE_INFINITY;
  let yObservedMax = Number.NEGATIVE_INFINITY;
  const validPairs: PairSample[] = [];

  const inputSampleCount = forEachSelectedSampleIndex(xRange, sampleIndices, (sampleIndex) => {
    const xLocal = localIndexForSample(xRange, sampleIndex);
    const yLocal = localIndexForSample(yRange, sampleIndex);
    if (xLocal === undefined || yLocal === undefined) {
      unavailableSampleCount += 1;
      return;
    }

    const x = xRange.values[xLocal];
    const y = yRange.values[yLocal];
    if (
      xRange.validity[xLocal] !== 1
      || yRange.validity[yLocal] !== 1
      || x === undefined
      || y === undefined
      || !Number.isFinite(x)
      || !Number.isFinite(y)
    ) {
      invalidSampleCount += 1;
      return;
    }

    validPairs.push({ sampleIndex, x, y });
    xObservedMin = Math.min(xObservedMin, x);
    xObservedMax = Math.max(xObservedMax, x);
    yObservedMin = Math.min(yObservedMin, y);
    yObservedMax = Math.max(yObservedMax, y);
  });

  return {
    inputSampleCount,
    invalidSampleCount,
    unavailableSampleCount,
    validPairs,
    xObservedMin: validPairs.length > 0 ? xObservedMin : undefined,
    xObservedMax: validPairs.length > 0 ? xObservedMax : undefined,
    yObservedMin: validPairs.length > 0 ? yObservedMin : undefined,
    yObservedMax: validPairs.length > 0 ? yObservedMax : undefined,
  };
}

function normalizedAxisValues(values: readonly number[] | undefined, axis: 'x' | 'y'): readonly number[] | undefined {
  if (values === undefined) return undefined;
  if (values.length === 0) throw new RangeError(`heatmap ${axis}AxisValues must not be empty.`);
  const sorted = [...values];
  for (const value of sorted) {
    if (!Number.isFinite(value)) throw new RangeError(`heatmap ${axis}AxisValues must contain only finite values.`);
  }
  sorted.sort((left, right) => left - right);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === sorted[index - 1]) throw new RangeError(`heatmap ${axis}AxisValues must be unique.`);
  }
  return sorted;
}

function buildUniformAxisBins(min: number, max: number, requestedCount: number): {
  readonly bins: readonly NumericHeatmapAxisBin[];
  readonly width: number;
} {
  if (min === max) {
    return {
      bins: [{ index: 0, lowerBound: min, upperBound: max, centerValue: min, includesUpperBound: true }],
      width: 0,
    };
  }

  const width = (max - min) / requestedCount;
  const bins: NumericHeatmapAxisBin[] = [];
  for (let index = 0; index < requestedCount; index += 1) {
    const lowerBound = min + width * index;
    const upperBound = index === requestedCount - 1 ? max : min + width * (index + 1);
    bins.push({
      index,
      lowerBound,
      upperBound,
      centerValue: (lowerBound + upperBound) / 2,
      includesUpperBound: index === requestedCount - 1,
    });
  }
  return { bins, width };
}

function buildExplicitAxisBins(
  centers: readonly number[],
  observedMin: number,
  observedMax: number,
): { readonly bins: readonly NumericHeatmapAxisBin[]; readonly width: undefined } {
  if (centers.length === 1) {
    const center = centers[0]!;
    return {
      bins: [{
        index: 0,
        lowerBound: Math.min(center, observedMin),
        upperBound: Math.max(center, observedMax),
        centerValue: center,
        includesUpperBound: true,
      }],
      width: undefined,
    };
  }

  const boundaries: number[] = [];
  boundaries.push(centers[0]! - (centers[1]! - centers[0]!) / 2);
  for (let index = 1; index < centers.length; index += 1) {
    boundaries.push((centers[index - 1]! + centers[index]!) / 2);
  }
  boundaries.push(centers[centers.length - 1]! + (centers[centers.length - 1]! - centers[centers.length - 2]!) / 2);

  return {
    bins: centers.map((centerValue, index) => ({
      index,
      lowerBound: boundaries[index]!,
      upperBound: boundaries[index + 1]!,
      centerValue,
      includesUpperBound: index === centers.length - 1,
    })),
    width: undefined,
  };
}

function buildAxisBins(
  min: number,
  max: number,
  requestedCount: number,
  explicitCenters: readonly number[] | undefined,
): { readonly bins: readonly NumericHeatmapAxisBin[]; readonly width: number | undefined } {
  return explicitCenters
    ? buildExplicitAxisBins(explicitCenters, min, max)
    : buildUniformAxisBins(min, max, requestedCount);
}

function binIndexForBins(
  value: number,
  bins: readonly NumericHeatmapAxisBin[],
  clampEdges = false,
): number | undefined {
  if (bins.length === 0) return undefined;
  if (clampEdges && value < bins[0]!.lowerBound) return 0;
  if (clampEdges && value > bins[bins.length - 1]!.upperBound) return bins.length - 1;
  for (let index = 0; index < bins.length; index += 1) {
    const bin = bins[index]!;
    if (value < bin.lowerBound) continue;
    if (value < bin.upperBound || (bin.includesUpperBound && value <= bin.upperBound)) return index;
  }
  return undefined;
}

function emptyResult(
  scan: PairScan,
  aggregationMethod: NumericAggregationMethod,
  requestedXMin: number | undefined,
  requestedXMax: number | undefined,
  requestedYMin: number | undefined,
  requestedYMax: number | undefined,
): NumericHeatmapResult {
  return {
    xBins: [],
    yBins: [],
    counts: new Uint32Array(0),
    cellValues: new Float64Array(0),
    cellValueSampleCounts: new Uint32Array(0),
    cellSampleIndices: [],
    aggregationMethod,
    cellValueMin: undefined,
    cellValueMax: undefined,
    xRangeMin: requestedXMin,
    xRangeMax: requestedXMax,
    yRangeMin: requestedYMin,
    yRangeMax: requestedYMax,
    xBinWidth: undefined,
    yBinWidth: undefined,
    inputSampleCount: scan.inputSampleCount,
    validPairSampleCount: 0,
    binnedSampleCount: 0,
    invalidSampleCount: scan.invalidSampleCount,
    unavailableSampleCount: scan.unavailableSampleCount,
    outsideRangeSampleCount: 0,
    xBelowRangeSampleCount: 0,
    xAboveRangeSampleCount: 0,
    yBelowRangeSampleCount: 0,
    yAboveRangeSampleCount: 0,
    valueValidSampleCount: 0,
    valueInvalidSampleCount: 0,
    valueUnavailableSampleCount: 0,
    maxCellCount: 0,
  };
}

export function buildNumericHeatmap(
  xRange: NumericChannelRange,
  yRange: NumericChannelRange,
  options: NumericHeatmapOptions = {},
): NumericHeatmapResult {
  const aggregationMethod = options.aggregation ?? 'count';
  if (aggregationMethod !== 'count' && !options.valueRange) {
    throw new RangeError(`heatmap ${aggregationMethod} aggregation requires valueRange.`);
  }

  const requestedXMin = requestedBound(options.xMin, 'xMin');
  const requestedXMax = requestedBound(options.xMax, 'xMax');
  const requestedYMin = requestedBound(options.yMin, 'yMin');
  const requestedYMax = requestedBound(options.yMax, 'yMax');
  const explicitXAxisValues = normalizedAxisValues(options.xAxisValues, 'x');
  const explicitYAxisValues = normalizedAxisValues(options.yAxisValues, 'y');
  const clampXAxisEdges = options.clampExplicitAxisEdges === true && explicitXAxisValues !== undefined;
  const clampYAxisEdges = options.clampExplicitAxisEdges === true && explicitYAxisValues !== undefined;
  const scan = scanPairs(xRange, yRange, options.sampleIndices);

  if (scan.validPairs.length === 0) {
    return emptyResult(
      scan,
      aggregationMethod,
      requestedXMin,
      requestedXMax,
      requestedYMin,
      requestedYMax,
    );
  }

  const xLower = requestedXMin ?? scan.xObservedMin!;
  const xUpper = requestedXMax ?? scan.xObservedMax!;
  const yLower = requestedYMin ?? scan.yObservedMin!;
  const yUpper = requestedYMax ?? scan.yObservedMax!;
  const xObservedRangeMin = Math.min(xLower, xUpper);
  const xObservedRangeMax = Math.max(xLower, xUpper);
  const yObservedRangeMin = Math.min(yLower, yUpper);
  const yObservedRangeMax = Math.max(yLower, yUpper);

  const xAxis = buildAxisBins(xObservedRangeMin, xObservedRangeMax, normalizedBinCount(options.xBinCount, 'x'), explicitXAxisValues);
  const yAxis = buildAxisBins(yObservedRangeMin, yObservedRangeMax, normalizedBinCount(options.yBinCount, 'y'), explicitYAxisValues);
  const xRangeMin = xAxis.bins[0]!.lowerBound;
  const xRangeMax = xAxis.bins[xAxis.bins.length - 1]!.upperBound;
  const yRangeMin = yAxis.bins[0]!.lowerBound;
  const yRangeMax = yAxis.bins[yAxis.bins.length - 1]!.upperBound;
  const cellCount = xAxis.bins.length * yAxis.bins.length;
  const counts = new Uint32Array(cellCount);
  const cellSampleIndices: number[][] = Array.from({ length: cellCount }, () => []);

  let binnedSampleCount = 0;
  let outsideRangeSampleCount = 0;
  let xBelowRangeSampleCount = 0;
  let xAboveRangeSampleCount = 0;
  let yBelowRangeSampleCount = 0;
  let yAboveRangeSampleCount = 0;
  let maxCellCount = 0;

  for (const pair of scan.validPairs) {
    const xBelow = !clampXAxisEdges && pair.x < xRangeMin;
    const xAbove = !clampXAxisEdges && pair.x > xRangeMax;
    const yBelow = !clampYAxisEdges && pair.y < yRangeMin;
    const yAbove = !clampYAxisEdges && pair.y > yRangeMax;
    if (xBelow) xBelowRangeSampleCount += 1;
    if (xAbove) xAboveRangeSampleCount += 1;
    if (yBelow) yBelowRangeSampleCount += 1;
    if (yAbove) yAboveRangeSampleCount += 1;
    if (xBelow || xAbove || yBelow || yAbove) {
      outsideRangeSampleCount += 1;
      continue;
    }

    const xIndex = binIndexForBins(pair.x, xAxis.bins, clampXAxisEdges);
    const yIndex = binIndexForBins(pair.y, yAxis.bins, clampYAxisEdges);
    if (xIndex === undefined || yIndex === undefined) { outsideRangeSampleCount += 1; continue; }
    const cellIndex = yIndex * xAxis.bins.length + xIndex;
    counts[cellIndex] = (counts[cellIndex] ?? 0) + 1;
    cellSampleIndices[cellIndex]!.push(pair.sampleIndex);
    maxCellCount = Math.max(maxCellCount, counts[cellIndex] ?? 0);
    binnedSampleCount += 1;
  }

  const cellValues = new Float64Array(cellCount);
  cellValues.fill(Number.NaN);
  const cellValueSampleCounts = new Uint32Array(cellCount);
  let valueValidSampleCount = 0;
  let valueInvalidSampleCount = 0;
  let valueUnavailableSampleCount = 0;
  let cellValueMin = Number.POSITIVE_INFINITY;
  let cellValueMax = Number.NEGATIVE_INFINITY;
  let finiteCellValueCount = 0;

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const sampleIndices = cellSampleIndices[cellIndex]!;
    if (sampleIndices.length === 0) continue;

    if (aggregationMethod === 'count') {
      const count = counts[cellIndex] ?? 0;
      cellValues[cellIndex] = count;
      cellValueSampleCounts[cellIndex] = count;
      valueValidSampleCount += count;
      cellValueMin = Math.min(cellValueMin, count);
      cellValueMax = Math.max(cellValueMax, count);
      finiteCellValueCount += 1;
      continue;
    }

    const aggregate = aggregateNumericSamples(options.valueRange!, { sampleIndices });
    const value = numericAggregationValue(aggregate, aggregationMethod);
    cellValueSampleCounts[cellIndex] = aggregate.validSampleCount;
    valueValidSampleCount += aggregate.validSampleCount;
    valueInvalidSampleCount += aggregate.invalidSampleCount;
    valueUnavailableSampleCount += aggregate.unavailableSampleCount;
    if (value === undefined || !Number.isFinite(value)) continue;
    cellValues[cellIndex] = value;
    cellValueMin = Math.min(cellValueMin, value);
    cellValueMax = Math.max(cellValueMax, value);
    finiteCellValueCount += 1;
  }

  return {
    xBins: xAxis.bins,
    yBins: yAxis.bins,
    counts,
    cellValues,
    cellValueSampleCounts,
    cellSampleIndices: cellSampleIndices.map((indices) => Uint32Array.from(indices)),
    aggregationMethod,
    cellValueMin: finiteCellValueCount > 0 ? cellValueMin : undefined,
    cellValueMax: finiteCellValueCount > 0 ? cellValueMax : undefined,
    xRangeMin,
    xRangeMax,
    yRangeMin,
    yRangeMax,
    xBinWidth: xAxis.width,
    yBinWidth: yAxis.width,
    inputSampleCount: scan.inputSampleCount,
    validPairSampleCount: scan.validPairs.length,
    binnedSampleCount,
    invalidSampleCount: scan.invalidSampleCount,
    unavailableSampleCount: scan.unavailableSampleCount,
    outsideRangeSampleCount,
    xBelowRangeSampleCount,
    xAboveRangeSampleCount,
    yBelowRangeSampleCount,
    yAboveRangeSampleCount,
    valueValidSampleCount,
    valueInvalidSampleCount,
    valueUnavailableSampleCount,
    maxCellCount,
  };
}
