import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { buildVeEvidenceMap, interpolateNumericRangeAtTime, interpolateVeTable } from '../../core/analysis/ve-evidence-map';

function range(values: readonly number[], stepMs = 100, startMs = 0): NumericChannelRange {
  return {
    startSampleIndex: 0,
    timeMs: Float64Array.from(values.map((_, index) => startMs + index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(values.map(() => 1)),
  };
}

const target = {
  rpmBins: [1000, 2000],
  loadBins: [50, 100],
  values: [14, 13, 12, 11],
  rows: 2,
  cols: 2,
} as const;

describe('VE evidence map', () => {
  it('interpolates the target table bilinearly without extrapolating', () => {
    expect(interpolateVeTable(target, 1000, 50)).toBe(14);
    expect(interpolateVeTable(target, 1500, 75)).toBeCloseTo(12.5, 8);
    expect(interpolateVeTable(target, 500, 75)).toBeUndefined();
  });

  it('interpolates engine-state channels by timestamp rather than record offset', () => {
    const irregular: NumericChannelRange = {
      startSampleIndex: 0,
      timeMs: Float64Array.from([0, 70, 210, 400]),
      values: Float64Array.from([1000, 1200, 1600, 2000]),
      validity: Uint8Array.from([1, 1, 1, 1]),
    };
    expect(interpolateNumericRangeAtTime(irregular, 140)).toBeCloseTo(1400, 8);
    expect(interpolateNumericRangeAtTime(irregular, -1)).toBeUndefined();
  });

  it('contributes an exact breakpoint sample to one VE node', () => {
    const result = buildVeEvidenceMap({
      actualMixture: range([15]),
      rpm: range([1000]),
      load: range([50]),
      target,
      veRpmBins: [1000, 2000],
      veLoadBins: [50, 100],
    }, { minimumStableDurationMs: 0 });

    expect(result.contributingSampleCount).toBe(1);
    expect(result.cells[0]!.sampleCount).toBe(1);
    expect(result.cells[0]!.totalWeight).toBe(1);
    expect(result.cells[0]!.correctionRatio).toBeCloseTo(15 / 14, 8);
    expect(result.cells.slice(1).every((cell) => cell.sampleCount === 0)).toBe(true);
  });

  it('splits a center operating point across four surrounding nodes', () => {
    const result = buildVeEvidenceMap({
      actualMixture: range([12.5]),
      rpm: range([1500]),
      load: range([75]),
      target,
      veRpmBins: [1000, 2000],
      veLoadBins: [50, 100],
    }, { minimumStableDurationMs: 0 });

    expect(result.cells.map((cell) => cell.totalWeight)).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(result.cells.every((cell) => cell.correctionRatio === 1)).toBe(true);
  });

  it('aligns observed mixture back to the delayed engine state by time', () => {
    const actual: NumericChannelRange = {
      startSampleIndex: 0,
      timeMs: Float64Array.from([0, 100, 200, 300]),
      values: Float64Array.from([14, 14, 14, 13]),
      validity: Uint8Array.from([1, 1, 1, 1]),
    };
    const rpm: NumericChannelRange = {
      startSampleIndex: 0,
      timeMs: Float64Array.from([0, 80, 200, 320]),
      values: Float64Array.from([1000, 1000, 2000, 2000]),
      validity: Uint8Array.from([1, 1, 1, 1]),
    };
    const load: NumericChannelRange = {
      startSampleIndex: 0,
      timeMs: Float64Array.from([0, 80, 200, 320]),
      values: Float64Array.from([50, 50, 100, 100]),
      validity: Uint8Array.from([1, 1, 1, 1]),
    };
    const result = buildVeEvidenceMap({ actualMixture: actual, rpm, load, target, veRpmBins: [1000, 2000], veLoadBins: [50, 100], sampleIndices: [3] }, {
      delayMs: 100,
      minimumStableDurationMs: 0,
    });

    // Mixture observed at 300 ms is attributed to engine state at 200 ms: 2000 RPM / 100 load.
    expect(result.delayMs).toBe(100);
    expect(result.delayUnavailableSampleCount).toBe(0);
    expect(result.cells[3]!.sampleCount).toBe(1);
    expect(result.cells[3]!.correctionRatio).toBeCloseTo(13 / 11, 8);
    expect(result.cells[0]!.sampleCount).toBe(0);
  });

  it('counts samples whose requested delayed engine state predates the loaded data', () => {
    const result = buildVeEvidenceMap({
      actualMixture: range([14], 100, 50),
      rpm: range([1000], 100, 50),
      load: range([50], 100, 50),
      target,
      veRpmBins: [1000, 2000],
      veLoadBins: [50, 100],
    }, { delayMs: 100, minimumStableDurationMs: 0 });
    expect(result.delayUnavailableSampleCount).toBe(1);
    expect(result.contributingSampleCount).toBe(0);
  });

  it('rejects target-table and VE-axis extrapolation explicitly', () => {
    const outsideTarget = buildVeEvidenceMap({
      actualMixture: range([14]), rpm: range([900]), load: range([50]), target,
      veRpmBins: [500, 2000], veLoadBins: [50, 100],
    }, { minimumStableDurationMs: 0 });
    expect(outsideTarget.targetOutOfRangeSampleCount).toBe(1);
    expect(outsideTarget.contributingSampleCount).toBe(0);

    const outsideVe = buildVeEvidenceMap({
      actualMixture: range([13]), rpm: range([2000]), load: range([100]), target,
      veRpmBins: [1000, 1500], veLoadBins: [50, 100],
    }, { minimumStableDurationMs: 0 });
    expect(outsideVe.veOutOfRangeSampleCount).toBe(1);
    expect(outsideVe.contributingSampleCount).toBe(0);
  });

  it('requires the configured trailing stability duration before accepting evidence', () => {
    const result = buildVeEvidenceMap({
      actualMixture: range([14, 14, 14, 14, 14], 100),
      rpm: range([1000, 1000, 1000, 1000, 1000], 100),
      load: range([50, 50, 50, 50, 50], 100),
      target,
      veRpmBins: [1000, 2000],
      veLoadBins: [50, 100],
    }, { minimumStableDurationMs: 300 });

    expect(result.validAlignedSampleCount).toBe(5);
    expect(result.eligibleSampleCount).toBe(2);
    expect(result.transientRejectedSampleCount).toBe(3);
  });
});
