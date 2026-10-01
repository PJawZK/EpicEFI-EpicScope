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

export interface NumericChannelDataSource {
  readonly sampleCount: number;
  readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange>;
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
