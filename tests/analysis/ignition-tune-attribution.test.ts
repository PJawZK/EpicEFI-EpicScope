import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import type { IgnitionReviewArea } from '../../core/analysis/ignition-review-regions';
import { analyzeIgnitionTuneAttribution } from '../../core/analysis/ignition-tune-attribution';
import type { TuneTable2D } from '../../core/tune/table-correlation';

function range(values: readonly number[], stepMs = 20): NumericChannelRange {
  return {
    startSampleIndex: 0,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(values.map(() => 1)),
  };
}

function area(overrides: Partial<IgnitionReviewArea> = {}): IgnitionReviewArea {
  return {
    rpmStart: 1000,
    rpmEnd: 2501,
    loadStart: 50,
    loadEnd: 100,
    stableSampleCount: 4,
    visitCount: 2,
    evidenceStrength: 'strong',
    reasons: ['timing-steps'],
    advanceMean: 17.5,
    advanceP10: 10,
    advanceP90: 25,
    advanceSpread: 15,
    timingTransitionCount: 3,
    timingStepCount: 2,
    maxTimingStep: 5,
    correctionActiveSampleCount: 0,
    correctionActiveFraction: 0,
    correctionEpisodeCount: 0,
    evidenceStartSampleIndex: 0,
    evidenceEndSampleIndex: 3,
    evidenceStartTimeMs: 0,
    evidenceEndTimeMs: 60,
    ...overrides,
  };
}

const table: TuneTable2D = {
  name: 'ignitionTable',
  units: 'deg',
  xAxisName: 'ignitionRpmBins',
  yAxisName: 'ignitionLoadBins',
  xAxis: [1000, 1500, 2000, 2500],
  yAxis: [50, 100],
  values: [10, 15, 20, 25, 12, 17, 22, 27],
  rows: 2,
  cols: 4,
};

describe('Ignition tune attribution', () => {
  it('recognizes representative timing steps that move with the base table', () => {
    const result = analyzeIgnitionTuneAttribution([area()], table, {
      advance: range([10, 15, 20, 25]),
      rpm: range([1000, 1500, 2000, 2500]),
      load: range([50, 50, 50, 50]),
    }, { timingStepThreshold: 5 });

    const entry = result.areas[0]!;
    expect(entry.mappedSampleCount).toBe(4);
    expect(entry.observedTimingStepCount).toBe(3);
    expect(entry.baseAlignedTimingStepCount).toBe(3);
    expect(entry.residualTimingStepCount).toBe(0);
    expect(entry.meanResidual).toBeCloseTo(0);
  });

  it('shows residual movement when observed timing does not follow the base table', () => {
    const result = analyzeIgnitionTuneAttribution([area()], table, {
      advance: range([10, 20, 20, 30]),
      rpm: range([1000, 1500, 2000, 2500]),
      load: range([50, 50, 50, 50]),
    }, { timingStepThreshold: 5 });

    const entry = result.areas[0]!;
    expect(entry.observedTimingStepCount).toBe(2);
    expect(entry.baseAlignedTimingStepCount).toBe(0);
    expect(entry.residualTimingStepCount).toBeGreaterThan(0);
    expect(entry.residualSpread).toBeGreaterThan(0);
  });

  it('reports correction overlap without assigning it as the cause', () => {
    const result = analyzeIgnitionTuneAttribution([area()], table, {
      advance: range([10, 15, 20, 25]),
      rpm: range([1000, 1500, 2000, 2500]),
      load: range([50, 50, 50, 50]),
      correction: range([0, 2, 2, 0]),
    }, { correctionThreshold: 0.5 });

    const entry = result.areas[0]!;
    expect(entry.correctionActiveSampleCount).toBe(2);
    expect(entry.correctionEpisodeCount).toBe(1);
  });

  it('compares an adjacent review region against the same base table', () => {
    const reviewArea = area({
      reasons: ['adjacent-transition'],
      adjacentRpmStart: 2500,
      adjacentRpmEnd: 3000,
      adjacentLoadStart: 50,
      adjacentLoadEnd: 100,
    });
    const result = analyzeIgnitionTuneAttribution([reviewArea], table, {
      advance: range([10, 15, 20, 25]),
      rpm: range([1000, 1500, 2000, 2500]),
      load: range([50, 50, 50, 50]),
    });

    expect(result.areas[0]?.adjacentBaseAdvanceDifference).toBeGreaterThan(0);
  });

  it('validates attribution thresholds', () => {
    const inputs = {
      advance: range([10]),
      rpm: range([1000]),
      load: range([50]),
    };
    expect(() => analyzeIgnitionTuneAttribution([area({ evidenceEndSampleIndex: 0 })], table, inputs, { timingStepThreshold: 0 })).toThrow(RangeError);
    expect(() => analyzeIgnitionTuneAttribution([area({ evidenceEndSampleIndex: 0 })], table, inputs, { correctionThreshold: -1 })).toThrow(RangeError);
    expect(() => analyzeIgnitionTuneAttribution([area({ evidenceEndSampleIndex: 0 })], table, inputs, { maxTransitionGapMs: 0 })).toThrow(RangeError);
  });
});
