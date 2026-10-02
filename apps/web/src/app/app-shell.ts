import { MlgFormatError } from '../../../../core/parsers/mlg/mlg-errors';
import { importMlgFile } from '../adapters/mlg-file-import';
import {
  importMlgFileStaged,
  supportsStagedMlgWorker,
  type StagedMlgImportHandle,
} from '../adapters/mlg-staged-import';
import { createLoggerPage } from '../pages/logger-page';
import { createPerformanceDiagnostics } from '../components/performance-diagnostics';

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
      <button type="button" class="open-log">Open Log</button>
      <div class="logger-tools-slot"></div>
      <button type="button" disabled title="Undo">↶</button>
      <button type="button" disabled title="Redo">↷</button>
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
          <p class="settings-note">Settings are temporary and reset when EpicScope is reloaded.</p>
        </div>
      </div>
    </div>
  `;

  const footer = document.createElement('footer');
  footer.className = 'status-bar';
  footer.innerHTML = `
    <div class="diagnostics-slot"></div>
    <div class="performance-diagnostics-slot"></div>
    <span class="app-status">Ready</span>
    <span>Local analysis</span>
    <span class="grow"></span>
    <span class="parser-status">LOG-MLG · local file parsing</span>
  `;

  const graphSelectorSlot = header.querySelector<HTMLElement>('.graph-selector-slot');
  const loggerToolsSlot = header.querySelector<HTMLElement>('.logger-tools-slot');
  const diagnosticsSlot = footer.querySelector<HTMLElement>('.diagnostics-slot');
  const performanceDiagnosticsSlot = footer.querySelector<HTMLElement>('.performance-diagnostics-slot');
  if (!graphSelectorSlot || !loggerToolsSlot || !diagnosticsSlot || !performanceDiagnosticsSlot) {
    throw new Error('EpicScope application shell control slots are incomplete.');
  }
  graphSelectorSlot.append(loggerPage.graphSelector);
  loggerToolsSlot.append(loggerPage.headerTools);
  diagnosticsSlot.append(loggerPage.diagnosticsControl);
  performanceDiagnosticsSlot.append(performanceDiagnostics.element);

  loggerPage.onChannelPerformance((run) => {
    performanceDiagnostics.recordChannel({
      channelName: run.channelName,
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
    });
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.mlg,application/octet-stream';
  fileInput.hidden = true;
  fileInput.setAttribute('aria-label', 'Open MLG log');

  const brandButton = header.querySelector<HTMLButtonElement>('.brand-button');
  const brandMenu = header.querySelector<HTMLElement>('.global-switch-menu');
  const openButton = header.querySelector<HTMLButtonElement>('.open-log');
  const loadedLog = header.querySelector<HTMLElement>('.loaded-log strong');
  const appStatus = footer.querySelector<HTMLElement>('.app-status');
  const parserStatus = footer.querySelector<HTMLElement>('.parser-status');
  const settingsButton = header.querySelector<HTMLButtonElement>('.settings-button');
  const settingsPopover = header.querySelector<HTMLElement>('.settings-popover');
  const playbackSpeed = header.querySelector<HTMLSelectElement>('.setting-playback-speed');
  const samplePoints = header.querySelector<HTMLInputElement>('.setting-sample-points');
  const overviewTraces = header.querySelector<HTMLInputElement>('.setting-overview-traces');
  const performanceVisible = header.querySelector<HTMLInputElement>('.setting-performance');

  if (!brandButton || !brandMenu || !openButton || !loadedLog || !appStatus || !parserStatus || !settingsButton || !settingsPopover || !playbackSpeed || !samplePoints || !overviewTraces || !performanceVisible) {
    throw new Error('EpicScope application shell structure is incomplete.');
  }

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
    if (Number.isFinite(speed) && speed > 0) loggerPage.setPlaybackSpeed(speed);
  });

  samplePoints.addEventListener('change', () => {
    loggerPage.setHighZoomSamplePointsVisible(samplePoints.checked);
  });

  overviewTraces.addEventListener('change', () => {
    loggerPage.setTimelineOverviewTracesVisible(overviewTraces.checked);
  });

  performanceVisible.addEventListener('change', () => {
    performanceDiagnostics.element.hidden = !performanceVisible.checked;
  });

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

  loggerPage.setPlaybackSpeed(Number(playbackSpeed.value));
  loggerPage.setHighZoomSamplePointsVisible(samplePoints.checked);
  loggerPage.setTimelineOverviewTracesVisible(overviewTraces.checked);
  performanceDiagnostics.element.hidden = !performanceVisible.checked;

  let activeStagedImport: StagedMlgImportHandle | undefined;

  const recordFullLoad = (
    file: File,
    parsed: Awaited<ReturnType<typeof importMlgFile>>,
  ): void => {
    const now = (): number => globalThis.performance?.now() ?? Date.now();
    const uiStart = now();
    loggerPage.setLog(
      parsed.summary,
      parsed.recordIndex.offsets.length,
      parsed.channelData,
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
      sourceReadCount: parsed.sourceStats.readCount,
      sourceBytesRead: parsed.sourceStats.bytesRead,
      physicalReadCount: parsed.sourceStats.physicalReadCount,
      physicalBytesRead: parsed.sourceStats.physicalBytesRead,
      cacheHitBytes: parsed.sourceStats.cacheHitBytes,
      cacheBytes: parsed.sourceStats.cacheBytes,
      cachePageCount: parsed.sourceStats.cachePageCount,
    });

    loadedLog.textContent = parsed.summary.source.displayName;
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
    loadedLog.textContent = file.name;
    appStatus.textContent = 'Indexing log…';
    parserStatus.textContent = 'LOG-MLG · reading local file';

    if (!supportsStagedMlgWorker()) {
      void importOnMainThread(file)
        .catch((error: unknown) => {
          const message = importErrorMessage(error);
          loggerPage.setImportError(message);
          appStatus.textContent = 'Import failed';
          parserStatus.textContent = 'LOG-MLG · parser error';
        })
        .finally(() => { openButton.disabled = false; });
      return;
    }

    const staged = importMlgFileStaged(file);
    activeStagedImport = staged;

    void staged.indexed
      .then((indexed) => {
        if (activeStagedImport !== staged) return;

        const now = (): number => globalThis.performance?.now() ?? Date.now();
        const pendingDiagnostic = {
          code: 'mlg-crc-validation-pending',
          severity: 'info' as const,
          message: 'Record CRC validation is running in the background.',
          recoverable: true,
        };
        const uiStart = now();
        loggerPage.setLog(
          {
            ...indexed.summary,
            diagnostics: [...indexed.summary.diagnostics, pendingDiagnostic],
          },
          indexed.recordIndex.offsets.length,
          indexed.channelData,
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
          sourceReadCount: indexed.sourceStats.readCount,
          sourceBytesRead: indexed.sourceStats.bytesRead,
          physicalReadCount: indexed.sourceStats.physicalReadCount,
          physicalBytesRead: indexed.sourceStats.physicalBytesRead,
          cacheHitBytes: indexed.sourceStats.cacheHitBytes,
          cacheBytes: indexed.sourceStats.cacheBytes,
          cachePageCount: indexed.sourceStats.cachePageCount,
        });

        loadedLog.textContent = indexed.summary.source.displayName;
        appStatus.textContent = 'Ready · validating CRC…';
        parserStatus.textContent = `MLG v${indexed.header.version} · ${indexed.recordIndex.offsets.length.toLocaleString()} records · CRC validating`;
        openButton.disabled = false;

        void staged.validated
          .then((validated) => {
            if (activeStagedImport !== staged) return;
            loggerPage.setDiagnostics([
              ...validated.indexedDiagnostics,
              ...validated.diagnostics,
            ]);
            loggerPage.refreshValidity();
            performanceDiagnostics.recordValidation({
              fileName: indexed.summary.source.displayName,
              fullyValidatedMs: validated.completedMs,
              validationMs: validated.performance.totalMs,
              validationReadMs: validated.performance.sourceReadMs,
              validationChecksumCpuMs: validated.performance.checksumCpuMs,
              validationDiagnosticCpuMs: validated.performance.diagnosticCpuMs,
              validationChecksumBytes: validated.performance.checksumBytes,
            });
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
            appStatus.textContent = 'Ready · CRC validation failed';
            parserStatus.textContent = 'LOG-MLG · background CRC validation failed';
            activeStagedImport = undefined;
          });
      })
      .catch((workerError: unknown) => {
        if (activeStagedImport !== staged) return;
        activeStagedImport = undefined;
        appStatus.textContent = 'Worker unavailable · using main thread…';
        parserStatus.textContent = 'LOG-MLG · worker fallback';
        void importOnMainThread(file)
          .catch((error: unknown) => {
            const message = importErrorMessage(error ?? workerError);
            loggerPage.setImportError(message);
            appStatus.textContent = 'Import failed';
            parserStatus.textContent = 'LOG-MLG · parser error';
          })
          .finally(() => { openButton.disabled = false; });
      });
  });

  app.append(header, loggerPage.element, footer, fileInput);
  root.append(app);
}
