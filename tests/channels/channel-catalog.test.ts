import { describe, expect, it } from 'vitest';

import { buildIniChannelCatalog } from '../../core/channels/channel-catalog';
import { parseIniChannelSections } from '../../core/parsers/ini/ini-channel-parser';

describe('INI-backed channel catalog', () => {
  it('uses exact INI output keys as stable logical identities and Datalog labels for display', () => {
    const parsed = parseIniChannelSections(`
[OutputChannels]
RPMValue = scalar, U16, 4, "RPM", 1, 0
MAPValue = scalar, U16, 44, "kPa", 0.01, 0
isMapValid = bits, U32, 0, [26:26]
derivedLoad = { MAPValue / 100 }

[Datalog]
entry = RPMValue, "Engine RPM", int, "%d"
entry = MAPValue, "MAP", float, "%.2f"
entry = isMapValid, "MAP Valid", int, "%d"
entry = datalogOnly, "Logger Only Definition", float, "%.3f"
`);

    const catalog = buildIniChannelCatalog(parsed);

    expect(catalog.byLogicalKey.get('RPMValue')).toMatchObject({
      logicalKey: 'RPMValue',
      sourceName: 'RPMValue',
      displayName: 'Engine RPM',
      valueType: 'integer',
      unit: 'RPM',
      availability: 'known-no-data',
      iniDefinitionKind: 'scalar',
      iniByteOffset: 4,
      iniScale: 1,
      datalogValueType: 'int',
      datalogFormat: '%d',
    });

    expect(catalog.byLogicalKey.get('MAPValue')).toMatchObject({
      logicalKey: 'MAPValue',
      displayName: 'MAP',
      precision: 2,
      unit: 'kPa',
    });

    expect(catalog.byLogicalKey.get('isMapValid')?.valueType).toBe('bitfield');
    expect(catalog.byLogicalKey.get('derivedLoad')?.iniDefinitionKind).toBe('expression');

    expect(catalog.byLogicalKey.get('datalogOnly')).toMatchObject({
      logicalKey: 'datalogOnly',
      displayName: 'Logger Only Definition',
      availability: 'known-no-data',
      precision: 3,
    });
  });

  it('keeps catalog identity separate from display labels', () => {
    const parsed = parseIniChannelSections(`
[OutputChannels]
boostControlOutput = scalar, U16, 0, "%", 0.1, 0
[Datalog]
entry = boostControlOutput, "Boost: Output", float, "%.1f"
`);

    const entry = buildIniChannelCatalog(parsed).entries[0];

    expect(entry?.logicalKey).toBe('boostControlOutput');
    expect(entry?.sourceName).toBe('boostControlOutput');
    expect(entry?.displayName).toBe('Boost: Output');
  });
});
