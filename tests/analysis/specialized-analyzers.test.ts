import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import {
  analyzeAeMapPredict,
  analyzeFueling,
  analyzeFuelPressureInjector,
  analyzeIdle,
  analyzeIgnition,
  analyzeTriggerSync,
} from '../../core/analysis/specialized-analyzers';

function range(values: readonly number[], validity?: readonly number[], startSampleIndex = 0, stepMs = 100): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('remaining Phase 4 analyzer cores', () => {
  it('Idle reports tracking, PID-related aggregates and sag/recovery events', () => {
    const result = analyzeIdle({
      rpm: range([800, 790, 650, 620, 760, 805]),
      target: range([800, 800, 800, 800, 800, 800]),
      valveDuty: range([25, 25, 35, 40, 32, 26]),
      bias: range([24, 24, 24, 24, 24, 24]),
      pTerm: range([0, 1, 8, 10, 3, 0]),
      iTerm: range([0, 0, 1, 2, 2, 1]),
    }, { sagThresholdRpm: 100, settledBandRpm: 50, complete: true });

    expect(result.tracking?.meanError).toBeCloseTo(-62.5);
    expect(result.valveDuty?.max).toBe(40);
    expect(result.pTerm?.max).toBe(10);
    expect(result.sagEvents).toHaveLength(1);
    expect(result.sagEvents[0]).toMatchObject({ startSampleIndex: 2, endSampleIndex: 3, minimumErrorRpm: -180, recoveryMs: 100 });
    expect(result.complete).toBe(true);
  });

  it('AE/MAP Predict detects tip-in/decel and reports MAP/prediction/AFR response', () => {
    const result = analyzeAeMapPredict({
      tps: range([5, 5, 20, 21, 21, 8, 8]),
      map: range([40, 40, 60, 90, 100, 70, 45]),
      predictedMap: range([40, 42, 65, 95, 98, 72, 46]),
      afr: range([14.7, 14.7, 15.8, 13.5, 13.0, 12.9, 14.5]),
    }, { tpsDeltaThreshold: 5, eventWindowMs: 200, complete: true });

    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({ direction: 'tip-in', startSampleIndex: 2, tpsDelta: 15, mapDelta: 60 });
    expect(result.events[0]?.predictionErrorAtEnd).toBeCloseTo(-2);
    expect(result.events[0]?.afrLeanExcursion).toBeCloseTo(1.1);
    expect(result.events[1]?.direction).toBe('decel');
  });

  it('Fueling reports target error and lean/rich evidence', () => {
    const result = analyzeFueling({
      actualAfr: range([14.7, 15.3, 13.8, 14.8]),
      targetAfr: range([14.7, 14.7, 14.7, 14.7]),
      ve: range([50, 51, 52, 53]),
    }, { errorDeadband: 0.25, complete: true });

    expect(result.tracking?.meanError).toBeCloseTo(-0.05);
    expect(result.leanSampleCount).toBe(1);
    expect(result.richSampleCount).toBe(1);
    expect(result.ve?.mean).toBeCloseTo(51.5);
  });

  it('Ignition groups knock activity and captures advance/retard at the peak', () => {
    const result = analyzeIgnition({
      advance: range([20, 21, 18, 15, 20, 22]),
      retard: range([0, 0, 2, 4, 0, 0]),
      knock: range([0, 0, 1, 3, 0, 2]),
    }, { knockThreshold: 0.5, complete: true });

    expect(result.knockEvents).toHaveLength(2);
    expect(result.knockEvents[0]).toMatchObject({ startSampleIndex: 2, endSampleIndex: 3, peakKnock: 3, advanceAtPeak: 15, retardAtPeak: 4 });
    expect(result.advance.mean).toBe(19.333333333333332);
  });

  it('Fuel Pressure/Injector reports low-pressure and high-duty events plus deadtime evidence', () => {
    const result = analyzeFuelPressureInjector({
      reference: range([0, 0, 0, 0, 0]),
      fuelPressure: range([300, 300, 290, 280, 300]),
      railDifferential: range([300, 295, 250, 240, 300]),
      injectorPulseWidth: range([3, 4, 8, 10, 4]),
      injectorDuty: range([30, 50, 92, 96, 45]),
      injectorDeadtime: range([0.8, 0.8, 0.8, 0.8, 0.8]),
    }, { lowPressureThreshold: 270, highDutyThreshold: 90, complete: true });

    expect(result.lowPressureEvents).toHaveLength(1);
    expect(result.lowPressureEvents[0]).toMatchObject({ startSampleIndex: 2, endSampleIndex: 3, extremeValue: 240 });
    expect(result.highDutyEvents[0]).toMatchObject({ startSampleIndex: 2, endSampleIndex: 3, extremeValue: 96 });
    expect(result.injectorDeadtime?.mean).toBeCloseTo(0.8);
  });

  it('Trigger/Sync combines sync-state, trigger-error and counter-increment evidence', () => {
    const result = analyzeTriggerSync({
      reference: range([0, 0, 0, 0, 0]),
      syncState: range([1, 1, 0, 1, 1]),
      triggerError: range([0, 0, 4, 0, -5]),
      syncLossCounter: range([0, 0, 1, 1, 2]),
      rpm: range([1000, 1500, 1800, 1900, 2000]),
    }, { syncedMinimum: 1, triggerErrorThreshold: 2, complete: true });

    expect(result.events.filter((event) => event.reason === 'sync-state')).toHaveLength(1);
    expect(result.events.filter((event) => event.reason === 'trigger-error')).toHaveLength(2);
    expect(result.events.filter((event) => event.reason === 'loss-counter')).toHaveLength(2);
    expect(result.rpm?.max).toBe(2000);
  });

  it('keeps selected-source-index unavailable evidence explicit', () => {
    const result = analyzeFueling({ actualAfr: range([14, 15], undefined, 10), targetAfr: range([14], undefined, 11) }, { sampleIndices: [10, 11, 12], complete: false });
    expect(result.actual.unavailableSampleCount).toBe(1);
    expect(result.tracking?.unavailableSampleCount).toBe(2);
    expect(result.complete).toBe(false);
  });

  it('validates domain thresholds', () => {
    expect(() => analyzeIdle({ rpm: range([800]) }, { sagThresholdRpm: 0 })).toThrow(RangeError);
    expect(() => analyzeAeMapPredict({ tps: range([0]) }, { tpsDeltaThreshold: 0 })).toThrow(RangeError);
    expect(() => analyzeFueling({ actualAfr: range([14]) }, { errorDeadband: -1 })).toThrow(RangeError);
  });
});
