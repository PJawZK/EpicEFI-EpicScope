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
    <div class="brand-switch">
      <button type="button" class="brand brand-button" aria-label="EpicScope workspace menu" aria-haspopup="menu" aria-expanded="false">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-product">EpicScope</span>
        <span class="brand-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="global-switch-menu" role="menu" hidden>
        <div class="global-switch-head">
          <strong>EpicScope</strong>
          <small>Analysis workspace</small>
        </div>
        <button type="button" class="global-module-choice global-module-choice--active" role="menuitem" aria-current="page">
          <span class="module-icon" aria-hidden="true">⌁</span>
          <span>
            <strong>Logger / Analyzer</strong>
            <small>Recorded log analysis</small>
          </span>
          <span class="module-state">Active</span>
        </button>
      </div>
    </div>
    <div class="header-context">
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
    const nextOpen = brandMenu.hidden;
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
          parsed.channelData,
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
