import type { LogTimeRange, ParserDiagnostic } from '../../../../core/log-model/log-types';
import { parseMlgHeader } from '../../../../core/parsers/mlg/mlg-header';
import type { MlgHeader } from '../../../../core/parsers/mlg/mlg-format';
import {
  classifyMlgRetryDiagnostics,
  scanMlgRecords,
} from '../../../../core/parsers/mlg/mlg-records';
import type {
  MlgCrcValidationPerformance,
  MlgCrcValidationResult,
  MlgRecordIndex,
} from '../../../../core/parsers/mlg/mlg-records';
import { BlobByteSource } from '../adapters/blob-byte-source';
import type {
  MlgWorkerRequest,
  MlgWorkerResponse,
} from './mlg-worker-protocol';

interface WorkerScope {
  onmessage: ((event: MessageEvent<MlgWorkerRequest>) => void) | null;
  postMessage(message: MlgWorkerResponse): void;
}

interface ValidationBatch {
  readonly firstIndex: number;
  readonly lastIndex: number;
  readonly firstOffset: number;
  readonly byteLength: number;
  readonly relativeOffsets: Float64Array;
}

interface ReadBatchResult {
  readonly batch: ValidationBatch;
  readonly buffer: ArrayBuffer;
  readonly readMs: number;
}

interface CrcChunkResult {
  readonly type: 'chunk-result';
  readonly chunkId: number;
  readonly firstIndex: number;
  readonly crcValid: Uint8Array;
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly checksumCpuMs: number;
  readonly diagnosticCpuMs: number;
  readonly checksumBytes: number;
}

interface CrcChunkError {
  readonly type: 'error';
  readonly chunkId: number;
  readonly message: string;
}

type CrcWorkerResponse = CrcChunkResult | CrcChunkError;

const scope = globalThis as unknown as WorkerScope;
const now = (): number => globalThis.performance?.now() ?? Date.now();
const BLOCK_HEADER_LENGTH = 4;
const VALIDATION_CHUNK_SIZE = 32 * 1024 * 1024;
let validationStartResolver: (() => void) | undefined;
let validationStartRequested = false;

function timeRange(timeMs: Float64Array): LogTimeRange | undefined {
  if (timeMs.length === 0) return undefined;
  const startMs = timeMs[0] ?? 0;
  const endMs = timeMs[timeMs.length - 1] ?? startMs;
  return {
    startMs,
    endMs,
    durationMs: Math.max(0, endMs - startMs),
  };
}

function planValidationBatch(
  recordIndex: MlgRecordIndex,
  blockLength: number,
  firstIndex: number,
): ValidationBatch {
  const firstOffset = recordIndex.offsets[firstIndex];
  if (firstOffset === undefined) {
    throw new RangeError(`Missing record offset for sample ${firstIndex}.`);
  }

  let lastIndex = firstIndex;
  let batchEnd = firstOffset + blockLength;
  while (lastIndex + 1 < recordIndex.offsets.length) {
    const nextOffset = recordIndex.offsets[lastIndex + 1];
    if (nextOffset === undefined) break;
    const nextEnd = nextOffset + blockLength;
    if (nextEnd - firstOffset > VALIDATION_CHUNK_SIZE) break;
    lastIndex += 1;
    batchEnd = nextEnd;
  }

  const relativeOffsets = new Float64Array(lastIndex - firstIndex + 1);
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const absoluteOffset = recordIndex.offsets[index];
    if (absoluteOffset === undefined) {
      throw new RangeError(`Missing record offset for sample ${index}.`);
    }
    relativeOffsets[index - firstIndex] = absoluteOffset - firstOffset;
  }

  return {
    firstIndex,
    lastIndex,
    firstOffset,
    byteLength: batchEnd - firstOffset,
    relativeOffsets,
  };
}

async function readValidationBatch(file: File, batch: ValidationBatch): Promise<ReadBatchResult> {
  const started = now();
  const buffer = await file.slice(batch.firstOffset, batch.firstOffset + batch.byteLength).arrayBuffer();
  const readMs = now() - started;
  if (buffer.byteLength !== batch.byteLength) {
    throw new RangeError(
      `CRC validation expected ${batch.byteLength} bytes at offset ${batch.firstOffset}, received ${buffer.byteLength}.`,
    );
  }
  return { batch, buffer, readMs };
}

async function validateMlgRecordCrcParallel(
  file: File,
  header: MlgHeader,
  recordIndex: MlgRecordIndex,
): Promise<MlgCrcValidationResult> {
  const totalStart = now();
  const recordLength = header.recordLength;
  const blockLength = BLOCK_HEADER_LENGTH + recordLength + 1;
  const crcValid = new Uint8Array(recordIndex.offsets.length);
  const diagnostics: ParserDiagnostic[] = [];
  let sourceReadMs = 0;
  let checksumCpuMs = 0;
  let diagnosticCpuMs = 0;
  let checksumBytes = 0;
  let chunkId = 0;

  const checksumWorker = new Worker(
    new URL('./mlg-crc.worker.ts', import.meta.url),
    { type: 'module' },
  );

  let pendingResolve: ((result: CrcChunkResult) => void) | undefined;
  let pendingReject: ((reason?: unknown) => void) | undefined;

  checksumWorker.onmessage = (event: MessageEvent<CrcWorkerResponse>): void => {
    const response = event.data;
    if (response.type === 'error') {
      pendingReject?.(new Error(response.message));
      pendingResolve = undefined;
      pendingReject = undefined;
      return;
    }
    pendingResolve?.(response);
    pendingResolve = undefined;
    pendingReject = undefined;
  };
  checksumWorker.onerror = (event): void => {
    pendingReject?.(new Error(event.message || 'CRC checksum worker failed.'));
    pendingResolve = undefined;
    pendingReject = undefined;
  };

  const checksumChunk = (read: ReadBatchResult): Promise<CrcChunkResult> => {
    if (pendingResolve || pendingReject) {
      return Promise.reject(new Error('CRC checksum worker already has an in-flight chunk.'));
    }
    const id = chunkId;
    chunkId += 1;
    return new Promise<CrcChunkResult>((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
      checksumWorker.postMessage({
        type: 'checksum-chunk',
        chunkId: id,
        firstIndex: read.batch.firstIndex,
        firstOffset: read.batch.firstOffset,
        recordLength,
        relativeOffsets: read.batch.relativeOffsets,
        buffer: read.buffer,
      }, [read.batch.relativeOffsets.buffer, read.buffer]);
    });
  };

  try {
    let nextIndex = 0;
    let pendingRead: Promise<ReadBatchResult> | undefined = recordIndex.offsets.length > 0
      ? readValidationBatch(file, planValidationBatch(recordIndex, blockLength, 0))
      : undefined;

    while (pendingRead) {
      const current = await pendingRead;
      sourceReadMs += current.readMs;

      nextIndex = current.batch.lastIndex + 1;
      const nextRead = nextIndex < recordIndex.offsets.length
        ? readValidationBatch(file, planValidationBatch(recordIndex, blockLength, nextIndex))
        : undefined;

      const result = await checksumChunk(current);
      crcValid.set(result.crcValid, result.firstIndex);
      diagnostics.push(...result.diagnostics);
      checksumCpuMs += result.checksumCpuMs;
      diagnosticCpuMs += result.diagnosticCpuMs;
      checksumBytes += result.checksumBytes;

      pendingRead = nextRead;
    }
  } finally {
    checksumWorker.terminate();
  }

  const performance: MlgCrcValidationPerformance = {
    totalMs: now() - totalStart,
    sourceReadMs,
    checksumCpuMs,
    diagnosticCpuMs,
    checksumBytes,
  };
  return { crcValid, diagnostics, performance };
}

scope.onmessage = (event): void => {
  if (event.data.type === 'start-validation') {
    validationStartRequested = true;
    validationStartResolver?.();
    return;
  }
  if (event.data.type !== 'import') return;

  const importRequest = event.data;
  validationStartRequested = false;
  validationStartResolver = undefined;

  void (async () => {
    const started = now();
    const source = new BlobByteSource(importRequest.file);

    try {
      const headerPhysicalStart = source.performanceSnapshot().physicalReadMs;
      const headerStart = now();
      const headerResult = await parseMlgHeader(source);
      const headerMs = now() - headerStart;
      const headerReadMs = Math.max(
        0,
        source.performanceSnapshot().physicalReadMs - headerPhysicalStart,
      );
      const headerCpuMs = Math.max(0, headerMs - headerReadMs);

      const scanStart = now();
      const scanResult = await scanMlgRecords(
        source,
        headerResult.header,
        { validateCrc: false },
      );
      const recordScanMs = now() - scanStart;

      const finalizeStart = now();
      const range = timeRange(scanResult.records.timeMs);
      const finalizeMs = now() - finalizeStart;

      scope.postMessage({
        type: 'indexed',
        payload: {
          summary: {
            source: importRequest.sourceIdentity,
            channels: headerResult.channels,
            diagnostics: scanResult.diagnostics,
            markers: scanResult.markers,
            ...(range ? { timeRange: range } : {}),
          },
          header: headerResult.header,
          fields: headerResult.fields,
          recordIndex: scanResult.records,
          sourceStats: source.stats(),
          sourceRuntime: source.runtimeDiagnostics(),
          importTotalMs: now() - started,
          performance: {
            scanMode: scanResult.performance.scanMode,
            headerMs,
            headerReadMs,
            headerCpuMs,
            recordScanMs,
            recordReadMs: scanResult.performance.sourceReadMs,
            recordCpuMs: Math.max(0, recordScanMs - scanResult.performance.sourceReadMs),
            checksumBytes: 0,
            checksumCpuMs: 0,
            checksumBenchmarkMs: 0,
            diagnosticCpuMs: scanResult.performance.diagnosticCpuMs,
            indexCpuMs: scanResult.performance.indexCpuMs,
            finalizeMs,
            totalMs: now() - started,
          },
        },
      });

      if (!validationStartRequested) {
        await new Promise<void>((resolve) => {
          validationStartResolver = resolve;
          if (validationStartRequested) resolve();
        });
      }
      validationStartResolver = undefined;

      const validation = await validateMlgRecordCrcParallel(
        importRequest.file,
        headerResult.header,
        scanResult.records,
      );

      const classified = classifyMlgRetryDiagnostics(
        scanResult.records,
        validation.crcValid,
        [...scanResult.diagnostics, ...validation.diagnostics],
        headerResult.header.recordLength,
      );

      scope.postMessage({
        type: 'validated',
        payload: {
          crcValid: validation.crcValid,
          diagnostics: classified.diagnostics,
          performance: validation.performance,
          sourceStats: source.stats(),
          completedMs: now() - started,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker import error.';
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : undefined;
      scope.postMessage({
        type: 'error',
        message,
        ...(code ? { code } : {}),
      });
    }
  })();
};
