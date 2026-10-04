import { describe, expect, it } from 'vitest';
import { parseMsq } from '../../../core/parsers/msq/msq-parser';

const SAMPLE = `<?xml version="1.0" encoding="ISO-8859-1"?>
<msq xmlns="http://www.msefi.com/:msq">
  <bibliography author="TunerStudio MS 3.2" tuneComment="" writeDate="Sun Jul 26 23:02:14 CEST 2026"/>
  <versionInfo fileFormat="5.0" firmwareInfo="rusEFI master" nPages="2" signature="rusEFI test signature"/>
  <page>
    <pcVariable name="tsCanId">"CAN ID 0"</pcVariable>
  </page>
  <page number="0" size="288">
    <constant digits="1" name="reqFuel" units="ms">7.9</constant>
    <constant cols="3" digits="0" name="rpmBins" rows="1">800 1600 2400</constant>
    <constant cols="2" digits="1" name="veTable" rows="2" units="%">
      40 41
      50 51
    </constant>
  </page>
</msq>`;

describe('parseMsq', () => {
  it('extracts MSQ identity and page-scoped constants without DOM APIs', () => {
    const parsed = parseMsq(SAMPLE);
    expect(parsed.fileFormat).toBe('5.0');
    expect(parsed.firmwareInfo).toBe('rusEFI master');
    expect(parsed.signature).toBe('rusEFI test signature');
    expect(parsed.writeDate).toBe('Sun Jul 26 23:02:14 CEST 2026');
    expect(parsed.author).toBe('TunerStudio MS 3.2');
    expect(parsed.variables).toHaveLength(4);
    expect(parsed.variables[1]).toMatchObject({
      kind: 'constant', name: 'reqFuel', pageNumber: 0, rows: undefined, cols: undefined, digits: 1, units: 'ms',
    });
  });

  it('parses numeric vectors and tables while preserving dimensions', () => {
    const parsed = parseMsq(SAMPLE);
    const rpm = parsed.variables.find((item) => item.name === 'rpmBins');
    const ve = parsed.variables.find((item) => item.name === 'veTable');
    expect(rpm?.numericValues).toEqual([800, 1600, 2400]);
    expect(rpm?.rows).toBe(1);
    expect(rpm?.cols).toBe(3);
    expect(ve?.numericValues).toEqual([40, 41, 50, 51]);
    expect(ve?.rows).toBe(2);
    expect(ve?.cols).toBe(2);
  });

  it('keeps quoted pcVariable text as one decoded token', () => {
    const parsed = parseMsq(SAMPLE);
    const variable = parsed.variables.find((item) => item.name === 'tsCanId');
    expect(variable?.numericValues).toBeUndefined();
    expect(variable?.tokens).toEqual(['CAN ID 0']);
  });

  it('decodes XML entities in metadata and values', () => {
    const parsed = parseMsq(`<msq><bibliography author="A &amp; B"/><versionInfo signature="x &quot;y&quot;"/><page><pcVariable name="label">"A &amp; B"</pcVariable></page></msq>`);
    expect(parsed.author).toBe('A & B');
    expect(parsed.signature).toBe('x "y"');
    expect(parsed.variables[0]?.tokens).toEqual(['A & B']);
  });

  it('rejects non-MSQ input', () => {
    expect(() => parseMsq('<xml/>')).toThrow(/<msq>/);
  });
});
