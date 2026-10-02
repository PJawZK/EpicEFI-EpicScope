import { MlgFormatError } from '../../../../core/parsers/mlg/mlg-errors';
import { importMlgFile } from '../adapters/mlg-file-import';
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
      <button type="button" aria-label="Settings" title="Settings" disabled>⚙</button>
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

  if (!brandButton || !brandMenu || !openButton || !loadedLog || !appStatus || !parserStatus) {
    throw new Error('EpicScope application shell structure is incomplete.');
  }

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
  document.addEventListener('click', closeBrandMenu);

  openButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.item(0);
    fileInput.value = '';
    if (!file) return;

    openButton.disabled = true;
    loadedLog.textContent = file.name;
    appStatus.textContent = 'Indexing log…';
    parserStatus.textContent = 'LOG-MLG · reading local file';

    void importMlgFile(file)
      .then((parsed) => {
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
      })
      .catch((error: unknown) => {
        const message = importErrorMessage(error);
        loggerPage.setImportError(message);
        loadedLog.textContent = file.name;
        appStatus.textContent = 'Import failed';
        parserStatus.textContent = 'LOG-MLG · parser error';
      })
      .finally(() => {
        openButton.disabled = false;
      });
  });

  app.append(header, loggerPage.element, footer, fileInput);
  root.append(app);
}
