import type { LoadPerformanceRun, IniLoadPerformanceRun, ChannelBindingPerformanceRun, WorkspaceRestorePerformanceRun, ChannelPerformanceRun, ValidationPerformanceRun, PerformanceRuntimeMemorySnapshot } from '../observability/performance-types';
import { clearChannelDecodePerformance } from '../../../../core/parsers/mlg/channel-decode-performance';
import { ObservabilityRecorder } from '../observability/recorder';
import { PerformanceEvidence, type PerformanceProjection } from '../observability/producers/performance';
import { buildPerformanceReport, decodeMeasuredMs } from '../observability/reports/performance-report';

export interface PerformanceDiagnosticsController {
  readonly element: HTMLElement;
  setRuntimeMemoryProvider(provider: () => PerformanceRuntimeMemorySnapshot): void;
  recordLoad(run: LoadPerformanceRun): void;
  recordIniLoad(run: IniLoadPerformanceRun): void;
  recordBinding(run: ChannelBindingPerformanceRun): void;
  recordValidation(run: ValidationPerformanceRun): void;
  recordWorkspaceRestore(run: WorkspaceRestorePerformanceRun): void;
  recordChannel(run: ChannelPerformanceRun): void;
  reportText(): string;
  captureEvidence(): PerformanceProjection;
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

export function createPerformanceDiagnostics(recorder = new ObservabilityRecorder({ sessionId: crypto.randomUUID(), maxRecordBytes: 8192 })): PerformanceDiagnosticsController {
  const evidence = new PerformanceEvidence(recorder);
  let decodeChannels: number | undefined;
  let runtimeMemoryProvider: (() => PerformanceRuntimeMemorySnapshot) | undefined;

  const root = document.createElement('div');
  root.className = 'performance-diagnostics-wrap';
  root.innerHTML = `
    <button type="button" class="performance-diagnostics-button utility-action-button" aria-haspopup="dialog" aria-expanded="false" title="Performance diagnostics">
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
          <strong>Retained memory</strong>
          <div class="performance-memory"></div>
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
  const memoryHost = root.querySelector<HTMLElement>('.performance-memory');
  const channelsHost = root.querySelector<HTMLElement>('.performance-channels');

  if (!button || !popover || !copyButton || !clearButton || !closeButton || !empty || !content || !loadHost || !iniLoadHost || !bindingHost || !workspaceRestoreHost || !memoryHost || !channelsHost) {
    throw new Error('Performance diagnostics structure is incomplete.');
  }

  const close = (): void => {
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = popover.hidden === true;
    if (open) render();
    popover.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  });
  popover.addEventListener('click', (event) => event.stopPropagation());
  closeButton.addEventListener('click', close);
  document.addEventListener('click', close);

  const projection = (captureSourceRuntime = true) => {
    evidence.captureProbes(runtimeMemoryProvider, decodeChannels, captureSourceRuntime);
    return evidence.project();
  };
  const reportText = (): string => buildPerformanceReport(projection());

  const render = (): void => {
    const state = projection(false);
    const { loadRuns, iniLoadRuns, bindingRuns, workspaceRestoreRuns, channelRuns } = state;
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
      const decode = state.decode;
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

    memoryHost.replaceChildren();
    if (!state.memory) memoryHost.textContent = 'Retained-memory evidence unavailable (check session retention/loss counters).';
    else {
      const persistentMemory = state.memory.persistent;
      const persistentAllMemory = state.memory.persistentAll;
      const boundMemory = state.memory.bound;
      const boundAllMemory = state.memory.boundAll;
      const graphMemory = state.memory.runtime;
      const memoryRows: [string, string][] = [
        ['Graph active ranges', bytes(graphMemory?.activeTraceRangeBytes ?? 0)],
        ['Persistent resident', `${bytes(persistentMemory?.residentBytes ?? 0)} · ${persistentMemory?.residentColumnCount ?? 0} columns`],
        ['Persistent peak', `${bytes(persistentMemory?.peakResidentBytes ?? 0)} · ${persistentMemory?.peakResidentColumnCount ?? 0} columns`],
        ['Persistent disk reloads', (persistentMemory?.diskLoadCount ?? 0).toLocaleString()],
        ['Persistent live sources', `${persistentAllMemory.liveSourceCount} · previous ${persistentAllMemory.previousLiveSourceCount} · collected ${persistentAllMemory.collectedSourceCount}`],
        ['Persistent all live', `${bytes(persistentAllMemory.totalResidentBytes)} · ${persistentAllMemory.totalResidentColumnCount} columns`],
        ['Persistent previous live', `${bytes(persistentAllMemory.previousResidentBytes)} · ${persistentAllMemory.previousResidentColumnCount} columns`],
        ['Bound resident', `${bytes(boundMemory?.residentBytes ?? 0)} · ${boundMemory?.residentRangeCount ?? 0} ranges`],
        ['Bound peak', `${bytes(boundMemory?.peakResidentBytes ?? 0)} · ${boundMemory?.peakResidentRangeCount ?? 0} ranges`],
        ['Bound live sources', `${boundAllMemory.liveSourceCount} · previous ${boundAllMemory.previousLiveSourceCount} · collected ${boundAllMemory.collectedSourceCount}`],
        ['Bound all live', `${bytes(boundAllMemory.totalResidentBytes)} · ${boundAllMemory.totalResidentRangeCount} ranges`],
        ['Bound previous live', `${bytes(boundAllMemory.previousResidentBytes)} · ${boundAllMemory.previousResidentRangeCount} ranges`],
        ['Evictions', '0 · not budgeted yet'],
      ];
      for (const [label, value] of memoryRows) {
        const row = document.createElement('div');
        row.className = 'performance-row';
        const left = document.createElement('span');
        left.textContent = label;
        const right = document.createElement('strong');
        right.textContent = value;
        row.append(left, right);
        memoryHost.append(row);
      }

    }

    channelsHost.replaceChildren();
    if (channelRuns.length === 0) {
      channelsHost.textContent = 'No channel selections captured.';
    } else {
      for (const run of channelRuns.slice(-24).reverse()) {
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

  const clear = (origin: 'user' | 'programmatic' = 'programmatic'): void => {
    evidence.clear(origin); decodeChannels = undefined;
    clearChannelDecodePerformance();
    if (!popover.hidden) render();
  };
  clearButton.addEventListener('click', event => clear(event.isTrusted ? 'user' : 'programmatic'));

  return {
    element: root,
    setRuntimeMemoryProvider: (provider) => { runtimeMemoryProvider = provider; if (!popover.hidden) render(); },
    recordLoad: (run) => {
      evidence.record('load', run); decodeChannels = undefined;
      clearChannelDecodePerformance();
      if (!popover.hidden) render();
    },
    recordIniLoad: (run) => { evidence.record('ini', run); if (!popover.hidden) render(); },
    recordBinding: (run) => { evidence.record('binding', run); if (!popover.hidden) render(); },
    recordWorkspaceRestore: (run) => { evidence.record('restore', run); decodeChannels = run.uniqueRequestedChannelCount; if (!popover.hidden) render(); },
    recordValidation: (run) => { evidence.record('validation', run); if (!popover.hidden) render(); },
    recordChannel: (run) => { evidence.record('channel', run); if (!popover.hidden) render(); },
    reportText,
    captureEvidence: () => projection(),
    clear,
  };
}
