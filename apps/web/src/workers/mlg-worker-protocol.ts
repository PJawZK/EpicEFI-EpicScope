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
import type { BlobByteSourceStats } from '../adapters/blob-byte-source';

export interface MlgWorkerImportRequest {
  readonly type: 'import';
  readonly file: File;
  readonly sourceIdentity: LogSourceIdentity;
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
  readonly importTotalMs: number;
}

export interface MlgWorkerValidatedPayload {
  readonly crcValid: Uint8Array;
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly performance: MlgCrcValidationPerformance;
  readonly sourceStats: BlobByteSourceStats;
  readonly completedMs: number;
}

export type MlgWorkerResponse =
  | { readonly type: 'indexed'; readonly payload: MlgWorkerIndexedPayload }
  | { readonly type: 'validated'; readonly payload: MlgWorkerValidatedPayload }
  | { readonly type: 'error'; readonly message: string; readonly code?: string };
