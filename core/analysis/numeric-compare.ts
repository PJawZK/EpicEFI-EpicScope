import type { NumericChannelRange } from '../log-model/log-types';
import {
  aggregateNumericSamples,
  numericAggregationValue,
  type NumericAggregationMethod,
  type NumericAggregationResult,
} from './numeric-aggregation';

export interface NumericCompareSide {
  readonly range: NumericChannelRange;
  /** Optional source sample indices defining the cohort on this side. */
  readonly sampleIndices?: ArrayLike<number>;
  /** Caller-owned coverage state for the requested comparison scope. */
  readonly complete: boolean;
}

export interface NumericCompareScalarMetric {
  readonly left: number | undefined;
  readonly right: number | undefined;
  /** right - left. Undefined unless both sides have a finite value. */
  readonly delta: number | undefined;
  /** (right - left) / left. Undefined for zero/non-finite/missing left values. */
  readonly relativeDelta: number | undefined;
}

export interface NumericCompareMetric extends NumericCompareScalarMetric {
  readonly method: NumericAggregationMethod;
}

export type NumericComparePercentile = 'p10' | 'median' | 'p90';

export interface NumericCompareResult {
  readonly left: NumericAggregationResult;
  readonly right: NumericAggregationResult;
  readonly metrics: Readonly<Record<NumericAggregationMethod, NumericCompareMetric>>;
  readonly percentiles: Readonly<Record<NumericComparePercentile, NumericCompareScalarMetric>>;
  readonly complete: boolean;
}

const METHODS: readonly NumericAggregationMethod[] = [
  'count',
  'sum',
  'min',
  'max',
  'mean',
  'variance',
  'standard-deviation',
];

const PERCENTILES: Readonly<Record<NumericComparePercentile, number>> = {
  p10: 0.1,
  median: 0.5,
  p90: 0.9,
};

function finiteOrUndefined(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function compareScalar(
  leftValue: number | undefined,
  rightValue: number | undefined,
): NumericCompareScalarMetric {
  const left = finiteOrUndefined(leftValue);
  const right = finiteOrUndefined(rightValue);
  if (left === undefined || right === undefined) {
    return { left, right, delta: undefined, relativeDelta: undefined };
  }
  const delta = right - left;
  return {
    left,
    right,
    delta,
    relativeDelta: left === 0 ? undefined : delta / left,
  };
}

function compareMetric(
  method: NumericAggregationMethod,
  left: NumericAggregationResult,
  right: NumericAggregationResult,
): NumericCompareMetric {
  return {
    method,
    ...compareScalar(numericAggregationValue(left, method), numericAggregationValue(right, method)),
  };
}

function aggregateSide(side: NumericCompareSide): NumericAggregationResult {
  return side.sampleIndices === undefined
    ? aggregateNumericSamples(side.range)
    : aggregateNumericSamples(side.range, { sampleIndices: side.sampleIndices });
}

function validValues(side: NumericCompareSide): number[] {
  const values: number[] = [];
  const pushLocal = (localIndex: number): void => {
    if (localIndex < 0 || localIndex >= side.range.values.length || localIndex >= side.range.validity.length) return;
    const value = side.range.values[localIndex];
    if (side.range.validity[localIndex] !== 1 || value === undefined || !Number.isFinite(value)) return;
    values.push(value);
  };

  if (side.sampleIndices === undefined) {
    for (let localIndex = 0; localIndex < side.range.values.length; localIndex += 1) pushLocal(localIndex);
    return values;
  }

  for (let index = 0; index < side.sampleIndices.length; index += 1) {
    const sampleIndex = side.sampleIndices[index];
    if (sampleIndex === undefined || !Number.isSafeInteger(sampleIndex)) continue;
    pushLocal(sampleIndex - side.range.startSampleIndex);
  }
  return values;
}

function percentile(sortedValues: readonly number[], fraction: number): number | undefined {
  if (sortedValues.length === 0) return undefined;
  const position = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = sortedValues[lower];
  const upperValue = sortedValues[upper];
  if (lowerValue === undefined) return undefined;
  if (upperValue === undefined || lower === upper) return lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}

function percentileMetrics(
  leftSide: NumericCompareSide,
  rightSide: NumericCompareSide,
): Record<NumericComparePercentile, NumericCompareScalarMetric> {
  const leftValues = validValues(leftSide).sort((a, b) => a - b);
  const rightValues = validValues(rightSide).sort((a, b) => a - b);
  return Object.fromEntries(
    (Object.entries(PERCENTILES) as [NumericComparePercentile, number][]).map(([name, fraction]) => [
      name,
      compareScalar(percentile(leftValues, fraction), percentile(rightValues, fraction)),
    ]),
  ) as Record<NumericComparePercentile, NumericCompareScalarMetric>;
}

export function compareNumericCohorts(
  leftSide: NumericCompareSide,
  rightSide: NumericCompareSide,
): NumericCompareResult {
  const left = aggregateSide(leftSide);
  const right = aggregateSide(rightSide);

  const metrics = Object.fromEntries(
    METHODS.map((method) => [method, compareMetric(method, left, right)]),
  ) as Record<NumericAggregationMethod, NumericCompareMetric>;

  return {
    left,
    right,
    metrics,
    percentiles: percentileMetrics(leftSide, rightSide),
    complete: leftSide.complete
      && rightSide.complete
      && left.unavailableSampleCount === 0
      && right.unavailableSampleCount === 0,
  };
}
