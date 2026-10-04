import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { numericRangeCoversTime, summarizeNumericRange } from '../../core/analysis/range-statistics';

function range(
  timeMs: readonly number[],
  values: readonly number[],
  validity: readonly number[],
): NumericChannelRange {
  return {
    startSampleIndex: 0,
    timeMs: Float64Array.from(timeMs),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity),
  };
}

describe('summarizeNumericRange', () => {
  it('summarizes only samples inside the requested time range', () => {
    const result = summarizeNumericRange(
      range([0, 10, 20, 30, 40], [1, 2, 3, 4, 5], [1, 1, 1, 1, 1]),
      10,
      30,
    );

    expect(result).toEqual({
      validCount: 3,
      invalidCount: 0,
      min: 2,
      max: 4,
      mean: 3,
      standardDeviation: 1,
    });
  });

  it('counts invalid samples without letting them affect numeric statistics', () => {
    const result = summarizeNumericRange(
      range([0, 10, 20, 30], [5, 100, 9, Number.NaN], [1, 0, 1, 1]),
    );

    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(2);
    expect(result.min).toBe(5);
    expect(result.max).toBe(9);
    expect(result.mean).toBe(7);
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(8));
  });

  it('accepts reversed A/B boundaries', () => {
    const result = summarizeNumericRange(
      range([0, 10, 20, 30], [1, 2, 3, 4], [1, 1, 1, 1]),
      30,
      10,
    );

    expect(result.validCount).toBe(3);
    expect(result.min).toBe(2);
    expect(result.max).toBe(4);
  });
});

describe('numericRangeCoversTime', () => {
  const decoded = range([100, 110, 120, 130], [1, 2, 3, 4], [1, 1, 1, 1]);

  it('reports complete coverage when both requested boundaries are decoded', () => {
    expect(numericRangeCoversTime(decoded, 105, 125)).toBe(true);
    expect(numericRangeCoversTime(decoded, 125, 105)).toBe(true);
  });

  it('reports partial coverage when the requested interval extends outside decoded data', () => {
    expect(numericRangeCoversTime(decoded, 90, 125)).toBe(false);
    expect(numericRangeCoversTime(decoded, 105, 140)).toBe(false);
  });
});
