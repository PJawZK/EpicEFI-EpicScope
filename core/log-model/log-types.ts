export type LogValidity = 'valid' | 'missing' | 'invalid';

export const NUMERIC_SAMPLE_QUALITY = {
  valid: 0,
  invalid: 1,
  stale: 2,
  unavailable: 3,
  lost: 4,
} as const;

export type NumericSampleQualityCode = typeof NUMERIC_SAMPLE_QUALITY[keyof typeof NUMERIC_SAMPLE_QUALITY];

export function numericSampleQualityIsValid(code: number): boolean {
  return code === NUMERIC_SAMPLE_QUALITY.valid;
}

export function numericSampleQualityToValidity(code: number): 0 | 1 {
  return numericSampleQualityIsValid(code) ? 1 : 0;
}

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

export interface NumericChannelStatistics {
  readonly validCount: number;
  readonly invalidCount: number;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly mean: number | undefined;
  readonly standardDeviation: number | undefined;
}

export interface NumericChannelEnvelopeBlocks {
  readonly blockSize: number;
  readonly validCount: Uint16Array;
  readonly invalidCount: Uint16Array;
  readonly first: Float64Array;
  readonly firstTimeMs: Float64Array;
  readonly min: Float64Array;
  readonly minTimeMs: Float64Array;
  readonly max: Float64Array;
  readonly maxTimeMs: Float64Array;
  readonly last: Float64Array;
  readonly lastTimeMs: Float64Array;
}

export interface NumericChannelRange {
  readonly startSampleIndex: number;
  readonly timeMs: Float64Array;
  readonly values: Float64Array;
  /** Compatibility projection: 1 = usable valid sample, 0 = non-valid sample. */
  readonly validity: Uint8Array;
  /** Optional richer per-sample quality. Values use NUMERIC_SAMPLE_QUALITY. */
  readonly quality?: Uint8Array;
  /** Optional full-range statistics computed while source samples were already being decoded. */
  readonly fullStatistics?: NumericChannelStatistics;
  /** Optional exact fixed-block envelope summaries for acceleration before CRC validity is refreshed. */
  readonly fullEnvelopeBlocks?: NumericChannelEnvelopeBlocks;
}

export interface NumericChannelBatchPerformance {
  readonly channelCount: number;
  readonly cacheHitChannelIds: readonly string[];
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly physicalReadMs: number;
  readonly persistentLookupMs?: number;
  readonly persistentRangeBuildMs?: number;
  readonly delegatedSourceMs?: number;
  readonly sidecarManifestMs?: number;
  readonly sidecarFileOpenAggregateMs?: number;
  readonly sidecarBlobReadAggregateMs?: number;
  readonly sidecarDecodeAggregateMs?: number;
  readonly sidecarRangeBuildMs?: number;
}

export interface NumericChannelBatchResult {
  readonly ranges: ReadonlyMap<string, NumericChannelRange>;
  readonly performance: NumericChannelBatchPerformance;
}

export interface NumericChannelDataSource {
  readonly sampleCount: number;
  readonly preferredBatchWindowMs?: number;
  readonly requiresExplicitBatchSelection?: boolean;
  readonly managesPersistentColumns?: boolean;
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
