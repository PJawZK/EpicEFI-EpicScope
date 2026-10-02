import { describe, expect, it } from 'vitest';

import { MemoryByteSource, type RandomAccessByteSource } from '../../core/parsers/byte-source';
import { MlgNumericChannelDataSource } from '../../core/parsers/mlg/mlg-channel-data';
import { parseMlg } from '../../core/parsers/mlg/mlg-parser';
import type { MlgScalarFieldDescriptor } from '../../core/parsers/mlg/mlg-format';
import type { MlgRecordIndex } from '../../core/parsers/mlg/mlg-records';
import { createScalarHeaderFixture } from './mlg-fixture-builder';

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function u16Block(counter: number, timestamp: number, raw: number, validCrc = true): Uint8Array {
  const block = new Uint8Array(7);
  const view = new DataView(block.buffer);
  block[0] = 0;
  block[1] = counter;
  view.setUint16(2, timestamp, false);
  view.setUint16(4, raw, false);
  const crc = (block[4]! + block[5]!) & 0xff;
  block[6] = validCrc ? crc : (crc + 1) & 0xff;
  return block;
}

function markerBlock(counter: number, timestamp: number): Uint8Array {
  const block = new Uint8Array(54);
  const view = new DataView(block.buffer);
  block[0] = 1;
  block[1] = counter;
  view.setUint16(2, timestamp, false);
  block.set(new TextEncoder().encode('between samples'), 4);
  return block;
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

describe('MlgNumericChannelDataSource', () => {
  it('reads bounded ranges and applies scalar transform then scale', async () => {
    const header = createScalarHeaderFixture({
      version: 2,
      type: 2,
      name: 'MAP',
      units: 'kPa',
      scale: 0.5,
      transform: -10,
      digits: 1,
    });
    const bytes = concat(
      header,
      u16Block(1, 100, 100),
      markerBlock(2, 105),
      u16Block(3, 110, 200, false),
    );
    const source = new MemoryByteSource(bytes);
    const parsed = await parseMlg(source, {
      id: 'fixture',
      displayName: 'fixture.mlg',
      format: 'MLG',
      sizeBytes: bytes.byteLength,
    });

    const range = await parsed.channelData.readChannelRange('mlg:0', 0, 2);

    expect([...range.timeMs]).toEqual([0, 0.1]);
    expect([...range.values]).toEqual([45, 95]);
    expect([...range.validity]).toEqual([1, 0]);
    expect(range.startSampleIndex).toBe(0);
  });

  it('rejects unknown channels and out-of-range sample requests', async () => {
    const header = createScalarHeaderFixture({ version: 1, type: 2 });
    const bytes = concat(header, u16Block(1, 100, 100));
    const source = new MemoryByteSource(bytes);
    const parsed = await parseMlg(source, {
      id: 'fixture',
      displayName: 'fixture.mlg',
      format: 'MLG',
      sizeBytes: bytes.byteLength,
    });

    await expect(parsed.channelData.readChannelRange('missing', 0, 1)).rejects.toBeInstanceOf(RangeError);
    await expect(parsed.channelData.readChannelRange('mlg:0', 1, 1)).rejects.toBeInstanceOf(RangeError);
  });
  it('batches multiple channels into one record-stream pass and caches decoded full ranges', async () => {
    const sampleCount = 1024;
    const stride = 4096;
    const bytes = new Uint8Array(sampleCount * stride);
    const offsets = new Float64Array(sampleCount);
    const timeMs = new Float64Array(sampleCount);
    const counters = new Uint8Array(sampleCount);
    const crcValid = new Uint8Array(sampleCount);
    crcValid.fill(1);

    for (let index = 0; index < sampleCount; index += 1) {
      offsets[index] = index * stride;
      timeMs[index] = index;
      counters[index] = index & 0xff;
      bytes[index * stride + 4] = index & 0xff;
      bytes[index * stride + 5] = (255 - index) & 0xff;
    }

    const fields: readonly MlgScalarFieldDescriptor[] = [
      {
        kind: 'scalar',
        index: 0,
        offset: 0,
        type: 0,
        name: 'first',
        units: '',
        displayStyle: 0,
        widthBytes: 1,
        category: '',
        scale: 1,
        transform: 0,
        digits: 0,
      },
      {
        kind: 'scalar',
        index: 1,
        offset: 1,
        type: 0,
        name: 'second',
        units: '',
        displayStyle: 0,
        widthBytes: 1,
        category: '',
        scale: 1,
        transform: 0,
        digits: 0,
      },
    ];
    const recordIndex: MlgRecordIndex = { offsets, timeMs, counters, crcValid };
    const source = new CountingByteSource(bytes);
    const channelData = new MlgNumericChannelDataSource(source, fields, recordIndex);

    const batch = await channelData.readChannelsRange(
      ['mlg:0', 'mlg:1'],
      0,
      sampleCount,
    );

    expect(source.readCount).toBe(1);
    expect(batch.performance.channelCount).toBe(2);
    expect(batch.performance.cacheHitChannelIds).toEqual([]);
    expect(batch.ranges.get('mlg:0')?.values[255]).toBe(255);
    expect(batch.ranges.get('mlg:1')?.values[255]).toBe(0);

    const firstAgain = await channelData.readChannelRange('mlg:0', 0, sampleCount);
    const secondAgain = await channelData.readChannelRange('mlg:1', 0, sampleCount);
    expect(source.readCount).toBe(1);
    expect(firstAgain.values[511]).toBe(255);
    expect(secondAgain.values[511]).toBe(0);
  });

  it('amortizes strided full-channel reads into multi-megabyte source batches', async () => {
    const sampleCount = 1024;
    const stride = 4096;
    const bytes = new Uint8Array(sampleCount * stride);
    const offsets = new Float64Array(sampleCount);
    const timeMs = new Float64Array(sampleCount);
    const counters = new Uint8Array(sampleCount);
    const crcValid = new Uint8Array(sampleCount);
    crcValid.fill(1);

    for (let index = 0; index < sampleCount; index += 1) {
      offsets[index] = index * stride;
      timeMs[index] = index;
      counters[index] = index & 0xff;
      bytes[index * stride + 4] = index & 0xff;
    }

    const field: MlgScalarFieldDescriptor = {
      kind: 'scalar',
      index: 0,
      offset: 0,
      type: 0,
      name: 'test',
      units: '',
      displayStyle: 0,
      widthBytes: 1,
      category: '',
      scale: 1,
      transform: 0,
      digits: 0,
    };
    const recordIndex: MlgRecordIndex = { offsets, timeMs, counters, crcValid };
    const source = new CountingByteSource(bytes);
    const channelData = new MlgNumericChannelDataSource(source, [field], recordIndex);

    const range = await channelData.readChannelRange('mlg:0', 0, sampleCount);

    expect(source.readCount).toBe(1);
    expect(range.values[0]).toBe(0);
    expect(range.values[255]).toBe(255);
    expect(range.values[256]).toBe(0);
    expect(range.values[1023]).toBe(255);
  });
});
