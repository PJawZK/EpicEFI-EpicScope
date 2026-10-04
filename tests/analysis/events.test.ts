import { describe, expect, it } from 'vitest';
import { findNumericEvents } from '../../core/analysis/events';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import type { NumericQualificationChannelRange } from '../../core/analysis/sample-qualification';

function range(
  startSampleIndex: number,
  values: readonly number[],
  options: {
    readonly validity?: readonly number[];
    readonly times?: readonly number[];
  } = {},
): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(options.times ?? values.map((_, index) => index * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(options.validity ?? values.map(() => 1)),
  };
}

function channelMap(entries: readonly [string, NumericChannelRange, boolean?][]): ReadonlyMap<string, NumericQualificationChannelRange> {
  return new Map(entries.map(([id, channelRange, complete = true]) => [
    id,
    { range: channelRange, complete },
  ]));
}

describe('findNumericEvents', () => {
  it('groups adjacent qualifying reference samples into intervals', () => {
    const channels = channelMap([
      ['rpm', range(0, [900, 1200, 1300, 800, 1400])],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'rpm',
      channels,
      conditions: [{ channelId: 'rpm', operator: 'gte', value: 1000 }],
    });

    expect(result.rawEventCount).toBe(2);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      kind: 'interval',
      startSampleIndex: 1,
      endSampleIndex: 2,
      startTimeMs: 10,
      endTimeMs: 20,
      durationMs: 10,
      qualifyingSampleCount: 2,
      bridgedGapSampleCount: 0,
      sampleSpanCount: 2,
    });
    expect(result.events[1]).toMatchObject({
      kind: 'point',
      startSampleIndex: 4,
      endSampleIndex: 4,
      durationMs: 0,
      qualifyingSampleCount: 1,
    });
  });

  it('keeps AND qualification semantics and evidence from the shared qualifier', () => {
    const channels = channelMap([
      ['rpm', range(0, [1000, 2000, 3000, 4000])],
      ['tps', range(0, [10, 60, 70, 20])],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'rpm',
      channels,
      conditions: [
        { channelId: 'rpm', operator: 'gte', value: 1500 },
        { channelId: 'tps', operator: 'gte', value: 50 },
      ],
    });

    expect([...result.qualification.eligibleSampleIndices]).toEqual([1, 2]);
    expect(result.qualification.valueRejectedSampleCount).toBe(2);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.qualifyingSampleCount).toBe(2);
  });

  it('merges short non-qualifying gaps while retaining bridged sample evidence', () => {
    const channels = channelMap([
      ['load', range(100, [1, 1, 0, 1, 1], { times: [0, 10, 20, 30, 40] })],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'load',
      channels,
      conditions: [{ channelId: 'load', operator: 'eq', value: 1 }],
      eventOptions: { maximumMergeGapMs: 25 },
    });

    expect(result.rawEventCount).toBe(2);
    expect(result.mergedEventCount).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      startSampleIndex: 100,
      endSampleIndex: 104,
      durationMs: 40,
      qualifyingSampleCount: 4,
      bridgedGapSampleCount: 1,
      sampleSpanCount: 5,
    });
  });

  it('does not merge a gap that exceeds the configured elapsed gap', () => {
    const channels = channelMap([
      ['load', range(0, [1, 0, 1], { times: [0, 20, 80] })],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'load',
      channels,
      conditions: [{ channelId: 'load', operator: 'eq', value: 1 }],
      eventOptions: { maximumMergeGapMs: 50 },
    });

    expect(result.rawEventCount).toBe(2);
    expect(result.mergedEventCount).toBe(2);
    expect(result.events).toHaveLength(2);
  });

  it('applies minimum duration after gap merging', () => {
    const channels = channelMap([
      ['state', range(0, [1, 1, 0, 1], { times: [0, 10, 20, 30] })],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'state',
      channels,
      conditions: [{ channelId: 'state', operator: 'eq', value: 1 }],
      eventOptions: {
        maximumMergeGapMs: 25,
        minimumDurationMs: 25,
      },
    });

    expect(result.rawEventCount).toBe(2);
    expect(result.mergedEventCount).toBe(1);
    expect(result.retainedEventCount).toBe(1);
    expect(result.events[0]?.durationMs).toBe(30);
  });

  it('drops short candidate events without altering qualification evidence', () => {
    const channels = channelMap([
      ['state', range(0, [1, 1, 0, 1], { times: [0, 10, 20, 30] })],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'state',
      channels,
      conditions: [{ channelId: 'state', operator: 'eq', value: 1 }],
      eventOptions: { minimumDurationMs: 15 },
    });

    expect(result.qualification.eligibleSampleCount).toBe(3);
    expect(result.rawEventCount).toBe(2);
    expect(result.retainedEventCount).toBe(0);
    expect(result.events).toEqual([]);
  });

  it('treats invalid and unavailable condition samples as event boundaries', () => {
    const channels = channelMap([
      ['reference', range(10, [0, 0, 0, 0, 0])],
      ['signal', range(11, [1, 2, 1], { validity: [1, 0, 1] })],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'reference',
      channels,
      conditions: [{ channelId: 'signal', operator: 'gte', value: 1 }],
    });

    expect(result.qualification.unavailableSampleCount).toBe(2);
    expect(result.qualification.invalidSampleCount).toBe(1);
    expect([...result.qualification.eligibleSampleIndices]).toEqual([11, 13]);
    expect(result.rawEventCount).toBe(2);
    expect(result.events.every((event) => event.kind === 'point')).toBe(true);
  });

  it('normalizes reversed A/B time scope through qualification', () => {
    const channels = channelMap([
      ['signal', range(0, [1, 1, 1, 1, 1], { times: [0, 10, 20, 30, 40] })],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'signal',
      channels,
      conditions: [{ channelId: 'signal', operator: 'eq', value: 1 }],
      timeRange: { startMs: 35, endMs: 5 },
    });

    expect(result.qualification.inputSampleCount).toBe(3);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      startSampleIndex: 1,
      endSampleIndex: 3,
      startTimeMs: 10,
      endTimeMs: 30,
    });
  });

  it('reports partial decoded coverage without inventing unseen events', () => {
    const channels = channelMap([
      ['signal', range(20, [1, 1, 1], { times: [20, 30, 40] }), false],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'signal',
      channels,
      conditions: [{ channelId: 'signal', operator: 'eq', value: 1 }],
      timeRange: { startMs: 0, endMs: 50 },
    });

    expect(result.complete).toBe(false);
    expect(result.qualification.complete).toBe(false);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ startTimeMs: 20, endTimeMs: 40 });
  });

  it('supports an empty condition list as one event over the in-scope reference grid', () => {
    const channels = channelMap([
      ['reference', range(0, [0, 0, 0], { times: [0, 10, 20] })],
    ]);
    const result = findNumericEvents({
      referenceChannelId: 'reference',
      channels,
      conditions: [],
    });

    expect(result.qualification.eligibleSampleCount).toBe(3);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.durationMs).toBe(20);
  });

  it('rejects negative or non-finite event timing options', () => {
    const channels = channelMap([['signal', range(0, [1])]]);
    const base = {
      referenceChannelId: 'signal',
      channels,
      conditions: [{ channelId: 'signal', operator: 'eq' as const, value: 1 }],
    };

    expect(() => findNumericEvents({ ...base, eventOptions: { minimumDurationMs: -1 } })).toThrow(RangeError);
    expect(() => findNumericEvents({ ...base, eventOptions: { maximumMergeGapMs: Number.NaN } })).toThrow(RangeError);
  });
});
