import { describe, expect, it } from 'vitest';
import {
  decodeShimTelemetryFrame,
  nanosecondsDeltaToMilliseconds,
} from '../../../apps/web/src/adapters/shim/shim-binary-decoder';
import { ShimProtocolError } from '../../../apps/web/src/adapters/shim/shim-protocol';

function writeU64(view: DataView, offset: number, value: bigint): void {
  view.setUint32(offset, Number((value >> 32n) & 0xffff_ffffn), false);
  view.setUint32(offset + 4, Number(value & 0xffff_ffffn), false);
}

function makeFrame(options: {
  readonly streamId?: number;
  readonly generation?: bigint;
  readonly deliverySequence?: bigint;
  readonly deliveryLoss?: number;
  readonly samples?: readonly {
    readonly acquisitionSequence: bigint;
    readonly timestampNs: bigint;
    readonly values: readonly number[];
    readonly quality: readonly number[];
  }[];
} = {}): Uint8Array {
  const samples = options.samples ?? [
    { acquisitionSequence: 41n, timestampNs: 9_007_199_254_740_993_125n, values: [800, 82.5], quality: [0, 2] },
    { acquisitionSequence: 42n, timestampNs: 9_007_199_254_760_993_125n, values: [815, 82.75], quality: [0, 0] },
  ];
  const channelCount = samples[0]?.values.length ?? 0;
  const sampleBytes = 20 + 9 * channelCount;
  const bytes = new Uint8Array(36 + samples.length * sampleBytes);
  const view = new DataView(bytes.buffer);
  bytes.set([0x45, 0x54, 0x4c, 0x4d], 0);
  view.setUint8(4, 1);
  const deliveryLoss = options.deliveryLoss ?? 0;
  view.setUint8(5, deliveryLoss === 0 ? 0 : 1);
  view.setUint16(6, 32, false);
  view.setUint32(8, options.streamId ?? 7, false);
  writeU64(view, 12, options.generation ?? 4n);
  writeU64(view, 20, options.deliverySequence ?? 9n);
  view.setUint16(28, samples.length, false);
  view.setUint16(30, channelCount, false);
  view.setUint32(32, deliveryLoss, false);

  let offset = 36;
  samples.forEach((sample, sampleIndex) => {
    if (sample.values.length !== channelCount || sample.quality.length !== channelCount) throw new Error('test frame channels differ');
    writeU64(view, offset, sample.acquisitionSequence);
    writeU64(view, offset + 8, sample.timestampNs);
    view.setUint32(offset + 16, sampleIndex === 0 ? deliveryLoss : 0, false);
    let valueOffset = offset + 20;
    for (const value of sample.values) {
      view.setFloat64(valueOffset, value, false);
      valueOffset += 8;
    }
    sample.quality.forEach((quality, index) => view.setUint8(valueOffset + index, quality));
    offset += sampleBytes;
  });
  return bytes;
}

function expectProtocolError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('Expected ShimProtocolError.');
  } catch (error) {
    expect(error).toBeInstanceOf(ShimProtocolError);
    expect((error as ShimProtocolError).code).toBe(code);
  }
}

describe('ts_shim epicefi-f64-v1 decoder', () => {
  it('decodes big-endian frame metadata, Float64 values, quality and exact uint64 timestamps', () => {
    const frame = decodeShimTelemetryFrame(makeFrame(), { streamId: 7, generation: 4, channelCount: 2 });

    expect(frame.streamId).toBe(7);
    expect(frame.generation).toBe(4n);
    expect(frame.deliverySequence).toBe(9n);
    expect(frame.channelCount).toBe(2);
    expect(frame.samples).toHaveLength(2);
    expect(frame.samples[0]?.acquisitionSequence).toBe(41n);
    expect(frame.samples[0]?.timestampNs).toBe(9_007_199_254_740_993_125n);
    expect([...frame.samples[0]!.values]).toEqual([800, 82.5]);
    expect([...frame.samples[0]!.quality]).toEqual([0, 2]);
    expect([...frame.samples[1]!.values]).toEqual([815, 82.75]);
  });

  it('preserves delivery loss in the header and first sample only', () => {
    const frame = decodeShimTelemetryFrame(makeFrame({ deliveryLoss: 3 }));
    expect(frame.flags).toBe(1);
    expect(frame.deliveryLoss).toBe(3);
    expect(frame.samples.map((sample) => sample.lossBefore)).toEqual([3, 0]);
  });

  it('rejects exact-length, flag and active-stream mismatches', () => {
    const valid = makeFrame();
    expectProtocolError(() => decodeShimTelemetryFrame(valid.subarray(0, valid.length - 1)), 'invalidTelemetryLength');

    const badFlags = valid.slice();
    badFlags[5] = 2;
    expectProtocolError(() => decodeShimTelemetryFrame(badFlags), 'invalidTelemetryFlags');

    expectProtocolError(() => decodeShimTelemetryFrame(valid, { streamId: 99 }), 'unexpectedTelemetryStream');
    expectProtocolError(() => decodeShimTelemetryFrame(valid, { generation: 5 }), 'unexpectedTelemetryGeneration');
    expectProtocolError(() => decodeShimTelemetryFrame(valid, { channelCount: 3 }), 'unexpectedTelemetryChannelCount');
  });

  it('rejects a loss flag that disagrees with the delivery-loss count', () => {
    const bytes = makeFrame({ deliveryLoss: 2 });
    bytes[5] = 0;
    expectProtocolError(() => decodeShimTelemetryFrame(bytes), 'invalidTelemetryLossFlag');
  });

  it('computes elapsed milliseconds without first narrowing absolute nanoseconds to Number', () => {
    const origin = 9_007_199_254_740_993_125n;
    const later = origin + 20_250_000n;
    expect(nanosecondsDeltaToMilliseconds(later, origin)).toBe(20.25);
  });
});
