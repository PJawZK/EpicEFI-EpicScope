import { describe, expect, it } from 'vitest';

import { BoundNumericChannelDataSource } from '../../core/channels/channel-binding';
import {
  latestBoundCacheDiagnosticSnapshot,
} from '../../core/diagnostics/bound-cache-observability';
import type {
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../core/log-model/log-types';

class Source implements NumericChannelDataSource {
  readonly sampleCount = 3;

  private range(): NumericChannelRange {
    return {
      startSampleIndex: 0,
      timeMs: Float64Array.from([0, 1, 2]),
      values: Float64Array.from([10, 11, 12]),
      validity: Uint8Array.from([1, 1, 1]),
    };
  }

  async readChannelRange(): Promise<NumericChannelRange> {
    return this.range();
  }

  async readChannelsRange(channelIds: readonly string[]): Promise<NumericChannelBatchResult> {
    return {
      ranges: new Map(channelIds.map((id) => [id, this.range()])),
      performance: {
        channelCount: channelIds.length,
        cacheHitChannelIds: [],
        physicalReadCount: 1,
        physicalBytesRead: 123,
        physicalReadMs: 1,
      },
    };
  }
}

describe('bound cache observability', () => {
  it('records restore retention and later cache recognition', async () => {
    const source = new Source();
    const bound = new BoundNumericChannelDataSource(
      source,
      new Map([['ini:a', 'mlg:a']]),
    );

    await bound.readChannelsRange(['ini:a'], 0, 3);
    expect(bound.hasCachedChannelRange('ini:a', 0, 3)).toBe(true);

    const snapshot = latestBoundCacheDiagnosticSnapshot();
    expect(snapshot.retainSuccesses).toBeGreaterThan(0);
    expect(snapshot.hasCacheChecks).toBeGreaterThan(0);
    expect(snapshot.recentEvents.some((event) =>
      event.kind === 'retain'
      && event.channelIds.includes('ini:a')
      && event.retained === true
    )).toBe(true);
    expect(snapshot.recentEvents.some((event) =>
      event.kind === 'has-cache'
      && event.channelIds.includes('ini:a')
      && event.cacheReady === true
    )).toBe(true);
  });
});
