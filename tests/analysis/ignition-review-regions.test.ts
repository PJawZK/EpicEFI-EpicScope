import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { analyzeIgnitionReviewRegions } from '../../core/analysis/ignition-review-regions';

function range(values: readonly number[], startSampleIndex = 0, stepMs = 20): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(values.map(() => 1)),
  };
}

describe('Ignition review regions', () => {
  it('surfaces repeated stable timing steps and variability in the same RPM/load area', () => {
    const rpm = [2000, 2000, 2000, 3000, 3000, 2000, 2000, 2000, 3000, 3000, 2000, 2000];
    const load = rpm.map(() => 55);
    const advance = [10, 10, 16, 25, 25, 11, 11, 17, 25, 25, 12, 12];
    const result = analyzeIgnitionReviewRegions({
      advance: range(advance),
      rpm: range(rpm),
      load: range(load),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerRegion: 4,
      minimumStableDurationMs: 0,
      timingStepThreshold: 5,
      maxTransitionGapMs: 100,
    });

    const area = result.areas.find((entry) => entry.rpmStart === 2000 && entry.loadStart === 50);
    expect(area).toBeDefined();
    expect(area?.visitCount).toBe(3);
    expect(area?.timingStepCount).toBe(2);
    expect(area?.reasons).toContain('timing-steps');
    expect(area?.reasons).toContain('timing-variability');
    expect(area?.evidenceStartSampleIndex).toBeLessThanOrEqual(area?.evidenceEndSampleIndex ?? -1);
  });

  it('surfaces repeated correction activity without assigning a cause', () => {
    const values = Array.from({ length: 12 }, () => 15);
    const result = analyzeIgnitionReviewRegions({
      advance: range(values),
      rpm: range(values.map(() => 2200)),
      load: range(values.map(() => 70)),
      correction: range([0, 2, 2, 0, 0, 0, 3, 3, 0, 0, 0, 0]),
    }, {
      minimumSamplesPerRegion: 6,
      minimumStableDurationMs: 0,
      correctionThreshold: 0.5,
      timingStepThreshold: 5,
    });

    expect(result.areas).toHaveLength(1);
    expect(result.areas[0]?.reasons).toContain('correction-activity');
    expect(result.areas[0]?.correctionEpisodeCount).toBe(2);
    expect(result.areas[0]?.correctionPeakMagnitude).toBe(3);
  });

  it('rejects fast RPM movement from stable-context review evidence', () => {
    const rpm = [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400];
    const result = analyzeIgnitionReviewRegions({
      advance: range(rpm.map(() => 15)),
      rpm: range(rpm),
      load: range(rpm.map(() => 50)),
    }, {
      minimumSamplesPerRegion: 2,
      minimumStableDurationMs: 60,
      maxRpmRatePerSecond: 200,
      maxLoadRatePerSecond: 25,
      timingStepThreshold: 5,
    });

    expect(result.validAlignedSampleCount).toBe(rpm.length);
    expect(result.stableSampleCount).toBe(0);
    expect(result.transientRejectedSampleCount).toBe(rpm.length);
    expect(result.areas).toHaveLength(0);
  });

  it('surfaces a well-supported advance difference between adjacent operating regions', () => {
    const rpm = [2000, 2000, 2000, 2000, 2000, 2250, 2250, 2250, 2250, 2250];
    const advance = [10, 10, 10, 10, 10, 18, 18, 18, 18, 18];
    const result = analyzeIgnitionReviewRegions({
      advance: range(advance),
      rpm: range(rpm),
      load: range(rpm.map(() => 60)),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerRegion: 4,
      minimumStableDurationMs: 0,
      timingStepThreshold: 5,
    });

    expect(result.reviewAreaCount).toBe(2);
    expect(result.areas.every((entry) => entry.reasons.includes('adjacent-transition'))).toBe(true);
    expect(result.areas.every((entry) => entry.adjacentAdvanceDifference === 8)).toBe(true);
  });

  it('validates review configuration', () => {
    const input = {
      advance: range([10, 10]),
      rpm: range([1000, 1000]),
      load: range([50, 50]),
    };
    expect(() => analyzeIgnitionReviewRegions(input, { rpmBinSize: 0 })).toThrow(RangeError);
    expect(() => analyzeIgnitionReviewRegions(input, { minimumSamplesPerRegion: 0 })).toThrow(RangeError);
    expect(() => analyzeIgnitionReviewRegions(input, { timingStepThreshold: 0 })).toThrow(RangeError);
    expect(() => analyzeIgnitionReviewRegions(input, { correctionThreshold: -1 })).toThrow(RangeError);
  });
});
