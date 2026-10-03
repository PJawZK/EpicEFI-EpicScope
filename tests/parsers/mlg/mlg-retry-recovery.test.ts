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
  it('classifies an invalid attempt followed by a valid same-counter/same-timestamp retry', async () => {
    const bytes = new Uint8Array(24 + 24);
    bytes.set(makeRecord(10, 100, 1), 24);
    bytes.set(makeRecord(11, 101, 2, false), 30);
    bytes.set(makeRecord(11, 101, 2, true), 36);
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
    expect(summary?.message).toContain('1 invalid record recovered');
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


describe('MLG CRC-valid counter retry patterns', () => {
  it('classifies a counter jump followed by a same-timestamp repeat as informational', async () => {
    const bytes = new Uint8Array(24 + 24);
    bytes.set(makeRecord(1, 300, 1), 24);
    bytes.set(makeRecord(3, 301, 2), 30);
    bytes.set(makeRecord(3, 301, 3), 36);
    bytes.set(makeRecord(4, 303, 4), 42);

    const result = await scanMlgRecords(new MemoryByteSource(bytes), header);

    expect(result.records.crcValid).toEqual(new Uint8Array([1, 1, 1, 1]));
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-counter-discontinuity'),
    ).toHaveLength(0);

    const patterns = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === 'mlg-counter-retry-pattern',
    );
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.severity).toBe('info');
    expect(patterns[0]?.message).toContain('advanced from 1 to 3');
    expect(patterns[0]?.message).toContain('2 CRC-valid records');
    expect(patterns[0]?.message).toContain('same counter and timestamp');

    const summary = result.diagnostics.find(
      (diagnostic) => diagnostic.code === 'mlg-counter-pattern-summary',
    );
    expect(summary?.severity).toBe('info');
    expect(summary?.message).toContain('1 CRC-valid same-counter/same-timestamp retry-like run');
  });

  it('keeps an unpaired counter jump as a warning', async () => {
    const bytes = new Uint8Array(24 + 18);
    bytes.set(makeRecord(10, 400, 1), 24);
    bytes.set(makeRecord(12, 401, 2), 30);
    bytes.set(makeRecord(13, 402, 3), 36);

    const result = await scanMlgRecords(new MemoryByteSource(bytes), header);

    const warnings = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === 'mlg-counter-discontinuity',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.severity).toBe('warning');
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === 'mlg-counter-retry-pattern'),
    ).toHaveLength(0);
  });
});
