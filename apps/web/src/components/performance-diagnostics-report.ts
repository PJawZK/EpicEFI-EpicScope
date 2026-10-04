import { latestChannelDecodePerformance } from '../../../../core/parsers/mlg/channel-decode-performance';
import { latestBlobByteSourceRuntimeDiagnostics } from '../adapters/blob-byte-source';
import type {
  ChannelBindingPerformanceRun,
  ChannelPerformanceRun,
  IniLoadPerformanceRun,
  LoadPerformanceRun,
  WorkspaceRestorePerformanceRun,
} from './performance-diagnostics';

function decodeMeasuredMs(snapshot: ReturnType<typeof latestChannelDecodePerformance>): number {
  if (!snapshot) return 0;
  return snapshot.cacheResolveMs
    + snapshot.batchPlanMs
    + snapshot.sourceReadAwaitMs
    + snapshot.decodeTransformMs
    + snapshot.resultAssemblyMs
    + snapshot.cacheStoreMs;
}

export function buildPerformanceDiagnosticsReport(
  loadRuns: readonly LoadPerformanceRun[],
  iniLoadRuns: readonly IniLoadPerformanceRun[],
  bindingRuns: readonly ChannelBindingPerformanceRun[],
  workspaceRestoreRuns: readonly WorkspaceRestorePerformanceRun[],
  channelRuns: readonly ChannelPerformanceRun[],
): string {
    const lines: string[] = ['EpicScope performance diagnostics'];
    const blobRuntime = latestBlobByteSourceRuntimeDiagnostics();
    if (blobRuntime) {
      lines.push(
        '',
        '[Blob source runtime]',
        `scope=${blobRuntime.scope}`,
        `pageSizeBytes=${blobRuntime.pageSizeBytes}`,
        `cacheLimitBytes=${blobRuntime.cacheLimitBytes}`,
        `pinnedCacheLimitBytes=${blobRuntime.pinnedCacheLimitBytes}`,
        `physicalReads=${blobRuntime.physicalReadCount}`,
        `physicalReadMs=${blobRuntime.physicalReadMs.toFixed(2)} ms`,
        `physicalReadMinMs=${blobRuntime.physicalReadMinMs.toFixed(2)} ms`,
        `physicalReadAverageMs=${blobRuntime.physicalReadAverageMs.toFixed(2)} ms`,
        `physicalReadMaxMs=${blobRuntime.physicalReadMaxMs.toFixed(2)} ms`,
      );
      blobRuntime.slowestReads.forEach((read, index) => {
        lines.push(
          `slowRead${index + 1}=offset:${read.offset};bytes:${read.bytes};ms:${read.durationMs.toFixed(2)}`
        );
      });
    }
    const latestLoad = loadRuns[loadRuns.length - 1];
    if (latestLoad) {
      lines.push(
        '',
        '[Load]',
        `file=${latestLoad.fileName}`,
        `size=${latestLoad.fileSizeBytes} bytes`,
        `records=${latestLoad.recordCount}`,
        `channels=${latestLoad.channelCount}`,
        `importMode=${latestLoad.importMode}`,
        `scanMode=${latestLoad.scanMode}`,
        `total=${latestLoad.importTotalMs.toFixed(2)} ms`,
        `header=${latestLoad.headerMs.toFixed(2)} ms`,
        `headerRead=${latestLoad.headerReadMs.toFixed(2)} ms`,
        `headerCpu=${latestLoad.headerCpuMs.toFixed(2)} ms`,
        `recordScan=${latestLoad.recordScanMs.toFixed(2)} ms`,
        `recordRead=${latestLoad.recordReadMs.toFixed(2)} ms`,
        `recordCpu=${latestLoad.recordCpuMs.toFixed(2)} ms`,
        `checksumBytes=${latestLoad.checksumBytes}`,
        `checksumCpu=${latestLoad.checksumCpuMs.toFixed(2)} ms`,
        `checksumBenchmark=${latestLoad.checksumBenchmarkMs.toFixed(2)} ms`,
        `diagnosticCpu=${latestLoad.diagnosticCpuMs.toFixed(2)} ms`,
        `indexCpu=${latestLoad.indexCpuMs.toFixed(2)} ms`,
        `finalize=${latestLoad.finalizeMs.toFixed(2)} ms`,
        `uiPopulate=${latestLoad.uiPopulateMs.toFixed(2)} ms`,
        ...(latestLoad.uiWorkspaceMs !== undefined ? [
          `uiWorkspace=${latestLoad.uiWorkspaceMs.toFixed(2)} ms`,
          `uiChannelModel=${(latestLoad.uiChannelModelMs ?? 0).toFixed(2)} ms`,
          `uiInspector=${(latestLoad.uiInspectorMs ?? 0).toFixed(2)} ms`,
          `uiTimeline=${(latestLoad.uiTimelineMs ?? 0).toFixed(2)} ms`,
          `uiGraphSetup=${(latestLoad.uiGraphSetupMs ?? 0).toFixed(2)} ms`,
          `uiLayout=${(latestLoad.uiLayoutMs ?? 0).toFixed(2)} ms`,
          `uiValueSearch=${(latestLoad.uiValueSearchMs ?? 0).toFixed(2)} ms`,
          `uiViewport=${(latestLoad.uiViewportMs ?? 0).toFixed(2)} ms`,
          `uiDiagnostics=${(latestLoad.uiDiagnosticsMs ?? 0).toFixed(2)} ms`,
        ] : []),
        `sourceReads=${latestLoad.sourceReadCount}`,
        `sourceBytes=${latestLoad.sourceBytesRead}`,
        `physicalReads=${latestLoad.physicalReadCount}`,
        `physicalBytes=${latestLoad.physicalBytesRead}`,
        `cacheHitBytes=${latestLoad.cacheHitBytes}`,
        `cacheBytes=${latestLoad.cacheBytes}`,
        `cachePages=${latestLoad.cachePageCount}`,
      );
      if (latestLoad.workerSourceRuntime) {
        const worker = latestLoad.workerSourceRuntime;
        lines.push(
          '',
          '[Worker Blob source]',
          'scope=worker-index-source-lifetime',
          `pageSizeBytes=${worker.pageSizeBytes}`,
          `cacheLimitBytes=${worker.cacheLimitBytes}`,
          `pinnedCacheLimitBytes=${worker.pinnedCacheLimitBytes}`,
          `physicalReads=${worker.physicalReadCount}`,
          `physicalReadMs=${worker.physicalReadMs.toFixed(2)} ms`,
          `physicalReadMinMs=${worker.physicalReadMinMs.toFixed(2)} ms`,
          `physicalReadAverageMs=${worker.physicalReadAverageMs.toFixed(2)} ms`,
          `physicalReadMaxMs=${worker.physicalReadMaxMs.toFixed(2)} ms`,
        );
        worker.slowestReads.forEach((read, index) => {
          lines.push(
            `slowRead${index + 1}=offset:${read.offset};bytes:${read.bytes};ms:${read.durationMs.toFixed(2)}`
          );
        });
      }
      if (latestLoad.fullyValidatedMs !== undefined) {
        lines.push(
          `fullyValidated=${latestLoad.fullyValidatedMs.toFixed(2)} ms`,
          `validationMode=${latestLoad.validationMode ?? 'unknown'}`,
          `validation=${latestLoad.validationMs?.toFixed(2) ?? '0.00'} ms`,
          `validationRead=${latestLoad.validationReadMs?.toFixed(2) ?? '0.00'} ms`,
          `validationChecksumCpu=${latestLoad.validationChecksumCpuMs?.toFixed(2) ?? '0.00'} ms`,
          `validationDiagnosticCpu=${latestLoad.validationDiagnosticCpuMs?.toFixed(2) ?? '0.00'} ms`,
          `validationChecksumBytes=${latestLoad.validationChecksumBytes ?? 0}`,
        );
        if (latestLoad.sidecarStatus) {
          lines.push(
            '[MLG column sidecar]',
            `status=${latestLoad.sidecarStatus}`,
            `total=${(latestLoad.sidecarTotalMs ?? 0).toFixed(2)} ms`,
            `transpose=${(latestLoad.sidecarTransposeMs ?? 0).toFixed(2)} ms`,
            `write=${(latestLoad.sidecarWriteMs ?? 0).toFixed(2)} ms`,
            `other=${Math.max(0, (latestLoad.sidecarTotalMs ?? 0) - (latestLoad.sidecarTransposeMs ?? 0) - (latestLoad.sidecarWriteMs ?? 0)).toFixed(2)} ms`,
            `bytesWritten=${latestLoad.sidecarBytesWritten ?? 0}`,
            `stripes=${latestLoad.sidecarStripeCount ?? 0}`,
            `targetStripeBytes=${latestLoad.sidecarTargetStripeBytes ?? 0}`,
            `storedBytes=${latestLoad.sidecarTotalBytes ?? 0}`,
          );
        }
      }
    }
    const latestIniLoad = iniLoadRuns[iniLoadRuns.length - 1];
    if (latestIniLoad) {
      lines.push(
        '',
        '[INI load]',
        `file=${latestIniLoad.fileName}`,
        `size=${latestIniLoad.fileSizeBytes} bytes`,
        `total=${latestIniLoad.totalMs.toFixed(2)} ms`,
        `textRead=${latestIniLoad.textReadMs.toFixed(2)} ms`,
        `parse=${latestIniLoad.parseMs.toFixed(2)} ms`,
        `catalogBuild=${latestIniLoad.catalogBuildMs.toFixed(2)} ms`,
        `lines=${latestIniLoad.lineCount}`,
        `outputChannels=${latestIniLoad.outputChannelCount}`,
        `datalogEntries=${latestIniLoad.datalogEntryCount}`,
        `catalogEntries=${latestIniLoad.catalogEntryCount}`,
        `scalar=${latestIniLoad.scalarCount}`,
        `bits=${latestIniLoad.bitCount}`,
        `expressions=${latestIniLoad.expressionCount}`,
        `datalogOnly=${latestIniLoad.datalogOnlyCount}`,
        `outputOnly=${latestIniLoad.outputOnlyCount}`,
        `diagnostics=${latestIniLoad.diagnosticCount}`,
      );
      if (latestIniLoad.diagnosticGroups.length > 0) {
        lines.push('[INI diagnostic groups]');
        for (const group of latestIniLoad.diagnosticGroups) {
          lines.push(`${group.severity.toUpperCase()} | ${group.code} | ${group.count}`);
        }
      }
    }

    const latestBinding = bindingRuns[bindingRuns.length - 1];
    if (latestBinding) {
      lines.push(
        '',
        '[INI/MLG binding]',
        `total=${latestBinding.totalMs.toFixed(2)} ms`,
        `catalogChannels=${latestBinding.catalogChannelCount}`,
        `logChannels=${latestBinding.logChannelCount}`,
        `mergedChannels=${latestBinding.mergedChannelCount}`,
        `bound=${latestBinding.boundChannelCount}`,
        `knownNoData=${latestBinding.knownNoDataCount}`,
        `logOnly=${latestBinding.logOnlyCount}`,
        `logicalKeyMatches=${latestBinding.matchedByLogicalKey}`,
        `displayNameMatches=${latestBinding.matchedByDisplayName}`,
        `displayNameUnitMatches=${latestBinding.matchedByDisplayNameUnit}`,
        `ambiguousLogChannels=${latestBinding.ambiguousLogChannelCount}`,
      );
    }

    const latestRestore = workspaceRestoreRuns[workspaceRestoreRuns.length - 1];
    if (latestRestore) {
      lines.push(
        '',
        '[Workspace restore]',
        `total=${latestRestore.totalMs.toFixed(2)} ms`,
        `prepare=${latestRestore.prepareMs.toFixed(2)} ms`,
        `prepareState=${latestRestore.prepareStateMs.toFixed(2)} ms`,
        `prepareClear=${latestRestore.prepareClearMs.toFixed(2)} ms`,
        `prepareLayout=${latestRestore.prepareLayoutMs.toFixed(2)} ms`,
        `prepareViewport=${latestRestore.prepareViewportMs.toFixed(2)} ms`,
        `preparePaneRequests=${latestRestore.preparePaneRequestsMs.toFixed(2)} ms`,
        `prepareBatchPlan=${latestRestore.prepareBatchPlanMs.toFixed(2)} ms`,
        `prepareRemainder=${Math.max(0, latestRestore.prepareMs - latestRestore.prepareStateMs - latestRestore.prepareClearMs - latestRestore.prepareLayoutMs - latestRestore.prepareViewportMs - latestRestore.preparePaneRequestsMs - latestRestore.prepareBatchPlanMs).toFixed(2)} ms`,
        `sharedBatch=${latestRestore.sharedBatchMs.toFixed(2)} ms`,
        `activation=${latestRestore.activationMs.toFixed(2)} ms`,
        `activationGraphTotal=${latestRestore.activationGraphTotalMs.toFixed(2)} ms`,
        `activationChannelLookup=${latestRestore.activationChannelLookupMs.toFixed(2)} ms`,
        `activationStatisticsScale=${latestRestore.activationStatisticsScaleMs.toFixed(2)} ms`,
        `activationTraceRegistration=${latestRestore.activationTraceRegistrationMs.toFixed(2)} ms`,
        `activationReadout=${latestRestore.activationReadoutMs.toFixed(2)} ms`,
        `activationCursor=${latestRestore.activationCursorMs.toFixed(2)} ms`,
        `activationDraw=${latestRestore.activationDrawMs.toFixed(2)} ms`,
        `activationEnvelope=${latestRestore.activationEnvelopeMs.toFixed(2)} ms`,
        `activationDrawSetup=${latestRestore.activationDrawSetupMs.toFixed(2)} ms`,
        `activationDrawTrace=${latestRestore.activationDrawTraceMs.toFixed(2)} ms`,
        `activationDrawOverlay=${latestRestore.activationDrawOverlayMs.toFixed(2)} ms`,
        `activationDrawRemainder=${Math.max(0, latestRestore.activationDrawMs - latestRestore.activationEnvelopeMs - latestRestore.activationDrawSetupMs - latestRestore.activationDrawTraceMs - latestRestore.activationDrawOverlayMs).toFixed(2)} ms`,
        `activationRemainder=${Math.max(0, latestRestore.activationMs - latestRestore.activationGraphTotalMs).toFixed(2)} ms`,
        `finalSync=${latestRestore.finalSyncMs.toFixed(2)} ms`,
        `finalSyncResolve=${latestRestore.finalSyncResolveMs.toFixed(2)} ms`,
        `finalSyncAssignedNormalize=${latestRestore.finalSyncAssignedNormalizeMs.toFixed(2)} ms`,
        `finalSyncInspectorActive=${latestRestore.finalSyncInspectorActiveMs.toFixed(2)} ms`,
        `finalSyncInspectorQueued=${latestRestore.finalSyncInspectorQueuedMs.toFixed(2)} ms`,
        `finalSyncValueSearch=${latestRestore.finalSyncValueSearchMs.toFixed(2)} ms`,
        `finalSyncAssignedSync=${latestRestore.finalSyncAssignedSyncMs.toFixed(2)} ms`,
        `finalSyncOverview=${latestRestore.finalSyncOverviewMs.toFixed(2)} ms`,
        `finalSyncRemainder=${Math.max(0, latestRestore.finalSyncMs - latestRestore.finalSyncResolveMs - latestRestore.finalSyncAssignedNormalizeMs - latestRestore.finalSyncInspectorActiveMs - latestRestore.finalSyncInspectorQueuedMs - latestRestore.finalSyncValueSearchMs - latestRestore.finalSyncAssignedSyncMs - latestRestore.finalSyncOverviewMs).toFixed(2)} ms`,
        `visiblePanes=${latestRestore.visiblePaneCount}`,
        `assignedChannels=${latestRestore.assignedChannelCount}`,
        `requestedChannels=${latestRestore.requestedChannelCount}`,
        `uniqueRequestedChannels=${latestRestore.uniqueRequestedChannelCount}`,
        `cacheHit=${latestRestore.cacheHit}`,
        `physicalReads=${latestRestore.physicalReadCount}`,
        `physicalBytes=${latestRestore.physicalBytesRead}`,
        `physicalReadMs=${latestRestore.physicalReadMs.toFixed(2)} ms`,
      );

      if (latestRestore.assignedChannelCount === 0 && (latestLoad?.channelCount ?? 0) > 0) {
        lines.push(
          '',
          '[Workspace warning]',
          'activeWorkspaceAssignedChannels=0',
          'message=Active workspace restored with zero assigned channels. This may be intentional; check the workspace selector for another populated workspace.',
        );
      }

      const decode = latestChannelDecodePerformance(latestRestore.uniqueRequestedChannelCount);
      if (decode) {
        const measured = decodeMeasuredMs(decode);
        lines.push(
          '',
          '[Channel decode detail]',
          `channels=${decode.channelCount}`,
          `samples=${decode.sampleCount}`,
          `batches=${decode.batchCount}`,
          `total=${decode.totalMs.toFixed(2)} ms`,
          `cacheResolve=${decode.cacheResolveMs.toFixed(2)} ms`,
          `batchPlan=${decode.batchPlanMs.toFixed(2)} ms`,
          `sourceReadAwait=${decode.sourceReadAwaitMs.toFixed(2)} ms`,
          `decodeTransform=${decode.decodeTransformMs.toFixed(2)} ms`,
          `resultAssembly=${decode.resultAssemblyMs.toFixed(2)} ms`,
          `cacheStore=${decode.cacheStoreMs.toFixed(2)} ms`,
          `instrumentedRemainder=${Math.max(0, decode.totalMs - measured).toFixed(2)} ms`,
        );
      }
    }

    if (channelRuns.length > 0) {
      lines.push('', '[Channel selections]');
      channelRuns.slice(-10).forEach((run, index) => {
        const lowLevel = [
          run.persistentLookupMs !== undefined ? `persistentLookup=${run.persistentLookupMs.toFixed(2)} ms` : '',
          run.persistentRangeBuildMs !== undefined ? `persistentRange=${run.persistentRangeBuildMs.toFixed(2)} ms` : '',
          run.delegatedSourceMs !== undefined ? `delegatedSource=${run.delegatedSourceMs.toFixed(2)} ms` : '',
          run.sidecarManifestMs !== undefined ? `sidecarManifest=${run.sidecarManifestMs.toFixed(2)} ms` : '',
          run.sidecarFileOpenAggregateMs !== undefined ? `sidecarFileOpenAggregate=${run.sidecarFileOpenAggregateMs.toFixed(2)} ms` : '',
          run.sidecarBlobReadAggregateMs !== undefined ? `sidecarBlobReadAggregate=${run.sidecarBlobReadAggregateMs.toFixed(2)} ms` : '',
          run.sidecarDecodeAggregateMs !== undefined ? `sidecarDecodeAggregate=${run.sidecarDecodeAggregateMs.toFixed(2)} ms` : '',
          run.sidecarRangeBuildMs !== undefined ? `sidecarRange=${run.sidecarRangeBuildMs.toFixed(2)} ms` : '',
        ].filter(Boolean).join('; ');
        lines.push(
          `${index + 1}. ${run.channelName}: phase=${run.phase}; startSample=${run.startSampleIndex}; requestedSamples=${run.requestedSampleCount}; returnedSamples=${run.sampleCount}; total=${run.totalMs.toFixed(2)} ms; readDecode=${run.readDecodeMs.toFixed(2)} ms; scale=${run.scaleMs.toFixed(2)} ms; render=${run.renderMs.toFixed(2)} ms; batch=${run.batchSize}; cacheHit=${run.cacheHit}; physicalReads=${run.physicalReadCount}; physicalBytes=${run.physicalBytesRead}; physicalReadMs=${run.physicalReadMs.toFixed(2)} ms${lowLevel ? `; ${lowLevel}` : ''}`,
        );
      });
    }
    return lines.join('\n');
}
