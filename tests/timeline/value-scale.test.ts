import { describe, expect, it } from 'vitest';
import { buildStableValueScale } from '../../core/timeline/value-scale';

describe('buildStableValueScale', () => {
  it('uses the complete valid channel range independently of a later viewport', () => {
    const scale = buildStableValueScale({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 10, 20, 30]),
      values: new Float64Array([0, 100, 50, 80]),
      validity: new Uint8Array([1, 1, 1, 1]),
    });

    expect(scale.min).toBe(0);
    expect(scale.max).toBe(104);
  });

  it('ignores invalid and non-finite samples', () => {
    const scale = buildStableValueScale({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 10, 20, 30]),
      values: new Float64Array([10, 999, Number.NaN, 20]),
      validity: new Uint8Array([1, 0, 1, 1]),
    });

    expect(scale.min).toBeCloseTo(9.6);
    expect(scale.max).toBeCloseTo(20.4);
  });
});
