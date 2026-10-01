import { describe, expect, it } from 'vitest';

import { MemoryByteSource } from '../../core/parsers/byte-source';
import { parseMlg } from '../../core/parsers/mlg/mlg-parser';
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
});
