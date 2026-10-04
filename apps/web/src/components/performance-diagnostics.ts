import {
  clearChannelDecodePerformance,
  latestChannelDecodePerformance,
} from '../../../../core/diagnostics/channel-decode-performance';
import {
  latestBlobByteSourceRuntimeDiagnostics,
  type BlobByteSourceRuntimeDiagnostics,
} from '../adapters/blob-byte-source';

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
  readonly phase: 'viewport' | 'full' | 'cache';
  readonly startSampleIndex: number;
  readonly requestedSampleCount: number;
  readonly totalMs: number;
  readonly readDecodeMs: number;
  readonly scaleMs: number;
  readonly renderMs: number;
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


export interface PerformanceDiagnosticsController {
  readonly element: HTMLElement;
  recordLoad(run: LoadPerformanceRun): void;
  recordIniLoad(run: IniLoadPerformanceRun): void;
  recordBinding(run: ChannelBindingPerformanceRun): void;
  recordValidation(run: ValidationPerformanceRun): void;
  recordWorkspaceRestore(run: WorkspaceRestorePerformanceRun): void;
  recordChannel(run: ChannelPerformanceRun): void;
  reportText(): string;
  clear(): void;
}

function ms(value: number): string {
  return `${value.toFixed(2)} ms`;
}

function bytes(value: number): string {
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KiB`;
  return `${value} B`;
}

function decodeMeasuredMs(snapshot: ReturnType<typeof latestChannelDecodePerformance>): number {
  if (!snapshot) return 0;
  return snapshot.cacheResolveMs
    + snapshot.batchPlanMs
    + snapshot.sourceReadAwaitMs
    + snapshot.decodeTransformMs
    + snapshot.resultAssemblyMs
    + snapshot.cacheStoreMs;
}

export function createPerformanceDiagnostics(): PerformanceDiagnosticsController {
  const loadRuns: LoadPerformanceRun[] = [];
  const iniLoadRuns: IniLoadPerformanceRun[] = [];
  const bindingRuns: ChannelBindingPerformanceRun[] = [];
  const workspaceRestoreRuns: WorkspaceRestorePerformanceRun[] = [];
  const channelRuns: ChannelPerformanceRun[] = [];

  const root = document.createElement('div');
  root.className = 'performance-diagnostics-wrap';
  root.innerHTML = `
    <button type="button" class="performance-diagnostics-button" aria-haspopup="dialog" aria-expanded="false" title="Performance diagnostics">
      <span aria-hidden="true">⏱</span>
      <span>Perf</span>
    </button>
    <div class="performance-diagnostics-popover" role="dialog" aria-label="Performance diagnostics" hidden>
      <div class="performance-diagnostics-head">
        <div>
          <strong>Performance diagnostics</strong>
          <small>Current browser session</small>
        </div>
        <div class="performance-diagnostics-actions">
          <button type="button" class="performance-copy" disabled>Copy report</button>
          <button type="button" class="performance-clear" disabled>Clear</button>
          <button type="button" class="performance-close" aria-label="Close performance diagnostics">×</button>
        </div>
      </div>
      <div class="performance-empty">Open a log, load an INI, or select a channel to capture timings.</div>
      <div class="performance-content" hidden>
        <section>
          <strong>Latest log load</strong>
          <div class="performance-load"></div>
        </section>
        <section>
          <strong>Latest INI load</strong>
          <div class="performance-ini-load"></div>
        </section>
        <section>
          <strong>Latest INI/MLG binding</strong>
          <div class="performance-binding"></div>
        </section>
        <section>
          <strong>Latest workspace restore</strong>
          <div class="performance-workspace-restore"></div>
        </section>
        <section>
          <strong>Recent channel selections</strong>
          <div class="performance-channels"></div>
        </section>
      </div>
    </div>
  `;

  const button = root.querySelector<HTMLButtonElement>('.performance-diagnostics-button');
  const popover = root.querySelector<HTMLElement>('.performance-diagnostics-popover');
  const copyButton = root.querySelector<HTMLButtonElement>('.performance-copy');
  const clearButton = root.querySelector<HTMLButtonElement>('.performance-clear');
  const closeButton = root.querySelector<HTMLButtonElement>('.performance-close');
  const empty = root.querySelector<HTMLElement>('.performance-empty');
  const content = root.querySelector<HTMLElement>('.performance-content');
  const loadHost = root.querySelector<HTMLElement>('.performance-load');
  const iniLoadHost = root.querySelector<HTMLElement>('.performance-ini-load');
  const bindingHost = root.querySelector<HTMLElement>('.performance-binding');
  const workspaceRestoreHost = root.querySelector<HTMLElement>('.performance-workspace-restore');
  const channelsHost = root.querySelector<HTMLElement>('.performance-channels');

  if (!button || !popover || !copyButton || !clearButton || !closeButton || !empty || !content || !loadHost || !iniLoadHost || !bindingHost || !workspaceRestoreHost || !channelsHost) {
    throw new Error('Performance diagnostics structure is incomplete.');
  }

  const close = (): void => {
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = popover.hidden === true;
    popover.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  });
  popover.addEventListener('click', (event) => event.stopPropagation());
  closeButton.addEventListener('click', close);
  document.addEventListener('click', close);

  const reportText = (): string => {
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
          run.sidecarFileOpenMs !== undefined ? `sidecarFileOpen=${run.sidecarFileOpenMs.toFixed(2)} ms` : '',
          run.sidecarBlobReadMs !== undefined ? `sidecarBlobRead=${run.sidecarBlobReadMs.toFixed(2)} ms` : '',
          run.sidecarDecodeMs !== undefined ? `sidecarDecode=${run.sidecarDecodeMs.toFixed(2)} ms` : '',
          run.sidecarRangeBuildMs !== undefined ? `sidecarRange=${run.sidecarRangeBuildMs.toFixed(2)} ms` : '',
        ].filter(Boolean).join('; ');
        lines.push(
          `${index + 1}. ${run.channelName}: phase=${run.phase}; startSample=${run.startSampleIndex}; requestedSamples=${run.requestedSampleCount}; returnedSamples=${run.sampleCount}; total=${run.totalMs.toFixed(2)} ms; readDecode=${run.readDecodeMs.toFixed(2)} ms; scale=${run.scaleMs.toFixed(2)} ms; render=${run.renderMs.toFixed(2)} ms; batch=${run.batchSize}; cacheHit=${run.cacheHit}; physicalReads=${run.physicalReadCount}; physicalBytes=${run.physicalBytesRead}; physicalReadMs=${run.physicalReadMs.toFixed(2)} ms${lowLevel ? `; ${lowLevel}` : ''}`,
        );
      });
    }
    return lines.join('\n');
  };

  const render = (): void => {
    const hasData = loadRuns.length > 0
      || iniLoadRuns.length > 0
      || bindingRuns.length > 0
      || workspaceRestoreRuns.length > 0
      || channelRuns.length > 0;
    empty.hidden = hasData;
    content.hidden = !hasData;
    copyButton.disabled = !hasData;
    clearButton.disabled = !hasData;

    loadHost.replaceChildren();
    const latestLoad = loadRuns[loadRuns.length - 1];
    if (latestLoad) {
      const rows: [string, string][] = [
        ['File', latestLoad.fileName],
        ['Size', bytes(latestLoad.fileSizeBytes)],
        ['Import mode', latestLoad.importMode],
        ['Record scan mode', latestLoad.scanMode],
        ['Total import', ms(latestLoad.importTotalMs)],
        ['Header total', ms(latestLoad.headerMs)],
        ['Header physical read', ms(latestLoad.headerReadMs)],
        ['Header CPU', ms(latestLoad.headerCpuMs)],
        ['Record scan / CRC / index', ms(latestLoad.recordScanMs)],
        ['Record source read', ms(latestLoad.recordReadMs)],
        ['Record CPU remainder', ms(latestLoad.recordCpuMs)],
        ['Checksum bytes', bytes(latestLoad.checksumBytes)],
        ['Checksum CPU (batch est.)', ms(latestLoad.checksumCpuMs)],
        ['Checksum benchmark overhead', ms(latestLoad.checksumBenchmarkMs)],
        ['Diagnostic CPU', ms(latestLoad.diagnosticCpuMs)],
        ['Index/timestamp CPU', ms(latestLoad.indexCpuMs)],
        ['Parser finalize', ms(latestLoad.finalizeMs)],
        ['UI population', ms(latestLoad.uiPopulateMs)],
        ...(latestLoad.uiWorkspaceMs !== undefined ? [
          ['UI · workspace prep', ms(latestLoad.uiWorkspaceMs)],
          ['UI · channel model', ms(latestLoad.uiChannelModelMs ?? 0)],
          ['UI · inspector', ms(latestLoad.uiInspectorMs ?? 0)],
          ['UI · timeline', ms(latestLoad.uiTimelineMs ?? 0)],
          ['UI · graph setup', ms(latestLoad.uiGraphSetupMs ?? 0)],
          ['UI · layout', ms(latestLoad.uiLayoutMs ?? 0)],
          ['UI · value search', ms(latestLoad.uiValueSearchMs ?? 0)],
          ['UI · viewport', ms(latestLoad.uiViewportMs ?? 0)],
          ['UI · diagnostics', ms(latestLoad.uiDiagnosticsMs ?? 0)],
        ] as [string, string][] : []),
        ['Logical source reads', latestLoad.sourceReadCount.toLocaleString()],
        ['Logical source bytes', bytes(latestLoad.sourceBytesRead)],
        ['Physical Blob reads', latestLoad.physicalReadCount.toLocaleString()],
        ['Physical Blob bytes', bytes(latestLoad.physicalBytesRead)],
        ['Cache-hit bytes', bytes(latestLoad.cacheHitBytes)],
        ['Raw cache resident', `${bytes(latestLoad.cacheBytes)} · ${latestLoad.cachePageCount} pages`],
        ['Records', latestLoad.recordCount.toLocaleString()],
        ['Channels', latestLoad.channelCount.toLocaleString()],
      ];
      if (latestLoad.fullyValidatedMs !== undefined) {
        rows.push(
          ['Fully validated', ms(latestLoad.fullyValidatedMs)],
          ['CRC validation mode', latestLoad.validationMode ?? 'unknown'],
          ['CRC validation', ms(latestLoad.validationMs ?? 0)],
          ['Validation source read', ms(latestLoad.validationReadMs ?? 0)],
          ['Validation checksum CPU', ms(latestLoad.validationChecksumCpuMs ?? 0)],
          ['Validation diagnostic CPU', ms(latestLoad.validationDiagnosticCpuMs ?? 0)],
          ['Validation checksum bytes', bytes(latestLoad.validationChecksumBytes ?? 0)],
        );
      }
      for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'performance-row';
        const left = document.createElement('span');
        left.textContent = label;
        const right = document.createElement('strong');
        right.textContent = value;
        row.append(left, right);
        loadHost.append(row);
      }
    } else {
      loadHost.textContent = 'No load run captured.';
    }

    iniLoadHost.replaceChildren();
    const latestIniLoad = iniLoadRuns[iniLoadRuns.length - 1];
    if (latestIniLoad) {
      const rows: [string, string][] = [
        ['File', latestIniLoad.fileName],
        ['Size', bytes(latestIniLoad.fileSizeBytes)],
        ['Total import', ms(latestIniLoad.totalMs)],
        ['File read + text decode', ms(latestIniLoad.textReadMs)],
        ['Channel-section parse', ms(latestIniLoad.parseMs)],
        ['Catalog build', ms(latestIniLoad.catalogBuildMs)],
        ['Lines', latestIniLoad.lineCount.toLocaleString()],
        ['Output channels', latestIniLoad.outputChannelCount.toLocaleString()],
        ['Datalog entries', latestIniLoad.datalogEntryCount.toLocaleString()],
        ['Catalog entries', latestIniLoad.catalogEntryCount.toLocaleString()],
        ['Scalar outputs', latestIniLoad.scalarCount.toLocaleString()],
        ['Bit outputs', latestIniLoad.bitCount.toLocaleString()],
        ['Expression outputs', latestIniLoad.expressionCount.toLocaleString()],
        ['Datalog-only keys', latestIniLoad.datalogOnlyCount.toLocaleString()],
        ['Output-only keys', latestIniLoad.outputOnlyCount.toLocaleString()],
        ['Diagnostics', latestIniLoad.diagnosticCount.toLocaleString()],
      ];
      for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'performance-row';
        const left = document.createElement('span');
        left.textContent = label;
        const right = document.createElement('strong');
        right.textContent = value;
        row.append(left, right);
        iniLoadHost.append(row);
      }

      if (latestIniLoad.diagnosticGroups.length > 0) {
        const groups = document.createElement('div');
        groups.className = 'performance-channel-card';
        const title = document.createElement('strong');
        title.textContent = 'INI diagnostics';
        const detail = document.createElement('span');
        detail.textContent = latestIniLoad.diagnosticGroups
          .map((group) => `${group.severity}:${group.code}=${group.count}`)
          .join(' · ');
        groups.append(title, detail);
        iniLoadHost.append(groups);
      }
    } else {
      iniLoadHost.textContent = 'No INI load captured.';
    }

    bindingHost.replaceChildren();
    const latestBinding = bindingRuns[bindingRuns.length - 1];
    if (latestBinding) {
      const rows: [string, string][] = [
        ['Binding total', ms(latestBinding.totalMs)],
        ['INI catalog channels', latestBinding.catalogChannelCount.toLocaleString()],
        ['MLG channels', latestBinding.logChannelCount.toLocaleString()],
        ['Merged channels', latestBinding.mergedChannelCount.toLocaleString()],
        ['Bound channels', latestBinding.boundChannelCount.toLocaleString()],
        ['Known / no data', latestBinding.knownNoDataCount.toLocaleString()],
        ['Log-only channels', latestBinding.logOnlyCount.toLocaleString()],
        ['Logical-key matches', latestBinding.matchedByLogicalKey.toLocaleString()],
        ['Display-name matches', latestBinding.matchedByDisplayName.toLocaleString()],
        ['Display+unit matches', latestBinding.matchedByDisplayNameUnit.toLocaleString()],
        ['Ambiguous log channels', latestBinding.ambiguousLogChannelCount.toLocaleString()],
      ];
      for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'performance-row';
        const left = document.createElement('span');
        left.textContent = label;
        const right = document.createElement('strong');
        right.textContent = value;
        row.append(left, right);
        bindingHost.append(row);
      }
    } else {
      bindingHost.textContent = 'No INI/MLG binding captured.';
    }

    workspaceRestoreHost.replaceChildren();
    const latestRestore = workspaceRestoreRuns[workspaceRestoreRuns.length - 1];
    if (latestRestore) {
      const rows: [string, string][] = [
        ['Restore total', ms(latestRestore.totalMs)],
        ['Prepare', ms(latestRestore.prepareMs)],
        ['Shared cache/decode batch', ms(latestRestore.sharedBatchMs)],
        ['Pane activation', ms(latestRestore.activationMs)],
        ['Graph activation total', ms(latestRestore.activationGraphTotalMs)],
        ['Statistics + scale', ms(latestRestore.activationStatisticsScaleMs)],
        ['Graph draw', ms(latestRestore.activationDrawMs)],
        ['Envelope build', ms(latestRestore.activationEnvelopeMs)],
        ['Final sync', ms(latestRestore.finalSyncMs)],
        ['Visible panes', latestRestore.visiblePaneCount.toLocaleString()],
        ['Assigned channels', latestRestore.assignedChannelCount.toLocaleString()],
        ['Requested with data', latestRestore.requestedChannelCount.toLocaleString()],
        ['Unique requested', latestRestore.uniqueRequestedChannelCount.toLocaleString()],
        ['Shared batch cache hit', String(latestRestore.cacheHit)],
        ['Physical reads', latestRestore.physicalReadCount.toLocaleString()],
        ['Physical bytes', bytes(latestRestore.physicalBytesRead)],
        ['Physical read', ms(latestRestore.physicalReadMs)],
      ];
      const decode = latestChannelDecodePerformance(latestRestore.uniqueRequestedChannelCount);
      if (decode) {
        rows.push(
          ['Decode · batches', decode.batchCount.toLocaleString()],
          ['Decode · cache/resolve', ms(decode.cacheResolveMs)],
          ['Decode · batch planning', ms(decode.batchPlanMs)],
          ['Decode · source await', ms(decode.sourceReadAwaitMs)],
          ['Decode · raw transform', ms(decode.decodeTransformMs)],
          ['Decode · result assembly', ms(decode.resultAssemblyMs)],
          ['Decode · cache store', ms(decode.cacheStoreMs)],
          ['Decode · instrumented remainder', ms(Math.max(0, decode.totalMs - decodeMeasuredMs(decode)))],
        );
      }
      for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'performance-row';
        const left = document.createElement('span');
        left.textContent = label;
        const right = document.createElement('strong');
        right.textContent = value;
        row.append(left, right);
        workspaceRestoreHost.append(row);
      }
    } else {
      workspaceRestoreHost.textContent = 'No workspace restore captured.';
    }

    channelsHost.replaceChildren();
    if (channelRuns.length === 0) {
      channelsHost.textContent = 'No channel selections captured.';
    } else {
      for (const run of channelRuns.slice(-10).reverse()) {
        const card = document.createElement('div');
        card.className = 'performance-channel-card';
        const title = document.createElement('strong');
        title.textContent = run.channelName;
        const detail = document.createElement('span');
        const source = run.cacheHit
          ? 'decoded cache'
          : `${run.batchSize} ch batch · ${bytes(run.physicalBytesRead)} physical`;
        detail.textContent = `${run.phase} · samples ${run.startSampleIndex.toLocaleString()}–${Math.max(run.startSampleIndex, run.startSampleIndex + run.requestedSampleCount - 1).toLocaleString()} · ${ms(run.totalMs)} total · ${ms(run.readDecodeMs)} read/decode · ${ms(run.scaleMs)} scale · ${ms(run.renderMs)} render · ${source}`;
        card.append(title, detail);
        channelsHost.append(card);
      }
    }
  };

  copyButton.addEventListener('click', () => {
    void navigator.clipboard.writeText(reportText()).then(() => {
      const original = copyButton.textContent;
      copyButton.textContent = 'Copied';
      window.setTimeout(() => { copyButton.textContent = original; }, 1200);
    });
  });

  clearButton.addEventListener('click', () => {
    loadRuns.length = 0;
    iniLoadRuns.length = 0;
    bindingRuns.length = 0;
    workspaceRestoreRuns.length = 0;
    channelRuns.length = 0;
    clearChannelDecodePerformance();
    render();
  });

  render();

  return {
    element: root,
    recordLoad: (run) => {
      loadRuns.push(run);
      if (loadRuns.length > 20) loadRuns.shift();

      // A log load starts a new performance context. Workspace restore and
      // channel-selection runs are asynchronous and are recorded after this
      // point; keeping entries from the previous log makes the copied report
      // look like those reads belong to the current load.
      workspaceRestoreRuns.length = 0;
      channelRuns.length = 0;
      clearChannelDecodePerformance();
      render();
    },
    recordIniLoad: (run) => {
      iniLoadRuns.push(run);
      if (iniLoadRuns.length > 20) iniLoadRuns.shift();
      render();
    },
    recordBinding: (run) => {
      bindingRuns.push(run);
      if (bindingRuns.length > 20) bindingRuns.shift();
      render();
    },
    recordWorkspaceRestore: (run) => {
      workspaceRestoreRuns.push(run);
      if (workspaceRestoreRuns.length > 20) workspaceRestoreRuns.shift();
      render();
    },
    recordValidation: (run) => {
      for (let index = loadRuns.length - 1; index >= 0; index -= 1) {
        const current = loadRuns[index];
        if (!current || current.fileName !== run.fileName) continue;
        loadRuns[index] = {
          ...current,
          fullyValidatedMs: run.fullyValidatedMs,
          validationMs: run.validationMs,
          validationReadMs: run.validationReadMs,
          validationChecksumCpuMs: run.validationChecksumCpuMs,
          validationDiagnosticCpuMs: run.validationDiagnosticCpuMs,
          validationChecksumBytes: run.validationChecksumBytes,
          validationMode: run.validationMode,
          ...(run.sidecarStatus ? {
            sidecarStatus: run.sidecarStatus,
            sidecarTotalMs: run.sidecarTotalMs ?? 0,
            sidecarTransposeMs: run.sidecarTransposeMs ?? 0,
            sidecarWriteMs: run.sidecarWriteMs ?? 0,
            sidecarBytesWritten: run.sidecarBytesWritten ?? 0,
            sidecarStripeCount: run.sidecarStripeCount ?? 0,
            sidecarTargetStripeBytes: run.sidecarTargetStripeBytes ?? 0,
            sidecarTotalBytes: run.sidecarTotalBytes ?? 0,
          } : {}),
        };
        break;
      }
      render();
    },
    recordChannel: (run) => {
      channelRuns.push(run);
      if (channelRuns.length > 50) channelRuns.shift();
      render();
    },
    reportText,
    clear: () => {
      loadRuns.length = 0;
      iniLoadRuns.length = 0;
      bindingRuns.length = 0;
      workspaceRestoreRuns.length = 0;
      channelRuns.length = 0;
      clearChannelDecodePerformance();
      render();
    },
  };
}
