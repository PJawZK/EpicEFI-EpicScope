import { describe, expect, it } from 'vitest';

import { MemoryByteSource } from '../../core/parsers/byte-source';
import { parseMlgHeader } from '../../core/parsers/mlg/mlg-header';
import {
  createBitFieldHeaderFixture,
  createIdentityFixture,
  createScalarHeaderFixture,
  setFieldType,
  setLoggerFieldCount,
} from './mlg-fixture-builder';

describe('parseMlgHeader', () => {
  it('parses an MLVLG v1 scalar channel', async () => {
    const source = new MemoryByteSource(createScalarHeaderFixture({
      version: 1,
      type: 2,
      name: 'RPM',
      units: 'rpm',
      scale: 1,
      transform: 0,
      digits: 0,
    }));

    const result = await parseMlgHeader(source);

    expect(result.header).toMatchObject({
      version: 1,
      recordLength: 2,
      loggerFieldCount: 1,
    });
    expect(result.fields[0]).toMatchObject({
      kind: 'scalar',
      type: 2,
      name: 'RPM',
      units: 'rpm',
      scale: 1,
      transform: 0,
      digits: 0,
    });
    expect(result.channels[0]).toEqual({
      id: 'mlg:0',
      sourceName: 'RPM',
      displayName: 'RPM',
      valueType: 'integer',
      unit: 'rpm',
      precision: 0,
    });
  });

  it('parses MLVLG v2 category and float metadata', async () => {
    const source = new MemoryByteSource(createScalarHeaderFixture({
      version: 2,
      type: 7,
      name: 'MAP',
      units: 'kPa',
      category: 'Engine',
      scale: 0.5,
      transform: -1,
      digits: 1,
    }));

    const result = await parseMlgHeader(source);

    expect(result.header).toMatchObject({
      version: 2,
      recordLength: 4,
      loggerFieldCount: 1,
      loggerFieldDescriptorLength: 89,
    });
    expect(result.fields[0]).toMatchObject({
      kind: 'scalar',
      type: 7,
      name: 'MAP',
      category: 'Engine',
      scale: 0.5,
      transform: -1,
      digits: 1,
    });
    expect(result.channels[0]).toEqual({
      id: 'mlg:0',
      sourceName: 'MAP',
      displayName: 'MAP',
      valueType: 'number',
      unit: 'kPa',
      category: 'Engine',
      precision: 1,
    });
  });

  it('parses bit-field descriptors without dereferencing absent names', async () => {
    const source = new MemoryByteSource(createBitFieldHeaderFixture({
      version: 2,
      type: 11,
      name: 'status',
      bits: 12,
      category: 'Status',
    }));

    const result = await parseMlgHeader(source);

    expect(result.fields[0]).toMatchObject({
      kind: 'bitfield',
      type: 11,
      widthBytes: 2,
      bits: 12,
      bitFieldNamesIndex: 0,
      category: 'Status',
    });
    expect(result.channels[0]).toMatchObject({
      sourceName: 'status',
      valueType: 'bitfield',
      category: 'Status',
    });
  });

  it('rejects unsupported MLVLG versions explicitly', async () => {
    const source = new MemoryByteSource(createIdentityFixture(3));

    await expect(parseMlgHeader(source)).rejects.toMatchObject({
      code: 'unsupported-version',
      offset: 6,
    });
  });

  it('rejects a truncated fixed header', async () => {
    const source = new MemoryByteSource(createIdentityFixture(2));

    await expect(parseMlgHeader(source)).rejects.toMatchObject({
      code: 'truncated-header',
    });
  });

  it('rejects logger field counts that cannot fit in the file', async () => {
    const bytes = createScalarHeaderFixture({ version: 2 });
    setLoggerFieldCount(bytes, 2, 2);
    const source = new MemoryByteSource(bytes);

    await expect(parseMlgHeader(source)).rejects.toMatchObject({
      code: 'descriptor-range-out-of-bounds',
    });
  });

  it('rejects unsupported field types rather than guessing widths', async () => {
    const bytes = createScalarHeaderFixture({ version: 1 });
    setFieldType(bytes, 1, 9);
    const source = new MemoryByteSource(bytes);

    await expect(parseMlgHeader(source)).rejects.toMatchObject({
      code: 'unsupported-field-type',
    });
  });

  it('rejects record-length metadata that does not match field widths', async () => {
    const source = new MemoryByteSource(createScalarHeaderFixture({
      version: 2,
      type: 2,
      recordLength: 4,
    }));

    await expect(parseMlgHeader(source)).rejects.toMatchObject({
      code: 'record-length-mismatch',
    });
  });

  it('rejects impossible bit counts', async () => {
    const source = new MemoryByteSource(createBitFieldHeaderFixture({
      version: 1,
      type: 10,
      bits: 9,
    }));

    await expect(parseMlgHeader(source)).rejects.toMatchObject({
      code: 'invalid-bit-field',
    });
  });
});
