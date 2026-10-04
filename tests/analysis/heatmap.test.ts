import { describe, expect, it } from 'vitest';
import { buildNumericHeatmap } from '../../core/analysis/heatmap';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(startSampleIndex: number, values: readonly number[], validity?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => (startSampleIndex + index) * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('buildNumericHeatmap', () => {
  it('bins aligned x/y pairs and includes both maximum bounds in the final cells', () => {
    const result = buildNumericHeatmap(
      range(0, [0, 1, 2, 3]),
      range(0, [10, 20, 30, 40]),
      { xBinCount: 2, yBinCount: 2 },
    );

    expect(result.xBins).toHaveLength(2);
    expect(result.yBins).toHaveLength(2);
    expect([...result.counts]).toEqual([2, 0, 0, 2]);
    expect(result.binnedSampleCount).toBe(4);
    expect(result.maxCellCount).toBe(2);
  });

  it('aligns qualified sample indices across ranges with different local offsets', () => {
    const result = buildNumericHeatmap(
      range(100, [1, 2, 3, 4]),
      range(99, [8, 10, 20, 30, 40]),
      { sampleIndices: Uint32Array.from([101, 103]), xBinCount: 2, yBinCount: 2 },
    );

    expect(result.inputSampleCount).toBe(2);
    expect(result.validPairSampleCount).toBe(2);
    expect(result.binnedSampleCount).toBe(2);
    expect([...result.counts].reduce((sum, count) => sum + count, 0)).toBe(2);
  });

  it('keeps invalid and unavailable pair counts separate', () => {
    const result = buildNumericHeatmap(
      range(10, [1, 2, 3], [1, 0, 1]),
      range(11, [20, 30], [1, 1]),
      { sampleIndices: [10, 11, 12, 13] },
    );

    expect(result.inputSampleCount).toBe(4);
    expect(result.invalidSampleCount).toBe(1);
    expect(result.unavailableSampleCount).toBe(2);
    expect(result.validPairSampleCount).toBe(1);
    expect(result.binnedSampleCount).toBe(1);
  });

  it('tracks outside-range samples once while retaining per-axis diagnostics', () => {
    const result = buildNumericHeatmap(
      range(0, [-1, 1, 5, 9]),
      range(0, [-2, 2, 6, 12]),
      {
        xBinCount: 2,
        yBinCount: 2,
        xMin: 0,
        xMax: 8,
        yMin: 0,
        yMax: 10,
      },
    );

    expect(result.binnedSampleCount).toBe(2);
    expect(result.outsideRangeSampleCount).toBe(2);
    expect(result.xBelowRangeSampleCount).toBe(1);
    expect(result.xAboveRangeSampleCount).toBe(1);
    expect(result.yBelowRangeSampleCount).toBe(1);
    expect(result.yAboveRangeSampleCount).toBe(1);
  });

  it('normalizes reversed explicit axis bounds', () => {
    const result = buildNumericHeatmap(
      range(0, [1, 2, 3]),
      range(0, [10, 20, 30]),
      { xMin: 4, xMax: 0, yMin: 40, yMax: 0 },
    );

    expect(result.xRangeMin).toBe(0);
    expect(result.xRangeMax).toBe(4);
    expect(result.yRangeMin).toBe(0);
    expect(result.yRangeMax).toBe(40);
    expect(result.binnedSampleCount).toBe(3);
  });

  it('collapses constant axes to one bin', () => {
    const result = buildNumericHeatmap(
      range(0, [5, 5, 5]),
      range(0, [7, 7, 7]),
      { xBinCount: 30, yBinCount: 30 },
    );

    expect(result.xBins).toHaveLength(1);
    expect(result.yBins).toHaveLength(1);
    expect(result.xBinWidth).toBe(0);
    expect(result.yBinWidth).toBe(0);
    expect([...result.counts]).toEqual([3]);
  });

  it('returns empty axes when no valid pair exists', () => {
    const result = buildNumericHeatmap(
      range(0, [1, 2], [0, 0]),
      range(0, [3, 4], [1, 1]),
    );

    expect(result.xBins).toEqual([]);
    expect(result.yBins).toEqual([]);
    expect(result.counts).toHaveLength(0);
    expect(result.validPairSampleCount).toBe(0);
    expect(result.invalidSampleCount).toBe(2);
  });

  it('rejects non-finite configuration values', () => {
    expect(() => buildNumericHeatmap(range(0, [1]), range(0, [2]), { xBinCount: Number.NaN })).toThrow(RangeError);
    expect(() => buildNumericHeatmap(range(0, [1]), range(0, [2]), { yMax: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });
});
