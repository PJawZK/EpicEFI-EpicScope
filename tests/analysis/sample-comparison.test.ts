import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { compareQualifiedNumericSamples } from '../../core/analysis/sample-comparison';
import type { NumericQualificationChannelRange } from '../../core/analysis/sample-qualification';

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

describe('compareQualifiedNumericSamples', () => {
  it('compares independently scoped A/B evidence while preserving source indices and provenance', () => {
    const channels = new Map([
      ['rpm', channel(range(100, [0, 10, 20, 30, 40, 50], [1000, 2000, 3000, 4000, 5000, 6000], [1, 1, 1, 1, 1, 1]))],
      ['tps', channel(range(100, [0, 10, 20, 30, 40, 50], [5, 15, 70, 80, 20, 90], [1, 1, 1, 1, 1, 1]))],
    ]);

    const result = compareQualifiedNumericSamples({
      referenceChannelId: 'rpm',
      channels,
      left: {
        label: 'Range A',
        timeRange: { startMs: 0, endMs: 25 },
        groups: [{ logic: 'and', conditions: [{ channelId: 'tps', operator: 'gte', value: 50 }] }],
      },
      right: {
        label: 'Range B',
        timeRange: { startMs: 30, endMs: 50 },
        groups: [{ logic: 'and', conditions: [{ channelId: 'tps', operator: 'gte', value: 50 }] }],
      },
    });

    expect(result.left.label).toBe('Range A');
    expect([...result.left.eligibleSampleIndices]).toEqual([102]);
    expect(result.left.inputSampleCount).toBe(3);
    expect(result.left.eligibleSampleCount).toBe(1);
    expect(result.left.evaluableSampleCount).toBe(3);
    expect(result.left.qualificationRatio).toBeCloseTo(1 / 3);

    expect(result.right.label).toBe('Range B');
    expect([...result.right.eligibleSampleIndices]).toEqual([103, 105]);
    expect(result.right.inputSampleCount).toBe(3);
    expect(result.right.eligibleSampleCount).toBe(2);
    expect(result.right.evaluableSampleCount).toBe(3);
    expect(result.right.qualificationRatio).toBeCloseTo(2 / 3);

    expect(result.inputSampleCountDelta).toBe(0);
    expect(result.eligibleSampleCountDelta).toBe(1);
    expect(result.qualificationRatioDelta).toBeCloseTo(1 / 3);
  });

  it('keeps invalid and unavailable samples out of the qualification ratio denominator', () => {
    const channels = new Map([
      ['rpm', channel(range(0, [0, 10, 20, 30], [1000, 2000, 3000, 4000], [1, 1, 1, 1]))],
      ['map', channel(range(1, [10, 20], [50, 100], [0, 1]), false)],
    ]);

    const result = compareQualifiedNumericSamples({
      referenceChannelId: 'rpm',
      channels,
      left: {
        label: 'Filtered',
        groups: [{ logic: 'and', conditions: [{ channelId: 'map', operator: 'gte', value: 80 }] }],
      },
      right: { label: 'Unfiltered' },
    });

    expect(result.left.inputSampleCount).toBe(4);
    expect(result.left.invalidSampleCount).toBe(1);
    expect(result.left.unavailableSampleCount).toBe(2);
    expect(result.left.evaluableSampleCount).toBe(1);
    expect(result.left.eligibleSampleCount).toBe(1);
    expect(result.left.qualificationRatio).toBe(1);
    expect(result.left.complete).toBe(false);

    expect(result.right.inputSampleCount).toBe(4);
    expect(result.right.evaluableSampleCount).toBe(4);
    expect(result.right.qualificationRatio).toBe(1);
  });

  it('supports different grouped qualification logic on each side', () => {
    const channels = new Map([
      ['rpm', channel(range(0, [0, 10, 20], [1000, 4000, 7000], [1, 1, 1]))],
      ['clt', channel(range(0, [0, 10, 20], [70, 85, 90], [1, 1, 1]))],
    ]);

    const result = compareQualifiedNumericSamples({
      referenceChannelId: 'rpm',
      channels,
      left: {
        label: 'AND',
        groupLogic: 'and',
        groups: [
          { logic: 'and', conditions: [{ channelId: 'rpm', operator: 'gte', value: 4000 }] },
          { logic: 'and', conditions: [{ channelId: 'clt', operator: 'gte', value: 90 }] },
        ],
      },
      right: {
        label: 'OR',
        groupLogic: 'or',
        groups: [
          { logic: 'and', conditions: [{ channelId: 'rpm', operator: 'gte', value: 4000 }] },
          { logic: 'and', conditions: [{ channelId: 'clt', operator: 'gte', value: 90 }] },
        ],
      },
    });

    expect([...result.left.eligibleSampleIndices]).toEqual([2]);
    expect([...result.right.eligibleSampleIndices]).toEqual([1, 2]);
    expect(result.eligibleSampleCountDelta).toBe(1);
  });
});
