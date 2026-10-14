import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { analyzeFuelPressureArchitecture } from '../../core/analysis/fuel-pressure-architecture';

function range(values: readonly number[], startSampleIndex = 0, stepMs = 100): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(values.map(() => 1)),
  };
}

describe('architecture-aware fuel pressure evidence', () => {
  const indices = [0, 1, 2, 3, 4];

  it('uses rail differential for conventional systems', () => {
    const result = analyzeFuelPressureArchitecture({
      architecture: 'conventional',
      lowSidePressure: range([300, 300, 290, 280, 300]),
      railDifferential: range([300, 295, 250, 240, 300]),
      highSidePressure: range([5000, 5200, 5100, 5050, 5150]),
      sampleIndices: indices,
      conventionalMinimumDifferential: 270,
      gdiMinimumPressure: 4500,
    });

    expect(result.pressureRole).toBe('rail-differential');
    expect(result.activePressure?.mean).toBeCloseTo(277);
    expect(result.activePressureQuality?.state).toBe('usable');
    expect(result.pressureEvents).toHaveLength(1);
    expect(result.pressureEvents[0]).toMatchObject({ startSampleIndex: 2, endSampleIndex: 3, extremeValue: 240 });
  });

  it('uses high-side rail pressure for GDI while retaining low-side context', () => {
    const result = analyzeFuelPressureArchitecture({
      architecture: 'gdi',
      lowSidePressure: range([450, 455, 460, 458, 452]),
      railDifferential: range([300, 300, 300, 300, 300]),
      highSidePressure: range([5000, 4700, 4200, 4100, 4900]),
      sampleIndices: indices,
      conventionalMinimumDifferential: 270,
      gdiMinimumPressure: 4500,
    });

    expect(result.pressureRole).toBe('high-side');
    expect(result.lowSidePressure?.mean).toBeCloseTo(455);
    expect(result.activePressure?.min).toBe(4100);
    expect(result.pressureEvents).toHaveLength(1);
    expect(result.pressureEvents[0]).toMatchObject({ startSampleIndex: 2, endSampleIndex: 3, extremeValue: 4100 });
  });

  it('does not substitute the wrong pressure domain when the selected architecture lacks its required channel', () => {
    const conventional = analyzeFuelPressureArchitecture({
      architecture: 'conventional',
      highSidePressure: range([5000, 5000]),
      sampleIndices: [0, 1],
      conventionalMinimumDifferential: 270,
    });
    const gdi = analyzeFuelPressureArchitecture({
      architecture: 'gdi',
      railDifferential: range([300, 250]),
      sampleIndices: [0, 1],
      gdiMinimumPressure: 4500,
    });

    expect(conventional.pressureRole).toBe('unavailable');
    expect(conventional.pressureEvents).toHaveLength(0);
    expect(gdi.pressureRole).toBe('unavailable');
    expect(gdi.pressureEvents).toHaveLength(0);
  });

  it('keeps non-contiguous source regions as separate low-pressure events', () => {
    const result = analyzeFuelPressureArchitecture({
      architecture: 'gdi',
      highSidePressure: range([5000, 4200, 4100, 5000, 4300, 4200]),
      sampleIndices: [1, 2, 4, 5],
      gdiMinimumPressure: 4500,
    });

    expect(result.pressureEvents).toHaveLength(2);
    expect(result.pressureEvents[0]).toMatchObject({ startSampleIndex: 1, endSampleIndex: 2, extremeSampleIndex: 2 });
    expect(result.pressureEvents[1]).toMatchObject({ startSampleIndex: 4, endSampleIndex: 5, extremeSampleIndex: 5 });
  });

  it('treats a constant-zero active pressure channel as unavailable evidence', () => {
    const result = analyzeFuelPressureArchitecture({
      architecture: 'conventional',
      railDifferential: range([0, 0, 0, 0, 0]),
      sampleIndices: indices,
      conventionalMinimumDifferential: 25,
    });

    expect(result.activePressureQuality).toMatchObject({ state: 'constant-zero', validSampleCount: 5, span: 0 });
    expect(result.pressureRole).toBe('unavailable');
    expect(result.pressureEvents).toHaveLength(0);
  });

  it('flags constant non-zero pressure as limited evidence without fabricating variation', () => {
    const result = analyzeFuelPressureArchitecture({
      architecture: 'gdi',
      highSidePressure: range([5000, 5000, 5000, 5000, 5000]),
      sampleIndices: indices,
      gdiMinimumPressure: 4500,
    });

    expect(result.activePressureQuality).toMatchObject({ state: 'constant', validSampleCount: 5, span: 0 });
    expect(result.pressureRole).toBe('high-side');
    expect(result.pressureEvents).toHaveLength(0);
  });

  it('excludes samples below the configured running RPM from pressure evidence and events', () => {
    const result = analyzeFuelPressureArchitecture({
      architecture: 'conventional',
      rpm: range([0, 150, 800, 1000, 1200]),
      railDifferential: range([0, 0, 250, 240, 300]),
      sampleIndices: indices,
      minimumRunningRpm: 300,
      conventionalMinimumDifferential: 270,
    });

    expect(result.minimumRunningRpm).toBe(300);
    expect(result.excludedByRunningGateCount).toBe(2);
    expect(result.pressureQualifiedSampleCount).toBe(3);
    expect(result.activePressure?.mean).toBeCloseTo(263.3333333);
    expect(result.pressureEvents).toHaveLength(1);
    expect(result.pressureEvents[0]).toMatchObject({ startSampleIndex: 2, endSampleIndex: 3, extremeSampleIndex: 3, extremeValue: 240 });
  });

  it('reports negative calibrated-pressure samples for verification without inventing a universal valid range', () => {
    const result = analyzeFuelPressureArchitecture({
      architecture: 'conventional',
      lowSidePressure: range([-1078, -900, 1000, 1020, 980]),
      railDifferential: range([300, 295, 280, 275, 290]),
      sampleIndices: indices,
    });

    expect(result.lowSidePressureQuality).toMatchObject({ state: 'usable', validSampleCount: 5, negativeSampleCount: 2 });
    expect(result.lowSidePressure?.min).toBe(-1078);
  });

  it('rejects invalid running RPM thresholds', () => {
    expect(() => analyzeFuelPressureArchitecture({
      architecture: 'conventional',
      sampleIndices: indices,
      minimumRunningRpm: -1,
    })).toThrow(/running RPM/i);
  });
});
