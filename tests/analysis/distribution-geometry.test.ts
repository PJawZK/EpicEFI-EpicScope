import { describe, expect, it } from 'vitest';
import { distributionValueInsideGeometry, resolveFixedDistributionGeometry } from '../../core/analysis/distribution-geometry';

describe('fixed Distribution geometry', () => {
  it('resolves exact repeatable min/max/width geometry', () => {
    expect(resolveFixedDistributionGeometry({ min: 0, max: 250, width: 5 })).toEqual({ min: 0, max: 250, width: 5, binCount: 50 });
    expect(resolveFixedDistributionGeometry({ min: -1, max: 1, width: .1 }).binCount).toBe(20);
  });

  it('rejects ambiguous partial-width or excessive geometry', () => {
    expect(() => resolveFixedDistributionGeometry({ min: 0, max: 10, width: 3 })).toThrow(/whole number/i);
    expect(() => resolveFixedDistributionGeometry({ min: 0, max: 1000, width: 1, maximumBinCount: 512 })).toThrow(/1–512/);
  });

  it('treats both fixed endpoints as inside the requested geometry', () => {
    expect(distributionValueInsideGeometry(0, 0, 100)).toBe(true);
    expect(distributionValueInsideGeometry(100, 0, 100)).toBe(true);
    expect(distributionValueInsideGeometry(-.001, 0, 100)).toBe(false);
    expect(distributionValueInsideGeometry(100.001, 0, 100)).toBe(false);
  });
});
