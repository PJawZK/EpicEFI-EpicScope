import { describe, expect, it } from 'vitest';
import { strongestVeEvidenceVisit } from '../../apps/web/src/pages/ve-analyzer-cell-evidence';

describe('VE Analyzer cell evidence review', () => {
  it('preserves a visit above 320k samples and calculates extrema across its full timestamp range', () => {
    const count = 320_459;
    const indices = Uint32Array.from({ length: count }, (_, index) => index);
    const visit = strongestVeEvidenceVisit(indices, (sample) => sample === 160_000 ? -500 : sample * 10);
    expect(visit?.sampleIndices).toHaveLength(count);
    expect(visit?.timeMs).toHaveLength(count);
    expect(visit?.startSampleIndex).toBe(0);
    expect(visit?.endSampleIndex).toBe(count - 1);
    expect(visit?.timeMs[160_000]).toBe(-500);
    expect(visit?.durationMs).toBe((count - 1) * 10 + 500);
  });

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
  it('retains normalization, duplicate samples, gap policy, missing times and stable ties', () => {
    const reference = (input: readonly number[], gap: number) => {
      const indices = input.filter(Number.isSafeInteger).sort((a, b) => a - b);
      const runs: number[][] = [];
      for (const sample of indices) {
        const last = runs[runs.length - 1];
        if (last && sample - last[last.length - 1]! <= Math.max(1, gap)) last.push(sample);
        else runs.push([sample]);
      }
      const time = (sample: number) => sample % 7 === 0 ? undefined : (sample % 5) * 100 - sample;
      const timed = runs.map(samples => {
        const times = samples.map(time).filter((value): value is number => value !== undefined);
        return { samples, times, duration: times.length > 0 ? Math.max(...times) - Math.min(...times) : undefined };
      }).filter(run => run.duration !== undefined).sort((a, b) => b.samples.length - a.samples.length || b.duration! - a.duration!);
      const best = timed[0];
      return best ? { sampleIndices: best.samples, timeMs: best.times, durationMs: best.duration,
        startSampleIndex: best.samples[0], endSampleIndex: best.samples[best.samples.length - 1] } : undefined;
    };
    let seed = 913;
    for (let test = 0; test < 200; test += 1) {
      const input = Array.from({ length: test % 60 }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % 70 - 10; });
      input.push(Number.NaN, 1.5, Number.POSITIVE_INFINITY);
      const original = input.slice();
      for (const gap of [0, 1, 3, 10, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(strongestVeEvidenceVisit(input, sample => sample % 7 === 0 ? undefined : (sample % 5) * 100 - sample, gap)).toEqual(reference(input, gap));
      }
      expect(input).toEqual(original);
    }
    expect(strongestVeEvidenceVisit([3, 2, 2, 1], sample => sample)?.sampleIndices).toEqual([1, 2, 2, 3]);
  });

  it('selects one timestamped visit from more than 320k fragments without losing the earliest tie', () => {
    const indices = Uint32Array.from({ length: 320_459 }, (_, index) => index * 2);
    expect(strongestVeEvidenceVisit(indices, index => index === 0 ? undefined : index * 10)?.sampleIndices).toEqual([2]);
  });

});
