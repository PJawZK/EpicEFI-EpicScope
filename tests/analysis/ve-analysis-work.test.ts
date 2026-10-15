import { describe, expect, it, vi } from 'vitest';
import { finishVeAnalysis, runVeAnalysis, sortVeAnalysisValues, type VeAnalysisSteps } from '../../core/analysis/ve-analysis-work';
import { robustWeightedEstimate, robustWeightedEstimateSteps } from '../../core/analysis/ve-evidence-statistics';
import { buildVeEvidenceMapWithDelayTable, buildVeEvidenceMapWithDelayTableAsync } from '../../core/analysis/ve-delay-aligned-evidence';
import type { VeDelayAlignedEvidenceInputs } from '../../core/analysis/ve-delay-aligned-evidence';

function fixture(count: number): VeDelayAlignedEvidenceInputs {
  const timeMs = Float64Array.from({ length: count }, (_, i) => i * 10);
  const range = (pick: (i: number) => number) => ({ startSampleIndex: 0, timeMs, values: Float64Array.from({ length: count }, (_, i) => pick(i)), validity: new Uint8Array(count).fill(1) });
  return {
    actualMixture: range((i) => 14 + (i % 17) / 100), rpm: range(() => 1000), load: range(() => 50),
    fuelCorrectionPercent: range((i) => i % 5),
    target: { rpmBins: [1000, 2000], loadBins: [50, 100], values: [14, 14, 14, 14], rows: 2, cols: 2 },
    veRpmBins: [1000, 2000], veLoadBins: [50, 100],
    delayTable: { rpmBins: [1000, 2000], loadBins: [50, 100], rows: 2, cols: 2, origin: 'saved-file', cells: Array.from({ length: 4 }, (_, i) => ({ row: Math.floor(i / 2), col: i % 2, state: 'measured' as const, workingMs: 20, recommendedMs: 20, workingProvenance: 'measured-recommendation' as const, p10Ms: 20, p90Ms: 20, spreadMs: 0, eventCount: 5, confidence: 'strong' as const, sourceEvents: [] })) },
  };
}

describe('cooperative VE calculation', () => {
  it('preserves exact weighted results and stable ordering across merge boundaries', () => {
    const observations = Array.from({ length: 12_345 }, (_, i) => ({ value: (i * 73) % 31, weight: (i % 7 + 1) / 10 }));
    observations.push({ value: NaN, weight: 1 }, { value: 0, weight: -1 });
    expect(finishVeAnalysis(robustWeightedEstimateSteps(observations))).toEqual(robustWeightedEstimate(observations));
    const items = observations.slice(0, 12_345).map((entry, i) => ({ ...entry, i }));
    const sorted = finishVeAnalysis(sortVeAnalysisValues([...items], (a, b) => a.value - b.value, 'test'));
    expect(sorted).toEqual([...items].sort((a, b) => a.value - b.value));
  });

  it('matches the synchronous full pipeline for >320k continuous samples and a populated single cell', async () => {
    const inputs = fixture(320_459);
    const config = { compensateFuelCorrectionPercent: true };
    const expected = buildVeEvidenceMapWithDelayTable(inputs, config);
    const actual = await buildVeEvidenceMapWithDelayTableAsync(inputs, config, { yieldControl: async () => {} });
    expect(actual).toEqual(expected);
    expect(actual.contributingSampleCount).toBeGreaterThan(320_000);
    expect(inputs.actualMixture.validity[0]).toBe(1);
    expect(inputs.actualMixture.timeMs[2]).toBe(20);
  }, 20_000);

  it('matches synchronous results across gaps, unsorted/duplicate scope indices and unavailable delay', async () => {
    const inputs = fixture(10_000);
    inputs.actualMixture.validity[500] = 0;
    inputs.rpm.values[1000] = 999;
    const selected = { ...inputs, sampleIndices: [9999, 2, 1, 1, NaN, 500, 1000, 1001, 300, 301, 302] };
    expect(await buildVeEvidenceMapWithDelayTableAsync(selected, {}, { yieldControl: async () => {} })).toEqual(buildVeEvidenceMapWithDelayTable(selected));
  });

  it('checks cancellation before touching input and closes suspended work', async () => {
    let entered = false, closed = false;
    function* steps(): VeAnalysisSteps<number> {
      try { entered = true; yield { phase: 'test', completed: 0, total: 1 }; return 1; }
      finally { closed = true; }
    }
    await expect(runVeAnalysis(steps(), { isCancelled: () => true })).rejects.toMatchObject({ name: 'AbortError' });
    expect(entered).toBe(false);
    let clock = 0, cancelled = false, progress = 0;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => clock += 9);
    try {
      await expect(runVeAnalysis(steps(), {
        isCancelled: () => cancelled,
        onProgress: () => { progress += 1; },
        yieldControl: async () => { if (entered) cancelled = true; },
      })).rejects.toMatchObject({ name: 'AbortError' });
      expect(closed).toBe(true); expect(progress).toBe(1);
    } finally { now.mockRestore(); }
  });

  it('cancels a large calculation after progress without publishing a result or mutating cached ranges', async () => {
    const inputs = fixture(20_000); let cancelled = false, clock = 0;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => clock += 9);
    try {
      await expect(buildVeEvidenceMapWithDelayTableAsync(inputs, {}, {
        isCancelled: () => cancelled,
        onProgress: ({ phase }) => { if (phase === 'Sorting weighted evidence') cancelled = true; },
        yieldControl: async () => {},
      })).rejects.toMatchObject({ name: 'AbortError' });
      expect(cancelled).toBe(true); expect(inputs.actualMixture.timeMs[0]).toBe(0); expect(inputs.actualMixture.validity[0]).toBe(1);
    } finally { now.mockRestore(); }
  });
  it('can cancel inside a wide steady-state slope window', async () => {
    const inputs = fixture(20_000); let cancelled = false, clock = 0;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => clock += 9);
    try {
      await expect(buildVeEvidenceMapWithDelayTableAsync(inputs, { minimumStableDurationMs: 100_000 }, {
        isCancelled: () => cancelled,
        onProgress: ({ phase }) => { if (phase === 'Checking steady slope') cancelled = true; },
        yieldControl: async () => {},
      })).rejects.toMatchObject({ name: 'AbortError' });
      expect(cancelled).toBe(true);
    } finally { now.mockRestore(); }
  });

});
