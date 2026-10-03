export type LogValidity = 'valid' | 'missing' | 'invalid';

export type ParserDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface ParserDiagnostic {
  readonly code: string;
  readonly severity: ParserDiagnosticSeverity;
  readonly message: string;
  readonly recoverable: boolean;
  readonly offset?: number;
}

export interface LogSourceIdentity {
  readonly id: string;
  readonly displayName: string;
  readonly format: string;
  readonly sizeBytes: number;
}

export type ChannelValueType = 'integer' | 'number' | 'bitfield';

export interface ChannelDefinition {
  readonly id: string;
  readonly sourceName: string;
  readonly displayName: string;
  readonly valueType: ChannelValueType;
  readonly unit?: string;
  readonly category?: string;
  readonly precision?: number;
}

export interface NumericChannelRange {
  readonly startSampleIndex: number;
  readonly timeMs: Float64Array;
  readonly values: Float64Array;
  /** 1 = valid source record, 0 = invalid/corrupt source record. */
  readonly validity: Uint8Array;
}

export interface NumericChannelBatchPerformance {
  readonly channelCount: number;
  readonly cacheHitChannelIds: readonly string[];
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly physicalReadMs: number;
}

export interface NumericChannelBatchResult {
  readonly ranges: ReadonlyMap<string, NumericChannelRange>;
  readonly performance: NumericChannelBatchPerformance;
}

export interface NumericChannelDataSource {
  readonly sampleCount: number;
  readonly preferredBatchWindowMs?: number;
  readonly requiresExplicitBatchSelection?: boolean;
  sampleRangeForTime?(
    startMs: number,
    endMs: number,
  ): { readonly startSampleIndex: number; readonly sampleCount: number };
  hasCachedChannelRange?(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean;
  readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange>;
  readChannelsRange?(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult>;
}

export interface LogMarker {
  readonly timeMs: number;
  readonly label: string;
}

export interface LogTimeRange {
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
}

export interface ImportedLogSummary {
  readonly source: LogSourceIdentity;
  readonly channels: readonly ChannelDefinition[];
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly markers: readonly LogMarker[];
  readonly timeRange?: LogTimeRange;
}
