import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { buildNumericHistogram } from '../../core/analysis/histogram';

function range(
  startSampleIndex: number,
  timeMs: readonly number[],
  values: readonly number[],
  validity: readonly number[],
): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(timeMs),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity),
  };
}

describe('buildNumericHistogram', () => {
  it('bins valid values and includes the maximum in the final bin', () => {
    const result = buildNumericHistogram(
      range(0, [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [1, 1, 1, 1, 1]),
      { binCount: 2 },
    );

    expect(result.rangeMin).toBe(0);
    expect(result.rangeMax).toBe(4);
    expect(result.binWidth).toBe(2);
    expect(result.bins).toHaveLength(2);
    expect(result.bins[0]).toMatchObject({ lowerBound: 0, upperBound: 2, includesUpperBound: false, count: 2 });
    expect(result.bins[1]).toMatchObject({ lowerBound: 2, upperBound: 4, includesUpperBound: true, count: 3 });
    expect(result.inputSampleCount).toBe(5);
    expect(result.validSampleCount).toBe(5);
    expect(result.binnedSampleCount).toBe(5);
  });

  it('uses source sample indices when a qualified sample set is supplied', () => {
    const result = buildNumericHistogram(
      range(100, [10, 20, 30, 40], [5, 10, 15, 20], [1, 1, 1, 1]),
      { sampleIndices: Uint32Array.from([101, 103]), binCount: 2 },
    );

    expect(result.inputSampleCount).toBe(2);
    expect(result.validSampleCount).toBe(2);
    expect(result.binnedSampleCount).toBe(2);
    expect(result.rangeMin).toBe(10);
    expect(result.rangeMax).toBe(20);
    expect(result.bins.map((bin) => bin.count)).toEqual([1, 1]);
  });

  it('distinguishes invalid selected samples from unavailable source indices', () => {
    const result = buildNumericHistogram(
      range(200, [0, 10, 20], [1, 2, 3], [1, 0, 1]),
      { sampleIndices: Uint32Array.from([199, 200, 201, 202, 203]), binCount: 2 },
    );

    expect(result.inputSampleCount).toBe(5);
    expect(result.validSampleCount).toBe(2);
    expect(result.invalidSampleCount).toBe(1);
    expect(result.unavailableSampleCount).toBe(2);
    expect(result.binnedSampleCount).toBe(2);
  });

  it('accounts for valid values below and above an explicit histogram range', () => {
    const result = buildNumericHistogram(
      range(0, [0, 1, 2, 3, 4], [-5, 0, 5, 10, 15], [1, 1, 1, 1, 1]),
      { min: 0, max: 10, binCount: 2 },
    );

    expect(result.validSampleCount).toBe(5);
    expect(result.binnedSampleCount).toBe(3);
    expect(result.belowRangeSampleCount).toBe(1);
    expect(result.aboveRangeSampleCount).toBe(1);
    expect(result.bins.map((bin) => bin.count)).toEqual([1, 2]);
  });

  it('collapses a constant value range to one bin', () => {
    const result = buildNumericHistogram(
      range(0, [0, 1, 2], [7, 7, 7], [1, 1, 1]),
      { binCount: 40 },
    );

    expect(result.bins).toEqual([{ index: 0, lowerBound: 7, upperBound: 7, includesUpperBound: true, count: 3 }]);
    expect(result.binWidth).toBe(0);
    expect(result.binnedSampleCount).toBe(3);
  });

  it('normalizes reversed explicit min/max bounds', () => {
    const result = buildNumericHistogram(
      range(0, [0, 1, 2], [0, 5, 10], [1, 1, 1]),
      { min: 10, max: 0, binCount: 2 },
    );

    expect(result.rangeMin).toBe(0);
    expect(result.rangeMax).toBe(10);
    expect(result.bins.map((bin) => bin.count)).toEqual([1, 2]);
  });

  it('returns no bins when there are no valid available samples', () => {
    const result = buildNumericHistogram(
      range(50, [0, 1], [1, Number.NaN], [0, 1]),
      { sampleIndices: Uint32Array.from([49, 50, 51]) },
    );

    expect(result.bins).toEqual([]);
    expect(result.inputSampleCount).toBe(3);
    expect(result.validSampleCount).toBe(0);
    expect(result.invalidSampleCount).toBe(2);
    expect(result.unavailableSampleCount).toBe(1);
    expect(result.binnedSampleCount).toBe(0);
  });

  it('rejects non-finite histogram configuration', () => {
    const source = range(0, [0], [1], [1]);
    expect(() => buildNumericHistogram(source, { binCount: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => buildNumericHistogram(source, { min: Number.NaN })).toThrow(RangeError);
  });
});
