import { describe, expect, it } from 'vitest';

import { parseIniChannelSections } from '../../../core/parsers/ini/ini-channel-parser';

describe('INI channel section parser', () => {
  it('parses OutputChannels and Datalog without leaking definitions from other sections', () => {
    const text = `
[Constants]
rpmHardLimit = scalar, U16, 10, "rpm", 1, 0, 0, 20000, 0

[OutputChannels]
ochBlockSize = 4080
RPMValue = scalar, U16, 4, "RPM", 1, 0
MAPValue = scalar, U16, 44, "kPa", 0.01, 0
isMapValid = bits, U32, 0, [26:26]
time = { timeNow }
wheelDiameterMM = { 2 * tireSizeWidth } ; computed output

[Datalog]
entry = time, "Time", float, "%.3f"
entry = RPMValue, "RPM", int, "%d"
entry = MAPValue, "MAP", float, "%.2f"
entry = isMapValid, "MAP Valid", int, "%d"
`;

    const result = parseIniChannelSections(text);

    expect(result.diagnostics).toEqual([]);
    expect(result.outputChannels.map((channel) => channel.key)).toEqual([
      'RPMValue',
      'MAPValue',
      'isMapValid',
      'time',
      'wheelDiameterMM',
    ]);

    expect(result.outputChannels[0]).toMatchObject({
      key: 'RPMValue',
      kind: 'scalar',
      dataType: 'U16',
      byteOffset: 4,
      unit: 'RPM',
      scale: 1,
      translate: 0,
    });
    expect(result.outputChannels[2]).toMatchObject({
      key: 'isMapValid',
      kind: 'bits',
      dataType: 'U32',
      byteOffset: 0,
      bitRange: '[26:26]',
    });
    expect(result.outputChannels[3]).toMatchObject({
      key: 'time',
      kind: 'expression',
      expression: 'timeNow',
    });

    expect(result.datalogEntries[2]).toMatchObject({
      channelKey: 'MAPValue',
      label: 'MAP',
      valueType: 'float',
      format: '%.2f',
      precision: 2,
    });

    expect(result.outputChannels.some((channel) => channel.key === 'rpmHardLimit')).toBe(false);
    expect(result.outputChannels.some((channel) => channel.key === 'ochBlockSize')).toBe(false);
  });

  it('ignores semicolon comments outside quoted values', () => {
    const text = `
[OutputChannels]
messageLike = scalar, U16, 0, "unit;still-unit", 1, 0 ; actual comment
[Datalog]
entry = messageLike, "Label;still-label", float, "%.1f" ; actual comment
`;

    const result = parseIniChannelSections(text);

    expect(result.outputChannels[0]?.unit).toBe('unit;still-unit');
    expect(result.datalogEntries[0]?.label).toBe('Label;still-label');
  });

  it('bounds hostile text and line counts', () => {
    expect(() => parseIniChannelSections('123456', { maxTextLength: 5 })).toThrow(RangeError);
    expect(() => parseIniChannelSections('a\nb\nc', { maxLines: 2 })).toThrow(RangeError);
  });

  it('reports malformed Datalog entries without fabricating catalog fields', () => {
    const result = parseIniChannelSections(`
[OutputChannels]
RPMValue = scalar, U16, 4, "RPM", 1, 0
[Datalog]
entry = RPMValue
`);

    expect(result.datalogEntries).toHaveLength(0);
    expect(result.diagnostics.some((diagnostic) =>
      diagnostic.code === 'ini-datalog-entry-unparsed'
    )).toBe(true);
  });
});
