import type { LogTimeRange } from '../../../../core/log-model/log-types';
import { parseMlgHeader } from '../../../../core/parsers/mlg/mlg-header';
import {
  classifyMlgRetryDiagnostics,
  scanMlgRecords,
  validateMlgRecordCrc,
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

const scope = globalThis as unknown as WorkerScope;
const now = (): number => globalThis.performance?.now() ?? Date.now();
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

      const validation = await validateMlgRecordCrc(
        source,
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
