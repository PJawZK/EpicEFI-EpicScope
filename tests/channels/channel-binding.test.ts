import { describe, expect, it } from 'vitest';

import {
  BoundNumericChannelDataSource,
  bindChannelCatalogToLog,
} from '../../core/channels/channel-binding';
import type { ChannelCatalog } from '../../core/channels/channel-catalog';
import type {
  ChannelDefinition,
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../core/log-model/log-types';

function catalog(): ChannelCatalog {
  const entries = [
    {
      logicalKey: 'RPMValue',
      sourceName: 'RPMValue',
      displayName: 'RPM',
      valueType: 'integer' as const,
      unit: 'RPM',
      availability: 'known-no-data' as const,
      provenance: { kind: 'ini' as const },
    },
    {
      logicalKey: 'MAPValue',
      sourceName: 'MAPValue',
      displayName: 'MAP',
      valueType: 'number' as const,
      unit: 'kPa',
      precision: 2,
      availability: 'known-no-data' as const,
      provenance: { kind: 'ini' as const },
    },
    {
      logicalKey: 'duplicateA',
      sourceName: 'duplicateA',
      displayName: 'Duplicate',
      valueType: 'number' as const,
      unit: 'kPa',
      availability: 'known-no-data' as const,
      provenance: { kind: 'ini' as const },
    },
    {
      logicalKey: 'duplicateB',
      sourceName: 'duplicateB',
      displayName: 'Duplicate',
      valueType: 'number' as const,
      unit: 'percent',
      availability: 'known-no-data' as const,
      provenance: { kind: 'ini' as const },
    },
    {
      logicalKey: 'neverLogged',
      sourceName: 'neverLogged',
      displayName: 'Never logged',
      valueType: 'number' as const,
      availability: 'known-no-data' as const,
      provenance: { kind: 'ini' as const },
    },
  ];

  return {
    entries,
    byLogicalKey: new Map(entries.map((entry) => [entry.logicalKey, entry] as const)),
  };
}

class FakeDataSource implements NumericChannelDataSource {
  readonly sampleCount = 2;
  readonly preferredBatchWindowMs = 0;
  readonly requiresExplicitBatchSelection = false;
  readonly readIds: string[] = [];

  hasCachedChannelRange(channelId: string): boolean {
    return channelId === 'mlg:0';
  }

  async readChannelRange(channelId: string): Promise<NumericChannelRange> {
    this.readIds.push(channelId);
    return {
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 1]),
      values: new Float64Array([1, 2]),
      validity: new Uint8Array([1, 1]),
    };
  }

  async readChannelsRange(channelIds: readonly string[]): Promise<NumericChannelBatchResult> {
    this.readIds.push(...channelIds);
    const ranges = new Map<string, NumericChannelRange>();
    for (const id of channelIds) ranges.set(id, await this.readChannelRange(id));
    return {
      ranges,
      performance: {
        channelCount: channelIds.length,
        cacheHitChannelIds: channelIds.filter((id) => id === 'mlg:0'),
        physicalReadCount: 1,
        physicalBytesRead: 10,
        physicalReadMs: 2,
      },
    };
  }
}

describe('INI to log channel binding', () => {
  it('binds unique exact logical keys and Datalog display labels conservatively', () => {
    const source = new FakeDataSource();
    const logChannels: ChannelDefinition[] = [
      {
        id: 'mlg:0',
        sourceName: 'RPM',
        displayName: 'RPM',
        valueType: 'integer',
        unit: 'RPM',
      },
      {
        id: 'mlg:1',
        sourceName: 'MAPValue',
        displayName: 'MAPValue',
        valueType: 'number',
        unit: 'kPa',
      },
      {
        id: 'mlg:2',
        sourceName: 'Duplicate',
        displayName: 'Duplicate',
        valueType: 'number',
        unit: 'percent',
      },
      {
        id: 'mlg:3',
        sourceName: 'Custom log only',
        displayName: 'Custom log only',
        valueType: 'number',
      },
    ];

    const result = bindChannelCatalogToLog(catalog(), logChannels, source);

    expect(result.metrics).toEqual({
      catalogChannelCount: 5,
      logChannelCount: 4,
      mergedChannelCount: 6,
      boundChannelCount: 3,
      knownNoDataCount: 2,
      logOnlyCount: 1,
      matchedByLogicalKey: 1,
      matchedByDisplayName: 1,
      matchedByDisplayNameUnit: 1,
      ambiguousLogChannelCount: 0,
    });

    expect(result.sourceToLogicalChannelId.get('mlg:0')).toBe('ini:RPMValue');
    expect(result.sourceToLogicalChannelId.get('mlg:1')).toBe('ini:MAPValue');
    expect(result.sourceToLogicalChannelId.get('mlg:2')).toBe('ini:duplicateB');
    expect(result.sourceToLogicalChannelId.get('mlg:3')).toBe('mlg:3');

    expect(result.availableChannelIds.has('ini:RPMValue')).toBe(true);
    expect(result.availableChannelIds.has('mlg:3')).toBe(true);
    expect(result.unavailableChannelIds.has('ini:neverLogged')).toBe(true);
    expect(result.unavailableChannelIds.has('ini:duplicateA')).toBe(true);

    expect(result.channels.find((channel) => channel.id === 'ini:RPMValue')).toMatchObject({
      sourceName: 'RPMValue',
      displayName: 'RPM',
      unit: 'RPM',
    });
  });

  it('leaves ambiguous duplicate labels as log-only when unit cannot resolve them', () => {
    const source = new FakeDataSource();
    const result = bindChannelCatalogToLog(
      catalog(),
      [{
        id: 'mlg:4',
        sourceName: 'Duplicate',
        displayName: 'Duplicate',
        valueType: 'number',
      }],
      source,
    );

    expect(result.metrics.boundChannelCount).toBe(0);
    expect(result.metrics.logOnlyCount).toBe(1);
    expect(result.metrics.ambiguousLogChannelCount).toBe(1);
    expect(result.sourceToLogicalChannelId.get('mlg:4')).toBe('mlg:4');
  });

  it('maps stable logical IDs back to the original data source and preserves cache-hit IDs', async () => {
    const source = new FakeDataSource();
    const wrapped = new BoundNumericChannelDataSource(
      source,
      new Map([
        ['ini:RPMValue', 'mlg:0'],
        ['ini:MAPValue', 'mlg:1'],
      ]),
    );

    expect(wrapped.hasCachedChannelRange?.('ini:RPMValue', 0, 2)).toBe(true);
    expect(wrapped.hasCachedChannelRange?.('ini:MAPValue', 0, 2)).toBe(false);

    await wrapped.readChannelRange('ini:RPMValue', 0, 2);
    expect(source.readIds).toContain('mlg:0');

    const batch = await wrapped.readChannelsRange?.(
      ['ini:RPMValue', 'ini:MAPValue'],
      0,
      2,
    );

    expect(batch?.ranges.has('ini:RPMValue')).toBe(true);
    expect(batch?.ranges.has('ini:MAPValue')).toBe(true);
    expect(batch?.performance.cacheHitChannelIds).toEqual(['ini:RPMValue']);
    await expect(wrapped.readChannelRange('ini:neverLogged', 0, 2)).rejects.toThrow(
      'has no bound log data',
    );
  });
});
