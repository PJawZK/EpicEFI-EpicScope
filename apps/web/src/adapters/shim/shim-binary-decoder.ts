import { SHIM_TELEMETRY_ENCODING, ShimProtocolError } from './shim-protocol';

const MAGIC = [0x45, 0x54, 0x4c, 0x4d] as const; // ETLM
const VERSION = 1;
const HEADER_PREFIX_BYTES = 32;
const HEADER_TOTAL_BYTES = 36;
const LOSS_FLAG = 0x01;

export interface ShimTelemetrySample {
  readonly acquisitionSequence: bigint;
  readonly timestampNs: bigint;
  readonly lossBefore: number;
  readonly values: Float64Array;
  readonly quality: Uint8Array;
}

export interface ShimTelemetryFrame {
  readonly encoding: typeof SHIM_TELEMETRY_ENCODING;
  readonly streamId: number;
  readonly generation: bigint;
  readonly deliverySequence: bigint;
  readonly deliveryLoss: number;
  readonly flags: number;
  readonly channelCount: number;
  readonly samples: readonly ShimTelemetrySample[];
}

export interface ShimTelemetryFrameExpectation {
  readonly streamId?: number;
  readonly generation?: number | bigint;
  readonly channelCount?: number;
}

function readU64(view: DataView, offset: number): bigint {
  const high = BigInt(view.getUint32(offset, false));
  const low = BigInt(view.getUint32(offset + 4, false));
  return (high << 32n) | low;
}

function assertExactLength(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new ShimProtocolError('invalidTelemetryLength', `Telemetry frame length ${actual} does not match expected ${expected}.`);
  }
}

export function nanosecondsDeltaToMilliseconds(timestampNs: bigint, originNs: bigint): number {
  const delta = timestampNs - originNs;
  const wholeMs = delta / 1_000_000n;
  const remainderNs = delta % 1_000_000n;
  return Number(wholeMs) + Number(remainderNs) / 1_000_000;
}

export function decodeShimTelemetryFrame(
  bytes: Uint8Array,
  expected: ShimTelemetryFrameExpectation = {},
): ShimTelemetryFrame {
  if (bytes.byteLength < HEADER_TOTAL_BYTES) {
    throw new ShimProtocolError('truncatedTelemetryFrame', `Telemetry frame is only ${bytes.byteLength} bytes.`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < MAGIC.length; index += 1) {
    if (view.getUint8(index) !== MAGIC[index]) {
      throw new ShimProtocolError('invalidTelemetryMagic', 'Telemetry frame does not start with ETLM.');
    }
  }

  const version = view.getUint8(4);
  if (version !== VERSION) {
    throw new ShimProtocolError('unsupportedTelemetryVersion', `Unsupported telemetry binary version ${version}.`);
  }

  const flags = view.getUint8(5);
  if ((flags & ~LOSS_FLAG) !== 0) {
    throw new ShimProtocolError('invalidTelemetryFlags', `Telemetry frame has unsupported flags 0x${flags.toString(16)}.`);
  }

  const headerPrefixBytes = view.getUint16(6, false);
  if (headerPrefixBytes !== HEADER_PREFIX_BYTES) {
    throw new ShimProtocolError('invalidTelemetryHeader', `Telemetry header prefix length ${headerPrefixBytes} is not ${HEADER_PREFIX_BYTES}.`);
  }

  const streamId = view.getUint32(8, false);
  const generation = readU64(view, 12);
  const deliverySequence = readU64(view, 20);
  const sampleCount = view.getUint16(28, false);
  const channelCount = view.getUint16(30, false);
  const deliveryLoss = view.getUint32(32, false);

  if (sampleCount < 1) throw new ShimProtocolError('invalidTelemetrySampleCount', 'Telemetry frame must contain at least one sample.');
  if (channelCount < 1) throw new ShimProtocolError('invalidTelemetryChannelCount', 'Telemetry frame must contain at least one channel.');

  const lossFlagSet = (flags & LOSS_FLAG) !== 0;
  if (lossFlagSet !== (deliveryLoss !== 0)) {
    throw new ShimProtocolError('invalidTelemetryLossFlag', 'Telemetry loss flag does not agree with delivery-loss count.');
  }

  if (expected.streamId !== undefined && streamId !== expected.streamId) {
    throw new ShimProtocolError('unexpectedTelemetryStream', `Telemetry stream ${streamId} does not match active stream ${expected.streamId}.`);
  }
  if (expected.generation !== undefined && generation !== BigInt(expected.generation)) {
    throw new ShimProtocolError('unexpectedTelemetryGeneration', `Telemetry generation ${generation} does not match active generation ${expected.generation}.`);
  }
  if (expected.channelCount !== undefined && channelCount !== expected.channelCount) {
    throw new ShimProtocolError('unexpectedTelemetryChannelCount', `Telemetry channel count ${channelCount} does not match stream definition ${expected.channelCount}.`);
  }

  const sampleBytes = 20 + 9 * channelCount;
  const expectedLength = HEADER_TOTAL_BYTES + sampleCount * sampleBytes;
  assertExactLength(bytes.byteLength, expectedLength);

  const samples: ShimTelemetrySample[] = [];
  let offset = HEADER_TOTAL_BYTES;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const acquisitionSequence = readU64(view, offset);
    const timestampNs = readU64(view, offset + 8);
    const lossBefore = view.getUint32(offset + 16, false);
    if (sampleIndex === 0) {
      if (lossBefore !== deliveryLoss) {
        throw new ShimProtocolError('invalidTelemetryLossBefore', 'First sample lossBefore does not match frame delivery loss.');
      }
    } else if (lossBefore !== 0) {
      throw new ShimProtocolError('invalidTelemetryLossBefore', 'Only the first sample may carry a non-zero lossBefore value.');
    }

    const values = new Float64Array(channelCount);
    let valueOffset = offset + 20;
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      values[channelIndex] = view.getFloat64(valueOffset, false);
      valueOffset += 8;
    }

    const quality = new Uint8Array(channelCount);
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      quality[channelIndex] = view.getUint8(valueOffset + channelIndex);
    }

    samples.push({ acquisitionSequence, timestampNs, lossBefore, values, quality });
    offset += sampleBytes;
  }

  return {
    encoding: SHIM_TELEMETRY_ENCODING,
    streamId,
    generation,
    deliverySequence,
    deliveryLoss,
    flags,
    channelCount,
    samples,
  };
}
