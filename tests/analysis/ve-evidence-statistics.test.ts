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

it('preserves weighted thresholds, validation and input order', () => {
  const observations = Object.freeze([
    Object.freeze({ value: 9, weight: 1 }),
    Object.freeze({ value: 1, weight: 1 }),
    Object.freeze({ value: 5, weight: 8 }),
    { value: NaN, weight: 1 }, { value: 0, weight: Infinity },
    { value: -1, weight: 0 }, { value: 2, weight: -2 },
  ]);
  expect(robustWeightedEstimate(observations)).toEqual({
    median: 5, p10: 1, p90: 5, spread: 4, totalWeight: 10, observationCount: 3,
  });
  expect(weightedQuantile(observations, -1)).toBe(1);
  expect(weightedQuantile(observations, 2)).toBe(9);
  expect(observations[0]!.value).toBe(9);
  expect(robustWeightedEstimate([])).toEqual({ median: undefined, p10: undefined, p90: undefined, spread: undefined, totalWeight: 0, observationCount: 0 });
});

it('computes exact quantiles for over 320k unsorted observations without altering them', () => {
  const count = 320_459;
  const observations = Array.from({ length: count }, (_, index) => ({ value: count - index - 1, weight: 1 }));
  expect(robustWeightedEstimate(observations)).toEqual({
    median: Math.ceil(count * 0.5) - 1,
    p10: Math.ceil(count * 0.1) - 1,
    p90: Math.ceil(count * 0.9) - 1,
    spread: Math.ceil(count * 0.9) - Math.ceil(count * 0.1),
    totalWeight: count, observationCount: count,
  });
  expect(observations[0]!.value).toBe(count - 1);
});
