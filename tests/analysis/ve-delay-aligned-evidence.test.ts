import { describe, expect, it } from 'vitest';
import { buildVeEvidenceMapWithDelayTable, buildVeEvidenceMapWithDelayTableAsync } from '../../core/analysis/ve-delay-aligned-evidence';
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
  const target = { rpmBins: [1000, 2000], loadBins: [40, 80], values: [14, 14, 14, 14], rows: 2, cols: 2 };
  const fixture = (count: number) => ({ actualMixture: constantRange(14, count), rpm: constantRange(1000, count),
    load: constantRange(40, count), target, veRpmBins: [1000, 2000], veLoadBins: [40, 80], delayTable: delayTable(100) });

  it('counts duplicate selected failures without counting unselected or originally invalid observations', () => {
    const input = fixture(3); input.actualMixture.validity[1] = 0;
    const result = buildVeEvidenceMapWithDelayTable({ ...input, sampleIndices: [0, 0, 1, 2, 99, NaN, 2.5] }, { minimumStableDurationMs: 0 });
    expect([result.inputSampleCount, result.delayUnavailableSampleCount, result.invalidSampleCount, result.contributingSampleCount]).toEqual([5, 2, 2, 1]);
  });

  it('keeps invalid observed values/times distinct from unavailable delay', () => {
    const input = fixture(4);
    input.actualMixture.values.set([0, NaN, Infinity, 14]); input.actualMixture.timeMs[3] = NaN;
    const result = buildVeEvidenceMapWithDelayTable(input, { minimumStableDurationMs: 0 });
    expect([result.inputSampleCount, result.invalidSampleCount, result.delayUnavailableSampleCount, result.contributingSampleCount]).toEqual([4, 4, 0, 0]);
  });

  it('aligns independently indexed correction/engine ranges to observation identity in both execution paths', async () => {
    const input = fixture(2);
    const actualMixture = { ...range([14, 14]), startSampleIndex: 10, timeMs: Float64Array.from([100, 200]) };
    const rpm = { ...constantRange(1000, 3), startSampleIndex: 9 };
    const load = { ...constantRange(40, 3), startSampleIndex: 8 };
    const fuelCorrectionPercent = { ...range([0, 5, 10]), startSampleIndex: 7 };
    const values = actualMixture.values.slice();
    const next = { ...input, actualMixture, rpm, load, fuelCorrectionPercent, delayTable: delayTable(0) };
    const config = { minimumStableDurationMs: 0, compensateFuelCorrectionPercent: true };
    const sync = buildVeEvidenceMapWithDelayTable(next, config);
    const asyncResult = await buildVeEvidenceMapWithDelayTableAsync(next, config, { yieldControl: async () => {} });
    expect(asyncResult).toEqual(sync);
    expect(sync.contributingSampleCount).toBe(2);
    expect(sync.cells[0]!.correctionRatio).toBeCloseTo(1.05, 10);
    expect(sync.cells[0]!.sampleIndices).toEqual(Uint32Array.from([10, 11]));
    expect(actualMixture.values).toEqual(values);
    expect([rpm.startSampleIndex, load.startSampleIndex, fuelCorrectionPercent.startSampleIndex]).toEqual([9, 8, 7]);
  });

  it('withholds a hole reached after the one permitted refinement instead of iterating or falling back', () => {
    const input = fixture(4);
    const working = [100, undefined, 200, 100];
    const table: VeDelayTable = { ...delayTable(100), rpmBins: [1000, 2000, 3000, 4000], cols: 4,
      cells: Array.from({ length: 8 }, (_, index) => ({ ...delayTable(100).cells[0]!, row: Math.floor(index / 4), col: index % 4, workingMs: working[index % 4] })) };
    const result = buildVeEvidenceMapWithDelayTable({ ...input, rpm: range([1000, 2000, 3000, 4000]), delayTable: table,
      target: { ...target, rpmBins: [1000, 2000, 3000, 4000], cols: 4, values: new Array<number>(8).fill(14) },
      veRpmBins: [1000, 2000, 3000, 4000], sampleIndices: [3] }, { minimumStableDurationMs: 0 });
    expect([result.inputSampleCount, result.contributingSampleCount, result.delayUnavailableSampleCount]).toEqual([1, 0, 1]);
  });

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
