import { describe, expect, it } from 'vitest';
import { detectBoostPulls } from '../../core/analysis/boost-pull-detector';
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

describe('detectBoostPulls', () => {
  it('detects repeated qualified pulls and retains physical context', () => {
    const pulls = detectBoostPulls({
      measuredPressure: range(0, [100, 120, 150, 180, 130, 105, 125, 160, 195, 140]),
      rpm: range(0, [1800, 2200, 2600, 3000, 2800, 1900, 2300, 2700, 3200, 2900]),
      load: range(0, [40, 85, 92, 96, 60, 45, 86, 93, 98, 55]),
      upperDuty: range(0, [10, 35, 40, 45, 20, 12, 38, 43, 48, 22]),
      lowerDuty: range(0, [5, 10, 12, 14, 8, 5, 11, 13, 15, 8]),
    }, {
      startMinimumLoad: 80,
      releaseMinimumLoad: 70,
      startMinimumRpm: 2000,
      releaseMinimumRpm: 1800,
      minimumDurationMs: 150,
      minimumSamples: 3,
    });

    expect(pulls).toHaveLength(2);
    expect(pulls[0]).toMatchObject({
      startSampleIndex: 1,
      endSampleIndex: 3,
      durationMs: 200,
      sampleCount: 3,
      startRpm: 2200,
      endRpm: 3000,
      startLoad: 85,
      endLoad: 96,
      startPressure: 120,
      endPressure: 180,
      maximumPressure: 180,
      meanUpperDuty: 40,
      meanLowerDuty: 12,
    });
    expect(pulls[1]).toMatchObject({
      startSampleIndex: 6,
      endSampleIndex: 8,
      durationMs: 200,
      sampleCount: 3,
      startRpm: 2300,
      endRpm: 3200,
      maximumPressure: 195,
      meanUpperDuty: 43,
      meanLowerDuty: 13,
    });
  });

  it('uses lower release thresholds as explicit hysteresis', () => {
    const pulls = detectBoostPulls({
      measuredPressure: range(0, [100, 120, 140, 160, 180]),
      rpm: range(0, [1900, 2200, 2300, 2400, 2500]),
      load: range(0, [75, 82, 76, 72, 65]),
    }, {
      startMinimumLoad: 80,
      releaseMinimumLoad: 70,
      startMinimumRpm: 2000,
      releaseMinimumRpm: 1800,
      minimumSamples: 3,
    });

    expect(pulls).toHaveLength(1);
    expect(pulls[0]).toMatchObject({ startSampleIndex: 1, endSampleIndex: 3, sampleCount: 3 });
  });

  it('breaks candidates across gaps in qualified source indices', () => {
    const pulls = detectBoostPulls({
      measuredPressure: range(0, [100, 120, 140, 160, 180]),
      rpm: range(0, [2200, 2300, 2400, 2500, 2600]),
      load: range(0, [90, 90, 90, 90, 90]),
    }, {
      startMinimumLoad: 80,
      startMinimumRpm: 2000,
      minimumSamples: 2,
    }, [0, 1, 3, 4]);

    expect(pulls).toHaveLength(2);
    expect(pulls[0]).toMatchObject({ startSampleIndex: 0, endSampleIndex: 1 });
    expect(pulls[1]).toMatchObject({ startSampleIndex: 3, endSampleIndex: 4 });
  });

  it('rejects candidates that do not meet minimum duration or sample count', () => {
    const inputs = {
      measuredPressure: range(0, [100, 120, 140]),
      rpm: range(0, [2200, 2400, 2600]),
      load: range(0, [90, 92, 94]),
    };

    expect(detectBoostPulls(inputs, {
      startMinimumLoad: 80,
      startMinimumRpm: 2000,
      minimumDurationMs: 300,
    })).toEqual([]);
    expect(detectBoostPulls(inputs, {
      startMinimumLoad: 80,
      startMinimumRpm: 2000,
      minimumSamples: 4,
    })).toEqual([]);
  });

  it('validates release thresholds and detector limits', () => {
    const inputs = {
      measuredPressure: range(0, [100]),
      rpm: range(0, [2200]),
      load: range(0, [90]),
    };

    expect(() => detectBoostPulls(inputs, { startMinimumLoad: 80, releaseMinimumLoad: 81, startMinimumRpm: 2000 })).toThrow(RangeError);
    expect(() => detectBoostPulls(inputs, { startMinimumLoad: 80, startMinimumRpm: 2000, releaseMinimumRpm: 2100 })).toThrow(RangeError);
    expect(() => detectBoostPulls(inputs, { startMinimumLoad: 80, startMinimumRpm: 2000, minimumDurationMs: -1 })).toThrow(RangeError);
    expect(() => detectBoostPulls(inputs, { startMinimumLoad: 80, startMinimumRpm: 2000, minimumSamples: 0 })).toThrow(RangeError);
  });
});
