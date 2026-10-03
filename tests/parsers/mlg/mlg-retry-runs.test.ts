import { describe, expect, it } from 'vitest';

import { MemoryByteSource } from '../../../core/parsers/byte-source';
import type { MlgHeader } from '../../../core/parsers/mlg/mlg-format';
import { scanMlgRecords } from '../../../core/parsers/mlg/mlg-records';

const header: MlgHeader = {
  version: 2,
  logStartUnixSeconds: 0,
  infoDataStart: 0,
  dataBeginIndex: 24,
  recordLength: 1,
  loggerFieldCount: 1,
  loggerFieldsStart: 24,
  loggerFieldDescriptorLength: 89,
};

function makeRecord(
  counter: number,
  timestamp: number,
  value: number,
  validChecksum = true,
): Uint8Array {
  const checksum = validChecksum ? value & 0xff : (value + 1) & 0xff;
  return new Uint8Array([
    0,
    counter,
    (timestamp >> 8) & 0xff,
    timestamp & 0xff,
    value,
    checksum,
  ]);
}

function makeLog(records: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(24 + records.length * 6);
  records.forEach((record, index) => bytes.set(record, 24 + index * 6));
  return bytes;
}

describe('MLG retry run classification', () => {
  it('recovers every invalid attempt in a bad-bad-valid same-counter/same-timestamp run', async () => {
    const bytes = makeLog([
      makeRecord(149, 1000, 1),
      makeRecord(150, 1010, 2, false),
      makeRecord(150, 1010, 2, false),
      makeRecord(150, 1010, 2, true),
      makeRecord(151, 1020, 3),
    ]);

    const result = await scanMlgRecords(new MemoryByteSource(bytes), header);

    expect(result.records.crcValid).toEqual(new Uint8Array([1, 0, 0, 1, 1]));
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-crc-retry-recovered'),
    ).toHaveLength(2);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-crc-mismatch'),
    ).toHaveLength(0);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-counter-discontinuity'),
    ).toHaveLength(0);

    const summary = result.diagnostics.find(
      (diagnostic) => diagnostic.code === 'mlg-retry-recovery-summary',
    );
    expect(summary?.message).toContain('2 invalid records recovered');
    expect(summary?.message).toContain('0 invalid records not recovered');
  });

  it('does not classify a repeated counter with an advancing timestamp as retry-like', async () => {
    const bytes = makeLog([
      makeRecord(70, 20292, 1),
      makeRecord(72, 21476, 2),
      makeRecord(72, 22198, 3),
      makeRecord(73, 23083, 4),
    ]);

    const result = await scanMlgRecords(new MemoryByteSource(bytes), header);

    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-counter-retry-pattern'),
    ).toHaveLength(0);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-counter-discontinuity'),
    ).toHaveLength(2);
  });

  it('classifies a triple CRC-valid same-counter/same-timestamp run when the counter advances by three', async () => {
    const bytes = makeLog([
      makeRecord(109, 12000, 1),
      makeRecord(112, 12349, 2),
      makeRecord(112, 12349, 2),
      makeRecord(112, 12349, 2),
      makeRecord(113, 13000, 3),
    ]);

    const result = await scanMlgRecords(new MemoryByteSource(bytes), header);

    const patterns = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === 'mlg-counter-retry-pattern',
    );
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.message).toContain('3 CRC-valid records');
    expect(patterns[0]?.message).toContain('same counter and timestamp');
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-counter-discontinuity'),
    ).toHaveLength(0);
  });
});
