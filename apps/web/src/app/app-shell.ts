import { createLoggerPage } from '../pages/logger-page';

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
    <span>Ready</span>
    <span>Local analysis</span>
    <span class="grow"></span>
    <span>WEB-BOOT · no log source connected</span>
  `;

  app.append(header, loggerPage.element, footer);
  root.append(app);
}
