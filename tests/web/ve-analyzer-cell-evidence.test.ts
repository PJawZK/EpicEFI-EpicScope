import { describe, expect, it } from 'vitest';
import { strongestVeEvidenceVisit } from '../../apps/web/src/pages/ve-analyzer-cell-evidence';

describe('VE Analyzer cell evidence review', () => {
  it('selects the longest contiguous source visit for Logger navigation', () => {
    const times = new Map<number, number>([
      [10, 1000], [11, 1010], [12, 1020],
      [30, 2000], [31, 2010], [32, 2020], [33, 2030],
      [50, 3000],
    ]);
    const visit = strongestVeEvidenceVisit([10, 11, 12, 30, 31, 32, 33, 50], (sample) => times.get(sample));
    expect(visit?.sampleIndices).toEqual([30, 31, 32, 33]);
    expect(visit?.timeMs).toEqual([2000, 2010, 2020, 2030]);
    expect(visit?.durationMs).toBe(30);
  });

  it('uses duration to break equal-length visit ties', () => {
    const times = new Map<number, number>([
      [1, 100], [2, 110],
      [20, 1000], [21, 1100],
    ]);
    const visit = strongestVeEvidenceVisit([1, 2, 20, 21], (sample) => times.get(sample));
    expect(visit?.sampleIndices).toEqual([20, 21]);
    expect(visit?.durationMs).toBe(100);
  });

  it('returns undefined when none of the retained samples have timestamps', () => {
    expect(strongestVeEvidenceVisit([1, 2, 3], () => undefined)).toBeUndefined();
  });
});
