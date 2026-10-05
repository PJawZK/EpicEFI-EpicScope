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
    expect([...result.cellValues]).toEqual([2, Number.NaN, Number.NaN, 2]);
    expect([...result.cellValueSampleCounts]).toEqual([2, 0, 0, 2]);
    expect(result.aggregationMethod).toBe('count');
    expect(result.valueValidSampleCount).toBe(4);
    expect(result.valueInvalidSampleCount).toBe(0);
    expect(result.valueUnavailableSampleCount).toBe(0);
    expect(result.cellValueMin).toBe(2);
    expect(result.cellValueMax).toBe(2);
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
    expect(result.valueValidSampleCount).toBe(2);
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
    expect([...result.cellValues]).toEqual([3]);
  });

  it('aggregates an explicit value channel by source sample index', () => {
    const result = buildNumericHeatmap(
      range(100, [0, 0, 10, 10]),
      range(100, [0, 0, 10, 10]),
      {
        xBinCount: 2,
        yBinCount: 2,
        aggregation: 'mean',
        valueRange: range(99, [900, 10, 30, 50, 70]),
      },
    );

    expect(result.aggregationMethod).toBe('mean');
    expect([...result.counts]).toEqual([2, 0, 0, 2]);
    expect(result.cellValues[0]).toBe(20);
    expect(Number.isNaN(result.cellValues[1]!)).toBe(true);
    expect(Number.isNaN(result.cellValues[2]!)).toBe(true);
    expect(result.cellValues[3]).toBe(60);
    expect([...result.cellValueSampleCounts]).toEqual([2, 0, 0, 2]);
    expect(result.valueValidSampleCount).toBe(4);
    expect(result.valueInvalidSampleCount).toBe(0);
    expect(result.valueUnavailableSampleCount).toBe(0);
    expect(result.cellValueMin).toBe(20);
    expect(result.cellValueMax).toBe(60);
  });

  it('uses the shared sample standard-deviation convention inside cells', () => {
    const result = buildNumericHeatmap(
      range(0, [1, 1, 1]),
      range(0, [2, 2, 2]),
      {
        aggregation: 'standard-deviation',
        valueRange: range(0, [1, 2, 3]),
      },
    );

    expect(result.cellValues).toHaveLength(1);
    expect(result.cellValues[0]).toBe(1);
    expect(result.cellValueSampleCounts[0]).toBe(3);
  });

  it('separates value-channel invalid and unavailable evidence from valid X/Y pairs', () => {
    const result = buildNumericHeatmap(
      range(10, [1, 2, 3, 4]),
      range(10, [10, 20, 30, 40]),
      {
        aggregation: 'mean',
        valueRange: range(11, [100, 200], [1, 0]),
      },
    );

    expect(result.validPairSampleCount).toBe(4);
    expect(result.binnedSampleCount).toBe(4);
    expect(result.invalidSampleCount).toBe(0);
    expect(result.unavailableSampleCount).toBe(0);
    expect(result.valueValidSampleCount).toBe(1);
    expect(result.valueInvalidSampleCount).toBe(1);
    expect(result.valueUnavailableSampleCount).toBe(2);
    expect(
      result.valueValidSampleCount + result.valueInvalidSampleCount + result.valueUnavailableSampleCount,
    ).toBe(result.binnedSampleCount);
  });

  it('requires a value range for non-count aggregation', () => {
    expect(() => buildNumericHeatmap(
      range(0, [1]),
      range(0, [2]),
      { aggregation: 'mean' },
    )).toThrow(/requires valueRange/);
  });

  it('returns empty axes when no valid pair exists', () => {
    const result = buildNumericHeatmap(
      range(0, [1, 2], [0, 0]),
      range(0, [3, 4], [1, 1]),
    );

    expect(result.xBins).toEqual([]);
    expect(result.yBins).toEqual([]);
    expect(result.counts).toHaveLength(0);
    expect(result.cellValues).toHaveLength(0);
    expect(result.validPairSampleCount).toBe(0);
    expect(result.invalidSampleCount).toBe(2);
    expect(result.valueValidSampleCount).toBe(0);
  });

  it('uses explicit irregular axis centers with midpoint cell boundaries', () => {
    const result = buildNumericHeatmap(
      range(0, [900, 1100, 1900, 2500, 3900, 4100]),
      range(0, [45, 55, 70, 95, 105, 120]),
      { xAxisValues: [4000, 1000, 2000], yAxisValues: [50, 100] },
    );

    expect(result.xBins.map((bin) => bin.centerValue)).toEqual([1000, 2000, 4000]);
    expect(result.yBins.map((bin) => bin.centerValue)).toEqual([50, 100]);
    expect(result.xBins[0]).toMatchObject({ lowerBound: 500, upperBound: 1500 });
    expect(result.xBins[1]).toMatchObject({ lowerBound: 1500, upperBound: 3000 });
    expect(result.xBins[2]).toMatchObject({ lowerBound: 3000, upperBound: 5000, includesUpperBound: true });
    expect([...result.counts].reduce((sum, value) => sum + value, 0)).toBe(6);
    expect(result.xBinWidth).toBeUndefined();
    expect(result.yBinWidth).toBeUndefined();
  });

  it('rejects duplicate explicit axis centers', () => {
    expect(() => buildNumericHeatmap(
      range(0, [1, 2]),
      range(0, [3, 4]),
      { xAxisValues: [1, 1] },
    )).toThrow(/must be unique/);
  });

  it('rejects non-finite configuration values', () => {
    expect(() => buildNumericHeatmap(range(0, [1]), range(0, [2]), { xBinCount: Number.NaN })).toThrow(RangeError);
    expect(() => buildNumericHeatmap(range(0, [1]), range(0, [2]), { yMax: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });
});
