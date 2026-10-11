import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { buildFuelingOperatingMap } from '../../core/analysis/fueling-operating-map';

function range(values: readonly number[], stepMs = 100, startSampleIndex = 0, validity?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('steady-state Fueling operating map', () => {
  it('bins only stable RPM/load evidence and reports AFR error distribution', () => {
    const result = buildFuelingOperatingMap({
      actualAfr: range([14.7, 14.9, 15.0, 14.8, 14.6, 13.8, 13.9, 14.0, 14.1, 14.0]),
      targetAfr: range([14.7, 14.7, 14.7, 14.7, 14.7, 14.2, 14.2, 14.2, 14.2, 14.2]),
      rpm: range([2000, 2020, 2040, 2060, 2080, 3000, 3020, 3040, 3060, 3080]),
      load: range([50, 50.5, 51, 51.5, 52, 90, 90.5, 91, 91.5, 92]),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerBin: 4,
      maxRpmRatePerSecond: 300,
      maxLoadRatePerSecond: 10,
      minimumStableDurationMs: 300,
      errorDeadband: 0.15,
    });

    expect(result.operatingPoints).toHaveLength(2);
    expect(result.stableEligibleSampleCount).toBe(10);
    expect(result.transientRejectedSampleCount).toBe(1);
    expect(result.operatingPoints[0]).toMatchObject({
      rpmStart: 2000,
      loadStart: 50,
      sampleCount: 5,
      leanSampleCount: 2,
      richSampleCount: 0,
      bias: 'lean',
    });
    expect(result.operatingPoints[0]?.errorMean).toBeCloseTo(0.06);
    expect(result.operatingPoints[0]?.errorMedian).toBeCloseTo(0.1);
    expect(result.operatingPoints[1]).toMatchObject({
      rpmStart: 3000,
      loadStart: 90,
      sampleCount: 5,
      leanSampleCount: 0,
      richSampleCount: 4,
      bias: 'rich',
    });
    expect(result.operatingPoints[1]?.errorMean).toBeCloseTo(-0.24);
  });

  it('rejects short stable fragments below the minimum stable duration', () => {
    const result = buildFuelingOperatingMap({
      actualAfr: range([14.7, 14.8, 14.9]),
      targetAfr: range([14.7, 14.7, 14.7]),
      rpm: range([2000, 2010, 2020]),
      load: range([50, 50, 50]),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerBin: 1,
      minimumStableDurationMs: 300,
    });

    expect(result.stableEligibleSampleCount).toBe(0);
    expect(result.transientRejectedSampleCount).toBe(3);
    expect(result.operatingPoints).toHaveLength(0);
  });

  it('does not bridge selected source-index gaps into a stable segment', () => {
    const result = buildFuelingOperatingMap({
      actualAfr: range([14.7, 14.7, 14.7, 14.7, 14.7, 14.7]),
      targetAfr: range([14.7, 14.7, 14.7, 14.7, 14.7, 14.7]),
      rpm: range([2000, 2010, 2020, 2030, 2040, 2050]),
      load: range([50, 50, 50, 50, 50, 50]),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerBin: 1,
      minimumStableDurationMs: 200,
    }, [0, 1, 2, 4, 5]);

    expect(result.stableEligibleSampleCount).toBe(3);
    expect(result.transientRejectedSampleCount).toBe(2);
    expect(result.operatingPoints[0]?.sampleCount).toBe(3);
  });

  it('keeps invalid and unavailable source evidence explicit', () => {
    const result = buildFuelingOperatingMap({
      actualAfr: range([14.7, 14.8, 14.9], 100, 10, [1, 0, 1]),
      targetAfr: range([14.7, 14.7], 100, 10),
      rpm: range([2000, 2010, 2020], 100, 10),
      load: range([50, 50, 50], 100, 10),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerBin: 1,
      minimumStableDurationMs: 0,
    }, [10, 11, 12]);

    expect(result.invalidSampleCount).toBe(1);
    expect(result.unavailableSampleCount).toBe(1);
  });

  it('validates binning and stability thresholds', () => {
    const inputs = {
      actualAfr: range([14.7]),
      targetAfr: range([14.7]),
      rpm: range([2000]),
      load: range([50]),
    };
    expect(() => buildFuelingOperatingMap(inputs, { rpmBinSize: 0, loadBinSize: 10 })).toThrow(RangeError);
    expect(() => buildFuelingOperatingMap(inputs, { rpmBinSize: 250, loadBinSize: 0 })).toThrow(RangeError);
    expect(() => buildFuelingOperatingMap(inputs, { rpmBinSize: 250, loadBinSize: 10, minimumSamplesPerBin: 0 })).toThrow(RangeError);
    expect(() => buildFuelingOperatingMap(inputs, { rpmBinSize: 250, loadBinSize: 10, maxRpmRatePerSecond: -1 })).toThrow(RangeError);
    expect(() => buildFuelingOperatingMap(inputs, { rpmBinSize: 250, loadBinSize: 10, maxLoadRatePerSecond: -1 })).toThrow(RangeError);
    expect(() => buildFuelingOperatingMap(inputs, { rpmBinSize: 250, loadBinSize: 10, minimumStableDurationMs: -1 })).toThrow(RangeError);
  });
});
