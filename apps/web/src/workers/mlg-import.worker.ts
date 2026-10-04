import type { LogTimeRange, ParserDiagnostic } from '../../../../core/log-model/log-types';
import { parseMlgHeader } from '../../../../core/parsers/mlg/mlg-header';
import type { MlgHeader } from '../../../../core/parsers/mlg/mlg-format';
import {
  calculateMlgRecordChecksum,
  classifyMlgRetryDiagnostics,
  scanMlgRecords,
} from '../../../../core/parsers/mlg/mlg-records';
import type {
  MlgCrcValidationPerformance,
  MlgCrcValidationResult,
  MlgRecordIndex,
} from '../../../../core/parsers/mlg/mlg-records';
import { BlobByteSource } from '../adapters/blob-byte-source';
import { buildEnvelopeBlockSummary } from '../../../../core/timeline/viewport-series';
import { decodeMlgRawValue, displayMlgValue } from '../../../../core/parsers/mlg/mlg-channel-data';
import {
  createMlgColumnSidecarBuilder,
  planMlgColumnStripes,
  type MlgColumnSidecarBuilder,
} from '../adapters/mlg-column-sidecar';
import { findCompleteMlgColumnSidecar } from '../adapters/mlg-column-sidecar-storage';
import type {
  MlgColumnSidecarBuildResult,
  MlgPriorityCaptureSelector,
  MlgWorkerRequest,
  MlgWorkerResponse,
} from './mlg-worker-protocol';

interface WorkerScope {
  onmessage: ((event: MessageEvent<MlgWorkerRequest>) => void) | null;
  postMessage(message: MlgWorkerResponse, transfer?: Transferable[]): void;
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
const SERIAL_VALIDATION_CHUNK_SIZE = 32 * 1024 * 1024;
const PARALLEL_VALIDATION_CHUNK_SIZE = 32 * 1024 * 1024;

function normalized(value: string | undefined): string { return value?.trim().toLowerCase() ?? ''; }

function resolvePriorityFieldIndices(
  selectors: readonly MlgPriorityCaptureSelector[] | undefined,
  channels: readonly { readonly id: string; readonly sourceName: string; readonly unit?: string }[],
): number[] {
  if (!selectors || selectors.length === 0) return [];
  const indices = new Set<number>();
  for (const selector of selectors) {
    if (selector.sourceChannelId?.startsWith('mlg:')) {
      const index = Number(selector.sourceChannelId.slice(4));
      if (Number.isSafeInteger(index) && index >= 0 && index < channels.length) indices.add(index);
      continue;
    }
    const logicalKey = normalized(selector.logicalKey);
    const displayName = normalized(selector.displayName);
    let candidates = logicalKey
      ? channels.map((channel, index) => ({ channel, index })).filter(({ channel }) => normalized(channel.sourceName) === logicalKey)
      : [];
    if (candidates.length !== 1 && displayName) {
      candidates = channels.map((channel, index) => ({ channel, index })).filter(({ channel }) => normalized(channel.sourceName) === displayName);
      if (candidates.length > 1 && selector.unit) {
        const unit = normalized(selector.unit);
        const unitMatches = candidates.filter(({ channel }) => normalized(channel.unit) === unit);
        if (unitMatches.length === 1) candidates = unitMatches;
      }
    }
    if (candidates.length === 1) indices.add(candidates[0]!.index);
  }
  return [...indices];
}

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
  maximumBytes: number,
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
    if (nextEnd - firstOffset > maximumBytes) break;
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

async function appendSidecarBatch(
  sidecar: MlgColumnSidecarBuilder | undefined,
  batch: ValidationBatch,
  bytes: Uint8Array,
): Promise<number> {
  if (!sidecar) return 0;
  const started = now();
  await sidecar.append({
    bytes,
    firstOffset: batch.firstOffset,
    firstIndex: batch.firstIndex,
    lastIndex: batch.lastIndex,
  });
  return now() - started;
}

async function validateMlgRecordCrcSerial(
  source: BlobByteSource,
  header: MlgHeader,
  recordIndex: MlgRecordIndex,
  sidecar: MlgColumnSidecarBuilder | undefined,
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

  const readBatch = async (batch: ValidationBatch): Promise<{
    readonly batch: ValidationBatch;
    readonly bytes: Uint8Array;
    readonly readMs: number;
  }> => {
    const readStarted = now();
    const bytes = await source.read(batch.firstOffset, batch.byteLength);
    const readMs = now() - readStarted;
    if (bytes.byteLength !== batch.byteLength) {
      throw new RangeError(
        `CRC validation expected ${batch.byteLength} bytes at offset ${batch.firstOffset}, received ${bytes.byteLength}.`,
      );
    }
    return { batch, bytes, readMs };
  };

  let pendingRead = recordIndex.offsets.length > 0
    ? readBatch(planValidationBatch(
        recordIndex,
        blockLength,
        0,
        SERIAL_VALIDATION_CHUNK_SIZE,
      ))
    : undefined;

  while (pendingRead) {
    const current = await pendingRead;
    sourceReadMs += current.readMs;

    const nextIndex = current.batch.lastIndex + 1;
    const nextRead = nextIndex < recordIndex.offsets.length
      ? readBatch(planValidationBatch(
          recordIndex,
          blockLength,
          nextIndex,
          SERIAL_VALIDATION_CHUNK_SIZE,
        ))
      : undefined;

    // Transpose synchronously, then allow OPFS writes to stay in flight while
    // checksum CPU and the next file read progress.
    const sidecarPromise = appendSidecarBatch(sidecar, current.batch, current.bytes);

    const checksumStarted = now();
    const diagnosticBefore = diagnosticCpuMs;
    for (let index = current.batch.firstIndex; index <= current.batch.lastIndex; index += 1) {
      const absoluteOffset = recordIndex.offsets[index];
      if (absoluteOffset === undefined) continue;
      const relativeOffset = absoluteOffset - current.batch.firstOffset;
      const recordStart = relativeOffset + BLOCK_HEADER_LENGTH;
      checksumBytes += recordLength;
      const expectedCrc = calculateMlgRecordChecksum(current.bytes, recordStart, recordLength);
      const actualCrc = current.bytes[relativeOffset + blockLength - 1] ?? 0;
      const valid = expectedCrc === actualCrc;
      crcValid[index] = valid ? 1 : 0;

      if (!valid) {
        const diagnosticStart = now();
        const counter = current.bytes[relativeOffset + 1] ?? 0;
        const rawTimestamp = ((current.bytes[relativeOffset + 2] ?? 0) << 8)
          | (current.bytes[relativeOffset + 3] ?? 0);
        const blockHeaderSum = calculateMlgRecordChecksum(
          current.bytes,
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
    checksumCpuMs += Math.max(
      0,
      now() - checksumStarted - (diagnosticCpuMs - diagnosticBefore),
    );

    await sidecarPromise;
    pendingRead = nextRead;
  }

  return {
    crcValid,
    diagnostics,
    performance: {
      totalMs: now() - totalStart,
      sourceReadMs,
      checksumCpuMs,
      diagnosticCpuMs,
      checksumBytes,
    },
  };
}

async function validateMlgRecordCrcParallel(
  file: File,
  header: MlgHeader,
  recordIndex: MlgRecordIndex,
  sidecar: MlgColumnSidecarBuilder | undefined,
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
      ? readValidationBatch(
          file,
          planValidationBatch(recordIndex, blockLength, 0, PARALLEL_VALIDATION_CHUNK_SIZE),
        )
      : undefined;

    while (pendingRead) {
      const current = await pendingRead;
      sourceReadMs += current.readMs;

      nextIndex = current.batch.lastIndex + 1;
      const nextRead = nextIndex < recordIndex.offsets.length
        ? readValidationBatch(
            file,
            planValidationBatch(
              recordIndex,
              blockLength,
              nextIndex,
              PARALLEL_VALIDATION_CHUNK_SIZE,
            ),
          )
        : undefined;

      await appendSidecarBatch(sidecar, current.batch, new Uint8Array(current.buffer));
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

      const priorityFieldIndices = resolvePriorityFieldIndices(importRequest.priorityCapture, headerResult.channels);
      const blockLength = BLOCK_HEADER_LENGTH + headerResult.header.recordLength + 1;
      const fixedRecordCount = blockLength > 0 && (importRequest.file.size - headerResult.header.dataBeginIndex) % blockLength === 0
        ? (importRequest.file.size - headerResult.header.dataBeginIndex) / blockLength
        : 0;
      const fieldOffsets = new Uint32Array(headerResult.fields.length);
      let fieldOffset = 0;
      headerResult.fields.forEach((field, index) => { fieldOffsets[index] = fieldOffset; fieldOffset += field.widthBytes; });
      const capturedPriority = fixedRecordCount > 0 ? priorityFieldIndices.map((index) => ({
        index,
        channelId: `mlg:${index}`,
        field: headerResult.fields[index]!,
        fieldOffset: fieldOffsets[index] ?? 0,
        values: new Float64Array(fixedRecordCount),
        validCount: 0,
        invalidCount: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        mean: 0,
        m2: 0,
      })) : [];

      const scanStart = now();
      const scanResult = await scanMlgRecords(
        source,
        headerResult.header,
        {
          validateCrc: false,
          ...(capturedPriority.length > 0 ? {
            onFixedRecordChunk: (bytes, firstRecordIndex, recordCount, fixedBlockLength) => {
              const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
              for (let localIndex = 0; localIndex < recordCount; localIndex += 1) {
                const recordStart = localIndex * fixedBlockLength + BLOCK_HEADER_LENGTH;
                const sampleIndex = firstRecordIndex + localIndex;
                for (const captured of capturedPriority) {
                  const raw = decodeMlgRawValue(view, recordStart + captured.fieldOffset, captured.field);
                  const value = displayMlgValue(raw, captured.field);
                  captured.values[sampleIndex] = value;
                  if (!Number.isFinite(value)) {
                    captured.invalidCount += 1;
                    continue;
                  }
                  captured.validCount += 1;
                  captured.min = Math.min(captured.min, value);
                  captured.max = Math.max(captured.max, value);
                  const delta = value - captured.mean;
                  captured.mean += delta / captured.validCount;
                  captured.m2 += delta * (value - captured.mean);
                }
              }
            },
          } : {}),
        },
      );
      const recordScanMs = now() - scanStart;
      const capturedEnvelopeBlocks = capturedPriority.map((captured) => buildEnvelopeBlockSummary(
        captured.values,
        scanResult.records.timeMs,
        scanResult.records.crcValid,
        64,
      ));

      const finalizeStart = now();
      const range = timeRange(scanResult.records.timeMs);
      const finalizeMs = now() - finalizeStart;
      const indexedSourceStats = source.stats();
      const indexedSourceRuntime = source.runtimeDiagnostics();
      const sourceCacheSeed = source.takePinnedCacheSeed();

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
          sourceStats: indexedSourceStats,
          sourceRuntime: indexedSourceRuntime,
          sourceCacheSeed,
          importTotalMs: now() - started,
          ...(capturedPriority.length > 0 && scanResult.performance.scanMode === 'fixed' ? {
            capturedPriorityColumns: capturedPriority.map((captured, capturedIndex) => ({
              channelId: captured.channelId,
              values: captured.values,
              envelopeBlocks: capturedEnvelopeBlocks[capturedIndex]!,
              statistics: {
                validCount: captured.validCount,
                invalidCount: captured.invalidCount,
                min: captured.validCount > 0 ? captured.min : undefined,
                max: captured.validCount > 0 ? captured.max : undefined,
                mean: captured.validCount > 0 ? captured.mean : undefined,
                standardDeviation: captured.validCount > 1
                  ? Math.sqrt(captured.m2 / (captured.validCount - 1))
                  : captured.validCount === 1 ? 0 : undefined,
              },
            })),
          } : {}),
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
      }, [
        ...sourceCacheSeed.map((page) => page.bytes.buffer as ArrayBuffer),
        ...capturedPriority.map((captured) => captured.values.buffer as ArrayBuffer),
        ...capturedEnvelopeBlocks.flatMap((blocks) => [
          blocks.validCount.buffer, blocks.invalidCount.buffer,
          blocks.first.buffer, blocks.firstTimeMs.buffer, blocks.min.buffer, blocks.minTimeMs.buffer,
          blocks.max.buffer, blocks.maxTimeMs.buffer, blocks.last.buffer, blocks.lastTimeMs.buffer,
        ] as ArrayBuffer[]),
      ]);

      if (!validationStartRequested) {
        await new Promise<void>((resolve) => {
          validationStartResolver = resolve;
          if (validationStartRequested) resolve();
        });
      }
      validationStartResolver = undefined;

      const sidecarPlan = planMlgColumnStripes(headerResult.fields);
      const existingSidecar = await findCompleteMlgColumnSidecar(
        importRequest.sourceIdentity.id,
        scanResult.records.offsets.length,
        headerResult.fields.length,
        sidecarPlan.fieldPayloadBytes,
      );
      const sidecarBuilder = existingSidecar
        ? undefined
        : await createMlgColumnSidecarBuilder(
            importRequest.sourceIdentity.id,
            headerResult.fields,
            scanResult.records,
            headerResult.header.recordLength,
          );

      const hardwareConcurrency = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);
      const validationMode = hardwareConcurrency >= 4 ? 'parallel' : 'serial';
      let validation: MlgCrcValidationResult;
      try {
        validation = validationMode === 'parallel'
          ? await validateMlgRecordCrcParallel(
              importRequest.file,
              headerResult.header,
              scanResult.records,
              sidecarBuilder,
            )
          : await validateMlgRecordCrcSerial(
              source,
              headerResult.header,
              scanResult.records,
              sidecarBuilder,
            );
      } catch (error) {
        await sidecarBuilder?.abort();
        throw error;
      }

      let sidecar: MlgColumnSidecarBuildResult | undefined = existingSidecar
        ? {
            manifest: existingSidecar,
            performance: {
              totalMs: 0,
              transposeMs: 0,
              writeMs: 0,
              bytesWritten: 0,
            },
          }
        : undefined;
      let sidecarFinishDiagnostic: ParserDiagnostic | undefined;
      if (sidecarBuilder) {
        try {
          sidecar = await sidecarBuilder.finish();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          sidecarFinishDiagnostic = {
            code: 'mlg-sidecar-finish-failed',
            severity: 'warning',
            message: `MLG column sidecar finalization failed: ${message}`,
            recoverable: true,
          };
          await sidecarBuilder.abort();
        }
      }

      const classified = classifyMlgRetryDiagnostics(
        scanResult.records,
        validation.crcValid,
        [
          ...scanResult.diagnostics,
          ...validation.diagnostics,
          ...(sidecarFinishDiagnostic ? [sidecarFinishDiagnostic] : []),
        ],
        headerResult.header.recordLength,
      );

      scope.postMessage({
        type: 'validated',
        payload: {
          crcValid: validation.crcValid,
          diagnostics: classified.diagnostics,
          performance: validation.performance,
          validationMode,
          sourceStats: source.stats(),
          completedMs: now() - started,
          ...(sidecar ? { sidecar } : {}),
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
