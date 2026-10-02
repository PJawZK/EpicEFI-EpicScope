import type {
  ImportedLogSummary,
  LogSourceIdentity,
  LogTimeRange,
  NumericChannelDataSource,
} from '../../log-model/log-types';
import type { RandomAccessByteSource } from '../byte-source';
import { MlgNumericChannelDataSource } from './mlg-channel-data';
import type { MlgFieldDescriptor, MlgHeader } from './mlg-format';
import { parseMlgHeader } from './mlg-header';
import { scanMlgRecords, type MlgRecordIndex } from './mlg-records';

export interface MlgParsePerformance {
  readonly headerMs: number;
  readonly headerReadMs: number;
  readonly headerCpuMs: number;
  readonly recordScanMs: number;
  readonly recordReadMs: number;
  readonly recordCpuMs: number;
  readonly checksumBytes: number;
  readonly checksumCpuMs: number;
  readonly checksumBenchmarkMs: number;
  readonly diagnosticCpuMs: number;
  readonly indexCpuMs: number;
  readonly finalizeMs: number;
  readonly totalMs: number;
}

export interface ParsedMlgLog {
  readonly summary: ImportedLogSummary;
  readonly header: MlgHeader;
  readonly fields: readonly MlgFieldDescriptor[];
  readonly recordIndex: MlgRecordIndex;
  readonly channelData: NumericChannelDataSource;
  readonly performance: MlgParsePerformance;
}

function buildTimeRange(timeMs: Float64Array): LogTimeRange | undefined {
  if (timeMs.length === 0) {
    return undefined;
  }
  const startMs = timeMs[0] ?? 0;
  const endMs = timeMs[timeMs.length - 1] ?? startMs;
  return {
    startMs,
    endMs,
    durationMs: Math.max(0, endMs - startMs),
  };
}

export async function parseMlg(
  source: RandomAccessByteSource,
  sourceIdentity: LogSourceIdentity,
): Promise<ParsedMlgLog> {
  const now = (): number => globalThis.performance?.now() ?? Date.now();
  const totalStart = now();
  const headerPhysicalReadStart = source.performanceSnapshot?.().physicalReadMs ?? 0;
  const headerStart = now();
  const headerResult = await parseMlgHeader(source);
  const headerMs = now() - headerStart;
  const headerPhysicalReadEnd = source.performanceSnapshot?.().physicalReadMs ?? headerPhysicalReadStart;
  const headerReadMs = Math.max(0, headerPhysicalReadEnd - headerPhysicalReadStart);
  const headerCpuMs = Math.max(0, headerMs - headerReadMs);

  const scanStart = now();
  const scanResult = await scanMlgRecords(source, headerResult.header);
  const recordScanMs = now() - scanStart;

  const finalizeStart = now();
  const timeRange = buildTimeRange(scanResult.records.timeMs);
  const channelData = new MlgNumericChannelDataSource(
    source,
    headerResult.fields,
    scanResult.records,
  );
  const finalizeMs = now() - finalizeStart;

  return {
    summary: {
      source: sourceIdentity,
      channels: headerResult.channels,
      diagnostics: scanResult.diagnostics,
      markers: scanResult.markers,
      ...(timeRange ? { timeRange } : {}),
    },
    header: headerResult.header,
    fields: headerResult.fields,
    recordIndex: scanResult.records,
    channelData,
    performance: {
      headerMs,
      headerReadMs,
      headerCpuMs,
      recordScanMs,
      recordReadMs: scanResult.performance.sourceReadMs,
      recordCpuMs: Math.max(0, recordScanMs - scanResult.performance.sourceReadMs),
      checksumBytes: scanResult.performance.checksumBytes,
      checksumCpuMs: scanResult.performance.checksumCpuMs,
      checksumBenchmarkMs: scanResult.performance.checksumBenchmarkMs,
      diagnosticCpuMs: scanResult.performance.diagnosticCpuMs,
      indexCpuMs: scanResult.performance.indexCpuMs,
      finalizeMs,
      totalMs: now() - totalStart,
    },
  };
}
