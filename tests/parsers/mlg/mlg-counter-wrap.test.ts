import { describe, expect, it } from 'vitest';
import { createArrayBufferByteSource } from '../../../core/parsers/byte-source';
import type { MlgHeader } from '../../../core/parsers/mlg/mlg-format';
import { scanMlgRecords } from '../../../core/parsers/mlg/mlg-records';

const header: MlgHeader = {
  version: 2,
  timestampSeconds: 0,
  infoDataStart: 0,
  dataBeginIndex: 24,
  recordLength: 1,
  numLoggerFields: 1,
};

function makeRecord(counter: number, timestamp: number, value: number): Uint8Array {
  return new Uint8Array([
    0,
    counter,
    (timestamp >> 8) & 0xff,
    timestamp & 0xff,
    value,
    value & 0xff,
  ]);
}

describe('MLG block counter wrap', () => {
  it('accepts 254 -> 255 -> 0 as continuous 8-bit counter progression', async () => {
    const bytes = new Uint8Array(24 + 18);
    bytes.set(makeRecord(254, 100, 1), 24);
    bytes.set(makeRecord(255, 101, 2), 30);
    bytes.set(makeRecord(0, 102, 3), 36);

    const source = createArrayBufferByteSource(bytes.buffer);
    const result = await scanMlgRecords(source, header);

    expect(result.records.counters).toEqual(new Uint8Array([254, 255, 0]));
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-counter-discontinuity'),
    ).toHaveLength(0);
  });
});
