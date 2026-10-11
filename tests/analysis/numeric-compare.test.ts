import { describe, expect, it } from 'vitest';
import { compareNumericCohorts } from '../../core/analysis/numeric-compare';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(startSampleIndex: number, values: readonly number[], validity?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => (startSampleIndex + index) * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('compareNumericCohorts', () => {
  it('compares shared aggregation metrics with right-minus-left deltas', () => {
    const result = compareNumericCohorts(
      { range: range(0, [1, 2, 3]), complete: true },
      { range: range(0, [2, 4, 6]), complete: true },
    );

    expect(result.metrics.count.left).toBe(3);
    expect(result.metrics.count.right).toBe(3);
    expect(result.metrics.count.delta).toBe(0);
    expect(result.metrics.mean.left).toBe(2);
    expect(result.metrics.mean.right).toBe(4);
    expect(result.metrics.mean.delta).toBe(2);
    expect(result.metrics.mean.relativeDelta).toBe(1);
    expect(result.metrics['standard-deviation'].left).toBeCloseTo(1);
    expect(result.metrics['standard-deviation'].right).toBeCloseTo(2);
  });

  it('adds interpolated P10, median and P90 cohort comparisons', () => {
    const result = compareNumericCohorts(
      { range: range(0, [0, 10, 20, 30, 40]), complete: true },
      { range: range(0, [10, 20, 30, 40, 50]), complete: true },
    );

    expect(result.percentiles.p10.left).toBeCloseTo(4);
    expect(result.percentiles.p10.right).toBeCloseTo(14);
    expect(result.percentiles.p10.delta).toBeCloseTo(10);
    expect(result.percentiles.p10.relativeDelta).toBeCloseTo(2.5);
    expect(result.percentiles.median.left).toBe(20);
    expect(result.percentiles.median.right).toBe(30);
    expect(result.percentiles.median.delta).toBe(10);
    expect(result.percentiles.p90.left).toBeCloseTo(36);
    expect(result.percentiles.p90.right).toBeCloseTo(46);
  });

  it('supports independent source-index cohorts on each side', () => {
    const result = compareNumericCohorts(
      { range: range(100, [10, 20, 30, 40]), sampleIndices: [100, 102], complete: true },
      { range: range(200, [5, 15, 25, 35]), sampleIndices: [201, 203], complete: true },
    );

    expect(result.left.validSampleCount).toBe(2);
    expect(result.right.validSampleCount).toBe(2);
    expect(result.metrics.mean.left).toBe(20);
    expect(result.metrics.mean.right).toBe(25);
    expect(result.metrics.mean.delta).toBe(5);
    expect(result.percentiles.median.left).toBe(20);
    expect(result.percentiles.median.right).toBe(25);
  });

  it('keeps invalid and unavailable evidence separate per side', () => {
    const result = compareNumericCohorts(
      { range: range(10, [1, 2], [1, 0]), sampleIndices: [10, 11, 12], complete: false },
      { range: range(20, [3, 4]), sampleIndices: [20, 21], complete: true },
    );

    expect(result.left.validSampleCount).toBe(1);
    expect(result.left.invalidSampleCount).toBe(1);
    expect(result.left.unavailableSampleCount).toBe(1);
    expect(result.right.validSampleCount).toBe(2);
    expect(result.percentiles.median.left).toBe(1);
    expect(result.complete).toBe(false);
  });

  it('marks comparison partial when caller coverage is partial even with no unavailable selected samples', () => {
    const result = compareNumericCohorts(
      { range: range(0, [1, 2]), complete: false },
      { range: range(0, [3, 4]), complete: true },
    );

    expect(result.left.unavailableSampleCount).toBe(0);
    expect(result.complete).toBe(false);
  });

  it('returns undefined relative delta when the left baseline is zero', () => {
    const result = compareNumericCohorts(
      { range: range(0, [0]), complete: true },
      { range: range(0, [4]), complete: true },
    );

    expect(result.metrics.mean.delta).toBe(4);
    expect(result.metrics.mean.relativeDelta).toBeUndefined();
    expect(result.percentiles.median.delta).toBe(4);
    expect(result.percentiles.median.relativeDelta).toBeUndefined();
  });

  it('keeps missing numeric metrics undefined when a side has no valid samples', () => {
    const result = compareNumericCohorts(
      { range: range(0, [1], [0]), complete: true },
      { range: range(0, [4]), complete: true },
    );

    expect(result.metrics.mean.left).toBeUndefined();
    expect(result.metrics.mean.right).toBe(4);
    expect(result.metrics.mean.delta).toBeUndefined();
    expect(result.metrics.mean.relativeDelta).toBeUndefined();
    expect(result.metrics.count.left).toBe(0);
    expect(result.metrics.count.delta).toBe(1);
    expect(result.percentiles.median.left).toBeUndefined();
    expect(result.percentiles.median.delta).toBeUndefined();
  });
});
