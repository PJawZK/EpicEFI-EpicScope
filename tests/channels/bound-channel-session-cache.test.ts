import { describe, expect, it } from 'vitest';

import { BoundNumericChannelDataSource } from '../../core/channels/channel-binding';
import type {
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../core/log-model/log-types';

class CountingSource implements NumericChannelDataSource {
  readonly sampleCount = 6;
  readonly preferredBatchWindowMs = 0;
  readonly requiresExplicitBatchSelection = false;
  batchReads = 0;

  private range(channelId: string): NumericChannelRange {
    const offset = channelId === 'mlg:a' ? 100 : 200;
    return {
      startSampleIndex: 0,
      timeMs: Float64Array.from([0, 10, 20, 30, 40, 50]),
      values: Float64Array.from({ length: 6 }, (_, index) => offset + index),
      validity: new Uint8Array(6).fill(1),
    };
  }

  async readChannelRange(channelId: string): Promise<NumericChannelRange> {
    this.batchReads += 1;
    return this.range(channelId);
  }

  async readChannelsRange(channelIds: readonly string[]): Promise<NumericChannelBatchResult> {
    this.batchReads += 1;
    return {
      ranges: new Map(channelIds.map((channelId) => [channelId, this.range(channelId)])),
      performance: {
        channelCount: channelIds.length,
        cacheHitChannelIds: [],
        physicalReadCount: 34,
        physicalBytesRead: 1_126_789_322,
        physicalReadMs: 4_000,
      },
    };
  }
}

describe('BoundNumericChannelDataSource session cache', () => {
  it('reuses full logical columns from a shared restore batch without touching the source again', async () => {
    const source = new CountingSource();
    const bound = new BoundNumericChannelDataSource(
      source,
      new Map([
        ['ini:a', 'mlg:a'],
        ['ini:b', 'mlg:b'],
      ]),
    );

    const restored = await bound.readChannelsRange?.(['ini:a', 'ini:b'], 0, 6);
    expect(source.batchReads).toBe(1);
    expect(restored?.performance.physicalReadCount).toBe(34);
    expect(restored?.ranges.get('ini:a')?.values).toEqual(
      Float64Array.from([100, 101, 102, 103, 104, 105]),
    );

    const selected = await bound.readChannelsRange?.(['ini:a'], 0, 6);
    expect(source.batchReads).toBe(1);
    expect(selected?.performance.cacheHitChannelIds).toEqual(['ini:a']);
    expect(selected?.performance.physicalReadCount).toBe(0);
    expect(selected?.performance.physicalBytesRead).toBe(0);
    expect(selected?.performance.physicalReadMs).toBe(0);

    const viewport = await bound.readChannelRange('ini:a', 2, 2);
    expect(source.batchReads).toBe(1);
    expect(viewport.startSampleIndex).toBe(2);
    expect(viewport.values).toEqual(Float64Array.from([102, 103]));
  });
});
