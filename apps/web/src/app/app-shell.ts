import type {
  ChannelDefinition,
  ImportedLogSummary,
  LogSourceIdentity,
  NumericChannelDataSource,
} from '../../../../core/log-model/log-types';
import {
  bindChannelCatalogToLog,
  type BoundChannelCatalog,
} from '../../../../core/channels/channel-binding';
import type { ChannelCatalog } from '../../../../core/channels/channel-catalog';
import { MlgFormatError } from '../../../../core/parsers/mlg/mlg-errors';
import { PersistenceFormatError } from '../../../../core/persistence/versioned-artifact';
import { importIniFile } from '../adapters/ini-file-import';
import { importMlgFile } from '../adapters/mlg-file-import';
import { clearPersistentChannelCache } from '../adapters/persistent-channel-cache';
import {
  importMlgFileStaged,
  supportsStagedMlgWorker,
  type StagedMlgImportHandle,
} from '../adapters/mlg-staged-import';
import { createLoggerPage } from '../pages/logger-page';
import { createPerformanceDiagnostics } from '../components/performance-diagnostics';
import { createApplicationWorkspaceLocalStorageAdapter } from '../adapters/application-workspace-local-storage';
import { createIniCatalogLocalStorageAdapter } from '../adapters/ini-catalog-local-storage';
import { createWorkspaceLocalStorageAdapter } from '../adapters/workspace-local-storage';
import {
  mergeLogSpecificWorkspaceState,
  migrateReusableChannelAssignmentsFromLog,
} from '../state/application-workspace-persistence';
import {
  createWorkspaceHistory,
  type WebWorkspaceState,
} from '../state/workspace-state';

function importErrorMessage(error: unknown): string {
  if (error instanceof MlgFormatError) {
    return `${error.message} [${error.code}]`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown MLG import error.';
}

export function mountAppShell(root: HTMLElement): void {
  root.replaceChildren();

  const app = document.createElement('div');
  app.className = 'epicscope-app';

  const loggerPage = createLoggerPage();
  const performanceDiagnostics = createPerformanceDiagnostics();

  interface RuntimeErrorEntry {
    readonly time: number;
    readonly kind: 'error' | 'unhandledrejection';
    readonly message: string;
    readonly source?: string;
    readonly line?: number;
    readonly column?: number;
    readonly stack?: string;
  }

  const runtimeErrors: RuntimeErrorEntry[] = [];
  const rememberRuntimeError = (entry: RuntimeErrorEntry): void => {
    runtimeErrors.push(entry);
    if (runtimeErrors.length > 50) runtimeErrors.shift();
  };

  window.addEventListener('error', (event) => {
    rememberRuntimeError({
      time: Date.now(),
      kind: 'error',
      message: event.message || 'Unknown runtime error',
      ...(event.filename ? { source: event.filename } : {}),
      ...(event.lineno ? { line: event.lineno } : {}),
      ...(event.colno ? { column: event.colno } : {}),
      ...(event.error instanceof Error && event.error.stack ? { stack: event.error.stack } : {}),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    rememberRuntimeError({
      time: Date.now(),
      kind: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejection'),
      ...(reason instanceof Error && reason.stack ? { stack: reason.stack } : {}),
    });
  });

  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <div class="header-left">
      <div class="brand-switch">
        <button type="button" class="brand brand-button" aria-label="EpicScope workspace menu" aria-haspopup="menu" aria-expanded="false">
          <span class="brand-product">EpicScope</span>
          <span class="brand-chevron" aria-hidden="true"></span>
        </button>
        <div class="global-switch-menu" role="menu" hidden>
          <div class="global-switch-head">
            <strong>EpicScope</strong>
            <small>Analysis workspace</small>
          </div>
          <button type="button" class="global-module-choice global-module-choice--active" role="menuitem" aria-current="page">
            <span>
              <strong>Logger / Analyzer</strong>
              <small>Recorded log analysis</small>
            </span>
            <span class="module-state">Active</span>
          </button>
        </div>
      </div>
      <div class="graph-selector-slot"></div>
    </div>
    <div class="header-context">
      <span class="mode-chip">RECORDED</span>
      <span class="loaded-log" title="Loaded recorded log"><span>Log</span><strong>No log loaded</strong></span>
    </div>
    <div class="header-actions">
      <button type="button" class="open-log source-load-button" data-load-state="idle">Open Log</button>
      <button type="button" class="load-ini source-load-button" data-load-state="idle">Load INI</button>
      <div class="logger-tools-slot"></div>
      <button type="button" class="workspace-undo" disabled title="Undo workspace change">↶</button>
      <button type="button" class="workspace-redo" disabled title="Redo workspace change">↷</button>
      <button type="button" disabled>Tools ▾</button>
      <div class="settings-wrap">
        <button type="button" class="settings-button" aria-label="Settings" title="Settings" aria-haspopup="dialog" aria-expanded="false">⚙</button>
        <div class="settings-popover" role="dialog" aria-label="EpicScope settings" hidden>
          <div class="settings-popover-head">
            <strong>Settings</strong>
            <small>Current Web session</small>
          </div>
          <label class="settings-field">
            <span>Playback speed</span>
            <select class="setting-playback-speed">
              <option value="0.25">0.25×</option>
              <option value="0.5">0.5×</option>
              <option value="1" selected>1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
            </select>
          </label>
          <label class="settings-toggle">
            <input type="checkbox" class="setting-sample-points" checked />
            <span>
              <strong>High-zoom sample points</strong>
              <small>Show individual recorded points at extreme zoom.</small>
            </span>
          </label>
          <label class="settings-toggle">
            <input type="checkbox" class="setting-overview-traces" checked />
            <span>
              <strong>Timeline overview traces</strong>
              <small>Show active-channel traces in the whole-log overview.</small>
            </span>
          </label>
          <label class="settings-toggle">
            <input type="checkbox" class="setting-performance" checked />
            <span>
              <strong>Performance diagnostics</strong>
              <small>Show the Perf control in the status bar.</small>
            </span>
          </label>
          <div class="settings-shortcuts">
            <div>
              <strong>Keyboard shortcuts</strong>
              <small>Open the Logger shortcut reference.</small>
            </div>
            <div class="settings-shortcuts-slot"></div>
          </div>
          <div class="settings-ini-source">
            <div>
              <strong>INI channel catalog</strong>
              <small class="settings-ini-status">No INI catalog loaded.</small>
            </div>
            <button type="button" class="setting-unload-ini" disabled>Unload INI</button>
          </div>
          <div class="settings-persistence">
            <div>
              <strong>Saved workspace</strong>
              <small class="settings-persistence-status">Workspace structure is saved locally in this browser.</small>
            </div>
            <button type="button" class="setting-forget-workspace" disabled>Forget saved log view</button>
          </div>
          <div class="settings-persistence">
            <div>
              <strong>Decoded channel cache</strong>
              <small class="settings-channel-cache-status">Up to 128 recently decoded channels are retained locally.</small>
            </div>
            <button type="button" class="setting-clear-channel-cache">Clear channel cache</button>
          </div>
          <p class="settings-note">Layouts/channel assignments are reusable across logs. Cursor, A/B, markers and ranges remain log-specific.</p>
        </div>
      </div>
    </div>
  `;

  const footer = document.createElement('footer');
  footer.className = 'status-bar';
  footer.innerHTML = `
    <div class="diagnostics-slot"></div>
    <div class="performance-diagnostics-slot"></div>
    <div class="bug-report-slot"></div>
    <span class="app-status">Ready</span>
    <span>Local analysis</span>
    <span class="grow"></span>
    <span class="parser-status">LOG-MLG · local file parsing</span>
  `;

  const graphSelectorSlot = header.querySelector<HTMLElement>('.graph-selector-slot');
  const loggerToolsSlot = header.querySelector<HTMLElement>('.logger-tools-slot');
  const settingsShortcutsSlot = header.querySelector<HTMLElement>('.settings-shortcuts-slot');
  const diagnosticsSlot = footer.querySelector<HTMLElement>('.diagnostics-slot');
  const performanceDiagnosticsSlot = footer.querySelector<HTMLElement>('.performance-diagnostics-slot');
  const bugReportSlot = footer.querySelector<HTMLElement>('.bug-report-slot');
  if (!graphSelectorSlot || !loggerToolsSlot || !settingsShortcutsSlot || !diagnosticsSlot || !performanceDiagnosticsSlot || !bugReportSlot) {
    throw new Error('EpicScope application shell control slots are incomplete.');
  }
  graphSelectorSlot.append(loggerPage.graphSelector);
  loggerToolsSlot.append(loggerPage.headerTools);
  settingsShortcutsSlot.append(loggerPage.keyboardShortcutsControl);
  diagnosticsSlot.append(loggerPage.diagnosticsControl);
  performanceDiagnosticsSlot.append(performanceDiagnostics.element);

  const bugReportButton = document.createElement('button');
  bugReportButton.type = 'button';
  bugReportButton.className = 'bug-report-button';
  bugReportButton.textContent = 'Bug report';
  bugReportButton.title = 'Capture EpicScope runtime diagnostics';

  const bugReportDialog = document.createElement('dialog');
  bugReportDialog.className = 'bug-report-dialog';
  bugReportDialog.innerHTML = `
    <form method="dialog" class="bug-report-panel">
      <header>
        <div>
          <strong>EpicScope bug report</strong>
          <small>Runtime state, channel health, errors and performance evidence</small>
        </div>
        <button type="submit" class="bug-report-close" aria-label="Close bug report">×</button>
      </header>
      <div class="bug-report-health"></div>
      <textarea class="bug-report-text" readonly spellcheck="false" aria-label="EpicScope bug report text"></textarea>
      <footer>
        <button type="button" class="bug-report-copy">Copy report</button>
        <button type="button" class="bug-report-export">Export .txt</button>
        <button type="submit">Close</button>
      </footer>
    </form>
  `;
  bugReportSlot.append(bugReportButton);

  loggerPage.onChannelPerformance((run) => {
    performanceDiagnostics.recordChannel({
      channelName: run.channelName,
      phase: run.phase,
      startSampleIndex: run.startSampleIndex,
      requestedSampleCount: run.requestedSampleCount,
      totalMs: run.totalMs,
      readDecodeMs: run.readDecodeMs,
      scaleMs: run.scaleMs,
      renderMs: run.renderMs,
      sampleCount: run.sampleCount,
      batchSize: run.batchSize,
      cacheHit: run.cacheHit,
      physicalReadCount: run.physicalReadCount,
      physicalBytesRead: run.physicalBytesRead,
      physicalReadMs: run.physicalReadMs,
      persistentLookupMs: run.persistentLookupMs,
      persistentRangeBuildMs: run.persistentRangeBuildMs,
      delegatedSourceMs: run.delegatedSourceMs,
      sidecarManifestMs: run.sidecarManifestMs,
      sidecarFileOpenAggregateMs: run.sidecarFileOpenAggregateMs,
      sidecarBlobReadAggregateMs: run.sidecarBlobReadAggregateMs,
      sidecarDecodeAggregateMs: run.sidecarDecodeAggregateMs,
      sidecarRangeBuildMs: run.sidecarRangeBuildMs,
    });
  });

  loggerPage.onWorkspaceRestorePerformance((run) => {
    performanceDiagnostics.recordWorkspaceRestore(run);
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.mlg,application/octet-stream';
  fileInput.hidden = true;
  fileInput.setAttribute('aria-label', 'Open MLG log');

  const iniInput = document.createElement('input');
  iniInput.type = 'file';
  iniInput.accept = '.ini,text/plain';
  iniInput.hidden = true;
  iniInput.setAttribute('aria-label', 'Load TunerStudio INI');

  const brandButton = header.querySelector<HTMLButtonElement>('.brand-button');
  const brandMenu = header.querySelector<HTMLElement>('.global-switch-menu');
  const openButton = header.querySelector<HTMLButtonElement>('.open-log');
  const loadIniButton = header.querySelector<HTMLButtonElement>('.load-ini');
  const loadedLog = header.querySelector<HTMLElement>('.loaded-log strong');
  const appStatus = footer.querySelector<HTMLElement>('.app-status');
  const parserStatus = footer.querySelector<HTMLElement>('.parser-status');
  const settingsButton = header.querySelector<HTMLButtonElement>('.settings-button');
  const settingsPopover = header.querySelector<HTMLElement>('.settings-popover');
  const playbackSpeed = header.querySelector<HTMLSelectElement>('.setting-playback-speed');
  const samplePoints = header.querySelector<HTMLInputElement>('.setting-sample-points');
  const overviewTraces = header.querySelector<HTMLInputElement>('.setting-overview-traces');
  const performanceVisible = header.querySelector<HTMLInputElement>('.setting-performance');
  const undoButton = header.querySelector<HTMLButtonElement>('.workspace-undo');
  const redoButton = header.querySelector<HTMLButtonElement>('.workspace-redo');
  const unloadIniButton = header.querySelector<HTMLButtonElement>('.setting-unload-ini');
  const iniStatus = header.querySelector<HTMLElement>('.settings-ini-status');
  const forgetWorkspaceButton = header.querySelector<HTMLButtonElement>('.setting-forget-workspace');
  const persistenceStatus = header.querySelector<HTMLElement>('.settings-persistence-status');
  const clearChannelCacheButton = header.querySelector<HTMLButtonElement>('.setting-clear-channel-cache');
  const channelCacheStatus = header.querySelector<HTMLElement>('.settings-channel-cache-status');

  if (!brandButton || !brandMenu || !openButton || !loadIniButton || !loadedLog || !appStatus || !parserStatus || !settingsButton || !settingsPopover || !playbackSpeed || !samplePoints || !overviewTraces || !performanceVisible || !undoButton || !redoButton || !unloadIniButton || !iniStatus || !forgetWorkspaceButton || !persistenceStatus || !clearChannelCacheButton || !channelCacheStatus) {
    throw new Error('EpicScope application shell structure is incomplete.');
  }

  clearChannelCacheButton.addEventListener('click', () => {
    clearChannelCacheButton.disabled = true;
    channelCacheStatus.textContent = 'Clearing decoded channel cache…';
    void clearPersistentChannelCache().then(() => {
      channelCacheStatus.textContent = 'Decoded channel cache cleared.';
      appStatus.textContent = 'Channel cache cleared';
    }).catch((error: unknown) => {
      channelCacheStatus.textContent = `Unable to clear cache: ${error instanceof Error ? error.message : String(error)}`;
    }).finally(() => {
      clearChannelCacheButton.disabled = false;
    });
  });

  type SourceLoadState = 'idle' | 'loading' | 'success' | 'restored' | 'issue';

  bugReportButton.addEventListener('click', () => {
    refreshBugReport();
    bugReportDialog.showModal();
  });

  bugReportDialog.querySelector<HTMLButtonElement>('.bug-report-copy')?.addEventListener('click', () => {
    const report = buildBugReport().text;
    void navigator.clipboard.writeText(report).then(() => {
      appStatus.textContent = 'Bug report copied';
    }).catch(() => {
      const textArea = bugReportDialog.querySelector<HTMLTextAreaElement>('.bug-report-text');
      if (textArea) {
        textArea.value = report;
        textArea.focus();
        textArea.select();
      }
    });
  });

  bugReportDialog.querySelector<HTMLButtonElement>('.bug-report-export')?.addEventListener('click', () => {
    const report = buildBugReport().text;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EpicScope-bug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  });

  const setSourceLoadState = (
    button: HTMLButtonElement,
    state: SourceLoadState,
    title: string,
  ): void => {
    button.dataset.loadState = state;
    button.title = title;
  };

  const hasWarningOrError = (
    diagnostics: readonly { readonly severity: 'info' | 'warning' | 'error' }[],
  ): boolean => diagnostics.some(
    (diagnostic) => diagnostic.severity === 'warning' || diagnostic.severity === 'error',
  );

  let restoringWorkspaceHistory = false;
  const workspaceStorage = createWorkspaceLocalStorageAdapter();
  const applicationWorkspaceStorage = createApplicationWorkspaceLocalStorageAdapter();
  const iniCatalogStorage = createIniCatalogLocalStorageAdapter();
  let activeWorkspaceSource: LogSourceIdentity | undefined;
  let activeIniCatalog: ChannelCatalog | undefined;
  let activeIniSourceName: string | undefined;
  let activeIniBinding: BoundChannelCatalog | undefined;
  let currentRawLog: {
    summary: ImportedLogSummary;
    recordCount: number;
    channelData: NumericChannelDataSource;
  } | undefined;
  let workspaceSaveTimer: number | undefined;
  let applicationWorkspaceSaveTimer: number | undefined;
  let workspacePersistenceBlocked = false;
  let applicationWorkspacePersistenceBlocked = false;
  let reusableWorkspacePersistenceSuspended = false;

  const buildBugReport = (): { readonly text: string; readonly issueCount: number } => {
    const snapshot = loggerPage.getRuntimeDiagnosticSnapshot();
    const workspaceState = loggerPage.getWorkspaceState();
    const issues: string[] = [];
    const warnings: string[] = [];

    if (currentRawLog && !snapshot.hasChannelDataSource) {
      issues.push('Log is loaded but Logger has no channel data source.');
    }
    if (currentRawLog && snapshot.channelDefinitionCount === 0) {
      issues.push('Log is loaded but Logger has zero channel definitions.');
    }
    if (
      snapshot.renderableAssignedChannelCount > 0
      && snapshot.activeTraceCount < snapshot.renderableAssignedChannelCount
    ) {
      issues.push(
        `${snapshot.renderableAssignedChannelCount - snapshot.activeTraceCount} of `
        + `${snapshot.renderableAssignedChannelCount} renderable channels assigned to visible panes are not active.`,
      );
    }
    if (snapshot.unavailableAssignedChannelCount > 0) {
      warnings.push(
        `${snapshot.unavailableAssignedChannelCount} assigned visible-pane channel(s) are unavailable in the current log.`,
      );
    }
    if (snapshot.activeTraceCount > snapshot.renderableAssignedChannelCount) {
      warnings.push('Active trace count exceeds renderable assigned visible-channel count.');
    }
    if (runtimeErrors.length > 0) {
      issues.push(`${runtimeErrors.length} runtime error/unhandled rejection event(s) captured.`);
    }
    if (currentRawLog && activeIniCatalog && !activeIniBinding) {
      warnings.push('INI catalog and log are loaded but no current INI/MLG binding is recorded.');
    }

    const source = currentRawLog?.summary.source;
    const bindingMetrics = activeIniBinding?.metrics;
    const lines = [
      'EpicScope runtime bug report',
      `Generated: ${new Date().toISOString()}`,
      `URL: ${location.href}`,
      `User agent: ${navigator.userAgent}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight} @ DPR ${window.devicePixelRatio}`,
      `Document visibility: ${document.visibilityState}`,
      `Online: ${navigator.onLine ? 'yes' : 'no'}`,
      `CPU threads: ${navigator.hardwareConcurrency || 'unknown'}`,
      '',
      `[Health] ${issues.length} ISSUE / ${warnings.length} WARN`,
      ...issues.map((item) => `ISSUE | ${item}`),
      ...warnings.map((item) => `WARN | ${item}`),
      ...(issues.length === 0 && warnings.length === 0 ? ['PASS | No obvious runtime-state inconsistency detected.'] : []),
      '',
      '[Source]',
      `logLoaded=${currentRawLog ? 'yes' : 'no'}`,
      `logName=${source?.displayName ?? '—'}`,
      `logSize=${source?.sizeBytes ?? '—'}`,
      `records=${currentRawLog?.recordCount ?? 0}`,
      `logChannels=${currentRawLog?.summary.channels.length ?? 0}`,
      `dataSourceSamples=${currentRawLog?.channelData.sampleCount ?? 0}`,
      `iniLoaded=${activeIniCatalog ? 'yes' : 'no'}`,
      `iniSource=${activeIniSourceName ?? '—'}`,
      `iniCatalogEntries=${activeIniCatalog?.entries.length ?? 0}`,
      `bindingActive=${activeIniBinding ? 'yes' : 'no'}`,
      ...(bindingMetrics ? [
        `bindingBound=${bindingMetrics.boundChannelCount}`,
        `bindingKnownNoData=${bindingMetrics.knownNoDataCount}`,
        `bindingLogOnly=${bindingMetrics.logOnlyCount}`,
        `bindingAmbiguous=${bindingMetrics.ambiguousLogChannelCount}`,
      ] : []),
      '',
      '[Logger runtime]',
      `hasChannelDataSource=${snapshot.hasChannelDataSource}`,
      `channelDefinitions=${snapshot.channelDefinitionCount}`,
      `catalogChannels=${snapshot.catalogChannelCount}`,
      `unavailableChannels=${snapshot.unavailableChannelCount}`,
      `channelAliases=${snapshot.aliasCount}`,
      `workspaceCount=${snapshot.workspaceCount}`,
      `activeWorkspace=${snapshot.activeWorkspaceId}`,
      `restoringWorkspace=${snapshot.restoringWorkspaceState}`,
      `visiblePanes=${snapshot.visiblePaneCount}`,
      `assignedVisibleChannels=${snapshot.assignedChannelCount}`,
      `renderableAssignedVisibleChannels=${snapshot.renderableAssignedChannelCount}`,
      `unavailableAssignedVisibleChannels=${snapshot.unavailableAssignedChannelCount}`,
      `activeVisibleTraces=${snapshot.activeTraceCount}`,
      ...snapshot.panes.map((pane) =>
        `pane=${pane.id}; visible=${pane.visible}; assigned=[${pane.assignedChannelIds.join(',')}]; `
        + `renderable=[${pane.renderableAssignedChannelIds.join(',')}]; `
        + `unavailable=[${pane.unavailableAssignedChannelIds.join(',')}]; active=[${pane.activeChannelIds.join(',')}]`
      ),
      '',
      '[Workspace state]',
      JSON.stringify(workspaceState, null, 2),
      '',
      `[Runtime errors] ${runtimeErrors.length}`,
      ...runtimeErrors.flatMap((item) => [
        `${new Date(item.time).toISOString()} ${item.kind.toUpperCase()} ${item.message}${item.source ? ` · ${item.source}:${item.line ?? 0}:${item.column ?? 0}` : ''}`,
        ...(item.stack ? [item.stack] : []),
      ]),
      '',
      '[Application status]',
      `appStatus=${appStatus.textContent ?? ''}`,
      `parserStatus=${parserStatus.textContent ?? ''}`,
      `openLogState=${openButton.dataset.loadState ?? '—'}`,
      `openLogTitle=${openButton.title}`,
      `loadIniState=${loadIniButton.dataset.loadState ?? '—'}`,
      `loadIniTitle=${loadIniButton.title}`,
      '',
      performanceDiagnostics.reportText(),
    ];

    return { text: lines.join('\n'), issueCount: issues.length };
  };

  const refreshBugReport = (): void => {
    const report = buildBugReport();
    const textArea = bugReportDialog.querySelector<HTMLTextAreaElement>('.bug-report-text');
    const health = bugReportDialog.querySelector<HTMLElement>('.bug-report-health');
    if (textArea) textArea.value = report.text;
    if (health) {
      health.textContent = report.issueCount > 0
        ? `${report.issueCount} runtime issue${report.issueCount === 1 ? '' : 's'} detected`
        : 'No obvious runtime-state inconsistency detected';
      health.dataset.state = report.issueCount > 0 ? 'issue' : 'ok';
    }
  };

  const setPersistenceStatus = (message: string): void => {
    persistenceStatus.textContent = message;
  };


  const catalogDefinitions = (catalog: ChannelCatalog): ChannelDefinition[] =>
    catalog.entries.map((entry) => ({
      id: `ini:${entry.logicalKey}`,
      sourceName: entry.sourceName,
      displayName: entry.displayName,
      valueType: entry.valueType,
      ...(entry.unit ? { unit: entry.unit } : {}),
      ...(entry.precision !== undefined ? { precision: entry.precision } : {}),
    }));

  const bindLogToActiveIni = (
    summary: ImportedLogSummary,
    channelData: NumericChannelDataSource,
  ): {
    readonly summary: ImportedLogSummary;
    readonly channelData: NumericChannelDataSource;
    readonly binding: BoundChannelCatalog | undefined;
  } => {
    if (!activeIniCatalog) {
      return { summary, channelData, binding: undefined };
    }

    const started = globalThis.performance?.now() ?? Date.now();
    const binding = bindChannelCatalogToLog(activeIniCatalog, summary.channels, channelData);
    activeIniBinding = binding;
    const totalMs = (globalThis.performance?.now() ?? Date.now()) - started;

    performanceDiagnostics.recordBinding({
      totalMs,
      ...binding.metrics,
    });

    return {
      summary: {
        ...summary,
        channels: binding.channels,
      },
      channelData: binding.dataSource,
      binding,
    };
  };

  const remapWorkspaceToRawLogIds = (
    state: WebWorkspaceState,
    binding: BoundChannelCatalog | undefined,
  ): WebWorkspaceState => {
    if (!binding) return state;
    return {
      ...state,
      logger: {
        ...state.logger,
        workspaces: state.logger.workspaces.map((workspace) => {
          const remap = (channelId: string): string =>
            binding.logicalToSourceChannelId.get(channelId) ?? channelId;
          return {
            ...workspace,
            channelIds: workspace.channelIds.map(remap),
            ...(workspace.panes
              ? {
                  panes: workspace.panes.map((pane) => ({
                    ...pane,
                    channelIds: pane.channelIds.map(remap),
                  })),
                }
              : {}),
          };
        }),
        inspector: {
          ...state.logger.inspector,
          favoriteChannelIds: state.logger.inspector.favoriteChannelIds.map(
            (channelId) => binding.logicalToSourceChannelId.get(channelId) ?? channelId,
          ),
          recentChannelIds: state.logger.inspector.recentChannelIds.map(
            (channelId) => binding.logicalToSourceChannelId.get(channelId) ?? channelId,
          ),
        },
      },
    };
  };

  const captureWorkspaceState = (): WebWorkspaceState => ({
    logger: loggerPage.getWorkspaceState(),
    settings: {
      playbackSpeed: Number(playbackSpeed.value),
      highZoomSamplePointsVisible: samplePoints.checked,
      timelineOverviewTracesVisible: overviewTraces.checked,
      performanceDiagnosticsVisible: performanceVisible.checked,
    },
  });

  const scheduleWorkspaceSave = (): void => {
    if (restoringWorkspaceHistory) return;

    if (!applicationWorkspacePersistenceBlocked && !reusableWorkspacePersistenceSuspended) {
      if (applicationWorkspaceSaveTimer !== undefined) {
        window.clearTimeout(applicationWorkspaceSaveTimer);
      }
      applicationWorkspaceSaveTimer = window.setTimeout(() => {
        applicationWorkspaceSaveTimer = undefined;
        if (applicationWorkspacePersistenceBlocked) return;
        try {
          applicationWorkspaceStorage.save(captureWorkspaceState());
          setPersistenceStatus(
            activeWorkspaceSource
              ? `Workspace structure saved · log view saved for ${activeWorkspaceSource.displayName}.`
              : 'Workspace structure saved locally.',
          );
        } catch (error) {
          applicationWorkspacePersistenceBlocked = true;
          setPersistenceStatus(
            error instanceof Error
              ? `Application workspace save unavailable: ${error.message}`
              : 'Application workspace save unavailable.',
          );
        }
      }, 250);
    }

    if (!activeWorkspaceSource || workspacePersistenceBlocked) return;
    if (workspaceSaveTimer !== undefined) window.clearTimeout(workspaceSaveTimer);
    workspaceSaveTimer = window.setTimeout(() => {
      workspaceSaveTimer = undefined;
      if (!activeWorkspaceSource || workspacePersistenceBlocked) return;
      try {
        workspaceStorage.save(activeWorkspaceSource, captureWorkspaceState());
        setPersistenceStatus(
          `Workspace structure saved · log view saved for ${activeWorkspaceSource.displayName}.`,
        );
        forgetWorkspaceButton.disabled = false;
      } catch (error) {
        workspacePersistenceBlocked = true;
        setPersistenceStatus(
          error instanceof Error
            ? `Log-specific save unavailable: ${error.message}`
            : 'Log-specific save unavailable.',
        );
      }
    }, 250);
  };

  const loadPersistedWorkspace = async (source: LogSourceIdentity): Promise<boolean> => {
    activeWorkspaceSource = source;
    workspacePersistenceBlocked = false;
    forgetWorkspaceButton.disabled = true;
    setPersistenceStatus('Checking for a saved workspace…');

    try {
      const persisted = workspaceStorage.load(source);
      if (!persisted) {
        setPersistenceStatus(`Using reusable workspace structure · no saved log view yet for ${source.displayName}.`);
        return false;
      }
      const currentApplication = captureWorkspaceState();
      const migratedApplication = activeIniBinding
        ? migrateReusableChannelAssignmentsFromLog(
            currentApplication,
            persisted.workspace,
            activeIniBinding.sourceToLogicalChannelId,
          )
        : currentApplication;
      const merged = mergeLogSpecificWorkspaceState(
        migratedApplication,
        persisted.workspace,
      );
      await restoreWorkspaceSnapshot(merged);

      // If old exact-log state supplied source-local channel assignments, the
      // migration above may have converted them to stable INI identities.
      // Persist that application structure immediately so the next INI-only
      // startup no longer depends on loading this MLG again.
      if (activeIniBinding && !reusableWorkspacePersistenceSuspended) {
        try {
          applicationWorkspaceStorage.save(captureWorkspaceState());
        } catch (error) {
          setPersistenceStatus(
            error instanceof Error
              ? `Workspace restored, but stable channel migration could not be saved: ${error.message}`
              : 'Workspace restored, but stable channel migration could not be saved.',
          );
        }
      }

      setPersistenceStatus(
        `Restored log-specific navigation for ${source.displayName} · reusable layout/channels preserved.`,
      );
      forgetWorkspaceButton.disabled = false;
      return true;
    } catch (error) {
      workspacePersistenceBlocked = true;
      forgetWorkspaceButton.disabled = false;
      if (error instanceof PersistenceFormatError) {
        setPersistenceStatus(`Saved workspace not restored: ${error.message}`);
      } else {
        setPersistenceStatus(
          error instanceof Error
            ? `Saved workspace not restored: ${error.message}`
            : 'Saved workspace could not be restored.',
        );
      }
      return false;
    }
  };

  const cloneWorkspaceState = (state: WebWorkspaceState): WebWorkspaceState =>
    structuredClone(state);

  const workspaceStatesEqual = (left: WebWorkspaceState, right: WebWorkspaceState): boolean =>
    JSON.stringify(left) === JSON.stringify(right);

  const workspaceHistory = createWorkspaceHistory<WebWorkspaceState>(
    cloneWorkspaceState,
    workspaceStatesEqual,
    80,
  );

  const refreshUndoRedo = (): void => {
    undoButton.disabled = !workspaceHistory.canUndo();
    redoButton.disabled = !workspaceHistory.canRedo();
  };

  const pushWorkspaceHistory = (): void => {
    if (restoringWorkspaceHistory) return;
    workspaceHistory.push(captureWorkspaceState());
    refreshUndoRedo();
    scheduleWorkspaceSave();
  };

  const resetWorkspaceHistory = (): void => {
    workspaceHistory.reset(captureWorkspaceState());
    refreshUndoRedo();
  };

  const restoreWorkspaceSnapshot = async (state: WebWorkspaceState): Promise<void> => {
    restoringWorkspaceHistory = true;
    try {
      playbackSpeed.value = String(state.settings.playbackSpeed);
      samplePoints.checked = state.settings.highZoomSamplePointsVisible;
      overviewTraces.checked = state.settings.timelineOverviewTracesVisible;
      performanceVisible.checked = state.settings.performanceDiagnosticsVisible;

      loggerPage.setPlaybackSpeed(state.settings.playbackSpeed);
      loggerPage.setHighZoomSamplePointsVisible(state.settings.highZoomSamplePointsVisible);
      loggerPage.setTimelineOverviewTracesVisible(state.settings.timelineOverviewTracesVisible);
      performanceDiagnostics.element.hidden = !state.settings.performanceDiagnosticsVisible;
      await loggerPage.restoreWorkspaceState(state.logger);
    } finally {
      restoringWorkspaceHistory = false;
      refreshUndoRedo();
    }
  };

  const closeSettings = (): void => {
    settingsPopover.hidden = true;
    settingsButton.setAttribute('aria-expanded', 'false');
  };

  settingsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const nextOpen = settingsPopover.hidden;
    settingsPopover.hidden = !nextOpen;
    settingsButton.setAttribute('aria-expanded', String(nextOpen));
  });
  settingsPopover.addEventListener('click', (event) => event.stopPropagation());

  playbackSpeed.addEventListener('change', () => {
    const speed = Number(playbackSpeed.value);
    if (Number.isFinite(speed) && speed > 0) {
      loggerPage.setPlaybackSpeed(speed);
      pushWorkspaceHistory();
    }
  });

  samplePoints.addEventListener('change', () => {
    loggerPage.setHighZoomSamplePointsVisible(samplePoints.checked);
    pushWorkspaceHistory();
  });

  overviewTraces.addEventListener('change', () => {
    loggerPage.setTimelineOverviewTracesVisible(overviewTraces.checked);
    pushWorkspaceHistory();
  });

  performanceVisible.addEventListener('change', () => {
    performanceDiagnostics.element.hidden = !performanceVisible.checked;
    pushWorkspaceHistory();
  });

  undoButton.addEventListener('click', () => {
    const state = workspaceHistory.undo();
    if (state) void restoreWorkspaceSnapshot(state);
  });

  redoButton.addEventListener('click', () => {
    const state = workspaceHistory.redo();
    if (state) void restoreWorkspaceSnapshot(state);
  });

  forgetWorkspaceButton.addEventListener('click', () => {
    if (!activeWorkspaceSource) return;
    if (workspaceSaveTimer !== undefined) {
      window.clearTimeout(workspaceSaveTimer);
      workspaceSaveTimer = undefined;
    }
    try {
      workspaceStorage.remove(activeWorkspaceSource);
      workspacePersistenceBlocked = false;
      forgetWorkspaceButton.disabled = true;
      setPersistenceStatus(`Saved workspace forgotten for ${activeWorkspaceSource.displayName}.`);
    } catch (error) {
      setPersistenceStatus(
        error instanceof Error
          ? `Could not forget saved workspace: ${error.message}`
          : 'Could not forget saved workspace.',
      );
    }
  });

  loggerPage.onWorkspaceMutation(pushWorkspaceHistory);

  const closeBrandMenu = (): void => {
    brandMenu.hidden = true;
    brandButton.classList.remove('brand-button--open');
    brandButton.setAttribute('aria-expanded', 'false');
  };

  brandButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const nextOpen = brandMenu.hidden === true;
    brandMenu.hidden = !nextOpen;
    brandButton.classList.toggle('brand-button--open', nextOpen);
    brandButton.setAttribute('aria-expanded', String(nextOpen));
  });
  brandMenu.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => {
    closeBrandMenu();
    closeSettings();
  });

  openButton.addEventListener('click', () => fileInput.click());
  loadIniButton.addEventListener('click', () => iniInput.click());

  unloadIniButton.addEventListener('click', () => {
    if (!activeIniCatalog) return;

    const unloadedSourceName = activeIniSourceName ?? 'INI';
    const stableWorkspaceBeforeUnload = captureWorkspaceState();

    // Preserve the reusable INI-keyed workspace before entering temporary
    // raw-MLG mode. Raw source-local IDs must never replace application
    // workspace identity in persistence.
    try {
      applicationWorkspaceStorage.save(stableWorkspaceBeforeUnload);
    } catch (error) {
      setPersistenceStatus(
        error instanceof Error
          ? `INI unloaded, but reusable workspace could not be preserved: ${error.message}`
          : 'INI unloaded, but reusable workspace could not be preserved.',
      );
    }

    reusableWorkspacePersistenceSuspended = true;
    const rawWorkspaceForOpenLog = remapWorkspaceToRawLogIds(
      stableWorkspaceBeforeUnload,
      activeIniBinding,
    );

    try {
      iniCatalogStorage.remove();
    } catch (error) {
      setPersistenceStatus(
        error instanceof Error
          ? `INI catalog unloaded, but saved catalog could not be removed: ${error.message}`
          : 'INI catalog unloaded, but saved catalog could not be removed.',
      );
    }

    activeIniCatalog = undefined;
    activeIniSourceName = undefined;
    activeIniBinding = undefined;
    loggerPage.clearChannelCatalog();

    setSourceLoadState(
      loadIniButton,
      'idle',
      'No INI catalog loaded. Load an INI to rebuild the channel catalog.',
    );
    unloadIniButton.disabled = true;
    iniStatus.textContent = 'No INI catalog loaded.';

    if (currentRawLog) {
      loggerPage.setLog(
        currentRawLog.summary,
        currentRawLog.recordCount,
        currentRawLog.channelData,
      );
      void restoreWorkspaceSnapshot(rawWorkspaceForOpenLog).then(() => {
        resetWorkspaceHistory();
      });
      parserStatus.textContent =
        `LOG-MLG · ${currentRawLog.summary.channels.length.toLocaleString()} raw log channels · INI unloaded`;
      appStatus.textContent = `${unloadedSourceName} unloaded · raw log channels active`;
    } else {
      void restoreWorkspaceSnapshot(stableWorkspaceBeforeUnload).then(() => {
        resetWorkspaceHistory();
      });
      parserStatus.textContent = 'TUNE-INI · no catalog loaded';
      appStatus.textContent = `${unloadedSourceName} unloaded`;
    }
  });

  iniInput.addEventListener('change', () => {
    const file = iniInput.files?.item(0);
    iniInput.value = '';
    if (!file) return;

    loadIniButton.disabled = true;
    setSourceLoadState(loadIniButton, 'loading', `Loading ${file.name}`);
    appStatus.textContent = 'Loading INI…';
    parserStatus.textContent = 'TUNE-INI · reading local file';

    void importIniFile(file)
      .then((imported) => {
        const grouped = new Map<string, {
          code: string;
          severity: 'info' | 'warning' | 'error';
          count: number;
        }>();
        for (const diagnostic of imported.diagnostics) {
          const current = grouped.get(diagnostic.code);
          if (current) {
            current.count += 1;
          } else {
            grouped.set(diagnostic.code, {
              code: diagnostic.code,
              severity: diagnostic.severity,
              count: 1,
            });
          }
        }

        performanceDiagnostics.recordIniLoad({
          fileName: imported.fileName,
          ...imported.performance,
          diagnosticGroups: [...grouped.values()],
        });

        const definitions = catalogDefinitions(imported.catalog);
        activeIniCatalog = imported.catalog;
        activeIniSourceName = imported.fileName;
        activeIniBinding = undefined;
        try {
          iniCatalogStorage.save(imported.fileName, imported.catalog);
        } catch (error) {
          setPersistenceStatus(
            error instanceof Error
              ? `INI catalog loaded but could not be saved locally: ${error.message}`
              : 'INI catalog loaded but could not be saved locally.',
          );
        }
        loggerPage.setChannelCatalog(definitions, imported.fileName);
        unloadIniButton.disabled = false;
        iniStatus.textContent =
          `${imported.fileName} · ${imported.catalog.entries.length.toLocaleString()} channels · loaded this session`;

        if (currentRawLog) {
          const persistedReusable = reusableWorkspacePersistenceSuspended
            ? applicationWorkspaceStorage.load()?.workspace
            : undefined;
          const workspaceBeforeBinding = persistedReusable ?? captureWorkspaceState();
          const prepared = bindLogToActiveIni(
            currentRawLog.summary,
            currentRawLog.channelData,
          );
          loggerPage.setLog(
            prepared.summary,
            currentRawLog.recordCount,
            prepared.channelData,
            prepared.binding
              ? {
                  unavailableChannelIds: [...prepared.binding.unavailableChannelIds],
                  channelIdAliases: prepared.binding.workspaceChannelAliases,
                }
              : undefined,
          );
          void restoreWorkspaceSnapshot(workspaceBeforeBinding).then(() => {
            reusableWorkspacePersistenceSuspended = false;
            resetWorkspaceHistory();
            scheduleWorkspaceSave();
          });
        } else if (reusableWorkspacePersistenceSuspended) {
          const persistedReusable = applicationWorkspaceStorage.load();
          if (persistedReusable) {
            void restoreWorkspaceSnapshot(persistedReusable.workspace).then(() => {
              reusableWorkspacePersistenceSuspended = false;
              resetWorkspaceHistory();
              scheduleWorkspaceSave();
            });
          } else {
            reusableWorkspacePersistenceSuspended = false;
            scheduleWorkspaceSave();
          }
        }

        const warnings = imported.diagnostics.filter(
          (diagnostic) => diagnostic.severity === 'warning',
        ).length;
        const errors = imported.diagnostics.filter(
          (diagnostic) => diagnostic.severity === 'error',
        ).length;

        const iniHasIssues = errors > 0 || warnings > 0;
        setSourceLoadState(
          loadIniButton,
          iniHasIssues ? 'issue' : 'success',
          `${imported.fileName} · ${imported.catalog.entries.length.toLocaleString()} catalog channels · loaded this session`
            + (iniHasIssues ? ` · ${errors + warnings} diagnostic issue${errors + warnings === 1 ? '' : 's'}` : ''),
        );

        appStatus.textContent = errors > 0
          ? `INI loaded · ${errors.toLocaleString()} error diagnostic${errors === 1 ? '' : 's'}`
          : warnings > 0
            ? `INI loaded · ${warnings.toLocaleString()} warning${warnings === 1 ? '' : 's'}`
            : 'INI loaded';

        parserStatus.textContent =
          `INI · ${imported.catalog.entries.length.toLocaleString()} catalog channels · `
          + `${imported.parsed.outputChannels.length.toLocaleString()} outputs · local only`;
        scheduleWorkspaceSave();
      })
      .catch((error: unknown) => {
        setSourceLoadState(
          loadIniButton,
          'issue',
          error instanceof Error ? `INI load failed: ${error.message}` : 'INI load failed',
        );
        appStatus.textContent = 'INI load failed';
        parserStatus.textContent = error instanceof Error
          ? `TUNE-INI · ${error.message}`
          : 'TUNE-INI · parser error';
      })
      .finally(() => {
        loadIniButton.disabled = false;
      });
  });

  const restoreReusableApplicationState = async (): Promise<void> => {
    try {
      const persistedCatalog = iniCatalogStorage.load();
      if (persistedCatalog) {
        activeIniCatalog = persistedCatalog.catalog;
        activeIniSourceName = persistedCatalog.sourceName;
        reusableWorkspacePersistenceSuspended = false;
        activeIniBinding = undefined;
        loggerPage.setChannelCatalog(
          catalogDefinitions(persistedCatalog.catalog),
          persistedCatalog.sourceName,
        );
        setSourceLoadState(
          loadIniButton,
          'restored',
          `${persistedCatalog.sourceName} · restored local channel catalog · `
            + `${persistedCatalog.catalog.entries.length.toLocaleString()} channels`,
        );
        unloadIniButton.disabled = false;
        iniStatus.textContent =
          `${persistedCatalog.sourceName} · ${persistedCatalog.catalog.entries.length.toLocaleString()} channels · restored locally`;
        parserStatus.textContent =
          `INI · ${persistedCatalog.catalog.entries.length.toLocaleString()} catalog channels · restored locally`;
      } else {
        activeIniSourceName = undefined;
        unloadIniButton.disabled = true;
        iniStatus.textContent = 'No INI catalog loaded.';
      }
    } catch (error) {
      unloadIniButton.disabled = true;
      iniStatus.textContent = 'Saved INI catalog could not be restored.';
      setSourceLoadState(
        loadIniButton,
        'issue',
        error instanceof Error
          ? `Saved INI catalog not restored: ${error.message}`
          : 'Saved INI catalog not restored',
      );
    }

    try {
      const persisted = applicationWorkspaceStorage.load();
      if (persisted) {
        await restoreWorkspaceSnapshot(persisted.workspace);
        setPersistenceStatus('Reusable workspace structure restored locally.');
      } else {
        setPersistenceStatus('Workspace structure will be saved locally after the first change.');
      }
    } catch (error) {
      applicationWorkspacePersistenceBlocked = true;
      setPersistenceStatus(
        error instanceof Error
          ? `Reusable workspace not restored: ${error.message}`
          : 'Reusable workspace could not be restored.',
      );
    }

    resetWorkspaceHistory();
  };

  loggerPage.setPlaybackSpeed(Number(playbackSpeed.value));
  loggerPage.setHighZoomSamplePointsVisible(samplePoints.checked);
  loggerPage.setTimelineOverviewTracesVisible(overviewTraces.checked);
  performanceDiagnostics.element.hidden = !performanceVisible.checked;
  void restoreReusableApplicationState();

  let activeStagedImport: StagedMlgImportHandle | undefined;

  const priorityCaptureSelectorsForWorkspace = (workspaceState: WebWorkspaceState) => {
    const activeWorkspace = workspaceState.logger.workspaces.find((workspace) => workspace.id === workspaceState.logger.activeWorkspaceId);
    if (!activeWorkspace) return [];
    const ids = new Set<string>();
    if (activeWorkspace.panes && activeWorkspace.panes.length > 0) {
      for (const pane of activeWorkspace.panes) for (const id of pane.channelIds) ids.add(id);
    } else {
      for (const id of activeWorkspace.channelIds) ids.add(id);
    }
    const selectors: Array<{ logicalChannelId: string; logicalKey?: string; displayName?: string; unit?: string; sourceChannelId?: string }> = [];
    for (const logicalChannelId of ids) {
      if (logicalChannelId.startsWith('mlg:')) { selectors.push({ logicalChannelId, sourceChannelId: logicalChannelId }); continue; }
      if (!logicalChannelId.startsWith('ini:') || !activeIniCatalog) continue;
      const logicalKey = logicalChannelId.slice(4);
      const entry = activeIniCatalog.byLogicalKey.get(logicalKey);
      if (!entry) continue;
      selectors.push({ logicalChannelId, logicalKey: entry.logicalKey, displayName: entry.displayName, ...(entry.unit ? { unit: entry.unit } : {}) });
    }
    return selectors;
  };

  const prioritizedWorkspaceSourceChannelIds = (
    workspaceState: WebWorkspaceState,
    logicalToSourceChannelId: ReadonlyMap<string, string> | undefined,
  ): string[] => {
    const activeWorkspace = workspaceState.logger.workspaces.find(
      (workspace) => workspace.id === workspaceState.logger.activeWorkspaceId,
    );
    if (!activeWorkspace) return [];

    const logicalIds = new Set<string>();
    if (activeWorkspace.panes && activeWorkspace.panes.length > 0) {
      for (const pane of activeWorkspace.panes) {
        for (const channelId of pane.channelIds) logicalIds.add(channelId);
      }
    } else {
      for (const channelId of activeWorkspace.channelIds) logicalIds.add(channelId);
    }

    const sourceIds = new Set<string>();
    for (const channelId of logicalIds) {
      const sourceId = logicalToSourceChannelId?.get(channelId)
        ?? (channelId.startsWith('mlg:') ? channelId : undefined);
      if (sourceId) sourceIds.add(sourceId);
    }
    return [...sourceIds];
  };

  const recordFullLoad = (
    file: File,
    parsed: Awaited<ReturnType<typeof importMlgFile>>,
  ): void => {
    const now = (): number => globalThis.performance?.now() ?? Date.now();
    currentRawLog = {
      summary: parsed.summary,
      recordCount: parsed.recordIndex.offsets.length,
      channelData: parsed.channelData,
    };
    const prepared = bindLogToActiveIni(parsed.summary, parsed.channelData);
    const uiStart = now();
    const uiPerformance = loggerPage.setLog(
      prepared.summary,
      parsed.recordIndex.offsets.length,
      prepared.channelData,
      prepared.binding
        ? {
            unavailableChannelIds: [...prepared.binding.unavailableChannelIds],
            channelIdAliases: prepared.binding.workspaceChannelAliases,
          }
        : undefined,
    );
    const uiPopulateMs = now() - uiStart;

    performanceDiagnostics.recordLoad({
      fileName: parsed.summary.source.displayName,
      importMode: 'main-thread-full',
      scanMode: parsed.performance.scanMode,
      fileSizeBytes: parsed.summary.source.sizeBytes ?? file.size,
      recordCount: parsed.recordIndex.offsets.length,
      channelCount: parsed.summary.channels.length,
      importTotalMs: parsed.importTotalMs,
      headerMs: parsed.performance.headerMs,
      headerReadMs: parsed.performance.headerReadMs,
      headerCpuMs: parsed.performance.headerCpuMs,
      recordScanMs: parsed.performance.recordScanMs,
      recordReadMs: parsed.performance.recordReadMs,
      recordCpuMs: parsed.performance.recordCpuMs,
      checksumBytes: parsed.performance.checksumBytes,
      checksumCpuMs: parsed.performance.checksumCpuMs,
      checksumBenchmarkMs: parsed.performance.checksumBenchmarkMs,
      diagnosticCpuMs: parsed.performance.diagnosticCpuMs,
      indexCpuMs: parsed.performance.indexCpuMs,
      finalizeMs: parsed.performance.finalizeMs,
      uiPopulateMs,
      uiWorkspaceMs: uiPerformance.workspaceMs,
      uiChannelModelMs: uiPerformance.channelModelMs,
      uiInspectorMs: uiPerformance.inspectorMs,
      uiTimelineMs: uiPerformance.timelineMs,
      uiGraphSetupMs: uiPerformance.graphSetupMs,
      uiLayoutMs: uiPerformance.layoutMs,
      uiValueSearchMs: uiPerformance.valueSearchMs,
      uiViewportMs: uiPerformance.viewportMs,
      uiDiagnosticsMs: uiPerformance.diagnosticsMs,
      sourceReadCount: parsed.sourceStats.readCount,
      sourceBytesRead: parsed.sourceStats.bytesRead,
      physicalReadCount: parsed.sourceStats.physicalReadCount,
      physicalBytesRead: parsed.sourceStats.physicalBytesRead,
      cacheHitBytes: parsed.sourceStats.cacheHitBytes,
      cacheBytes: parsed.sourceStats.cacheBytes,
      cachePageCount: parsed.sourceStats.cachePageCount,
    });

    void loadPersistedWorkspace(parsed.summary.source).then(async (restored) => {
      if (!restored) await loggerPage.restoreActiveWorkspace();
      resetWorkspaceHistory();
      scheduleWorkspaceSave();
    });

    loadedLog.textContent = parsed.summary.source.displayName;
    setSourceLoadState(
      openButton,
      hasWarningOrError(parsed.summary.diagnostics) ? 'issue' : 'success',
      `${parsed.summary.source.displayName} · ${parsed.recordIndex.offsets.length.toLocaleString()} records`,
    );
    appStatus.textContent = 'Ready';
    parserStatus.textContent = `MLG v${parsed.header.version} · ${parsed.recordIndex.offsets.length.toLocaleString()} records · local only`;
  };

  const importOnMainThread = async (file: File): Promise<void> => {
    const parsed = await importMlgFile(file);
    recordFullLoad(file, parsed);
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.item(0);
    fileInput.value = '';
    if (!file) return;

    activeStagedImport?.cancel();
    activeStagedImport = undefined;
    openButton.disabled = true;
    setSourceLoadState(openButton, 'loading', `Loading ${file.name}`);
    loadedLog.textContent = file.name;
    appStatus.textContent = 'Indexing log…';
    parserStatus.textContent = 'LOG-MLG · reading local file';

    if (!supportsStagedMlgWorker()) {
      void importOnMainThread(file)
        .catch((error: unknown) => {
          const message = importErrorMessage(error);
          currentRawLog = undefined;
          loggerPage.setImportError(message);
          activeWorkspaceSource = undefined;
          workspacePersistenceBlocked = false;
          forgetWorkspaceButton.disabled = true;
          setPersistenceStatus('Open a log to enable per-log local restore.');
          setSourceLoadState(openButton, 'issue', `Log import failed: ${message}`);
          appStatus.textContent = 'Import failed';
          parserStatus.textContent = 'LOG-MLG · parser error';
        })
        .finally(() => { openButton.disabled = false; });
      return;
    }

    const priorityCapture = priorityCaptureSelectorsForWorkspace(captureWorkspaceState());
    const staged = importMlgFileStaged(file, priorityCapture);
    activeStagedImport = staged;

    void staged.indexed
      .then((indexed) => {
        if (activeStagedImport !== staged) return;

        const now = (): number => globalThis.performance?.now() ?? Date.now();
        const pendingDiagnostic = {
          code: 'mlg-crc-validation-pending',
          severity: 'info' as const,
          message: 'Record CRC validation is queued until the initial workspace channel restore completes.',
          recoverable: true,
        };
        const reusableWorkspaceBeforeLog = captureWorkspaceState();
        const rawSummary: ImportedLogSummary = {
          ...indexed.summary,
          diagnostics: [...indexed.summary.diagnostics, pendingDiagnostic],
        };
        currentRawLog = {
          summary: rawSummary,
          recordCount: indexed.recordIndex.offsets.length,
          channelData: indexed.channelData,
        };
        const prepared = bindLogToActiveIni(rawSummary, indexed.channelData);
        const uiStart = now();
        const uiPerformance = loggerPage.setLog(
          prepared.summary,
          indexed.recordIndex.offsets.length,
          prepared.channelData,
          prepared.binding
            ? {
                unavailableChannelIds: [...prepared.binding.unavailableChannelIds],
                channelIdAliases: prepared.binding.workspaceChannelAliases,
              }
            : undefined,
        );
        const uiPopulateMs = now() - uiStart;

        performanceDiagnostics.recordLoad({
          fileName: indexed.summary.source.displayName,
          importMode: 'worker-staged',
          scanMode: indexed.performance.scanMode,
          fileSizeBytes: indexed.summary.source.sizeBytes ?? file.size,
          recordCount: indexed.recordIndex.offsets.length,
          channelCount: indexed.summary.channels.length,
          importTotalMs: indexed.importTotalMs,
          headerMs: indexed.performance.headerMs,
          headerReadMs: indexed.performance.headerReadMs,
          headerCpuMs: indexed.performance.headerCpuMs,
          recordScanMs: indexed.performance.recordScanMs,
          recordReadMs: indexed.performance.recordReadMs,
          recordCpuMs: indexed.performance.recordCpuMs,
          checksumBytes: 0,
          checksumCpuMs: 0,
          checksumBenchmarkMs: 0,
          diagnosticCpuMs: indexed.performance.diagnosticCpuMs,
          indexCpuMs: indexed.performance.indexCpuMs,
          finalizeMs: indexed.performance.finalizeMs,
          uiPopulateMs,
          uiWorkspaceMs: uiPerformance.workspaceMs,
          uiChannelModelMs: uiPerformance.channelModelMs,
          uiInspectorMs: uiPerformance.inspectorMs,
          uiTimelineMs: uiPerformance.timelineMs,
          uiGraphSetupMs: uiPerformance.graphSetupMs,
          uiLayoutMs: uiPerformance.layoutMs,
          uiValueSearchMs: uiPerformance.valueSearchMs,
          uiViewportMs: uiPerformance.viewportMs,
          uiDiagnosticsMs: uiPerformance.diagnosticsMs,
          sourceReadCount: indexed.sourceStats.readCount,
          sourceBytesRead: indexed.sourceStats.bytesRead,
          physicalReadCount: indexed.sourceStats.physicalReadCount,
          physicalBytesRead: indexed.sourceStats.physicalBytesRead,
          cacheHitBytes: indexed.sourceStats.cacheHitBytes,
          cacheBytes: indexed.sourceStats.cacheBytes,
          cachePageCount: indexed.sourceStats.cachePageCount,
          workerSourceRuntime: indexed.sourceRuntime,
        });

        const prioritizedSourceChannelIds = prioritizedWorkspaceSourceChannelIds(
          reusableWorkspaceBeforeLog,
          prepared.binding?.logicalToSourceChannelId,
        );
        staged.startValidation(prioritizedSourceChannelIds);

        const workspaceRestore = loadPersistedWorkspace(indexed.summary.source).then(async (restored) => {
          if (!restored) await loggerPage.restoreActiveWorkspace();
          resetWorkspaceHistory();
          scheduleWorkspaceSave();
        });
        void workspaceRestore.catch(() => undefined);

        loadedLog.textContent = indexed.summary.source.displayName;
        setSourceLoadState(
          openButton,
          'loading',
          prioritizedSourceChannelIds.length > 0
            ? `${indexed.summary.source.displayName} · prioritizing ${prioritizedSourceChannelIds.length.toLocaleString()} restored channel(s) during CRC validation`
            : `${indexed.summary.source.displayName} · CRC validating`,
        );
        appStatus.textContent = prioritizedSourceChannelIds.length > 0
          ? 'Ready · prioritizing restored channels during CRC…'
          : 'Ready · validating CRC…';
        parserStatus.textContent = `MLG v${indexed.header.version} · ${indexed.recordIndex.offsets.length.toLocaleString()} records · CRC validating`;
        openButton.disabled = false;

        void staged.validated
          .then((validated) => {
            if (activeStagedImport !== staged) return;
            if (currentRawLog?.channelData === indexed.channelData) {
              currentRawLog = {
                ...currentRawLog,
                summary: {
                  ...indexed.summary,
                  diagnostics: validated.diagnostics,
                },
              };
            }
            loggerPage.setDiagnostics(validated.diagnostics);
            loggerPage.refreshValidity();
            performanceDiagnostics.recordValidation({
              fileName: indexed.summary.source.displayName,
              fullyValidatedMs: validated.completedMs,
              validationMs: validated.performance.totalMs,
              validationReadMs: validated.performance.sourceReadMs,
              validationChecksumCpuMs: validated.performance.checksumCpuMs,
              validationDiagnosticCpuMs: validated.performance.diagnosticCpuMs,
              validationChecksumBytes: validated.performance.checksumBytes,
              validationMode: validated.validationMode,
              ...(validated.sidecar ? {
                sidecarStatus: validated.sidecar.performance.totalMs === 0 ? 'reused' as const : 'built' as const,
                sidecarTotalMs: validated.sidecar.performance.totalMs,
                sidecarTransposeMs: validated.sidecar.performance.transposeMs,
                sidecarWriteMs: validated.sidecar.performance.writeMs,
                sidecarBytesWritten: validated.sidecar.performance.bytesWritten,
                sidecarStripeCount: validated.sidecar.manifest.stripes.length,
                sidecarTargetStripeBytes: validated.sidecar.manifest.targetStripeBytes,
                sidecarTotalBytes: validated.sidecar.manifest.totalBytes,
              } : {}),
            });
            setSourceLoadState(
              openButton,
              hasWarningOrError(validated.diagnostics) ? 'issue' : 'success',
              `${indexed.summary.source.displayName} · CRC validated · ${indexed.recordIndex.offsets.length.toLocaleString()} records`,
            );
            appStatus.textContent = 'Ready';
            parserStatus.textContent = `MLG v${indexed.header.version} · ${indexed.recordIndex.offsets.length.toLocaleString()} records · CRC validated · local only`;
            activeStagedImport = undefined;
          })
          .catch((error: unknown) => {
            if (activeStagedImport !== staged) return;
            loggerPage.setDiagnostics([
              ...indexed.summary.diagnostics,
              {
                code: 'mlg-crc-validation-failed',
                severity: 'error',
                message: error instanceof Error ? error.message : 'CRC validation worker failed.',
                recoverable: true,
              },
            ]);
            setSourceLoadState(openButton, 'issue', 'Log loaded, but CRC validation failed');
            appStatus.textContent = 'Ready · CRC validation failed';
            parserStatus.textContent = 'LOG-MLG · background CRC validation failed';
            activeStagedImport = undefined;
          });
      })
      .catch((workerError: unknown) => {
        if (activeStagedImport !== staged) return;
        activeStagedImport = undefined;
        setSourceLoadState(openButton, 'loading', `${file.name} · worker unavailable, using main thread`);
        appStatus.textContent = 'Worker unavailable · using main thread…';
        parserStatus.textContent = 'LOG-MLG · worker fallback';
        void importOnMainThread(file)
          .catch((error: unknown) => {
            const message = importErrorMessage(error ?? workerError);
            currentRawLog = undefined;
            loggerPage.setImportError(message);
            setSourceLoadState(openButton, 'issue', `Log import failed: ${message}`);
            appStatus.textContent = 'Import failed';
            parserStatus.textContent = 'LOG-MLG · parser error';
          })
          .finally(() => { openButton.disabled = false; });
      });
  });

  app.append(header, loggerPage.element, footer, fileInput, iniInput, bugReportDialog);
  root.append(app);
}
