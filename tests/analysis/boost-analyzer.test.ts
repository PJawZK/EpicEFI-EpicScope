import { describe, expect, it } from 'vitest';
import { analyzeBoost } from '../../core/analysis/boost-analyzer';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(
  startSampleIndex: number,
  values: readonly number[],
  validity?: readonly number[],
  stepMs = 100,
): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('analyzeBoost', () => {
  it('reports measured/target tracking error and optional wastegate duty aggregates', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [100, 150, 205, 210]),
      targetPressure: range(0, [100, 160, 200, 200]),
      upperDuty: range(0, [20, 30, 40, 50]),
      lowerDuty: range(0, [10, 20, 30, 40]),
    }, { complete: true });

    expect(result.measured.mean).toBeCloseTo(166.25);
    expect(result.target?.mean).toBeCloseTo(165);
    expect(result.upperDuty?.mean).toBe(35);
    expect(result.lowerDuty?.mean).toBe(25);
    expect(result.tracking?.sampleCount).toBe(4);
    expect(result.tracking?.meanError).toBeCloseTo(1.25);
    expect(result.tracking?.meanAbsoluteError).toBeCloseTo(6.25);
    expect(result.tracking?.maxOvershoot).toBe(10);
    expect(result.tracking?.maxUndershoot).toBe(-10);
    expect(result.complete).toBe(true);
  });

  it('keeps target tracking invalid and unavailable evidence explicit', () => {
    const result = analyzeBoost({
      measuredPressure: range(10, [100, 120, 140], [1, 0, 1]),
      targetPressure: range(11, [130, 150]),
    }, { sampleIndices: [10, 11, 12, 13], complete: false });

    expect(result.inputSampleCount).toBe(4);
    expect(result.tracking?.sampleCount).toBe(1);
    expect(result.tracking?.invalidSampleCount).toBe(1);
    expect(result.tracking?.unavailableSampleCount).toBe(2);
    expect(result.complete).toBe(false);
  });

  it('detects configurable spool completion against a target fraction', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [100, 110, 150, 180, 195]),
      targetPressure: range(0, [200, 200, 200, 200, 200]),
      rpm: range(0, [2000, 2200, 2500, 2800, 3000]),
    }, {
      complete: true,
      spool: { startPressure: 105, minimumTargetPressure: 180, completionFraction: 0.9 },
    });

    expect(result.spoolEvents).toHaveLength(1);
    expect(result.spoolEvents[0]).toMatchObject({
      startSampleIndex: 0,
      endSampleIndex: 3,
      durationMs: 300,
      startPressure: 100,
      endPressure: 180,
      endTargetPressure: 200,
      startRpm: 2000,
      endRpm: 2800,
    });
  });

  it('applies spool minimum duration after completion', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [100, 180]),
      targetPressure: range(0, [200, 200]),
    }, {
      spool: { startPressure: 105, minimumTargetPressure: 180, completionFraction: 0.9, minimumDurationMs: 200 },
    });
    expect(result.spoolEvents).toEqual([]);
  });

  it('finds steady-state windows from bounded target and measured rates', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [190, 191, 192, 193, 210]),
      targetPressure: range(0, [200, 200, 200, 200, 220]),
    }, {
      steadyState: {
        maxTargetRatePerSecond: 5,
        maxMeasuredRatePerSecond: 20,
        minimumDurationMs: 200,
      },
    });

    expect(result.steadyStateWindows).toHaveLength(1);
    expect(result.steadyStateWindows[0]).toMatchObject({
      startSampleIndex: 0,
      endSampleIndex: 3,
      durationMs: 300,
      sampleCount: 4,
      meanTargetPressure: 200,
      meanMeasuredPressure: 191.5,
      meanError: -8.5,
      maxUndershoot: -10,
    });
  });

  it('breaks steady-state windows across non-contiguous source samples', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [190, 191, 192, 193]),
      targetPressure: range(0, [200, 200, 200, 200]),
    }, {
      sampleIndices: [0, 1, 3],
      steadyState: { maxTargetRatePerSecond: 1, maxMeasuredRatePerSecond: 20, minimumDurationMs: 50 },
    });
    expect(result.steadyStateWindows).toHaveLength(1);
    expect(result.steadyStateWindows[0]?.startSampleIndex).toBe(0);
    expect(result.steadyStateWindows[0]?.endSampleIndex).toBe(1);
  });

  it('works as measured-pressure-only analysis when target is unavailable', () => {
    const result = analyzeBoost({ measuredPressure: range(0, [100, 120, 140]) }, { complete: true });
    expect(result.measured.max).toBe(140);
    expect(result.tracking).toBeUndefined();
    expect(result.spoolEvents).toEqual([]);
    expect(result.steadyStateWindows).toEqual([]);
    expect(result.complete).toBe(true);
  });

  it('validates spool and steady-state configuration', () => {
    const inputs = { measuredPressure: range(0, [100]), targetPressure: range(0, [200]) };
    expect(() => analyzeBoost(inputs, { spool: { startPressure: 100, minimumTargetPressure: 150, completionFraction: 2 } })).toThrow(RangeError);
    expect(() => analyzeBoost(inputs, { steadyState: { maxTargetRatePerSecond: -1, minimumDurationMs: 0 } })).toThrow(RangeError);
  });
});
