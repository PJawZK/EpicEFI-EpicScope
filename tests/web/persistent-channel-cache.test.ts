import { describe, expect, it } from 'vitest';

import type {
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../core/log-model/log-types';
import {
  PersistentColumnCacheDataSource,
  type PersistentChannelColumnStore,
} from '../../apps/web/src/adapters/persistent-channel-cache';

class MemoryColumnStore implements PersistentChannelColumnStore {
  private readonly columns = new Map<string, Float64Array>();
  putCount = 0;

  private key(logKey: string, channelId: string, sampleCount: number): string {
    return `${logKey}|${channelId}|${sampleCount}`;
  }

  async get(logKey: string, channelId: string, sampleCount: number): Promise<Float64Array | undefined> {
    return this.columns.get(this.key(logKey, channelId, sampleCount))?.slice();
  }

  async put(logKey: string, channelId: string, values: Float64Array): Promise<void> {
    this.putCount += 1;
    this.columns.set(this.key(logKey, channelId, values.length), values.slice());
  }
}

class FakeChannelDataSource implements NumericChannelDataSource {
  readonly sampleCount = 6;
  readonly preferredBatchWindowMs = 0;
  readonly requiresExplicitBatchSelection = true;
  readCount = 0;

  private range(channelId: string, startSampleIndex: number, sampleCount: number): NumericChannelRange {
    const channelOffset = Number(channelId.split(':')[1] ?? 0) * 100;
    return {
      startSampleIndex,
      timeMs: Float64Array.from(
        { length: sampleCount },
        (_, index) => (startSampleIndex + index) * 10,
      ),
      values: Float64Array.from(
        { length: sampleCount },
        (_, index) => channelOffset + startSampleIndex + index,
      ),
      validity: new Uint8Array(sampleCount).fill(1),
    };
  }

  sampleRangeForTime(startMs: number, endMs: number): { startSampleIndex: number; sampleCount: number } {
    const start = Math.max(0, Math.floor(Math.min(startMs, endMs) / 10));
    const end = Math.min(this.sampleCount, Math.ceil(Math.max(startMs, endMs) / 10) + 1);
    return { startSampleIndex: start, sampleCount: Math.max(0, end - start) };
  }

  hasCachedChannelRange(): boolean {
    return false;
  }

  async readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange> {
    this.readCount += 1;
    return this.range(channelId, startSampleIndex, sampleCount);
  }

  async readChannelsRange(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult> {
    this.readCount += 1;
    return {
      ranges: new Map(channelIds.map((channelId) => [
        channelId,
        this.range(channelId, startSampleIndex, sampleCount),
      ])),
      performance: {
        channelCount: channelIds.length,
        cacheHitChannelIds: [],
        physicalReadCount: 7,
        physicalBytesRead: 777,
        physicalReadMs: 12,
      },
    };
  }
}

const timeMs = Float64Array.from([0, 10, 20, 30, 40, 50]);
const validity = new Uint8Array([1, 1, 1, 1, 1, 1]);

describe('PersistentColumnCacheDataSource', () => {
  it('persists a full decoded channel and reuses it in a later data-source instance', async () => {
    const store = new MemoryColumnStore();
    const firstSource = new FakeChannelDataSource();
    const first = new PersistentColumnCacheDataSource(
      firstSource,
      'log-a',
      timeMs,
      validity,
      store,
    );

    const initial = await first.readChannelsRange?.(['mlg:2'], 0, first.sampleCount);
    expect(initial?.ranges.get('mlg:2')?.values).toEqual(
      Float64Array.from([200, 201, 202, 203, 204, 205]),
    );
    expect(firstSource.readCount).toBe(1);

    const secondSource = new FakeChannelDataSource();
    const second = new PersistentColumnCacheDataSource(
      secondSource,
      'log-a',
      timeMs,
      validity,
      store,
    );
    const reused = await second.readChannelsRange?.(['mlg:2'], 0, second.sampleCount);

    expect(secondSource.readCount).toBe(0);
    expect(reused?.performance.cacheHitChannelIds).toEqual(['mlg:2']);
    expect(reused?.performance.physicalReadCount).toBe(0);
    expect(reused?.performance.physicalBytesRead).toBe(0);
    expect(reused?.ranges.get('mlg:2')?.values).toEqual(
      Float64Array.from([200, 201, 202, 203, 204, 205]),
    );
  });

  it('serves a bounded range from a persisted full column without touching the row source', async () => {
    const store = new MemoryColumnStore();
    await store.put('log-b', 'mlg:1', Float64Array.from([100, 101, 102, 103, 104, 105]));
    const source = new FakeChannelDataSource();
    const cached = new PersistentColumnCacheDataSource(source, 'log-b', timeMs, validity, store);

    const range = await cached.readChannelRange('mlg:1', 2, 3);

    expect(source.readCount).toBe(0);
    expect(range.startSampleIndex).toBe(2);
    expect(range.values).toEqual(Float64Array.from([102, 103, 104]));
    expect(range.timeMs).toEqual(Float64Array.from([20, 30, 40]));
    expect(range.validity).toEqual(Uint8Array.from([1, 1, 1]));
  });

  it('keeps large workspace batches on the shared-scan path and retains them for session reuse', async () => {
    const store = new MemoryColumnStore();
    const source = new FakeChannelDataSource();
    const cached = new PersistentColumnCacheDataSource(source, 'log-c', timeMs, validity, store);

    const result = await cached.readChannelsRange?.(
      ['mlg:0', 'mlg:1', 'mlg:2', 'mlg:3', 'mlg:4'],
      0,
      cached.sampleCount,
    );

    expect(source.readCount).toBe(1);
    expect(result?.performance.physicalReadCount).toBe(7);
    expect(result?.ranges.size).toBe(5);
    expect(store.putCount).toBe(0);

    const reused = await cached.readChannelRange('mlg:0', 0, cached.sampleCount);
    expect(source.readCount).toBe(1);
    expect(reused.values).toEqual(Float64Array.from([0, 1, 2, 3, 4, 5]));
    expect(store.putCount).toBe(0);
  });
});
