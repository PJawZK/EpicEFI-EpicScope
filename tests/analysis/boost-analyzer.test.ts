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

  it('reports target attainment inside an explicit absolute pressure tolerance', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [195, 205, 212, 180]),
      targetPressure: range(0, [200, 200, 200, 200]),
    }, { complete: true, targetTolerance: 5 });

    expect(result.tracking?.targetTolerance).toBe(5);
    expect(result.tracking?.targetAttainmentSampleCount).toBe(2);
    expect(result.tracking?.targetAttainmentFraction).toBe(0.5);
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
    expect(result.spoolEvents[0]?.attainment10).toMatchObject({ durationMs: 0, measuredPressure: 100, targetPressure: 200, rpm: 2000 });
    expect(result.spoolEvents[0]?.attainment50).toMatchObject({ durationMs: 0, measuredPressure: 100, targetPressure: 200, rpm: 2000 });
    expect(result.spoolEvents[0]?.attainment90).toMatchObject({ durationMs: 300, measuredPressure: 180, targetPressure: 200, rpm: 2800 });
  });

  it('records first 10/50/90 percent target-attainment landmarks after spool start', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [10, 25, 60, 110, 185]),
      targetPressure: range(0, [200, 200, 200, 200, 200]),
      rpm: range(0, [1800, 2000, 2300, 2700, 3100]),
    }, {
      spool: { startPressure: 15, minimumTargetPressure: 180, completionFraction: 0.9 },
    });
    const event = result.spoolEvents[0];
    expect(event?.attainment10).toMatchObject({ sampleIndex: 1, durationMs: 100, rpm: 2000 });
    expect(event?.attainment50).toMatchObject({ sampleIndex: 3, durationMs: 300, rpm: 2700 });
    expect(event?.attainment90).toMatchObject({ sampleIndex: 4, durationMs: 400, rpm: 3100 });
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

  it('groups qualified physical response into RPM and TPS operating-point bins', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [150, 160, 170, 190, 200]),
      rpm: range(0, [3050, 3150, 3250, 3550, 3650]),
      tps: range(0, [92, 94, 96, 92, 94]),
      upperDuty: range(0, [40, 42, 44, 50, 52]),
      lowerDuty: range(0, [10, 12, 14, 20, 22]),
    }, { operatingPoints: { rpmBinSize: 500, tpsBinSize: 10, minimumSamples: 2 } });

    expect(result.operatingPoints).toHaveLength(2);
    expect(result.operatingPoints[0]).toMatchObject({ rpmStart: 3000, rpmEnd: 3500, tpsStart: 90, tpsEnd: 100, sampleCount: 3, pressureMean: 160, upperDutyMean: 42, lowerDutyMean: 12 });
    expect(result.operatingPoints[1]).toMatchObject({ rpmStart: 3500, rpmEnd: 4000, tpsStart: 90, tpsEnd: 100, sampleCount: 2, pressureMean: 195, upperDutyMean: 51, lowerDutyMean: 21 });
  });

  it('validates Boost operating-point bin configuration', () => {
    const inputs = { measuredPressure: range(0, [100]), rpm: range(0, [2000]), tps: range(0, [100]) };
    expect(() => analyzeBoost(inputs, { operatingPoints: { rpmBinSize: 0, tpsBinSize: 5 } })).toThrow(RangeError);
    expect(() => analyzeBoost(inputs, { operatingPoints: { rpmBinSize: 250, tpsBinSize: 0 } })).toThrow(RangeError);
    expect(() => analyzeBoost(inputs, { operatingPoints: { rpmBinSize: 250, tpsBinSize: 5, minimumSamples: 0 } })).toThrow(RangeError);
  });

  it('retains RPM, TPS and wastegate duty at peak measured pressure', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [100, 180, 220, 205]),
      rpm: range(0, [2000, 2500, 3200, 3600]),
      tps: range(0, [80, 95, 100, 100]),
      upperDuty: range(0, [30, 45, 60, 65]),
      lowerDuty: range(0, [5, 10, 20, 25]),
    }, { complete: true });

    expect(result.peak).toMatchObject({
      sampleIndex: 2,
      pressure: 220,
      rpm: 3200,
      tps: 100,
      upperDuty: 60,
      lowerDuty: 20,
    });
  });

  it('detects open-loop pressure-rise spool without a boost target', () => {
    const result = analyzeBoost({
      measuredPressure: range(0, [100, 108, 125, 155, 182, 205]),
      rpm: range(0, [1800, 1900, 2100, 2400, 2750, 3100]),
      tps: range(0, [96, 97, 98, 99, 100, 100]),
      upperDuty: range(0, [45, 45, 50, 55, 60, 60]),
      lowerDuty: range(0, [10, 10, 12, 15, 18, 20]),
    }, {
      complete: true,
      openLoopSpool: { startPressure: 110, endPressure: 200 },
    });

    expect(result.tracking).toBeUndefined();
    expect(result.openLoopSpoolEvents).toHaveLength(1);
    const event = result.openLoopSpoolEvents[0];
    expect(event).toMatchObject({ startSampleIndex: 1, endSampleIndex: 5, durationMs: 400, startRpm: 1900, endRpm: 3100, startTps: 97, endTps: 100 });
    expect(event?.attainment10).toMatchObject({ sampleIndex: 2, durationMs: 100, rpm: 2100, tps: 98, upperDuty: 50 });
    expect(event?.attainment50).toMatchObject({ sampleIndex: 3, durationMs: 200, rpm: 2400, tps: 99, upperDuty: 55 });
    expect(event?.attainment90).toMatchObject({ sampleIndex: 5, durationMs: 400, rpm: 3100, tps: 100, upperDuty: 60 });
  });

  it('resets open-loop spool across non-contiguous source samples', () => {
    const result = analyzeBoost({ measuredPressure: range(0, [100, 130, 170, 205]) }, {
      sampleIndices: [0, 1, 3],
      openLoopSpool: { startPressure: 110, endPressure: 200 },
    });
    expect(result.openLoopSpoolEvents).toEqual([]);
  });

  it('validates open-loop spool pressure thresholds', () => {
    const inputs = { measuredPressure: range(0, [100, 200]) };
    expect(() => analyzeBoost(inputs, { openLoopSpool: { startPressure: 200, endPressure: 100 } })).toThrow(RangeError);
    expect(() => analyzeBoost(inputs, { openLoopSpool: { startPressure: 100, endPressure: 200, minimumDurationMs: -1 } })).toThrow(RangeError);
  });

  it('works as measured-pressure-only analysis when target is unavailable', () => {
    const result = analyzeBoost({ measuredPressure: range(0, [100, 120, 140]) }, { complete: true });
    expect(result.measured.max).toBe(140);
    expect(result.tracking).toBeUndefined();
    expect(result.openLoopSpoolEvents).toEqual([]);
    expect(result.spoolEvents).toEqual([]);
    expect(result.steadyStateWindows).toEqual([]);
    expect(result.complete).toBe(true);
  });

  it('validates spool and steady-state configuration', () => {
    const inputs = { measuredPressure: range(0, [100]), targetPressure: range(0, [200]) };
    expect(() => analyzeBoost(inputs, { targetTolerance: -1 })).toThrow(RangeError);
    expect(() => analyzeBoost(inputs, { spool: { startPressure: 100, minimumTargetPressure: 150, completionFraction: 2 } })).toThrow(RangeError);
    expect(() => analyzeBoost(inputs, { steadyState: { maxTargetRatePerSecond: -1, minimumDurationMs: 0 } })).toThrow(RangeError);
  });
});
