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
const COUNTER_MODULUS = 255;

export interface MlgRecordIndex {
  readonly offsets: Float64Array;
  readonly timeMs: Float64Array;
  readonly counters: Uint8Array;
  readonly crcValid: Uint8Array;
}

export interface MlgRecordScanResult {
  readonly records: MlgRecordIndex;
  readonly markers: readonly LogMarker[];
  readonly diagnostics: readonly ParserDiagnostic[];
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

class ChunkedSourceReader {
  private readonly source: RandomAccessByteSource;
  private readonly chunkSize: number;
  private cachedOffset = -1;
  private cachedBytes = new Uint8Array(0);

  public constructor(source: RandomAccessByteSource, chunkSize = 256 * 1024) {
    this.source = source;
    this.chunkSize = chunkSize;
  }

  public async read(offset: number, length: number): Promise<Uint8Array> {
    if (length === 0) {
      return new Uint8Array(0);
    }
    if (offset < 0 || length < 0 || offset > this.source.size || length > this.source.size - offset) {
      throw new MlgFormatError(
        'short-read',
        `Read range [${offset}, ${offset + length}) exceeds MLG source size ${this.source.size}.`,
        offset,
      );
    }

    if (
      this.cachedOffset >= 0
      && offset >= this.cachedOffset
      && offset + length <= this.cachedOffset + this.cachedBytes.byteLength
    ) {
      const start = offset - this.cachedOffset;
      return this.cachedBytes.subarray(start, start + length);
    }

    if (length > this.chunkSize) {
      return this.source.read(offset, length);
    }

    const available = this.source.size - offset;
    const readLength = Math.min(this.chunkSize, available);
    this.cachedOffset = offset;
    this.cachedBytes = await this.source.read(offset, readLength);
    if (this.cachedBytes.byteLength !== readLength) {
      throw new MlgFormatError(
        'short-read',
        `Expected ${readLength} bytes at offset ${offset}, received ${this.cachedBytes.byteLength}.`,
        offset,
      );
    }
    return this.cachedBytes.subarray(0, length);
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

function calculateRecordCrc(recordBytes: Uint8Array): number {
  let crc = 0;
  for (const value of recordBytes) {
    crc = (crc + value) & 0xff;
  }
  return crc;
}

function counterDiagnostic(
  previousCounter: number | undefined,
  counter: number,
  offset: number,
): ParserDiagnostic | undefined {
  if (previousCounter === undefined) {
    return undefined;
  }
  const expected = (previousCounter + 1) % COUNTER_MODULUS;
  if (counter === expected) {
    return undefined;
  }
  return {
    code: 'mlg-counter-discontinuity',
    severity: 'warning',
    message: `MLG block counter expected ${expected}, found ${counter}.`,
    recoverable: true,
    offset,
  };
}

export async function scanMlgRecords(
  source: RandomAccessByteSource,
  header: MlgHeader,
): Promise<MlgRecordScanResult> {
  const reader = new ChunkedSourceReader(source);
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

  while (offset < source.size) {
    if (source.size - offset < BLOCK_HEADER_LENGTH) {
      throw new MlgFormatError(
        'short-read',
        `Truncated MLG block header at offset ${offset}.`,
        offset,
      );
    }

    const blockHeader = await reader.read(offset, BLOCK_HEADER_LENGTH);
    const blockType = blockHeader[0] ?? -1;
    const counter = blockHeader[1] ?? 0;
    const rawTimestamp = ((blockHeader[2] ?? 0) << 8) | (blockHeader[3] ?? 0);

    const discontinuity = counterDiagnostic(previousCounter, counter, offset + 1);
    if (discontinuity) {
      diagnostics.push(discontinuity);
    }
    previousCounter = counter;

    if (blockType === STANDARD_BLOCK_TYPE) {
      const blockLength = BLOCK_HEADER_LENGTH + header.recordLength + 1;
      if (blockLength > source.size - offset) {
        throw new MlgFormatError(
          'short-read',
          `Truncated MLG logger record at offset ${offset}.`,
          offset,
        );
      }

      const block = await reader.read(offset, blockLength);
      const recordBytes = block.subarray(BLOCK_HEADER_LENGTH, BLOCK_HEADER_LENGTH + header.recordLength);
      const expectedCrc = calculateRecordCrc(recordBytes);
      const actualCrc = block[blockLength - 1] ?? 0;
      const isCrcValid = expectedCrc === actualCrc;

      if (!isCrcValid) {
        diagnostics.push({
          code: 'mlg-crc-mismatch',
          severity: 'warning',
          message: `MLG record checksum expected ${expectedCrc}, found ${actualCrc}.`,
          recoverable: true,
          offset: offset + blockLength - 1,
        });
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

      offsets.push(offset);
      times.push((unwrappedTimestamp - firstUnwrappedTimestamp) * TIMESTAMP_TICK_MS);
      counters.push(counter);
      crcValid.push(isCrcValid ? 1 : 0);

      offset += blockLength;
      continue;
    }

    if (blockType === MARKER_BLOCK_TYPE) {
      if (MARKER_BLOCK_LENGTH > source.size - offset) {
        throw new MlgFormatError(
          'short-read',
          `Truncated MLG marker block at offset ${offset}.`,
          offset,
        );
      }
      const markerBytes = await reader.read(offset, MARKER_BLOCK_LENGTH);
      const epochAdjusted = timestampEpoch + rawTimestamp;
      const relativeTimeMs = firstUnwrappedTimestamp === undefined
        ? 0
        : Math.max(0, (epochAdjusted - firstUnwrappedTimestamp) * TIMESTAMP_TICK_MS);
      markers.push({
        timeMs: relativeTimeMs,
        label: decodeMarker(markerBytes),
      });
      offset += MARKER_BLOCK_LENGTH;
      continue;
    }

    throw new MlgFormatError(
      'unsupported-block-type',
      `Unsupported MLG block type ${blockType} at offset ${offset}.`,
      offset,
    );
  }

  return {
    records: {
      offsets: offsets.finish(),
      timeMs: times.finish(),
      counters: counters.finish(),
      crcValid: crcValid.finish(),
    },
    markers,
    diagnostics,
  };
}
