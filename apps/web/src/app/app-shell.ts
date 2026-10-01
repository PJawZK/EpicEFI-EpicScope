import { MlgFormatError } from '../../../../core/parsers/mlg/mlg-errors';
import { importMlgFile } from '../adapters/mlg-file-import';
import { createLoggerPage } from '../pages/logger-page';

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

  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <div class="brand" aria-label="EpicScope">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-product">EpicScope</span>
      <span class="brand-context">Logger / Analyzer</span>
    </div>
    <div class="header-context">
      <button type="button" class="surface-select" aria-haspopup="menu" disabled>
        <span>Logger / Analyzer</span><span>▾</span>
      </button>
      <span class="mode-chip">RECORDED</span>
      <span class="loaded-log" title="Loaded recorded log"><span>Log</span><strong>No log loaded</strong></span>
    </div>
    <div class="header-actions">
      <button type="button" class="open-log">Open Log</button>
      <button type="button" disabled title="Undo">↶</button>
      <button type="button" disabled title="Redo">↷</button>
      <button type="button" disabled>Tools ▾</button>
      <button type="button" aria-label="Settings" title="Settings" disabled>⚙</button>
    </div>
  `;

  const loggerPage = createLoggerPage();

  const footer = document.createElement('footer');
  footer.className = 'status-bar';
  footer.innerHTML = `
    <span class="app-status">Ready</span>
    <span>Local analysis</span>
    <span class="grow"></span>
    <span class="parser-status">LOG-MLG · local file parsing</span>
  `;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.mlg,application/octet-stream';
  fileInput.hidden = true;
  fileInput.setAttribute('aria-label', 'Open MLG log');

  const openButton = header.querySelector<HTMLButtonElement>('.open-log');
  const loadedLog = header.querySelector<HTMLElement>('.loaded-log strong');
  const appStatus = footer.querySelector<HTMLElement>('.app-status');
  const parserStatus = footer.querySelector<HTMLElement>('.parser-status');

  if (!openButton || !loadedLog || !appStatus || !parserStatus) {
    throw new Error('EpicScope application shell structure is incomplete.');
  }

  openButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.item(0);
    fileInput.value = '';
    if (!file) {
      return;
    }

    openButton.disabled = true;
    loadedLog.textContent = file.name;
    appStatus.textContent = 'Indexing log…';
    parserStatus.textContent = 'LOG-MLG · reading local file';

    void importMlgFile(file)
      .then((parsed) => {
        loggerPage.setLog(
          parsed.summary,
          parsed.recordIndex.offsets.length,
          parsed.header.version,
        );
        loadedLog.textContent = parsed.summary.source.displayName;
        appStatus.textContent = parsed.summary.diagnostics.length > 0
          ? `Loaded with ${parsed.summary.diagnostics.length} warning${parsed.summary.diagnostics.length === 1 ? '' : 's'}`
          : 'Ready';
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
