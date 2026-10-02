import type { LogMarker, ParserDiagnostic } from '../../log-model/log-types';
import type { RandomAccessByteSource } from '../byte-source';
import { MlgFormatError } from './mlg-errors';
import type { MlgHeader } from './mlg-format';

const STANDARD_BLOCK_TYPE = 0;
const MARKER_BLOCK_TYPE = 1;
const BLOCK_HEADER_LENGTH = 4;
const MARKER_BLOCK_LENGTH = 54;
const MARKER_MESSAGE_LENGTH = 50;
const TIMESTAMP_MODULUS = 65_536;
const TIMESTAMP_TICK_MS = 0.01;
const COUNTER_MODULUS = 256;
const SCAN_CHUNK_SIZE = 8 * 1024 * 1024;

export interface MlgRecordIndex {
  readonly offsets: Float64Array;
  readonly timeMs: Float64Array;
  readonly counters: Uint8Array;
  readonly crcValid: Uint8Array;
}

export interface MlgRecordScanPerformance {
  readonly sourceReadMs: number;
  readonly checksumBytes: number;
  readonly checksumCpuMs: number;
  readonly diagnosticCpuMs: number;
  readonly indexCpuMs: number;
}

export interface MlgRecordScanResult {
  readonly records: MlgRecordIndex;
  readonly markers: readonly LogMarker[];
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly performance: MlgRecordScanPerformance;
}

class GrowingFloat64Buffer {
  private values = new Float64Array(4096);
  private lengthValue = 0;

  public push(value: number): void {
    if (this.lengthValue === this.values.length) {
      const next = new Float64Array(this.values.length * 2);
      next.set(this.values);
      this.values = next;
    }
    this.values[this.lengthValue] = value;
    this.lengthValue += 1;
  }

  public finish(): Float64Array {
    return this.values.slice(0, this.lengthValue);
  }
}

class GrowingUint8Buffer {
  private values = new Uint8Array(4096);
  private lengthValue = 0;

  public push(value: number): void {
    if (this.lengthValue === this.values.length) {
      const next = new Uint8Array(this.values.length * 2);
      next.set(this.values);
      this.values = next;
    }
    this.values[this.lengthValue] = value;
    this.lengthValue += 1;
  }

  public finish(): Uint8Array {
    return this.values.slice(0, this.lengthValue);
  }
}

function decodeMarker(bytes: Uint8Array): string {
  const message = bytes.subarray(BLOCK_HEADER_LENGTH, BLOCK_HEADER_LENGTH + MARKER_MESSAGE_LENGTH);
  const zeroIndex = message.indexOf(0);
  const end = zeroIndex >= 0 ? zeroIndex : message.byteLength;
  let value = '';
  for (let index = 0; index < end; index += 1) {
    value += String.fromCharCode(message[index] ?? 0);
  }
  return value;
}

function calculateRecordCrcRange(
  bytes: Uint8Array,
  start: number,
  length: number,
): number {
  const end = start + length;
  let index = start;
  let sum = 0;

  // MLG's checksum is the low 8 bits of the payload-byte sum. Keep a wider
  // accumulator and unroll the hot loop so we avoid a mask, bounds/nullish
  // fallback and loop branch for every individual byte.
  const unrolledEnd = end - ((end - start) % 16);
  while (index < unrolledEnd) {
    sum +=
      bytes[index]! + bytes[index + 1]! + bytes[index + 2]! + bytes[index + 3]!
      + bytes[index + 4]! + bytes[index + 5]! + bytes[index + 6]! + bytes[index + 7]!
      + bytes[index + 8]! + bytes[index + 9]! + bytes[index + 10]! + bytes[index + 11]!
      + bytes[index + 12]! + bytes[index + 13]! + bytes[index + 14]! + bytes[index + 15]!;
    index += 16;
  }

  while (index < end) {
    sum += bytes[index]!;
    index += 1;
  }

  return sum & 0xff;
}

async function readChunk(
  source: RandomAccessByteSource,
  offset: number,
  minimumLength: number,
): Promise<Uint8Array> {
  const remaining = source.size - offset;
  if (remaining < minimumLength) {
    throw new MlgFormatError(
      'short-read',
      `Expected at least ${minimumLength} bytes at offset ${offset}, only ${remaining} remain.`,
      offset,
    );
  }
  const length = Math.min(remaining, Math.max(SCAN_CHUNK_SIZE, minimumLength));
  const bytes = await source.read(offset, length);
  if (bytes.byteLength !== length) {
    throw new MlgFormatError(
      'short-read',
      `Expected ${length} bytes at offset ${offset}, received ${bytes.byteLength}.`,
      offset,
    );
  }
  return bytes;
}

export async function scanMlgRecords(
  source: RandomAccessByteSource,
  header: MlgHeader,
): Promise<MlgRecordScanResult> {
  const offsets = new GrowingFloat64Buffer();
  const times = new GrowingFloat64Buffer();
  const counters = new GrowingUint8Buffer();
  const crcValid = new GrowingUint8Buffer();
  const markers: LogMarker[] = [];
  const diagnostics: ParserDiagnostic[] = [];

  let offset = header.dataBeginIndex;
  let previousCounter: number | undefined;
  let previousRawTimestamp: number | undefined;
  let timestampEpoch = 0;
  let firstUnwrappedTimestamp: number | undefined;
  let standardRecordIndex = 0;
  let sourceReadMs = 0;
  let checksumBytes = 0;
  let checksumSampleBytes = 0;
  let checksumSampleMs = 0;
  let diagnosticCpuMs = 0;
  const CHECKSUM_SAMPLE_INTERVAL = 256;
  const now = (): number => globalThis.performance?.now() ?? Date.now();
  const scanCpuStart = now();
  const recordLength = header.recordLength;
  const standardBlockLength = BLOCK_HEADER_LENGTH + recordLength + 1;

  // Parse many complete blocks synchronously from each source chunk. The old
  // scanner awaited two async reads per record even when both reads hit its
  // in-memory chunk cache. On a ~36k-record log that meant ~72k Promise/await
  // boundaries. This loop keeps the same bounded-memory model while reducing
  // source reads/awaits to roughly fileSize / SCAN_CHUNK_SIZE.
  while (offset < source.size) {
    const chunkStart = offset;
    const readStart = now();
    const chunk = await readChunk(source, chunkStart, BLOCK_HEADER_LENGTH);
    sourceReadMs += now() - readStart;
    let cursor = 0;

    while (cursor < chunk.byteLength) {
      const absoluteOffset = chunkStart + cursor;
      const bytesRemainingInFile = source.size - absoluteOffset;
      if (bytesRemainingInFile < BLOCK_HEADER_LENGTH) {
        throw new MlgFormatError(
          'short-read',
          `Truncated MLG block header at offset ${absoluteOffset}.`,
          absoluteOffset,
        );
      }

      if (chunk.byteLength - cursor < BLOCK_HEADER_LENGTH) break;

      const blockType = chunk[cursor] ?? -1;
      const counter = chunk[cursor + 1] ?? 0;
      const rawTimestamp = ((chunk[cursor + 2] ?? 0) << 8) | (chunk[cursor + 3] ?? 0);
      const blockLength = blockType === STANDARD_BLOCK_TYPE
        ? standardBlockLength
        : blockType === MARKER_BLOCK_TYPE
          ? MARKER_BLOCK_LENGTH
          : 0;

      if (blockLength === 0) {
        throw new MlgFormatError(
          'unsupported-block-type',
          `Unsupported MLG block type ${blockType} at offset ${absoluteOffset}.`,
          absoluteOffset,
        );
      }

      if (blockLength > bytesRemainingInFile) {
        throw new MlgFormatError(
          'short-read',
          blockType === STANDARD_BLOCK_TYPE
            ? `Truncated MLG logger record at offset ${absoluteOffset}.`
            : `Truncated MLG marker block at offset ${absoluteOffset}.`,
          absoluteOffset,
        );
      }

      if (chunk.byteLength - cursor < blockLength) {
        // Refill from the first incomplete block. This re-reads at most one
        // partial block at a chunk boundary and avoids per-record source calls.
        break;
      }

      if (previousCounter !== undefined) {
        const expectedCounter = (previousCounter + 1) % COUNTER_MODULUS;
        if (counter !== expectedCounter) {
          const diagnosticStart = now();
          diagnostics.push({
            code: 'mlg-counter-discontinuity',
            severity: 'warning',
            message: `MLG block counter expected ${expectedCounter}, found ${counter}.`,
            recoverable: true,
            offset: absoluteOffset + 1,
          });
          diagnosticCpuMs += now() - diagnosticStart;
        }
      }
      previousCounter = counter;

      if (blockType === STANDARD_BLOCK_TYPE) {
        const recordStart = cursor + BLOCK_HEADER_LENGTH;
        checksumBytes += recordLength;
        let expectedCrc: number;
        if (standardRecordIndex % CHECKSUM_SAMPLE_INTERVAL === 0) {
          const checksumStart = now();
          expectedCrc = calculateRecordCrcRange(chunk, recordStart, recordLength);
          checksumSampleMs += now() - checksumStart;
          checksumSampleBytes += recordLength;
        } else {
          expectedCrc = calculateRecordCrcRange(chunk, recordStart, recordLength);
        }
        const actualCrc = chunk[cursor + standardBlockLength - 1] ?? 0;
        const isCrcValid = expectedCrc === actualCrc;

        if (!isCrcValid) {
          const diagnosticStart = now();
          const blockHeaderSum = calculateRecordCrcRange(chunk, cursor, BLOCK_HEADER_LENGTH);
          const headerInclusiveCrc = (expectedCrc + blockHeaderSum) & 0xff;
          const checksumDelta = (actualCrc - expectedCrc + 256) & 0xff;
          diagnostics.push({
            code: 'mlg-crc-mismatch',
            severity: 'warning',
            message: `MLG record ${standardRecordIndex.toLocaleString()} checksum expected ${expectedCrc}, found ${actualCrc}; delta ${checksumDelta}; counter ${counter}; timestamp ${rawTimestamp}; header-inclusive candidate ${headerInclusiveCrc}.`,
            recoverable: true,
            offset: absoluteOffset + blockLength - 1,
          });
          diagnosticCpuMs += now() - diagnosticStart;
        }

        if (
          previousRawTimestamp !== undefined
          && rawTimestamp < previousRawTimestamp
          && previousRawTimestamp - rawTimestamp > TIMESTAMP_MODULUS / 2
        ) {
          timestampEpoch += TIMESTAMP_MODULUS;
        }
        previousRawTimestamp = rawTimestamp;

        const unwrappedTimestamp = timestampEpoch + rawTimestamp;
        firstUnwrappedTimestamp ??= unwrappedTimestamp;

        offsets.push(absoluteOffset);
        times.push((unwrappedTimestamp - firstUnwrappedTimestamp) * TIMESTAMP_TICK_MS);
        counters.push(counter);
        crcValid.push(isCrcValid ? 1 : 0);
        standardRecordIndex += 1;
      } else {
        const epochAdjusted = timestampEpoch + rawTimestamp;
        const relativeTimeMs = firstUnwrappedTimestamp === undefined
          ? 0
          : Math.max(0, (epochAdjusted - firstUnwrappedTimestamp) * TIMESTAMP_TICK_MS);
        markers.push({
          timeMs: relativeTimeMs,
          label: decodeMarker(chunk.subarray(cursor, cursor + blockLength)),
        });
      }

      cursor += blockLength;
      offset = chunkStart + cursor;
    }

  }

  const scanCpuElapsedMs = Math.max(0, now() - scanCpuStart - sourceReadMs);
  const checksumCpuMs = checksumSampleBytes > 0
    ? checksumSampleMs * (checksumBytes / checksumSampleBytes)
    : 0;
  const indexCpuMs = Math.max(0, scanCpuElapsedMs - checksumCpuMs - diagnosticCpuMs);

  return {
    records: {
      offsets: offsets.finish(),
      timeMs: times.finish(),
      counters: counters.finish(),
      crcValid: crcValid.finish(),
    },
    markers,
    diagnostics,
    performance: {
      sourceReadMs,
      checksumBytes,
      checksumCpuMs,
      diagnosticCpuMs,
      indexCpuMs,
    },
  };
}
