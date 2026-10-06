import { describe, expect, it } from 'vitest';
import {
  aggregateNumericSamples,
  numericAggregationValue,
  type NumericAggregationMethod,
} from '../../core/analysis/numeric-aggregation';
import { summarizeNumericRange } from '../../core/analysis/range-statistics';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(startSampleIndex: number, values: readonly number[], validity?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => (startSampleIndex + index) * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('aggregateNumericSamples', () => {
  it('computes count, sum, extrema, mean, magnitude metrics, sample variance and deviation', () => {
    const result = aggregateNumericSamples(range(0, [-2, -1, 1, 2]));

    expect(result.inputSampleCount).toBe(4);
    expect(result.validSampleCount).toBe(4);
    expect(result.invalidSampleCount).toBe(0);
    expect(result.unavailableSampleCount).toBe(0);
    expect(result.sum).toBe(0);
    expect(result.min).toBe(-2);
    expect(result.max).toBe(2);
    expect(result.mean).toBe(0);
    expect(result.meanAbsolute).toBe(1.5);
    expect(result.rootMeanSquare).toBeCloseTo(Math.sqrt(2.5));
    expect(result.variance).toBeCloseTo(10 / 3);
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(10 / 3));
  });

  it('matches the established range-statistics standard deviation convention', () => {
    const source = range(0, [3, 7, 7, 19]);
    const aggregate = aggregateNumericSamples(source);
    const summary = summarizeNumericRange(source);

    expect(aggregate.mean).toBe(summary.mean);
    expect(aggregate.standardDeviation).toBe(summary.standardDeviation);
    expect(aggregate.validSampleCount).toBe(summary.validCount);
    expect(aggregate.invalidSampleCount).toBe(summary.invalidCount);
  });

  it('aligns selected source sample indices and separates invalid from unavailable', () => {
    const result = aggregateNumericSamples(
      range(100, [10, 20, 30], [1, 0, 1]),
      { sampleIndices: [99, 100, 101, 102, 103] },
    );

    expect(result.inputSampleCount).toBe(5);
    expect(result.validSampleCount).toBe(2);
    expect(result.invalidSampleCount).toBe(1);
    expect(result.unavailableSampleCount).toBe(2);
    expect(result.sum).toBe(40);
    expect(result.meanAbsolute).toBe(20);
    expect(result.rootMeanSquare).toBeCloseTo(Math.sqrt(500));
  });

  it('defines a single valid sample as zero sample variance and deviation', () => {
    const result = aggregateNumericSamples(range(0, [42]));
    expect(result.variance).toBe(0);
    expect(result.standardDeviation).toBe(0);
    expect(result.meanAbsolute).toBe(42);
    expect(result.rootMeanSquare).toBe(42);
  });

  it('returns undefined numeric statistics when no valid sample exists', () => {
    const result = aggregateNumericSamples(range(0, [1, 2], [0, 0]));
    expect(result.validSampleCount).toBe(0);
    expect(result.sum).toBeUndefined();
    expect(result.min).toBeUndefined();
    expect(result.max).toBeUndefined();
    expect(result.mean).toBeUndefined();
    expect(result.meanAbsolute).toBeUndefined();
    expect(result.rootMeanSquare).toBeUndefined();
    expect(result.variance).toBeUndefined();
    expect(result.standardDeviation).toBeUndefined();
  });

  it('maps aggregation methods to their explicit result values', () => {
    const result = aggregateNumericSamples(range(0, [-1, 2, 3]));
    const expected: Record<NumericAggregationMethod, number | undefined> = {
      count: 3,
      sum: 4,
      min: -1,
      max: 3,
      mean: 4 / 3,
      'mean-absolute': 2,
      'root-mean-square': Math.sqrt(14 / 3),
      variance: 13 / 3,
      'standard-deviation': Math.sqrt(13 / 3),
    };

    for (const [method, value] of Object.entries(expected) as [NumericAggregationMethod, number | undefined][]) {
      expect(numericAggregationValue(result, method)).toBeCloseTo(value ?? Number.NaN);
    }
  });
});
