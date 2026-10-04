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

export interface NumericCompareMetric {
  readonly method: NumericAggregationMethod;
  readonly left: number | undefined;
  readonly right: number | undefined;
  /** right - left. Undefined unless both sides have a finite value. */
  readonly delta: number | undefined;
  /** (right - left) / left. Undefined for zero/non-finite/missing left values. */
  readonly relativeDelta: number | undefined;
}

export interface NumericCompareResult {
  readonly left: NumericAggregationResult;
  readonly right: NumericAggregationResult;
  readonly metrics: Readonly<Record<NumericAggregationMethod, NumericCompareMetric>>;
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

function finiteOrUndefined(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function compareMetric(
  method: NumericAggregationMethod,
  left: NumericAggregationResult,
  right: NumericAggregationResult,
): NumericCompareMetric {
  const leftValue = finiteOrUndefined(numericAggregationValue(left, method));
  const rightValue = finiteOrUndefined(numericAggregationValue(right, method));
  if (leftValue === undefined || rightValue === undefined) {
    return { method, left: leftValue, right: rightValue, delta: undefined, relativeDelta: undefined };
  }

  const delta = rightValue - leftValue;
  return {
    method,
    left: leftValue,
    right: rightValue,
    delta,
    relativeDelta: leftValue === 0 ? undefined : delta / leftValue,
  };
}

export function compareNumericCohorts(
  leftSide: NumericCompareSide,
  rightSide: NumericCompareSide,
): NumericCompareResult {
  const left = aggregateNumericSamples(leftSide.range, { sampleIndices: leftSide.sampleIndices });
  const right = aggregateNumericSamples(rightSide.range, { sampleIndices: rightSide.sampleIndices });

  const metrics = Object.fromEntries(
    METHODS.map((method) => [method, compareMetric(method, left, right)]),
  ) as Record<NumericAggregationMethod, NumericCompareMetric>;

  return {
    left,
    right,
    metrics,
    complete: leftSide.complete
      && rightSide.complete
      && left.unavailableSampleCount === 0
      && right.unavailableSampleCount === 0,
  };
}
