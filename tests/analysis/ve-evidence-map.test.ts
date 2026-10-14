import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { buildVeEvidenceMap, interpolateVeTable } from '../../core/analysis/ve-evidence-map';

function range(values: readonly number[], stepMs = 100): NumericChannelRange {
  return {
    startSampleIndex: 0,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
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
