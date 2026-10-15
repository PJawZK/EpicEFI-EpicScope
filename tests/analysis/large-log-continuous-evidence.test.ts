import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { buildVeEvidenceMap } from '../../core/analysis/ve-evidence-map';
import { buildVeEvidenceMapWithDelayTable } from '../../core/analysis/ve-delay-aligned-evidence';
import { buildFuelingOperatingMap } from '../../core/analysis/fueling-operating-map';
import { analyzeIgnitionReviewRegions } from '../../core/analysis/ignition-review-regions';
import type { VeDelayTable } from '../../core/analysis/ve-delay-table';

// Keep each accepted continuous segment above the browser's argument-count limit.
const SAMPLE_COUNT = 320_459;
// These correctness cases intentionally process full logs, not interactive-sized fixtures.
const ANALYSIS_TIMEOUT_MS = 30_000;
const STEP_MS = 10;

function range(value: number): NumericChannelRange {
  return {
    startSampleIndex: 0,
    timeMs: Float64Array.from({ length: SAMPLE_COUNT }, (_, index) => index * STEP_MS),
    values: new Float64Array(SAMPLE_COUNT).fill(value),
    validity: new Uint8Array(SAMPLE_COUNT).fill(1),
  };
}

const target = {
  rpmBins: [1000, 2000], loadBins: [50, 100],
  values: [14, 14, 14, 14], rows: 2, cols: 2,
};

describe('browser-scale continuous analysis evidence', () => {
  it.each([0, 300])('retains all eligible VE samples with a %i ms stability window', (minimumStableDurationMs) => {
    const result = buildVeEvidenceMap({
      actualMixture: range(15), rpm: range(1000), load: range(50), target,
      veRpmBins: target.rpmBins, veLoadBins: target.loadBins,
    }, { minimumStableDurationMs });
    const firstEligible = minimumStableDurationMs / STEP_MS;
    const eligible = SAMPLE_COUNT - firstEligible;
    expect(result.inputSampleCount).toBe(SAMPLE_COUNT);
    expect(result.validAlignedSampleCount).toBe(SAMPLE_COUNT);
    expect(result.eligibleSampleCount).toBe(eligible);
    expect(result.contributingSampleCount).toBe(eligible);
    expect(result.transientRejectedSampleCount).toBe(firstEligible);
    const cell = result.cells[0]!;
    expect(cell.sampleCount).toBe(eligible);
    expect(cell.totalWeight).toBe(eligible);
    expect(cell.sampleIndices).toHaveLength(eligible);
    expect(cell.sampleIndices[0]).toBe(firstEligible);
    expect(cell.sampleIndices[eligible - 1]).toBe(SAMPLE_COUNT - 1);
    expect(cell.correctionRatio).toBeCloseTo(15 / 14, 10);
    expect(result.cells.slice(1).every((entry) => entry.sampleCount === 0)).toBe(true);
  }, ANALYSIS_TIMEOUT_MS);

  it('retains a browser-scale continuous segment through working-delay alignment', () => {
    const delayTable: VeDelayTable = {
      rpmBins: target.rpmBins, loadBins: target.loadBins, rows: 2, cols: 2,
      origin: 'saved-file',
      cells: Array.from({ length: 4 }, (_, index) => ({
        row: Math.floor(index / 2), col: index % 2,
        state: 'measured', recommendedMs: 100, workingMs: 100,
        workingProvenance: 'measured-recommendation', eventCount: 5,
        p10Ms: 100, p90Ms: 100, spreadMs: 0, confidence: 'moderate', sourceEvents: [],
      })),
    };
    const result = buildVeEvidenceMapWithDelayTable({
      actualMixture: range(15), rpm: range(1000), load: range(50), target,
      veRpmBins: target.rpmBins, veLoadBins: target.loadBins, delayTable,
    });
    // Ten samples precede the working delay, then thirty establish stability.
    const eligible = SAMPLE_COUNT - 40;
    expect(result.delayUnavailableSampleCount).toBe(10);
    expect(result.validAlignedSampleCount).toBe(SAMPLE_COUNT - 10);
    expect(result.transientRejectedSampleCount).toBe(30);
    expect(result.contributingSampleCount).toBe(eligible);
    expect(result.cells[0]!.sampleIndices).toHaveLength(eligible);
    expect(result.cells[0]!.sampleIndices[0]).toBe(40);
    expect(result.cells[0]!.sampleIndices[eligible - 1]).toBe(SAMPLE_COUNT - 1);
    expect(result.cells[0]!.correctionRatio).toBeCloseTo(15 / 14, 10);
  }, ANALYSIS_TIMEOUT_MS);

  it.each([0, 300])('retains all eligible Fueling samples with a %i ms stability window', (minimumStableDurationMs) => {
    const result = buildFuelingOperatingMap({
      actualAfr: range(15), targetAfr: range(14), rpm: range(1000), load: range(50),
    }, { rpmBinSize: 250, loadBinSize: 10, minimumStableDurationMs });
    const rejected = minimumStableDurationMs / STEP_MS;
    expect(result.inputSampleCount).toBe(SAMPLE_COUNT);
    expect(result.validAlignedSampleCount).toBe(SAMPLE_COUNT);
    expect(result.stableEligibleSampleCount).toBe(SAMPLE_COUNT - rejected);
    expect(result.transientRejectedSampleCount).toBe(rejected);
    expect(result.operatingPoints).toHaveLength(1);
    expect(result.operatingPoints[0]).toMatchObject({
      observedSampleCount: SAMPLE_COUNT, sampleCount: SAMPLE_COUNT - rejected,
      actualAfrMean: 15, targetAfrMean: 14, errorMedian: 1, errorP10: 1, errorP90: 1,
    });
  }, ANALYSIS_TIMEOUT_MS);

  it.each([0, 300])('retains all eligible Ignition samples with a %i ms stability window', (minimumStableDurationMs) => {
    const advance = range(10);
    for (let index = 1; index < SAMPLE_COUNT; index += 2) advance.values[index] = 16;
    const result = analyzeIgnitionReviewRegions({
      advance, rpm: range(1000), load: range(50),
    }, { minimumStableDurationMs });
    const rejected = minimumStableDurationMs / STEP_MS;
    const eligible = SAMPLE_COUNT - rejected;
    expect(result.inputSampleCount).toBe(SAMPLE_COUNT);
    expect(result.validAlignedSampleCount).toBe(SAMPLE_COUNT);
    expect(result.stableSampleCount).toBe(eligible);
    expect(result.transientRejectedSampleCount).toBe(rejected);
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0]).toMatchObject({
      stableSampleCount: eligible, visitCount: 1, timingStepCount: eligible - 1,
      evidenceStartSampleIndex: rejected, evidenceEndSampleIndex: SAMPLE_COUNT - 1,
    });
  }, ANALYSIS_TIMEOUT_MS);
});
