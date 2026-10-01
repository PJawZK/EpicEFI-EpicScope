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

export interface ParsedMlgLog {
  readonly summary: ImportedLogSummary;
  readonly header: MlgHeader;
  readonly fields: readonly MlgFieldDescriptor[];
  readonly recordIndex: MlgRecordIndex;
  readonly channelData: NumericChannelDataSource;
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
  const headerResult = await parseMlgHeader(source);
  const scanResult = await scanMlgRecords(source, headerResult.header);
  const timeRange = buildTimeRange(scanResult.records.timeMs);
  const channelData = new MlgNumericChannelDataSource(
    source,
    headerResult.fields,
    scanResult.records,
  );

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
  };
}
