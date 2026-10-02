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

describe('MLG retry/recovery diagnostics', () => {
  it('classifies an invalid attempt followed by a valid same-counter retry', async () => {
    const bytes = new Uint8Array(24 + 24);
    bytes.set(makeRecord(10, 100, 1), 24);
    bytes.set(makeRecord(11, 101, 2, false), 30);
    bytes.set(makeRecord(11, 102, 2, true), 36);
    bytes.set(makeRecord(12, 103, 3), 42);

    const result = await scanMlgRecords(new MemoryByteSource(bytes), header);

    expect(result.records.crcValid).toEqual(new Uint8Array([1, 0, 1, 1]));

    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-counter-discontinuity'),
    ).toHaveLength(0);

    const recovered = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === 'mlg-crc-retry-recovered',
    );
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.severity).toBe('info');

    const summary = result.diagnostics.find(
      (diagnostic) => diagnostic.code === 'mlg-retry-recovery-summary',
    );
    expect(summary?.severity).toBe('info');
    expect(summary?.message).toContain('1 invalid record followed by a valid same-counter retry');
    expect(summary?.message).toContain('0 invalid records not recovered');
  });

  it('keeps an unrecovered invalid record as a warning', async () => {
    const bytes = new Uint8Array(24 + 18);
    bytes.set(makeRecord(20, 200, 1), 24);
    bytes.set(makeRecord(21, 201, 2, false), 30);
    bytes.set(makeRecord(22, 202, 3), 36);

    const result = await scanMlgRecords(new MemoryByteSource(bytes), header);

    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-crc-mismatch'),
    ).toHaveLength(1);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-crc-retry-recovered'),
    ).toHaveLength(0);

    const summary = result.diagnostics.find(
      (diagnostic) => diagnostic.code === 'mlg-retry-recovery-summary',
    );
    expect(summary?.severity).toBe('warning');
    expect(summary?.message).toContain('1 invalid record not recovered');
  });
});
