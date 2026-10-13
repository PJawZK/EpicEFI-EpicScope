import { describe, expect, it } from 'vitest';
import { buildNumericScatter, selectNumericScatterRegion } from '../../core/analysis/scatter';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(startSampleIndex: number, values: readonly number[], validity?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => (startSampleIndex + index) * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('buildNumericScatter', () => {
  it('returns aligned x/y values and source sample indices', () => {
    const result = buildNumericScatter(
      range(10, [1, 2, 3]),
      range(10, [10, 20, 30]),
    );

    expect([...result.sampleIndices]).toEqual([10, 11, 12]);
    expect([...result.xValues]).toEqual([1, 2, 3]);
    expect([...result.yValues]).toEqual([10, 20, 30]);
    expect(result.inputSampleCount).toBe(3);
    expect(result.validPairSampleCount).toBe(3);
  });

  it('aligns selected source indices across different local offsets', () => {
    const result = buildNumericScatter(
      range(100, [1, 2, 3, 4]),
      range(99, [8, 10, 20, 30, 40]),
      { sampleIndices: Uint32Array.from([101, 103]) },
    );

    expect([...result.sampleIndices]).toEqual([101, 103]);
    expect([...result.xValues]).toEqual([2, 4]);
    expect([...result.yValues]).toEqual([20, 40]);
  });

  it('keeps invalid and unavailable pairs separate', () => {
    const result = buildNumericScatter(
      range(10, [1, 2, 3], [1, 0, 1]),
      range(11, [20, 30], [1, 1]),
      { sampleIndices: [10, 11, 12, 13] },
    );

    expect(result.inputSampleCount).toBe(4);
    expect(result.validPairSampleCount).toBe(1);
    expect(result.invalidSampleCount).toBe(1);
    expect(result.unavailableSampleCount).toBe(2);
    expect([...result.sampleIndices]).toEqual([12]);
    expect([...result.xValues]).toEqual([3]);
    expect([...result.yValues]).toEqual([30]);
  });

  it('reports finite bounds over valid aligned pairs only', () => {
    const result = buildNumericScatter(
      range(0, [-4, 2, 7, 100], [1, 1, 1, 0]),
      range(0, [5, -3, 9, 200], [1, 1, 1, 1]),
    );

    expect(result.xMin).toBe(-4);
    expect(result.xMax).toBe(7);
    expect(result.yMin).toBe(-3);
    expect(result.yMax).toBe(9);
    expect(result.invalidSampleCount).toBe(1);
  });

  it('returns undefined bounds when no valid aligned pair exists', () => {
    const result = buildNumericScatter(
      range(0, [1, 2], [0, 0]),
      range(0, [3, 4]),
    );

    expect(result.validPairSampleCount).toBe(0);
    expect(result.xMin).toBeUndefined();
    expect(result.xMax).toBeUndefined();
    expect(result.yMin).toBeUndefined();
    expect(result.yMax).toBeUndefined();
  });

  it('treats selected indices outside either decoded range as unavailable', () => {
    const result = buildNumericScatter(
      range(20, [1, 2]),
      range(20, [3, 4]),
      { sampleIndices: [19, 20, 21, 22] },
    );

    expect(result.inputSampleCount).toBe(4);
    expect(result.validPairSampleCount).toBe(2);
    expect(result.unavailableSampleCount).toBe(2);
  });

  it('selects every valid pair inside an inclusive X/Y region', () => {
    const result = buildNumericScatter(
      range(100, [1, 2, 3, 4, 5]),
      range(100, [50, 40, 30, 20, 10]),
    );
    const selected = selectNumericScatterRegion(result, { xMin: 2, xMax: 4, yMin: 20, yMax: 40 });

    expect(selected.selectedPairCount).toBe(3);
    expect([...selected.sampleIndices]).toEqual([101, 102, 103]);
  });

  it('normalizes reversed region bounds and selects from the complete result', () => {
    const values = Array.from({ length: 12 }, (_, index) => index);
    const result = buildNumericScatter(range(0, values), range(0, values.map((value) => value * 2)));
    const selected = selectNumericScatterRegion(result, { xMin: 9, xMax: 3, yMin: 18, yMax: 6 });

    expect(selected.selectedPairCount).toBe(7);
    expect([...selected.sampleIndices]).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('returns an empty evidence set when no pair lies inside the region', () => {
    const result = buildNumericScatter(range(0, [1, 2, 3]), range(0, [10, 20, 30]));
    const selected = selectNumericScatterRegion(result, { xMin: 100, xMax: 200, yMin: 100, yMax: 200 });

    expect(selected.selectedPairCount).toBe(0);
    expect([...selected.sampleIndices]).toEqual([]);
  });
});
