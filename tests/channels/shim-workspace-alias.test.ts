import { describe, expect, it } from 'vitest';

import { bindChannelCatalogToLog } from '../../core/channels/channel-binding';
import type { ChannelCatalog } from '../../core/channels/channel-catalog';
import type {
  ChannelDefinition,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../core/log-model/log-types';

class FakeDataSource implements NumericChannelDataSource {
  readonly sampleCount = 1;

  async readChannelRange(
    _channelId: string,
    startSampleIndex: number,
    _sampleCount: number,
  ): Promise<NumericChannelRange> {
    return {
      startSampleIndex,
      timeMs: new Float64Array([0]),
      values: new Float64Array([0]),
      validity: new Uint8Array([1]),
    };
  }
}

function liveCompatibleCatalog(): ChannelCatalog {
  const entries = [
    {
      logicalKey: 'RPMValue',
      sourceName: 'RPMValue',
      displayName: 'RPM',
      valueType: 'number' as const,
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
      availability: 'known-no-data' as const,
      provenance: { kind: 'ini' as const },
    },
    {
      logicalKey: 'TPSValue',
      sourceName: 'TPSValue',
      displayName: 'TPS',
      valueType: 'number' as const,
      unit: '%',
      availability: 'known-no-data' as const,
      provenance: { kind: 'ini' as const },
    },
    {
      logicalKey: 'intake',
      sourceName: 'intake',
      displayName: 'IAT',
      valueType: 'number' as const,
      unit: 'deg C',
      availability: 'known-no-data' as const,
      provenance: { kind: 'ini' as const },
    },
    {
      logicalKey: 'coolant',
      sourceName: 'coolant',
      displayName: 'CLT',
      valueType: 'number' as const,
      unit: 'deg C',
      availability: 'known-no-data' as const,
      provenance: { kind: 'ini' as const },
    },
  ];

  return {
    entries,
    byLogicalKey: new Map(entries.map((entry) => [entry.logicalKey, entry] as const)),
  };
}

describe('shim workspace channel identity migration', () => {
  it('maps bare ts_shim logical IDs onto canonical INI IDs when the channels are bound', () => {
    const logChannels: ChannelDefinition[] = [
      { id: 'mlg:0', sourceName: 'RPM', displayName: 'RPM', valueType: 'number', unit: 'RPM' },
      { id: 'mlg:1', sourceName: 'MAP', displayName: 'MAP', valueType: 'number', unit: 'kPa' },
      { id: 'mlg:2', sourceName: 'TPS', displayName: 'TPS', valueType: 'number', unit: '%' },
      { id: 'mlg:3', sourceName: 'IAT', displayName: 'IAT', valueType: 'number', unit: 'deg C' },
      { id: 'mlg:4', sourceName: 'CLT', displayName: 'CLT', valueType: 'number', unit: 'deg C' },
    ];

    const result = bindChannelCatalogToLog(
      liveCompatibleCatalog(),
      logChannels,
      new FakeDataSource(),
    );

    expect(result.workspaceChannelAliases.get('RPMValue')).toBe('ini:RPMValue');
    expect(result.workspaceChannelAliases.get('MAPValue')).toBe('ini:MAPValue');
    expect(result.workspaceChannelAliases.get('TPSValue')).toBe('ini:TPSValue');
    expect(result.workspaceChannelAliases.get('intake')).toBe('ini:intake');
    expect(result.workspaceChannelAliases.get('coolant')).toBe('ini:coolant');
  });

  it('does not alias bare INI keys that have no data in the current log', () => {
    const catalog = liveCompatibleCatalog();
    const result = bindChannelCatalogToLog(
      catalog,
      [{ id: 'mlg:0', sourceName: 'RPM', displayName: 'RPM', valueType: 'number', unit: 'RPM' }],
      new FakeDataSource(),
    );

    expect(result.workspaceChannelAliases.get('RPMValue')).toBe('ini:RPMValue');
    expect(result.workspaceChannelAliases.has('MAPValue')).toBe(false);
    expect(result.workspaceChannelAliases.has('coolant')).toBe(false);
  });
});
