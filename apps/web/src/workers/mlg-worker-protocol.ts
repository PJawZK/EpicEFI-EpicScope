import type {
  ImportedLogSummary,
  LogSourceIdentity,
  ParserDiagnostic,
} from '../../../../core/log-model/log-types';
import type { MlgFieldDescriptor, MlgHeader } from '../../../../core/parsers/mlg/mlg-format';
import type {
  MlgCrcValidationPerformance,
  MlgRecordIndex,
} from '../../../../core/parsers/mlg/mlg-records';
import type { MlgParsePerformance } from '../../../../core/parsers/mlg/mlg-parser';
import type {
  BlobByteSourceCacheSeedPage,
  BlobByteSourceRuntimeDiagnostics,
  BlobByteSourceStats,
} from '../adapters/blob-byte-source';

export interface MlgColumnSidecarStripeManifest {
  readonly index: number;
  readonly startByte: number;
  readonly widthBytes: number;
  readonly firstFieldIndex: number;
  readonly lastFieldIndexExclusive: number;
  readonly storageOffset: number;
}

export interface MlgColumnSidecarManifest {
  readonly schemaVersion: 2;
  readonly logKey: string;
  readonly storageKey: string;
  readonly dataFileName: string;
  readonly sampleCount: number;
  readonly fieldCount: number;
  readonly recordLength: number;
  readonly fieldPayloadBytes: number;
  readonly targetStripeBytes: number;
  readonly totalBytes: number;
  readonly stripes: readonly MlgColumnSidecarStripeManifest[];
  readonly createdAt: number;
}

export interface MlgColumnSidecarBuildPerformance {
  readonly totalMs: number;
  readonly transposeMs: number;
  readonly writeMs: number;
  readonly bytesWritten: number;
}

export interface MlgColumnSidecarBuildResult {
  readonly manifest: MlgColumnSidecarManifest;
  readonly performance: MlgColumnSidecarBuildPerformance;
}

export interface MlgPriorityCaptureSelector {
  readonly logicalChannelId: string;
  readonly logicalKey?: string;
  readonly displayName?: string;
  readonly unit?: string;
  readonly sourceChannelId?: string;
}

export interface MlgCapturedPriorityColumn {
  readonly channelId: string;
  readonly values: Float64Array;
}

export interface MlgWorkerImportRequest {
  readonly type: 'import';
  readonly file: File;
  readonly sourceIdentity: LogSourceIdentity;
  readonly priorityCapture?: readonly MlgPriorityCaptureSelector[];
}

export interface MlgWorkerStartValidationRequest {
  readonly type: 'start-validation';
}

export type MlgWorkerRequest = MlgWorkerImportRequest | MlgWorkerStartValidationRequest;

export interface MlgWorkerIndexedPayload {
  readonly summary: ImportedLogSummary;
  readonly header: MlgHeader;
  readonly fields: readonly MlgFieldDescriptor[];
  readonly recordIndex: MlgRecordIndex;
  readonly performance: MlgParsePerformance;
  readonly sourceStats: BlobByteSourceStats;
  readonly sourceRuntime: BlobByteSourceRuntimeDiagnostics;
  readonly sourceCacheSeed: readonly BlobByteSourceCacheSeedPage[];
  readonly importTotalMs: number;
  readonly capturedPriorityColumns?: readonly MlgCapturedPriorityColumn[];
}

export type MlgValidationMode = 'serial' | 'parallel';

export interface MlgWorkerValidatedPayload {
  readonly crcValid: Uint8Array;
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly performance: MlgCrcValidationPerformance;
  readonly validationMode: MlgValidationMode;
  readonly sourceStats: BlobByteSourceStats;
  readonly completedMs: number;
  readonly sidecar?: MlgColumnSidecarBuildResult;
}

export type MlgWorkerResponse =
  | { readonly type: 'indexed'; readonly payload: MlgWorkerIndexedPayload }
  | { readonly type: 'validated'; readonly payload: MlgWorkerValidatedPayload }
  | { readonly type: 'error'; readonly message: string; readonly code?: string };
