import type { NumericChannelRange } from '../log-model/log-types';

export interface NumericHeatmapOptions {
  /** Optional source sample indices, for example qualification output. */
  readonly sampleIndices?: ArrayLike<number>;
  readonly xBinCount?: number;
  readonly yBinCount?: number;
  readonly xMin?: number;
  readonly xMax?: number;
  readonly yMin?: number;
  readonly yMax?: number;
}

export interface NumericHeatmapAxisBin {
  readonly index: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly includesUpperBound: boolean;
}

export interface NumericHeatmapResult {
  readonly xBins: readonly NumericHeatmapAxisBin[];
  readonly yBins: readonly NumericHeatmapAxisBin[];
  /** Row-major counts: index = yIndex * xBins.length + xIndex. */
  readonly counts: Uint32Array;
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
  readonly maxCellCount: number;
}

interface PairSample {
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

    validPairs.push({ x, y });
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

function buildAxisBins(min: number, max: number, requestedCount: number): {
  readonly bins: readonly NumericHeatmapAxisBin[];
  readonly width: number;
} {
  if (min === max) {
    return {
      bins: [{ index: 0, lowerBound: min, upperBound: max, includesUpperBound: true }],
      width: 0,
    };
  }

  const width = (max - min) / requestedCount;
  const bins: NumericHeatmapAxisBin[] = [];
  for (let index = 0; index < requestedCount; index += 1) {
    bins.push({
      index,
      lowerBound: min + width * index,
      upperBound: index === requestedCount - 1 ? max : min + width * (index + 1),
      includesUpperBound: index === requestedCount - 1,
    });
  }
  return { bins, width };
}

function binIndex(value: number, min: number, max: number, width: number, binCount: number): number {
  if (binCount === 1 || min === max || width === 0) return 0;
  if (value === max) return binCount - 1;
  return Math.min(binCount - 1, Math.max(0, Math.floor((value - min) / width)));
}

export function buildNumericHeatmap(
  xRange: NumericChannelRange,
  yRange: NumericChannelRange,
  options: NumericHeatmapOptions = {},
): NumericHeatmapResult {
  const requestedXMin = requestedBound(options.xMin, 'xMin');
  const requestedXMax = requestedBound(options.xMax, 'xMax');
  const requestedYMin = requestedBound(options.yMin, 'yMin');
  const requestedYMax = requestedBound(options.yMax, 'yMax');
  const scan = scanPairs(xRange, yRange, options.sampleIndices);

  if (scan.validPairs.length === 0) {
    return {
      xBins: [],
      yBins: [],
      counts: new Uint32Array(0),
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
      maxCellCount: 0,
    };
  }

  const xLower = requestedXMin ?? scan.xObservedMin!;
  const xUpper = requestedXMax ?? scan.xObservedMax!;
  const yLower = requestedYMin ?? scan.yObservedMin!;
  const yUpper = requestedYMax ?? scan.yObservedMax!;
  const xRangeMin = Math.min(xLower, xUpper);
  const xRangeMax = Math.max(xLower, xUpper);
  const yRangeMin = Math.min(yLower, yUpper);
  const yRangeMax = Math.max(yLower, yUpper);

  const xAxis = buildAxisBins(xRangeMin, xRangeMax, normalizedBinCount(options.xBinCount, 'x'));
  const yAxis = buildAxisBins(yRangeMin, yRangeMax, normalizedBinCount(options.yBinCount, 'y'));
  const counts = new Uint32Array(xAxis.bins.length * yAxis.bins.length);

  let binnedSampleCount = 0;
  let outsideRangeSampleCount = 0;
  let xBelowRangeSampleCount = 0;
  let xAboveRangeSampleCount = 0;
  let yBelowRangeSampleCount = 0;
  let yAboveRangeSampleCount = 0;
  let maxCellCount = 0;

  for (const pair of scan.validPairs) {
    const xBelow = pair.x < xRangeMin;
    const xAbove = pair.x > xRangeMax;
    const yBelow = pair.y < yRangeMin;
    const yAbove = pair.y > yRangeMax;
    if (xBelow) xBelowRangeSampleCount += 1;
    if (xAbove) xAboveRangeSampleCount += 1;
    if (yBelow) yBelowRangeSampleCount += 1;
    if (yAbove) yAboveRangeSampleCount += 1;
    if (xBelow || xAbove || yBelow || yAbove) {
      outsideRangeSampleCount += 1;
      continue;
    }

    const xIndex = binIndex(pair.x, xRangeMin, xRangeMax, xAxis.width, xAxis.bins.length);
    const yIndex = binIndex(pair.y, yRangeMin, yRangeMax, yAxis.width, yAxis.bins.length);
    const cellIndex = yIndex * xAxis.bins.length + xIndex;
    counts[cellIndex] = (counts[cellIndex] ?? 0) + 1;
    maxCellCount = Math.max(maxCellCount, counts[cellIndex] ?? 0);
    binnedSampleCount += 1;
  }

  return {
    xBins: xAxis.bins,
    yBins: yAxis.bins,
    counts,
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
    maxCellCount,
  };
}
