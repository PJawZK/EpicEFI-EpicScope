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
  readonly scanMode: 'fixed' | 'general';
  readonly sourceReadMs: number;
  readonly checksumBytes: number;
  readonly checksumCpuMs: number;
  readonly checksumBenchmarkMs: number;
  readonly diagnosticCpuMs: number;
  readonly indexCpuMs: number;
}

export interface MlgRecordScanResult {
  readonly records: MlgRecordIndex;
  readonly markers: readonly LogMarker[];
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly performance: MlgRecordScanPerformance;
}

export interface MlgRecordScanOptions {
  readonly validateCrc?: boolean;
}

export interface MlgCrcValidationPerformance {
  readonly totalMs: number;
  readonly sourceReadMs: number;
  readonly checksumCpuMs: number;
  readonly diagnosticCpuMs: number;
  readonly checksumBytes: number;
}

export interface MlgCrcValidationResult {
  readonly crcValid: Uint8Array;
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly performance: MlgCrcValidationPerformance;
}

export interface MlgDiagnosticClassification {
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly recoveredRetryCount: number;
  readonly unrecoveredInvalidCount: number;
  readonly counterRetryPatternCount: number;
}

export function classifyMlgRetryDiagnostics(
  recordIndex: MlgRecordIndex,
  crcValid: Uint8Array,
  diagnostics: readonly ParserDiagnostic[],
  recordLength: number,
): MlgDiagnosticClassification {
  const blockLength = BLOCK_HEADER_LENGTH + recordLength + 1;
  const recoveredInvalidIndices = new Set<number>();
  const retryCounterOffsets = new Set<number>();
  const recoveredCrcOffsets = new Set<number>();
  const counterPatternOffsets = new Set<number>();
  const counterPatternDiagnostics: ParserDiagnostic[] = [];
  let invalidCount = 0;

  for (let index = 0; index < crcValid.length; index += 1) {
    if (crcValid[index] !== 0) continue;
    invalidCount += 1;

    const nextIndex = index + 1;
    if (nextIndex >= crcValid.length || crcValid[nextIndex] !== 1) continue;

    const counter = recordIndex.counters[index];
    const nextCounter = recordIndex.counters[nextIndex];
    if (counter === undefined || nextCounter === undefined || counter !== nextCounter) continue;

    const invalidOffset = recordIndex.offsets[index];
    const retryOffset = recordIndex.offsets[nextIndex];
    if (invalidOffset === undefined || retryOffset === undefined) continue;

    recoveredInvalidIndices.add(index);
    // Both the invalid attempt and its valid same-counter retry can generate
    // counter discontinuities. The CRC retry diagnostic is the more precise
    // evidence, so suppress both redundant counter warnings.
    retryCounterOffsets.add(invalidOffset + 1);
    retryCounterOffsets.add(retryOffset + 1);
    recoveredCrcOffsets.add(invalidOffset + blockLength - 1);
  }

  for (let index = 1; index + 1 < recordIndex.counters.length; index += 1) {
    if (crcValid[index] !== 1 || crcValid[index + 1] !== 1) continue;

    const previousCounter = recordIndex.counters[index - 1];
    const counter = recordIndex.counters[index];
    const repeatedCounter = recordIndex.counters[index + 1];
    const offset = recordIndex.offsets[index];
    const repeatedOffset = recordIndex.offsets[index + 1];
    if (
      previousCounter === undefined
      || counter === undefined
      || repeatedCounter === undefined
      || offset === undefined
      || repeatedOffset === undefined
    ) continue;

    const expected = (previousCounter + 1) % COUNTER_MODULUS;
    const jumped = (previousCounter + 2) % COUNTER_MODULUS;
    if (counter !== jumped || repeatedCounter !== counter) continue;

    const firstCounterOffset = offset + 1;
    const repeatedCounterOffset = repeatedOffset + 1;
    counterPatternOffsets.add(firstCounterOffset);
    counterPatternOffsets.add(repeatedCounterOffset);
    counterPatternDiagnostics.push({
      code: 'mlg-counter-retry-pattern',
      severity: 'info',
      message: `MLG counter skipped ${expected} and then repeated ${counter} on the next CRC-valid record. Classified as a retry-like counter pattern; both source records remain valid and unchanged.`,
      recoverable: true,
      offset: firstCounterOffset,
    });
  }

  const classified: ParserDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    if (
      diagnostic.code === 'mlg-counter-discontinuity'
      && diagnostic.offset !== undefined
      && (
        retryCounterOffsets.has(diagnostic.offset)
        || counterPatternOffsets.has(diagnostic.offset)
      )
    ) {
      continue;
    }

    if (
      diagnostic.code === 'mlg-crc-mismatch'
      && diagnostic.offset !== undefined
      && recoveredCrcOffsets.has(diagnostic.offset)
    ) {
      classified.push({
        ...diagnostic,
        code: 'mlg-crc-retry-recovered',
        severity: 'info',
        message: `${diagnostic.message} A following valid record repeats the same block counter, indicating a recovered retry; the invalid attempt remains excluded from trusted data.`,
      });
      continue;
    }

    classified.push(diagnostic);
  }

  classified.push(...counterPatternDiagnostics);

  const recoveredRetryCount = recoveredInvalidIndices.size;
  const unrecoveredInvalidCount = Math.max(0, invalidCount - recoveredRetryCount);
  const counterRetryPatternCount = counterPatternDiagnostics.length;
  if (counterRetryPatternCount > 0) {
    classified.unshift({
      code: 'mlg-counter-pattern-summary',
      severity: 'info',
      message: `MLG counter classification: ${counterRetryPatternCount.toLocaleString()} CRC-valid jump-and-repeat pattern${counterRetryPatternCount === 1 ? '' : 's'} classified as retry-like counter behavior. Source records remain valid and unchanged.`,
      recoverable: true,
    });
  }

  if (invalidCount > 0) {
    classified.unshift({
      code: 'mlg-retry-recovery-summary',
      severity: unrecoveredInvalidCount > 0 ? 'warning' : 'info',
      message: `MLG CRC classification: ${recoveredRetryCount.toLocaleString()} invalid record${recoveredRetryCount === 1 ? '' : 's'} followed by a valid same-counter retry; ${unrecoveredInvalidCount.toLocaleString()} invalid record${unrecoveredInvalidCount === 1 ? '' : 's'} not recovered by an immediate same-counter retry. Invalid attempts remain retained as source evidence and excluded from trusted samples.`,
      recoverable: true,
    });
  }

  return {
    diagnostics: classified,
    recoveredRetryCount,
    unrecoveredInvalidCount,
    counterRetryPatternCount,
  };
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

export function calculateMlgRecordChecksum(
  bytes: Uint8Array,
  start: number,
  length: number,
): number {
  const end = start + length;
  let index = start;
  let sum0 = 0;
  let sum1 = 0;
  let sum2 = 0;
  let sum3 = 0;

  // Four independent accumulators shorten the dependency chain in the hottest
  // parser loop. MLG only needs the low 8 bits of the complete payload sum.
  const unrolledEnd = end - ((end - start) % 32);
  while (index < unrolledEnd) {
    sum0 += bytes[index]! + bytes[index + 4]! + bytes[index + 8]! + bytes[index + 12]!
      + bytes[index + 16]! + bytes[index + 20]! + bytes[index + 24]! + bytes[index + 28]!;
    sum1 += bytes[index + 1]! + bytes[index + 5]! + bytes[index + 9]! + bytes[index + 13]!
      + bytes[index + 17]! + bytes[index + 21]! + bytes[index + 25]! + bytes[index + 29]!;
    sum2 += bytes[index + 2]! + bytes[index + 6]! + bytes[index + 10]! + bytes[index + 14]!
      + bytes[index + 18]! + bytes[index + 22]! + bytes[index + 26]! + bytes[index + 30]!;
    sum3 += bytes[index + 3]! + bytes[index + 7]! + bytes[index + 11]! + bytes[index + 15]!
      + bytes[index + 19]! + bytes[index + 23]! + bytes[index + 27]! + bytes[index + 31]!;
    index += 32;
  }

  let sum = sum0 + sum1 + sum2 + sum3;
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


function benchmarkChecksumCpu(
  chunk: Uint8Array | undefined,
  recordStarts: readonly number[],
  recordLength: number,
  checksumBytes: number,
  now: () => number,
): { checksumCpuMs: number; checksumBenchmarkMs: number } {
  const targetBytes = 2 * 1024 * 1024;
  if (!chunk || recordStarts.length === 0 || recordLength <= 0) {
    return { checksumCpuMs: 0, checksumBenchmarkMs: 0 };
  }

  const repeats = Math.max(
    1,
    Math.ceil(targetBytes / (recordStarts.length * recordLength)),
  );
  let benchmarkBytes = 0;
  let sink = 0;
  const started = now();
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    for (const recordStart of recordStarts) {
      sink ^= calculateMlgRecordChecksum(chunk, recordStart, recordLength);
      benchmarkBytes += recordLength;
    }
  }
  const checksumBenchmarkMs = now() - started;
  if (sink === -1) throw new Error('Unreachable checksum benchmark sink.');
  return {
    checksumCpuMs: benchmarkBytes > 0
      ? checksumBenchmarkMs * (checksumBytes / benchmarkBytes)
      : 0,
    checksumBenchmarkMs,
  };
}

async function tryScanFixedRecords(
  source: RandomAccessByteSource,
  header: MlgHeader,
  validateCrc: boolean,
): Promise<MlgRecordScanResult | undefined> {
  const now = (): number => globalThis.performance?.now() ?? Date.now();
  const recordLength = header.recordLength;
  const blockLength = BLOCK_HEADER_LENGTH + recordLength + 1;
  const dataLength = source.size - header.dataBeginIndex;

  if (recordLength <= 0 || dataLength < 0 || dataLength % blockLength !== 0) {
    return undefined;
  }

  const recordCount = dataLength / blockLength;
  const offsets = new Float64Array(recordCount);
  const times = new Float64Array(recordCount);
  const counters = new Uint8Array(recordCount);
  const crcValid = new Uint8Array(recordCount);
  const diagnostics: ParserDiagnostic[] = [];

  let previousCounter: number | undefined;
  let previousRawTimestamp: number | undefined;
  let timestampEpoch = 0;
  let firstUnwrappedTimestamp: number | undefined;
  let sourceReadMs = 0;
  let diagnosticCpuMs = 0;
  const checksumBytes = validateCrc ? recordCount * recordLength : 0;
  const benchmarkStarts: number[] = [];
  let benchmarkChunk: Uint8Array | undefined;
  const benchmarkRecordLimit = 128;
  const recordsPerChunk = Math.max(1, Math.floor(SCAN_CHUNK_SIZE / blockLength));
  const scanCpuStart = now();

  for (let batchFirst = 0; batchFirst < recordCount; batchFirst += recordsPerChunk) {
    const batchCount = Math.min(recordsPerChunk, recordCount - batchFirst);
    const chunkOffset = header.dataBeginIndex + batchFirst * blockLength;
    const chunkLength = batchCount * blockLength;
    const readStart = now();
    const chunk = await source.read(chunkOffset, chunkLength);
    sourceReadMs += now() - readStart;
    if (chunk.byteLength !== chunkLength) {
      throw new MlgFormatError(
        'short-read',
        `Expected ${chunkLength} bytes at offset ${chunkOffset}, received ${chunk.byteLength}.`,
        chunkOffset,
      );
    }

    benchmarkChunk ??= chunk;

    for (let localIndex = 0; localIndex < batchCount; localIndex += 1) {
      const recordIndex = batchFirst + localIndex;
      const cursor = localIndex * blockLength;
      const absoluteOffset = chunkOffset + cursor;

      // A single non-standard block means this is not a fixed-record log.
      // Fall back to the mixed-block scanner so marker/error behavior remains
      // authoritative and unchanged.
      if ((chunk[cursor] ?? -1) !== STANDARD_BLOCK_TYPE) return undefined;

      const counter = chunk[cursor + 1] ?? 0;
      const rawTimestamp = ((chunk[cursor + 2] ?? 0) << 8) | (chunk[cursor + 3] ?? 0);

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

      let isCrcValid = true;
      if (validateCrc) {
        const recordStart = cursor + BLOCK_HEADER_LENGTH;
        if (chunk === benchmarkChunk && benchmarkStarts.length < benchmarkRecordLimit) {
          benchmarkStarts.push(recordStart);
        }
        const expectedCrc = calculateMlgRecordChecksum(chunk, recordStart, recordLength);
        const actualCrc = chunk[cursor + blockLength - 1] ?? 0;
        isCrcValid = expectedCrc === actualCrc;

        if (!isCrcValid) {
          const diagnosticStart = now();
          const blockHeaderSum = calculateMlgRecordChecksum(chunk, cursor, BLOCK_HEADER_LENGTH);
          const headerInclusiveCrc = (expectedCrc + blockHeaderSum) & 0xff;
          const checksumDelta = (actualCrc - expectedCrc + 256) & 0xff;
          diagnostics.push({
            code: 'mlg-crc-mismatch',
            severity: 'warning',
            message: `MLG record ${recordIndex.toLocaleString()} checksum expected ${expectedCrc}, found ${actualCrc}; delta ${checksumDelta}; counter ${counter}; timestamp ${rawTimestamp}; header-inclusive candidate ${headerInclusiveCrc}.`,
            recoverable: true,
            offset: absoluteOffset + blockLength - 1,
          });
          diagnosticCpuMs += now() - diagnosticStart;
        }
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

      offsets[recordIndex] = absoluteOffset;
      times[recordIndex] = (unwrappedTimestamp - firstUnwrappedTimestamp) * TIMESTAMP_TICK_MS;
      counters[recordIndex] = counter;
      crcValid[recordIndex] = isCrcValid ? 1 : 0;
    }
  }

  const scanCpuElapsedMs = Math.max(0, now() - scanCpuStart - sourceReadMs);
  const benchmark = benchmarkChecksumCpu(
    benchmarkChunk,
    benchmarkStarts,
    recordLength,
    checksumBytes,
    now,
  );

  return {
    records: { offsets, timeMs: times, counters, crcValid },
    markers: [],
    diagnostics,
    performance: {
      scanMode: 'fixed',
      sourceReadMs,
      checksumBytes,
      checksumCpuMs: benchmark.checksumCpuMs,
      checksumBenchmarkMs: benchmark.checksumBenchmarkMs,
      diagnosticCpuMs,
      indexCpuMs: Math.max(0, scanCpuElapsedMs - benchmark.checksumCpuMs - diagnosticCpuMs),
    },
  };
}

async function scanMlgRecordsGeneral(
  source: RandomAccessByteSource,
  header: MlgHeader,
  validateCrc: boolean,
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
  let diagnosticCpuMs = 0;
  let checksumBenchmarkChunk: Uint8Array | undefined;
  const checksumBenchmarkStarts: number[] = [];
  const CHECKSUM_BENCHMARK_RECORDS = 128;
  const CHECKSUM_BENCHMARK_TARGET_BYTES = 2 * 1024 * 1024;
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
    checksumBenchmarkChunk ??= chunk;
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
        let isCrcValid = true;
        if (validateCrc) {
          const recordStart = cursor + BLOCK_HEADER_LENGTH;
          checksumBytes += recordLength;
          if (
            chunk === checksumBenchmarkChunk
            && checksumBenchmarkStarts.length < CHECKSUM_BENCHMARK_RECORDS
          ) {
            checksumBenchmarkStarts.push(recordStart);
          }
          const expectedCrc = calculateMlgRecordChecksum(chunk, recordStart, recordLength);
          const actualCrc = chunk[cursor + standardBlockLength - 1] ?? 0;
          isCrcValid = expectedCrc === actualCrc;

          if (!isCrcValid) {
            const diagnosticStart = now();
            const blockHeaderSum = calculateMlgRecordChecksum(chunk, cursor, BLOCK_HEADER_LENGTH);
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

  // Benchmark checksum throughput in one timing window after the real scan.
  // The checksum function is already JIT-hot at this point, and batching a
  // few MiB avoids extrapolating sub-millisecond single-record samples.
  let checksumBenchmarkMs = 0;
  let checksumBenchmarkBytes = 0;
  let checksumBenchmarkSink = 0;
  if (checksumBenchmarkChunk && checksumBenchmarkStarts.length > 0) {
    const repeats = Math.max(
      1,
      Math.ceil(
        CHECKSUM_BENCHMARK_TARGET_BYTES
        / (checksumBenchmarkStarts.length * recordLength),
      ),
    );
    const checksumBenchmarkStart = now();
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      for (const recordStart of checksumBenchmarkStarts) {
        checksumBenchmarkSink ^= calculateMlgRecordChecksum(
          checksumBenchmarkChunk,
          recordStart,
          recordLength,
        );
        checksumBenchmarkBytes += recordLength;
      }
    }
    checksumBenchmarkMs = now() - checksumBenchmarkStart;
  }
  // Keep the benchmark result observable so engines cannot discard the work.
  if (checksumBenchmarkSink === -1) diagnostics.length += 0;

  const checksumCpuMs = checksumBenchmarkBytes > 0
    ? checksumBenchmarkMs * (checksumBytes / checksumBenchmarkBytes)
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
      scanMode: 'general',
      sourceReadMs,
      checksumBytes,
      checksumCpuMs,
      checksumBenchmarkMs,
      diagnosticCpuMs,
      indexCpuMs,
    },
  };
}


export async function scanMlgRecords(
  source: RandomAccessByteSource,
  header: MlgHeader,
  options: MlgRecordScanOptions = {},
): Promise<MlgRecordScanResult> {
  const validateCrc = options.validateCrc ?? true;
  const fixed = await tryScanFixedRecords(source, header, validateCrc);
  const result = fixed ?? await scanMlgRecordsGeneral(source, header, validateCrc);

  if (!validateCrc) return result;

  const classified = classifyMlgRetryDiagnostics(
    result.records,
    result.records.crcValid,
    result.diagnostics,
    header.recordLength,
  );
  return {
    ...result,
    diagnostics: classified.diagnostics,
  };
}


export async function validateMlgRecordCrc(
  source: RandomAccessByteSource,
  header: MlgHeader,
  recordIndex: MlgRecordIndex,
): Promise<MlgCrcValidationResult> {
  const now = (): number => globalThis.performance?.now() ?? Date.now();
  const totalStart = now();
  const crcValid = new Uint8Array(recordIndex.offsets.length);
  const diagnostics: ParserDiagnostic[] = [];
  const recordLength = header.recordLength;
  const blockLength = BLOCK_HEADER_LENGTH + recordLength + 1;
  let sourceReadMs = 0;
  let diagnosticCpuMs = 0;
  let checksumBytes = 0;

  let sampleIndex = 0;
  while (sampleIndex < recordIndex.offsets.length) {
    const firstOffset = recordIndex.offsets[sampleIndex];
    if (firstOffset === undefined) {
      throw new RangeError(`Missing record offset for sample ${sampleIndex}.`);
    }

    let lastIndex = sampleIndex;
    let batchEnd = firstOffset + blockLength;
    while (lastIndex + 1 < recordIndex.offsets.length) {
      const nextOffset = recordIndex.offsets[lastIndex + 1];
      if (nextOffset === undefined) break;
      const nextEnd = nextOffset + blockLength;
      if (nextEnd - firstOffset > SCAN_CHUNK_SIZE) break;
      lastIndex += 1;
      batchEnd = nextEnd;
    }

    const readStart = now();
    const bytes = await source.read(firstOffset, batchEnd - firstOffset);
    sourceReadMs += now() - readStart;

    for (let index = sampleIndex; index <= lastIndex; index += 1) {
      const absoluteOffset = recordIndex.offsets[index];
      if (absoluteOffset === undefined) continue;
      const relativeOffset = absoluteOffset - firstOffset;
      const recordStart = relativeOffset + BLOCK_HEADER_LENGTH;
      checksumBytes += recordLength;
      const expectedCrc = calculateMlgRecordChecksum(bytes, recordStart, recordLength);
      const actualCrc = bytes[relativeOffset + blockLength - 1] ?? 0;
      const valid = expectedCrc === actualCrc;
      crcValid[index] = valid ? 1 : 0;

      if (!valid) {
        const diagnosticStart = now();
        const counter = bytes[relativeOffset + 1] ?? 0;
        const rawTimestamp = ((bytes[relativeOffset + 2] ?? 0) << 8)
          | (bytes[relativeOffset + 3] ?? 0);
        const blockHeaderSum = calculateMlgRecordChecksum(
          bytes,
          relativeOffset,
          BLOCK_HEADER_LENGTH,
        );
        const headerInclusiveCrc = (expectedCrc + blockHeaderSum) & 0xff;
        const checksumDelta = (actualCrc - expectedCrc + 256) & 0xff;
        diagnostics.push({
          code: 'mlg-crc-mismatch',
          severity: 'warning',
          message: `MLG record ${index.toLocaleString()} checksum expected ${expectedCrc}, found ${actualCrc}; delta ${checksumDelta}; counter ${counter}; timestamp ${rawTimestamp}; header-inclusive candidate ${headerInclusiveCrc}.`,
          recoverable: true,
          offset: absoluteOffset + blockLength - 1,
        });
        diagnosticCpuMs += now() - diagnosticStart;
      }
    }

    sampleIndex = lastIndex + 1;
  }

  const totalMs = now() - totalStart;
  return {
    crcValid,
    diagnostics,
    performance: {
      totalMs,
      sourceReadMs,
      checksumCpuMs: Math.max(0, totalMs - sourceReadMs - diagnosticCpuMs),
      diagnosticCpuMs,
      checksumBytes,
    },
  };
}
