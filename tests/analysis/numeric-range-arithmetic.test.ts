import { describe, expect, it } from 'vitest';
import { subtractNumericRanges } from '../../core/analysis/numeric-range-arithmetic';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(
  startSampleIndex: number,
  values: readonly number[],
  validity?: readonly number[],
): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => (startSampleIndex + index) * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('subtractNumericRanges', () => {
  it('aligns inputs by source sample index and subtracts overlapping samples', () => {
    const result = subtractNumericRanges(
      range(100, [10, 20, 30, 40]),
      range(99, [1, 2, 3, 4, 5]),
    );

    expect(result.startSampleIndex).toBe(100);
    expect([...result.values]).toEqual([8, 17, 26, 35]);
    expect([...result.validity]).toEqual([1, 1, 1, 1]);
    expect([...result.timeMs]).toEqual([1000, 1010, 1020, 1030]);
  });

  it('marks a derived sample invalid when either source sample is invalid', () => {
    const result = subtractNumericRanges(
      range(0, [10, 20, 30], [1, 0, 1]),
      range(0, [1, 2, 3], [1, 1, 0]),
    );

    expect(result.validity[0]).toBe(1);
    expect(result.values[0]).toBe(9);
    expect(result.validity[1]).toBe(0);
    expect(Number.isNaN(result.values[1]!)).toBe(true);
    expect(result.validity[2]).toBe(0);
    expect(Number.isNaN(result.values[2]!)).toBe(true);
  });

  it('returns an empty range when source-index windows do not overlap', () => {
    const result = subtractNumericRanges(range(0, [1, 2]), range(10, [1, 2]));
    expect(result.startSampleIndex).toBe(10);
    expect(result.values).toHaveLength(0);
    expect(result.validity).toHaveLength(0);
    expect(result.timeMs).toHaveLength(0);
  });
});
