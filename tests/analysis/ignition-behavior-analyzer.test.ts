import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { analyzeIgnitionBehavior } from '../../core/analysis/ignition-behavior-analyzer';

function range(values: readonly number[], validity?: readonly number[], startSampleIndex = 0, stepMs = 20): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('Ignition behavior analyzer', () => {
  it('summarizes advance steps and captures RPM/load/dwell context for large timing changes', () => {
    const result = analyzeIgnitionBehavior({
      advance: range([15, 16, 17, 10, 9, 15]),
      retardOrCorrection: range([0, 0, 0.5, 3, 2, 0]),
      dwell: range([3.0, 3.0, 3.1, 3.2, 3.2, 3.1]),
      rpm: range([1800, 1900, 2000, 2100, 2200, 2300]),
      load: range([40, 45, 50, 55, 60, 65]),
    }, {
      timingStepThreshold: 5,
      correctionThreshold: 1,
      maxTransitionGapMs: 50,
      complete: true,
    });

    expect(result.transitions.transitionCount).toBe(5);
    expect(result.transitions.meanAbsoluteStep).toBeCloseTo(3.2);
    expect(result.transitions.maxAbsoluteStep).toBe(7);
    expect(result.timingStepEvents).toHaveLength(2);
    expect(result.timingStepEvents[0]).toMatchObject({
      startSampleIndex: 2,
      endSampleIndex: 3,
      deltaAdvance: -7,
      advanceBefore: 17,
      advanceAfter: 10,
      retardOrCorrection: 3,
      dwell: 3.2,
      rpm: 2100,
      load: 55,
    });
    expect(result.dwell?.mean).toBeCloseTo(3.1);
    expect(result.complete).toBe(true);
  });

  it('groups correction activity without assigning a cause', () => {
    const result = analyzeIgnitionBehavior({
      advance: range([20, 20, 18, 17, 19, 20, 20]),
      retardOrCorrection: range([0, 0.2, 1.5, 3, 1.2, 0.1, -2]),
      rpm: range([1000, 1200, 1500, 1800, 2000, 2200, 2400]),
    }, { correctionThreshold: 1, timingStepThreshold: 10, maxTransitionGapMs: 50 });

    expect(result.correctionEvents).toHaveLength(2);
    expect(result.correctionEvents[0]).toMatchObject({
      startSampleIndex: 2,
      endSampleIndex: 4,
      sampleCount: 3,
      peakMagnitude: 3,
      peakValue: 3,
      advanceAtPeak: 17,
      rpmAtPeak: 1800,
    });
    expect(result.correctionEvents[1]).toMatchObject({ startSampleIndex: 6, endSampleIndex: 6, peakValue: -2 });
  });

  it('does not bridge timing transitions or correction events across source gaps', () => {
    const advance: NumericChannelRange = {
      startSampleIndex: 0,
      timeMs: Float64Array.from([0, 20, 40, 500, 520]),
      values: Float64Array.from([10, 11, 12, 20, 21]),
      validity: Uint8Array.from([1, 1, 1, 1, 1]),
    };
    const correction: NumericChannelRange = {
      startSampleIndex: 0,
      timeMs: Float64Array.from([0, 20, 40, 500, 520]),
      values: Float64Array.from([0, 2, 2, 2, 0]),
      validity: Uint8Array.from([1, 1, 1, 1, 1]),
    };
    const result = analyzeIgnitionBehavior({ advance, retardOrCorrection: correction }, {
      timingStepThreshold: 5,
      correctionThreshold: 1,
      maxTransitionGapMs: 100,
    });

    expect(result.transitions.skippedGapCount).toBe(1);
    expect(result.timingStepEvents).toHaveLength(0);
    expect(result.correctionEvents).toHaveLength(2);
    expect(result.correctionEvents[0]).toMatchObject({ startSampleIndex: 1, endSampleIndex: 2 });
    expect(result.correctionEvents[1]).toMatchObject({ startSampleIndex: 3, endSampleIndex: 3 });
  });

  it('keeps invalid/unavailable evidence explicit and counts non-positive dwell without calling it a fault', () => {
    const result = analyzeIgnitionBehavior({
      advance: range([10, 11, 12, 13], [1, 0, 1, 1], 10),
      dwell: range([3, 0, -1], undefined, 11),
    }, { sampleIndices: [10, 11, 12, 13, 14], timingStepThreshold: 5 });

    expect(result.advance.unavailableSampleCount).toBe(1);
    expect(result.transitions.invalidOrUnavailablePairCount).toBeGreaterThan(0);
    expect(result.nonPositiveDwellSampleCount).toBe(2);
  });

  it('validates thresholds', () => {
    expect(() => analyzeIgnitionBehavior({ advance: range([10]) }, { timingStepThreshold: 0 })).toThrow(RangeError);
    expect(() => analyzeIgnitionBehavior({ advance: range([10]) }, { correctionThreshold: -1 })).toThrow(RangeError);
    expect(() => analyzeIgnitionBehavior({ advance: range([10]) }, { maxTransitionGapMs: 0 })).toThrow(RangeError);
  });
});
