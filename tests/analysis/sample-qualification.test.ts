import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import {
  matchesNumericQualification,
  qualifyNumericSamples,
  type NumericQualificationChannelRange,
} from '../../core/analysis/sample-qualification';

function range(
  startSampleIndex: number,
  timeMs: readonly number[],
  values: readonly number[],
  validity: readonly number[],
): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(timeMs),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity),
  };
}

function channel(rangeValue: NumericChannelRange, complete = true): NumericQualificationChannelRange {
  return { range: rangeValue, complete };
}

describe('matchesNumericQualification', () => {
  it('implements the shared numeric comparison operators', () => {
    expect(matchesNumericQualification(11, 'gt', 10)).toBe(true);
    expect(matchesNumericQualification(10, 'gte', 10)).toBe(true);
    expect(matchesNumericQualification(9, 'lt', 10)).toBe(true);
    expect(matchesNumericQualification(10, 'lte', 10)).toBe(true);
    expect(matchesNumericQualification(10, 'eq', 10)).toBe(true);
  });
});

describe('qualifyNumericSamples', () => {
  it('combines multiple conditions with AND semantics and preserves source sample indices', () => {
    const channels = new Map([
      ['rpm', channel(range(100, [0, 10, 20, 30], [1000, 2000, 3000, 4000], [1, 1, 1, 1]))],
      ['tps', channel(range(100, [0, 10, 20, 30], [5, 20, 80, 90], [1, 1, 1, 1]))],
    ]);

    const result = qualifyNumericSamples({
      referenceChannelId: 'rpm',
      channels,
      conditions: [
        { channelId: 'rpm', operator: 'gte', value: 2000 },
        { channelId: 'tps', operator: 'gt', value: 50 },
      ],
    });

    expect([...result.eligibleSampleIndices]).toEqual([102, 103]);
    expect(result.inputSampleCount).toBe(4);
    expect(result.eligibleSampleCount).toBe(2);
    expect(result.valueRejectedSampleCount).toBe(2);
    expect(result.invalidSampleCount).toBe(0);
    expect(result.unavailableSampleCount).toBe(0);
    expect(result.complete).toBe(true);
  });

  it('keeps A/B time scope independent from value qualification and accepts reversed boundaries', () => {
    const channels = new Map([
      ['rpm', channel(range(10, [0, 10, 20, 30, 40], [1000, 2000, 3000, 4000, 5000], [1, 1, 1, 1, 1]))],
    ]);

    const result = qualifyNumericSamples({
      referenceChannelId: 'rpm',
      channels,
      conditions: [{ channelId: 'rpm', operator: 'gte', value: 2500 }],
      timeRange: { startMs: 35, endMs: 10 },
    });

    expect([...result.eligibleSampleIndices]).toEqual([12, 13]);
    expect(result.inputSampleCount).toBe(3);
    expect(result.eligibleSampleCount).toBe(2);
    expect(result.valueRejectedSampleCount).toBe(1);
  });

  it('aligns condition channels by source sample index rather than local array position', () => {
    const channels = new Map([
      ['rpm', channel(range(102, [20, 30, 40], [3000, 4000, 5000], [1, 1, 1]))],
      ['tps', channel(range(100, [0, 10, 20, 30, 40], [0, 10, 60, 20, 80], [1, 1, 1, 1, 1]))],
    ]);

    const result = qualifyNumericSamples({
      referenceChannelId: 'rpm',
      channels,
      conditions: [{ channelId: 'tps', operator: 'gte', value: 50 }],
    });

    expect([...result.eligibleSampleIndices]).toEqual([102, 104]);
    expect(result.inputSampleCount).toBe(3);
    expect(result.valueRejectedSampleCount).toBe(1);
  });

  it('distinguishes invalid condition samples from unavailable decoded samples', () => {
    const channels = new Map([
      ['rpm', channel(range(100, [0, 10, 20, 30], [1000, 2000, 3000, 4000], [1, 1, 1, 1]))],
      ['tps', channel(range(101, [10, 20], [20, 80], [0, 1]), false)],
    ]);

    const result = qualifyNumericSamples({
      referenceChannelId: 'rpm',
      channels,
      conditions: [{ channelId: 'tps', operator: 'gt', value: 10 }],
    });

    expect([...result.eligibleSampleIndices]).toEqual([102]);
    expect(result.inputSampleCount).toBe(4);
    expect(result.eligibleSampleCount).toBe(1);
    expect(result.invalidSampleCount).toBe(1);
    expect(result.unavailableSampleCount).toBe(2);
    expect(result.valueRejectedSampleCount).toBe(0);
    expect(result.complete).toBe(false);
  });

  it('can prove a partial decoded range complete for an A/B scope it covers', () => {
    const channels = new Map([
      ['rpm', channel(range(100, [100, 110, 120, 130], [1, 2, 3, 4], [1, 1, 1, 1]), false)],
      ['tps', channel(range(100, [100, 110, 120, 130], [10, 20, 30, 40], [1, 1, 1, 1]), false)],
    ]);

    const result = qualifyNumericSamples({
      referenceChannelId: 'rpm',
      channels,
      conditions: [{ channelId: 'tps', operator: 'gte', value: 20 }],
      timeRange: { startMs: 105, endMs: 125 },
    });

    expect(result.complete).toBe(true);
    expect([...result.eligibleSampleIndices]).toEqual([101, 102]);
  });

  it('does not claim full-log completeness for partial ranges without an explicit time scope', () => {
    const channels = new Map([
      ['rpm', channel(range(100, [100, 110], [1, 2], [1, 1]), false)],
    ]);

    const result = qualifyNumericSamples({
      referenceChannelId: 'rpm',
      channels,
      conditions: [],
    });

    expect(result.eligibleSampleCount).toBe(2);
    expect(result.complete).toBe(false);
  });
});
