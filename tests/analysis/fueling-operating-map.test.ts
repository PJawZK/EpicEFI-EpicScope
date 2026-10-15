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
  it('bins settled RPM/load evidence from a trailing stability window and reports AFR error distribution', () => {
    const result = buildFuelingOperatingMap({
      actualAfr: range([14.7, 14.9, 15.0, 14.8, 14.6, 13.8, 13.9, 14.0, 14.1, 14.0]),
      targetAfr: range([14.7, 14.7, 14.7, 14.7, 14.7, 14.2, 14.2, 14.2, 14.2, 14.2]),
      rpm: range([2000, 2020, 2040, 2060, 2080, 3000, 3020, 3040, 3060, 3080]),
      load: range([50, 50.5, 51, 51.5, 52, 90, 90.5, 91, 91.5, 92]),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerBin: 3,
      maxRpmRatePerSecond: 300,
      maxLoadRatePerSecond: 10,
      minimumStableDurationMs: 200,
      errorDeadband: 0.15,
    });

    expect(result.operatingPoints).toHaveLength(2);
    expect(result.validAlignedSampleCount).toBe(10);
    expect(result.stableEligibleSampleCount).toBe(6);
    expect(result.transientRejectedSampleCount).toBe(4);
    expect(result.operatingPoints[0]).toMatchObject({
      rpmStart: 2000,
      loadStart: 50,
      sampleCount: 3,
      observedSampleCount: 5,
      evidenceStrength: 'moderate',
      leanSampleCount: 1,
      richSampleCount: 0,
      bias: 'lean',
    });
    expect(result.operatingPoints[0]?.stableFraction).toBeCloseTo(0.6);
    expect(result.operatingPoints[0]?.errorMean).toBeCloseTo(0.1);
    expect(result.operatingPoints[0]?.errorMedian).toBeCloseTo(0.1);
    expect(result.operatingPoints[1]).toMatchObject({
      rpmStart: 3000,
      loadStart: 90,
      sampleCount: 3,
      observedSampleCount: 5,
      evidenceStrength: 'moderate',
      leanSampleCount: 0,
      richSampleCount: 2,
      bias: 'rich',
    });
    expect(result.operatingPoints[1]?.errorMean).toBeCloseTo(-1 / 6);
    expect(result.moderateOperatingPointCount).toBe(2);
  });

  it('uses minimum stable duration as the trailing observation window before samples become eligible', () => {
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
    expect(result.observedOperatingPointCount).toBe(1);
  });

  it('does not bridge selected source-index gaps into a stability window', () => {
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

    expect(result.stableEligibleSampleCount).toBe(1);
    expect(result.transientRejectedSampleCount).toBe(4);
    expect(result.operatingPoints[0]?.sampleCount).toBe(1);
  });

  it('does not let high-rate logger jitter repeatedly reset an otherwise stable operating condition', () => {
    const sampleCount = 60;
    const actual = Array.from({ length: sampleCount }, (_, index) => 1 + (index % 3 - 1) * 0.002);
    const target = Array.from({ length: sampleCount }, () => 1);
    const rpm = Array.from({ length: sampleCount }, (_, index) => 2200 + (index % 2 === 0 ? -9 : 9));
    const load = Array.from({ length: sampleCount }, (_, index) => 55 + (index % 2 === 0 ? -0.4 : 0.4));
    const result = buildFuelingOperatingMap({
      actualAfr: range(actual, 10),
      targetAfr: range(target, 10),
      rpm: range(rpm, 10),
      load: range(load, 10),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerBin: 10,
      maxRpmRatePerSecond: 500,
      maxLoadRatePerSecond: 25,
      minimumStableDurationMs: 300,
      errorDeadband: 0.015,
    });

    // Adjacent +/-18 RPM at 10 ms is 1800 RPM/s, which the previous adjacent-sample
    // implementation rejected continuously. The rolling trend/span remains stable.
    expect(result.stableEligibleSampleCount).toBeGreaterThanOrEqual(29);
    expect(result.operatingPoints).toHaveLength(1);
    expect(result.operatingPoints[0]?.sampleCount).toBeGreaterThanOrEqual(29);
    expect(result.operatingPoints[0]?.evidenceStrength).toBe('strong');
  });

  it('keeps low-count stable bins visible as weak evidence instead of silently dropping them', () => {
    const result = buildFuelingOperatingMap({
      actualAfr: range([1, 1.01, 1.02, 1.03]),
      targetAfr: range([1, 1, 1, 1]),
      rpm: range([2000, 2005, 2010, 2015]),
      load: range([50, 50, 50, 50]),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerBin: 10,
      minimumStableDurationMs: 100,
      maxRpmRatePerSecond: 500,
      maxLoadRatePerSecond: 25,
      errorDeadband: 0.015,
    });

    expect(result.operatingPoints).toHaveLength(1);
    expect(result.operatingPoints[0]).toMatchObject({
      sampleCount: 3,
      observedSampleCount: 4,
      evidenceStrength: 'weak',
    });
    expect(result.weakOperatingPointCount).toBe(1);
    expect(result.lowEvidenceSampleCount).toBe(3);
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
    expect(result.validAlignedSampleCount).toBe(1);
    expect(result.stableEligibleSampleCount).toBe(1);
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

  it('handles a 320k-sample continuous stable segment without argument-spread overflow', () => {
    const sampleCount = 320_458;
    const actual = new Array<number>(sampleCount).fill(14.7);
    const targetValues = new Array<number>(sampleCount).fill(14.7);
    const rpm = new Array<number>(sampleCount).fill(2000);
    const load = new Array<number>(sampleCount).fill(50);
    const result = buildFuelingOperatingMap({
      actualAfr: range(actual, 10),
      targetAfr: range(targetValues, 10),
      rpm: range(rpm, 10),
      load: range(load, 10),
    }, {
      rpmBinSize: 250,
      loadBinSize: 10,
      minimumSamplesPerBin: 1,
      minimumStableDurationMs: 0,
    });

    expect(result.validAlignedSampleCount).toBe(sampleCount);
    expect(result.stableEligibleSampleCount).toBe(sampleCount);
  });
});
