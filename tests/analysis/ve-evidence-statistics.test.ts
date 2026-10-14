import { describe, expect, it } from 'vitest';
import { robustWeightedEstimate, weightedQuantile } from '../../core/analysis/ve-evidence-statistics';

describe('VE robust weighted evidence statistics', () => {
  it('uses weighted quantiles instead of an arithmetic mean', () => {
    const observations = [
      { value: 0.99, weight: 1 },
      { value: 1.00, weight: 1 },
      { value: 1.01, weight: 1 },
      { value: 1.80, weight: 0.1 },
    ];
    expect(weightedQuantile(observations, 0.5)).toBe(1.00);
    expect(robustWeightedEstimate(observations).median).toBe(1.00);
  });

  it('retains P10/P90 spread as explicit evidence quality', () => {
    const estimate = robustWeightedEstimate([
      { value: 0.95, weight: 1 },
      { value: 1.00, weight: 1 },
      { value: 1.05, weight: 1 },
    ]);
    expect(estimate.p10).toBe(0.95);
    expect(estimate.median).toBe(1.00);
    expect(estimate.p90).toBe(1.05);
    expect(estimate.spread).toBeCloseTo(0.10, 8);
  });
});
