import { describe, expect, it } from 'vitest';
import { buildVeEvidenceMapWithDelayTable } from '../../core/analysis/ve-delay-aligned-evidence';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import type { VeDelayTable } from '../../core/analysis/ve-delay-table';

function range(values: number[], stepMs = 100): NumericChannelRange {
  return {
    startSampleIndex: 0,
    timeMs: Float64Array.from(values, (_, index) => index * stepMs),
    values: Float64Array.from(values),
    validity: Uint8Array.from(values, () => 1),
  };
}

function constantRange(value: number, count: number, stepMs = 100): NumericChannelRange {
  return range(Array.from({ length: count }, () => value), stepMs);
}

function delayTable(workingMs: number | undefined): VeDelayTable {
  return {
    rpmBins: [1000, 2000],
    loadBins: [40, 80],
    rows: 2,
    cols: 2,
    origin: 'log-discovery',
    cells: [0, 1, 2, 3].map((index) => ({
      row: Math.floor(index / 2),
      col: index % 2,
      state: workingMs === undefined ? 'insufficient' as const : 'measured' as const,
      recommendedMs: workingMs,
      workingMs,
      workingProvenance: workingMs === undefined ? undefined : 'measured-recommendation' as const,
      eventCount: workingMs === undefined ? 0 : 3,
      p10Ms: workingMs,
      p90Ms: workingMs,
      spreadMs: workingMs === undefined ? undefined : 0,
      confidence: workingMs === undefined ? 'none' as const : 'moderate' as const,
      sourceEvents: [],
    })),
  };
}

describe('VE delay-table aligned evidence', () => {
  it('uses the per-operating-point working delay instead of a global scalar', () => {
    const count = 20;
    const result = buildVeEvidenceMapWithDelayTable({
      actualMixture: constantRange(15.0, count),
      rpm: constantRange(1500, count),
      load: constantRange(60, count),
      target: { rpmBins: [1000, 2000], loadBins: [40, 80], values: [14, 14, 14, 14], rows: 2, cols: 2 },
      veRpmBins: [1000, 2000],
      veLoadBins: [40, 80],
      delayTable: delayTable(100),
    }, { minimumStableDurationMs: 0 });

    expect(result.delayModel).toBe('rpm-load-table');
    expect(result.delayUnavailableSampleCount).toBe(1);
    expect(result.contributingSampleCount).toBeGreaterThan(0);
    expect(result.cells.some((cell) => cell.totalWeight > 0)).toBe(true);
  });

  it('withholds samples where the working delay table has no usable value', () => {
    const count = 12;
    const result = buildVeEvidenceMapWithDelayTable({
      actualMixture: constantRange(14.0, count),
      rpm: constantRange(1500, count),
      load: constantRange(60, count),
      target: { rpmBins: [1000, 2000], loadBins: [40, 80], values: [14, 14, 14, 14], rows: 2, cols: 2 },
      veRpmBins: [1000, 2000],
      veLoadBins: [40, 80],
      delayTable: delayTable(undefined),
    }, { minimumStableDurationMs: 0 });

    expect(result.delayUnavailableSampleCount).toBe(count);
    expect(result.contributingSampleCount).toBe(0);
  });
});
