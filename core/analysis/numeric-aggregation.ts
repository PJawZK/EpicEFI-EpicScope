import type { NumericChannelRange } from '../log-model/log-types';

export type NumericAggregationMethod =
  | 'count'
  | 'sum'
  | 'min'
  | 'max'
  | 'mean'
  | 'mean-absolute'
  | 'root-mean-square'
  | 'variance'
  | 'standard-deviation';

export interface NumericAggregationOptions {
  /** Optional source sample indices, for example qualification output. */
  readonly sampleIndices?: ArrayLike<number>;
}

export interface NumericAggregationResult {
  readonly inputSampleCount: number;
  readonly validSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly sum: number | undefined;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly mean: number | undefined;
  /** Mean magnitude around zero, useful for signed correction/control signals. */
  readonly meanAbsolute: number | undefined;
  /** Root-mean-square magnitude around zero, emphasizing larger excursions. */
  readonly rootMeanSquare: number | undefined;
  /** Sample variance (n - 1), matching the existing Range Statistics convention. */
  readonly variance: number | undefined;
  /** Sample standard deviation (n - 1), matching the existing Range Statistics convention. */
  readonly standardDeviation: number | undefined;
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

export function aggregateNumericSamples(
  range: NumericChannelRange,
  options: NumericAggregationOptions = {},
): NumericAggregationResult {
  let validSampleCount = 0;
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;
  let sum = 0;
  let sumAbsolute = 0;
  let sumSquares = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let mean = 0;
  let m2 = 0;

  const inputSampleCount = forEachSelectedSample(range, options.sampleIndices, (localIndex) => {
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
    sum += value;
    sumAbsolute += Math.abs(value);
    sumSquares += value * value;
    min = Math.min(min, value);
    max = Math.max(max, value);
    const delta = value - mean;
    mean += delta / validSampleCount;
    m2 += delta * (value - mean);
  });

  const variance = validSampleCount > 1
    ? m2 / (validSampleCount - 1)
    : validSampleCount === 1 ? 0 : undefined;

  return {
    inputSampleCount,
    validSampleCount,
    invalidSampleCount,
    unavailableSampleCount,
    sum: validSampleCount > 0 ? sum : undefined,
    min: validSampleCount > 0 ? min : undefined,
    max: validSampleCount > 0 ? max : undefined,
    mean: validSampleCount > 0 ? mean : undefined,
    meanAbsolute: validSampleCount > 0 ? sumAbsolute / validSampleCount : undefined,
    rootMeanSquare: validSampleCount > 0 ? Math.sqrt(sumSquares / validSampleCount) : undefined,
    variance,
    standardDeviation: variance === undefined ? undefined : Math.sqrt(variance),
  };
}

export function numericAggregationValue(
  result: NumericAggregationResult,
  method: NumericAggregationMethod,
): number | undefined {
  if (method === 'count') return result.validSampleCount;
  if (method === 'sum') return result.sum;
  if (method === 'min') return result.min;
  if (method === 'max') return result.max;
  if (method === 'mean') return result.mean;
  if (method === 'mean-absolute') return result.meanAbsolute;
  if (method === 'root-mean-square') return result.rootMeanSquare;
  if (method === 'variance') return result.variance;
  return result.standardDeviation;
}
