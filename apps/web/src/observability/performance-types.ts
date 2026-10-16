import type { BlobByteSourceRuntimeDiagnostics } from '../adapters/blob-byte-source';

export interface LoadPerformanceRun {
  readonly fileName: string;
  readonly importMode: 'worker-staged' | 'main-thread-full';
  readonly scanMode: 'fixed' | 'general';
  readonly fileSizeBytes: number;
  readonly recordCount: number;
  readonly channelCount: number;
  readonly importTotalMs: number;
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
  readonly uiPopulateMs: number;
  readonly uiWorkspaceMs?: number;
  readonly uiChannelModelMs?: number;
  readonly uiInspectorMs?: number;
  readonly uiTimelineMs?: number;
  readonly uiGraphSetupMs?: number;
  readonly uiLayoutMs?: number;
  readonly uiValueSearchMs?: number;
  readonly uiViewportMs?: number;
  readonly uiDiagnosticsMs?: number;
  readonly sourceReadCount: number;
  readonly sourceBytesRead: number;
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly cacheHitBytes: number;
  readonly cacheBytes: number;
  readonly cachePageCount: number;
  readonly workerSourceRuntime?: BlobByteSourceRuntimeDiagnostics;
  readonly fullyValidatedMs?: number;
  readonly validationMs?: number;
  readonly validationReadMs?: number;
  readonly validationChecksumCpuMs?: number;
  readonly validationDiagnosticCpuMs?: number;
  readonly validationChecksumBytes?: number;
  readonly validationMode?: 'serial' | 'parallel';
  readonly sidecarStatus?: 'built' | 'reused';
  readonly sidecarTotalMs?: number;
  readonly sidecarTransposeMs?: number;
  readonly sidecarWriteMs?: number;
  readonly sidecarBytesWritten?: number;
  readonly sidecarStripeCount?: number;
  readonly sidecarTargetStripeBytes?: number;
  readonly sidecarTotalBytes?: number;
}


export interface IniLoadPerformanceRun {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalMs: number;
  readonly textReadMs: number;
  readonly parseMs: number;
  readonly catalogBuildMs: number;
  readonly lineCount: number;
  readonly outputChannelCount: number;
  readonly datalogEntryCount: number;
  readonly catalogEntryCount: number;
  readonly scalarCount: number;
  readonly bitCount: number;
  readonly expressionCount: number;
  readonly datalogOnlyCount: number;
  readonly outputOnlyCount: number;
  readonly diagnosticCount: number;
  readonly diagnosticGroups: readonly {
    readonly code: string;
    readonly severity: 'info' | 'warning' | 'error';
    readonly count: number;
  }[];
}

export interface ChannelBindingPerformanceRun {
  readonly totalMs: number;
  readonly catalogChannelCount: number;
  readonly logChannelCount: number;
  readonly mergedChannelCount: number;
  readonly boundChannelCount: number;
  readonly knownNoDataCount: number;
  readonly logOnlyCount: number;
  readonly matchedByLogicalKey: number;
  readonly matchedByDisplayName: number;
  readonly matchedByDisplayNameUnit: number;
  readonly ambiguousLogChannelCount: number;
}

export interface WorkspaceRestorePerformanceRun {
  readonly totalMs: number;
  readonly prepareMs: number;
  readonly prepareStateMs: number;
  readonly prepareClearMs: number;
  readonly prepareLayoutMs: number;
  readonly prepareViewportMs: number;
  readonly preparePaneRequestsMs: number;
  readonly prepareBatchPlanMs: number;
  readonly sharedBatchMs: number;
  readonly activationMs: number;
  readonly activationScheduleMs: number;
  readonly activationAwaitMs: number;
  readonly activationToggleDispatchMaxMs: number;
  readonly activationLoadPendingMaxMs: number;
  readonly activationToggleAwaitMaxMs: number;
  readonly activationApplyResultsMaxMs: number;
  readonly activationGraphTotalMs: number;
  readonly activationChannelLookupMs: number;
  readonly activationStatisticsScaleMs: number;
  readonly activationTraceRegistrationMs: number;
  readonly activationReadoutMs: number;
  readonly activationCursorMs: number;
  readonly activationDrawMs: number;
  readonly activationEnvelopeMs: number;
  readonly activationDrawSetupMs: number;
  readonly activationDrawTraceMs: number;
  readonly activationDrawOverlayMs: number;
  readonly finalSyncMs: number;
  readonly finalSyncResolveMs: number;
  readonly finalSyncAssignedNormalizeMs: number;
  readonly finalSyncInspectorActiveMs: number;
  readonly finalSyncInspectorQueuedMs: number;
  readonly finalSyncValueSearchMs: number;
  readonly finalSyncAssignedSyncMs: number;
  readonly finalSyncOverviewMs: number;
  readonly visiblePaneCount: number;
  readonly assignedChannelCount: number;
  readonly requestedChannelCount: number;
  readonly uniqueRequestedChannelCount: number;
  readonly cacheHit: boolean;
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly physicalReadMs: number;
}

export interface ChannelPerformanceRun {
  readonly channelName: string;
  readonly persistentLookupMs?: number | undefined;
  readonly persistentRangeBuildMs?: number | undefined;
  readonly delegatedSourceMs?: number | undefined;
  readonly sidecarManifestMs?: number | undefined;
  readonly sidecarFileOpenAggregateMs?: number | undefined;
  readonly sidecarBlobReadAggregateMs?: number | undefined;
  readonly sidecarDecodeAggregateMs?: number | undefined;
  readonly sidecarRangeBuildMs?: number | undefined;
  readonly sidecarReadPath?: 'captured' | 'native' | 'striped' | undefined;
  readonly phase: 'viewport' | 'full' | 'cache';
  readonly startSampleIndex: number;
  readonly requestedSampleCount: number;
  readonly totalMs: number;
  readonly readDecodeMs: number;
  readonly scaleMs: number;
  readonly renderMs: number;
  readonly statisticsMs?: number | undefined;
  readonly applyMs?: number | undefined;
  readonly readoutMs?: number | undefined;
  readonly cursorMs?: number | undefined;
  readonly envelopeMs?: number | undefined;
  readonly drawSetupMs?: number | undefined;
  readonly drawTraceMs?: number | undefined;
  readonly drawOverlayMs?: number | undefined;
  readonly drawRemainderMs?: number | undefined;
  readonly sampleCount: number;
  readonly batchSize: number;
  readonly cacheHit: boolean;
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly physicalReadMs: number;
}

export interface ValidationPerformanceRun {
  readonly fileName: string;
  readonly fullyValidatedMs: number;
  readonly validationMs: number;
  readonly validationReadMs: number;
  readonly validationChecksumCpuMs: number;
  readonly validationDiagnosticCpuMs: number;
  readonly validationChecksumBytes: number;
  readonly validationMode: 'serial' | 'parallel';
  readonly sidecarStatus?: 'built' | 'reused';
  readonly sidecarTotalMs?: number;
  readonly sidecarTransposeMs?: number;
  readonly sidecarWriteMs?: number;
  readonly sidecarBytesWritten?: number;
  readonly sidecarStripeCount?: number;
  readonly sidecarTargetStripeBytes?: number;
  readonly sidecarTotalBytes?: number;
}


export interface PerformanceRuntimeMemorySnapshot {
  readonly activeTraceRangeBytes: number;
}

