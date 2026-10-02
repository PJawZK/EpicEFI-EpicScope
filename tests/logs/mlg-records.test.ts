import { describe, expect, it } from 'vitest';

import { MemoryByteSource, type RandomAccessByteSource } from '../../core/parsers/byte-source';
import { parseMlgHeader } from '../../core/parsers/mlg/mlg-header';
import {
  calculateMlgRecordChecksum,
  scanMlgRecords,
  validateMlgRecordCrc,
} from '../../core/parsers/mlg/mlg-records';
import { createScalarHeaderFixture } from './mlg-fixture-builder';

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function loggerBlock(
  counter: number,
  timestamp: number,
  record: readonly number[],
  crcOverride?: number,
): Uint8Array {
  const result = new Uint8Array(4 + record.length + 1);
  const view = new DataView(result.buffer);
  result[0] = 0;
  result[1] = counter;
  view.setUint16(2, timestamp, false);
  result.set(record, 4);
  const crc = record.reduce((sum, value) => (sum + value) & 0xff, 0);
  result[result.length - 1] = crcOverride ?? crc;
  return result;
}

function markerBlock(counter: number, timestamp: number, message: string): Uint8Array {
  const result = new Uint8Array(54);
  const view = new DataView(result.buffer);
  result[0] = 1;
  result[1] = counter;
  view.setUint16(2, timestamp, false);
  const encoded = new TextEncoder().encode(message);
  result.set(encoded.subarray(0, 49), 4);
  return result;
}

class CountingByteSource implements RandomAccessByteSource {
  readonly size: number;
  readCount = 0;
  private readonly source: MemoryByteSource;

  constructor(bytes: Uint8Array) {
    this.source = new MemoryByteSource(bytes);
    this.size = this.source.size;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    this.readCount += 1;
    return this.source.read(offset, length);
  }
}

async function parseAndScan(bytes: Uint8Array) {
  const source = new MemoryByteSource(bytes);
  const parsed = await parseMlgHeader(source);
  return scanMlgRecords(source, parsed.header);
}

describe('scanMlgRecords', () => {
  it('builds a compact index and unwraps the 16-bit 10us timestamp', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const bytes = concat(
      header,
      loggerBlock(7, 65_530, [10]),
      loggerBlock(8, 4, [20]),
      loggerBlock(9, 14, [30]),
    );

    const result = await parseAndScan(bytes);

    expect([...result.records.counters]).toEqual([7, 8, 9]);
    expect([...result.records.crcValid]).toEqual([1, 1, 1]);
    expect([...result.records.timeMs]).toEqual([0, 0.1, 0.2]);
    expect(result.records.offsets).toHaveLength(3);
    expect(result.performance.scanMode).toBe('fixed');
    expect(result.diagnostics).toEqual([]);
  });

  it('extracts fixed-length marker messages', async () => {
    const header = createScalarHeaderFixture({ version: 1, type: 0 });
    const bytes = concat(
      header,
      loggerBlock(1, 100, [1]),
      markerBlock(2, 110, 'boost starts'),
      loggerBlock(3, 120, [2]),
    );

    const result = await parseAndScan(bytes);

    expect(result.performance.scanMode).toBe('general');
    expect(result.markers).toEqual([{ timeMs: 0.1, label: 'boost starts' }]);
    expect([...result.records.timeMs]).toEqual([0, 0.2]);
  });

  it('reports checksum mismatches without discarding the record', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const bytes = concat(header, loggerBlock(1, 10, [4], 99));

    const result = await parseAndScan(bytes);

    expect([...result.records.crcValid]).toEqual([0]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'mlg-crc-mismatch',
      severity: 'warning',
      recoverable: true,
    }));
  });

  it('reports block-counter discontinuities as recoverable warnings', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const bytes = concat(
      header,
      loggerBlock(10, 10, [1]),
      loggerBlock(12, 20, [2]),
    );

    const result = await parseAndScan(bytes);

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'mlg-counter-discontinuity',
      severity: 'warning',
      recoverable: true,
    }));
  });

  it('rejects unknown block types because their length is not trustworthy', async () => {
    const header = createScalarHeaderFixture({ version: 1, type: 0 });
    const unknown = Uint8Array.from([9, 1, 0, 1, 0]);
    const bytes = concat(header, unknown);

    await expect(parseAndScan(bytes)).rejects.toMatchObject({
      code: 'unsupported-block-type',
    });
  });

  it('rejects truncated logger records rather than fabricating bytes', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const truncated = Uint8Array.from([0, 1, 0, 1]);
    const bytes = concat(header, truncated);

    await expect(parseAndScan(bytes)).rejects.toMatchObject({
      code: 'short-read',
    });
  });

  it('rejects truncated markers', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const truncated = Uint8Array.from([1, 1, 0, 1, 65, 66]);
    const bytes = concat(header, truncated);

    await expect(parseAndScan(bytes)).rejects.toMatchObject({
      code: 'short-read',
    });
  });
  it('scans many records with one bounded source read when they fit one scan chunk', async () => {
    const header = createScalarHeaderFixture({ version: 2, type: 0 });
    const recordCount = 100_000;
    const blockLength = 6;
    const bytes = new Uint8Array(header.byteLength + recordCount * blockLength);
    bytes.set(header, 0);

    for (let index = 0; index < recordCount; index += 1) {
      const offset = header.byteLength + index * blockLength;
      bytes[offset] = 0;
      bytes[offset + 1] = index & 0xff;
      const timestamp = index & 0xffff;
      bytes[offset + 2] = (timestamp >>> 8) & 0xff;
      bytes[offset + 3] = timestamp & 0xff;
      bytes[offset + 4] = index & 0xff;
      bytes[offset + 5] = index & 0xff;
    }

    const source = new CountingByteSource(bytes);
    const parsed = await parseMlgHeader(source);
    source.readCount = 0;
    const result = await scanMlgRecords(source, parsed.header);

    expect(result.records.offsets).toHaveLength(recordCount);
    expect(source.readCount).toBe(1);
  });
});


describe('fixed-record checksum fast path', () => {
  it('sums a wide non-aligned payload identically to the reference checksum', () => {
    const payload = Uint8Array.from(
      { length: 4_390 },
      (_, index) => (index * 37 + 11) & 0xff,
    );
    const reference = [...payload].reduce((sum, value) => (sum + value) & 0xff, 0);

    expect(calculateMlgRecordChecksum(payload, 0, payload.byteLength)).toBe(reference);
    expect(calculateMlgRecordChecksum(payload, 13, 4_321)).toBe(
      [...payload.subarray(13, 13 + 4_321)]
        .reduce((sum, value) => (sum + value) & 0xff, 0),
    );
  });
});


describe('staged CRC validation', () => {
  it('indexes a bad-CRC record as provisionally usable, then validates it separately', async () => {
    const headerBytes = createScalarHeaderFixture({ version: 2, type: 0 });
    const bytes = concat(headerBytes, loggerBlock(1, 10, [4], 99));
    const source = new MemoryByteSource(bytes);
    const parsed = await parseMlgHeader(source);

    const indexed = await scanMlgRecords(source, parsed.header, { validateCrc: false });
    expect([...indexed.records.crcValid]).toEqual([1]);
    expect(indexed.diagnostics.some((item) => item.code === 'mlg-crc-mismatch')).toBe(false);

    const validated = await validateMlgRecordCrc(source, parsed.header, indexed.records);
    expect([...validated.crcValid]).toEqual([0]);
    expect(validated.diagnostics).toContainEqual(expect.objectContaining({
      code: 'mlg-crc-mismatch',
      severity: 'warning',
    }));
  });
});
