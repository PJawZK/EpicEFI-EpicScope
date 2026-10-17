import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import './ve-analyzer-v50-table-header.css';

/**
 * Compact v50 presentation over the existing v7 table-layout/result controls.
 * Existing selects, tab buttons and shared toolbar remain the semantic owners;
 * this adapter only supplies the reference workbench composition.
 */
export function installVeAnalyzerV50TableHeader(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  if (root.querySelector('.ve-v50-table-head')) return inner;

  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  const vePanel = veHost?.closest<HTMLElement>('.ve-workbench-panel');
  const header = vePanel?.querySelector<HTMLElement>(':scope > header');
  if (!header) return inner;

  header.classList.add('ve-v50-table-head');
  const titleBlock = header.querySelector<HTMLElement>(':scope > div:not(.ve-table-header-controls)');
  const title = titleBlock?.querySelector<HTMLElement>('strong');
  const identity = titleBlock?.querySelector<HTMLElement>('span');
  if (title) title.textContent = 'VE Table';

  const controls = header.querySelector<HTMLElement>('.ve-table-header-controls');
  if (!controls) return inner;

  const layout = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer table view"]');
  const resultView = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer result view"]');
  const veSelect = root.querySelector<HTMLSelectElement>('select[data-role="ve-table"]');
  const targetSelect = root.querySelector<HTMLSelectElement>('select[data-role="target-table"]');
  const tabs = root.querySelector<HTMLElement>('.ve-workbench-table-tabs');
  const veTab = tabs?.querySelector<HTMLButtonElement>('[data-table-tab="ve"]');
  const targetTab = tabs?.querySelector<HTMLButtonElement>('[data-table-tab="target"]');

  const actions = document.createElement('div');
  actions.className = 've-v50-table-actions';

  const toolbarHost = document.createElement('div');
  toolbarHost.className = 've-v50-table-toolbar-host';

  const resultHost = document.createElement('label');
  resultHost.className = 've-v50-result-view-host';
  if (resultView) resultHost.append(resultView);

  const targetHost = document.createElement('label');
  targetHost.className = 've-v50-target-host';
  const targetCaption = document.createElement('span');
  targetCaption.textContent = 'Target:';
  if (targetSelect) targetHost.append(targetCaption, targetSelect);

  const splitButton = document.createElement('button');
  splitButton.type = 'button';
  splitButton.className = 've-v50-table-icon-button';
  splitButton.setAttribute('aria-label', 'Toggle VE and Target split view');
  splitButton.title = 'Toggle VE + Target split view';
  splitButton.innerHTML = '<span aria-hidden="true">▥</span>';
  splitButton.addEventListener('click', () => {
    if (!layout) return;
    layout.value = layout.value === 'single' ? 'side-by-side' : 'single';
    layout.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const evidenceButton = document.createElement('button');
  evidenceButton.type = 'button';
  evidenceButton.className = 've-v50-table-icon-button';
  evidenceButton.setAttribute('aria-label', 'Cell Evidence');
  evidenceButton.title = 'Cell Evidence';
  evidenceButton.textContent = 'ⓘ';
  evidenceButton.addEventListener('click', () => {
    root.querySelector<HTMLButtonElement>('.ve-proposal-shared-toolbar button[aria-label="Cell Evidence"]')?.click();
  });

  const flipButton = document.createElement('button');
  flipButton.type = 'button';
  flipButton.className = 've-v50-table-flip';
  flipButton.addEventListener('click', () => {
    const targetActive = targetTab?.getAttribute('aria-selected') === 'true';
    (targetActive ? veTab : targetTab)?.click();
  });

  actions.append(toolbarHost, resultHost, targetHost, splitButton, evidenceButton, flipButton);
  header.append(actions);

  const sync = (): void => {
    const sharedToolbar = root.querySelector<HTMLElement>('.ve-proposal-shared-toolbar');
    if (sharedToolbar && sharedToolbar.parentElement !== toolbarHost) toolbarHost.append(sharedToolbar);

    if (layout) layout.closest<HTMLElement>('label')?.classList.add('ve-v50-semantic-control');
    if (veSelect) veSelect.closest<HTMLElement>('label')?.classList.add('ve-v50-semantic-control');
    if (tabs) tabs.classList.add('ve-v50-semantic-control');

    const veEntry = veSelect?.selectedOptions[0]?.textContent?.trim() || veSelect?.value || 'VE';
    const table = veHost?.querySelector<HTMLTableElement>('.ve-workbench-table');
    const rows = table?.tBodies[0]?.rows.length;
    const cols = table?.tHead?.rows[0]?.cells.length ? table.tHead.rows[0].cells.length - 1 : undefined;
    const units = table?.tHead?.rows[0]?.cells[0]?.textContent?.trim() || '%';
    if (identity) identity.textContent = `${veEntry} · ${units || '%'}${rows && cols ? ` · ${rows}×${cols}` : ''}`;

    resultHost.hidden = !inner.getPrimaryAnalysis() || !resultView;
    targetHost.hidden = !targetSelect;
    evidenceButton.hidden = !root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Cell Evidence"]');

    const targetName = targetSelect?.selectedOptions[0]?.textContent?.trim() || targetSelect?.value || 'Target';
    const targetActive = targetTab?.getAttribute('aria-selected') === 'true';
    flipButton.textContent = targetActive ? '← VE Table' : `${targetName} →`;
    splitButton.setAttribute('aria-pressed', layout?.value === 'side-by-side' ? 'true' : 'false');
  };

  root.addEventListener('change', () => queueMicrotask(sync));
  root.addEventListener('ve-proposal-table-rendered', () => queueMicrotask(sync));
  inner.onPrimaryAnalysisChange(() => queueMicrotask(sync));
  queueMicrotask(sync);

  return {
    element: root,
    setActive(active) {
      inner.setActive(active);
      if (active) queueMicrotask(sync);
    },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      queueMicrotask(sync);
      return changed;
    },
    setTuneModel(model, sourceName) {
      const changed = inner.setTuneModel(model, sourceName);
      queueMicrotask(sync);
      return changed;
    },
    refresh() {
      inner.refresh();
      queueMicrotask(sync);
    },
  };
}
