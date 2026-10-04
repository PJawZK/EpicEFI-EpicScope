import type { NumericChannelRange } from '../log-model/log-types';

export interface NumericHistogramOptions {
  /** Optional source sample indices, for example the output of sample qualification. */
  readonly sampleIndices?: ArrayLike<number>;
  readonly binCount?: number;
  readonly min?: number;
  readonly max?: number;
}

export interface NumericHistogramBin {
  readonly index: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  /** The final bin includes upperBound; all earlier bins are upper-exclusive. */
  readonly includesUpperBound: boolean;
  readonly count: number;
}

export interface NumericHistogramResult {
  readonly bins: readonly NumericHistogramBin[];
  readonly rangeMin: number | undefined;
  readonly rangeMax: number | undefined;
  readonly binWidth: number | undefined;
  readonly inputSampleCount: number;
  readonly validSampleCount: number;
  readonly binnedSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly belowRangeSampleCount: number;
  readonly aboveRangeSampleCount: number;
}

interface HistogramSampleScan {
  readonly inputSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly validSampleCount: number;
  readonly observedMin: number | undefined;
  readonly observedMax: number | undefined;
}

function normalizedBinCount(binCount: number | undefined): number {
  if (binCount === undefined) return 20;
  if (!Number.isFinite(binCount)) throw new RangeError('histogram binCount must be finite.');
  return Math.min(512, Math.max(1, Math.floor(binCount)));
}

function requestedBound(value: number | undefined, name: 'min' | 'max'): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) throw new RangeError(`histogram ${name} must be finite.`);
  return value;
}

function localIndexForSample(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const localIndex = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= range.values.length) return undefined;
  if (localIndex >= range.validity.length) return undefined;
  return localIndex;
}

function forEachSelectedSample(
  range: NumericChannelRange,
  sampleIndices: ArrayLike<number> | undefined,
  visitor: (localIndex: number | undefined) => void,
): number {
  if (sampleIndices) {
    for (let index = 0; index < sampleIndices.length; index += 1) {
      const sampleIndex = sampleIndices[index];
      visitor(sampleIndex === undefined ? undefined : localIndexForSample(range, sampleIndex));
    }
    return sampleIndices.length;
  }

  for (let localIndex = 0; localIndex < range.values.length; localIndex += 1) visitor(localIndex);
  return range.values.length;
}

function scanSamples(
  range: NumericChannelRange,
  sampleIndices: ArrayLike<number> | undefined,
): HistogramSampleScan {
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;
  let validSampleCount = 0;
  let observedMin = Number.POSITIVE_INFINITY;
  let observedMax = Number.NEGATIVE_INFINITY;

  const inputSampleCount = forEachSelectedSample(range, sampleIndices, (localIndex) => {
    if (localIndex === undefined) {
      unavailableSampleCount += 1;
      return;
    }
    const value = range.values[localIndex];
    if (range.validity[localIndex] !== 1 || value === undefined || !Number.isFinite(value)) {
      invalidSampleCount += 1;
      return;
    }
    validSampleCount += 1;
    observedMin = Math.min(observedMin, value);
    observedMax = Math.max(observedMax, value);
  });

  return {
    inputSampleCount,
    invalidSampleCount,
    unavailableSampleCount,
    validSampleCount,
    observedMin: validSampleCount > 0 ? observedMin : undefined,
    observedMax: validSampleCount > 0 ? observedMax : undefined,
  };
}

export function buildNumericHistogram(
  range: NumericChannelRange,
  options: NumericHistogramOptions = {},
): NumericHistogramResult {
  const requestedMin = requestedBound(options.min, 'min');
  const requestedMax = requestedBound(options.max, 'max');
  const scan = scanSamples(range, options.sampleIndices);

  if (scan.validSampleCount === 0) {
    return {
      bins: [],
      rangeMin: requestedMin,
      rangeMax: requestedMax,
      binWidth: undefined,
      inputSampleCount: scan.inputSampleCount,
      validSampleCount: 0,
      binnedSampleCount: 0,
      invalidSampleCount: scan.invalidSampleCount,
      unavailableSampleCount: scan.unavailableSampleCount,
      belowRangeSampleCount: 0,
      aboveRangeSampleCount: 0,
    };
  }

  const lower = requestedMin ?? scan.observedMin!;
  const upper = requestedMax ?? scan.observedMax!;
  const rangeMin = Math.min(lower, upper);
  const rangeMax = Math.max(lower, upper);
  const requestedBinCount = normalizedBinCount(options.binCount);

  if (rangeMin === rangeMax) {
    let binnedSampleCount = 0;
    let belowRangeSampleCount = 0;
    let aboveRangeSampleCount = 0;
    forEachSelectedSample(range, options.sampleIndices, (localIndex) => {
      if (localIndex === undefined) return;
      const value = range.values[localIndex];
      if (range.validity[localIndex] !== 1 || value === undefined || !Number.isFinite(value)) return;
      if (value < rangeMin) belowRangeSampleCount += 1;
      else if (value > rangeMax) aboveRangeSampleCount += 1;
      else binnedSampleCount += 1;
    });
    return {
      bins: [{ index: 0, lowerBound: rangeMin, upperBound: rangeMax, includesUpperBound: true, count: binnedSampleCount }],
      rangeMin,
      rangeMax,
      binWidth: 0,
      inputSampleCount: scan.inputSampleCount,
      validSampleCount: scan.validSampleCount,
      binnedSampleCount,
      invalidSampleCount: scan.invalidSampleCount,
      unavailableSampleCount: scan.unavailableSampleCount,
      belowRangeSampleCount,
      aboveRangeSampleCount,
    };
  }

  const binWidth = (rangeMax - rangeMin) / requestedBinCount;
  const counts = new Uint32Array(requestedBinCount);
  let binnedSampleCount = 0;
  let belowRangeSampleCount = 0;
  let aboveRangeSampleCount = 0;

  forEachSelectedSample(range, options.sampleIndices, (localIndex) => {
    if (localIndex === undefined) return;
    const value = range.values[localIndex];
    if (range.validity[localIndex] !== 1 || value === undefined || !Number.isFinite(value)) return;
    if (value < rangeMin) {
      belowRangeSampleCount += 1;
      return;
    }
    if (value > rangeMax) {
      aboveRangeSampleCount += 1;
      return;
    }
    const binIndex = value === rangeMax
      ? requestedBinCount - 1
      : Math.min(requestedBinCount - 1, Math.max(0, Math.floor((value - rangeMin) / binWidth)));
    counts[binIndex] = (counts[binIndex] ?? 0) + 1;
    binnedSampleCount += 1;
  });

  const bins: NumericHistogramBin[] = [];
  for (let index = 0; index < requestedBinCount; index += 1) {
    bins.push({
      index,
      lowerBound: rangeMin + binWidth * index,
      upperBound: index === requestedBinCount - 1 ? rangeMax : rangeMin + binWidth * (index + 1),
      includesUpperBound: index === requestedBinCount - 1,
      count: counts[index] ?? 0,
    });
  }

  return {
    bins,
    rangeMin,
    rangeMax,
    binWidth,
    inputSampleCount: scan.inputSampleCount,
    validSampleCount: scan.validSampleCount,
    binnedSampleCount,
    invalidSampleCount: scan.invalidSampleCount,
    unavailableSampleCount: scan.unavailableSampleCount,
    belowRangeSampleCount,
    aboveRangeSampleCount,
  };
}
