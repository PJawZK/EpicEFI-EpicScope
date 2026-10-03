import { describe, expect, it } from 'vitest';
import type { RandomAccessByteSource } from '../../../core/parsers/byte-source';
import { MlgNumericChannelDataSource } from '../../../core/parsers/mlg/mlg-channel-data';
import type { MlgFieldDescriptor } from '../../../core/parsers/mlg/mlg-format';
import type { MlgRecordIndex } from '../../../core/parsers/mlg/mlg-records';

class TrackingSource implements RandomAccessByteSource {
  readonly size: number;
  readonly preferredReadAlignmentBytes = 16;
  readonly reads: Array<{ offset: number; length: number }> = [];
  private readonly bytes: Uint8Array;

  constructor(size: number) {
    this.size = size;
    this.bytes = new Uint8Array(size);
  }

  setUint16(offset: number, value: number): void {
    new DataView(this.bytes.buffer).setUint16(offset, value, false);
  }

  setUint32(offset: number, value: number): void {
    new DataView(this.bytes.buffer).setUint32(offset, value, false);
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    this.reads.push({ offset, length });
    return this.bytes.subarray(offset, offset + length);
  }
}

function scalarField(widthBytes = 2): MlgFieldDescriptor {
  return {
    index: 0,
    offset: 0,
    kind: 'scalar',
    type: widthBytes === 4 ? 4 : 2,
    name: 'RPM',
    units: 'rpm',
    displayStyle: 0,
    widthBytes,
    category: '',
    scale: 1,
    transform: 0,
    digits: 0,
  };
}

function recordIndex(offsets: readonly number[]): MlgRecordIndex {
  return {
    offsets: Float64Array.from(offsets),
    timeMs: Float64Array.from(offsets.map((_value, index) => index * 10)),
    counters: Uint8Array.from(offsets.map((_value, index) => index)),
    crcValid: Uint8Array.from(offsets.map(() => 1)),
  };
}

describe('MLG channel source read alignment', () => {
  it('keeps decoder batches inside the source preferred page boundary', async () => {
    const source = new TrackingSource(64);
    const offsets = [0, 12, 24, 36];
    offsets.forEach((offset, index) => source.setUint16(offset + 4, 100 + index));
    const data = new MlgNumericChannelDataSource(source, [scalarField()], recordIndex(offsets));

    const result = await data.readChannelsRange(['mlg:0'], 0, offsets.length);

    expect([...result.ranges.get('mlg:0')!.values]).toEqual([100, 101, 102, 103]);
    expect(source.reads).toEqual([
      { offset: 4, length: 2 },
      { offset: 16, length: 14 },
      { offset: 40, length: 2 },
    ]);
    expect(source.reads.every(({ offset, length }) =>
      Math.floor(offset / 16) === Math.floor((offset + length - 1) / 16),
    )).toBe(true);
  });

  it('allows an unavoidable cross-page read when one selected field spans a boundary', async () => {
    const source = new TrackingSource(48);
    const offsets = [10, 26];
    source.setUint32(14, 101);
    source.setUint32(30, 102);
    const data = new MlgNumericChannelDataSource(source, [scalarField(4)], recordIndex(offsets));

    const result = await data.readChannelsRange(['mlg:0'], 0, offsets.length);

    expect([...result.ranges.get('mlg:0')!.values]).toEqual([101, 102]);
    expect(source.reads).toEqual([
      { offset: 14, length: 4 },
      { offset: 30, length: 4 },
    ]);
  });
});
