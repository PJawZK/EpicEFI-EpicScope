import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import './ve-analyzer-v50-table-header.css';

function headerIdentity(header: HTMLElement | null | undefined): { title: HTMLElement | undefined; identity: HTMLElement | undefined } {
  const block = header?.querySelector<HTMLElement>(':scope > div:not(.ve-table-header-controls):not(.ve-v50-table-actions)');
  return {
    title: block?.querySelector<HTMLElement>('strong') ?? undefined,
    identity: block?.querySelector<HTMLElement>('span') ?? undefined,
  };
}

/**
 * Compact v50 presentation over the existing v7 table-layout/result controls.
 * Existing selects, tab buttons and shared toolbar remain the semantic owners;
 * this adapter only supplies the reference workbench composition.
 */
export function installVeAnalyzerV50TableHeader(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  if (root.querySelector('.ve-v50-table-actions')) return inner;

  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  const targetTableHost = root.querySelector<HTMLElement>('[data-ve-analyzer="target-table-view"]');
  const vePanel = veHost?.closest<HTMLElement>('.ve-workbench-panel');
  const targetPanel = targetTableHost?.closest<HTMLElement>('.ve-workbench-panel');
  const veHeader = vePanel?.querySelector<HTMLElement>(':scope > header');
  const targetHeader = targetPanel?.querySelector<HTMLElement>(':scope > header');
  if (!veHeader) return inner;

  veHeader.classList.add('ve-v50-table-head');
  targetHeader?.classList.add('ve-v50-table-head');
  const veHeading = headerIdentity(veHeader);
  const targetHeading = headerIdentity(targetHeader);

  const controls = veHeader.querySelector<HTMLElement>('.ve-table-header-controls');
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
  targetHost.append(targetCaption);
  if (targetSelect) targetHost.append(targetSelect);

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
  veHeader.append(actions);

  const sync = (): void => {
    const sharedToolbar = root.querySelector<HTMLElement>('.ve-proposal-shared-toolbar');
    if (sharedToolbar && sharedToolbar.parentElement !== toolbarHost) toolbarHost.append(sharedToolbar);

    // v7 may re-parent these controls while synchronizing its semantic layout.
    // Put the visible target selector back in the compact v50 host every pass.
    if (targetSelect && targetSelect.parentElement !== targetHost) targetHost.append(targetSelect);

    if (layout) layout.closest<HTMLElement>('label')?.classList.add('ve-v50-semantic-control');
    if (veSelect) veSelect.closest<HTMLElement>('label')?.classList.add('ve-v50-semantic-control');
    if (tabs) tabs.classList.add('ve-v50-semantic-control');

    const split = layout?.value === 'side-by-side';
    const targetActive = !split && targetTab?.getAttribute('aria-selected') === 'true';
    const activeHeader = targetActive ? targetHeader : veHeader;
    if (activeHeader && actions.parentElement !== activeHeader) activeHeader.append(actions);

    const veEntry = veSelect?.selectedOptions[0]?.textContent?.trim() || veSelect?.value || 'VE';
    const veTable = veHost?.querySelector<HTMLTableElement>('.ve-workbench-table');
    const veRows = veTable?.tBodies[0]?.rows.length;
    const veCols = veTable?.tHead?.rows[0]?.cells.length ? veTable.tHead.rows[0].cells.length - 1 : undefined;
    const veUnits = veTable?.tHead?.rows[0]?.cells[0]?.textContent?.trim() || '%';
    if (veHeading.title) veHeading.title.textContent = 'VE Table';
    if (veHeading.identity) veHeading.identity.textContent = `${veEntry} · ${veUnits || '%'}${veRows && veCols ? ` · ${veRows}×${veCols}` : ''}`;

    const targetName = targetSelect?.selectedOptions[0]?.textContent?.trim() || targetSelect?.value || 'Target';
    const targetTable = targetTableHost?.querySelector<HTMLTableElement>('.ve-workbench-table');
    const targetRows = targetTable?.tBodies[0]?.rows.length;
    const targetCols = targetTable?.tHead?.rows[0]?.cells.length ? targetTable.tHead.rows[0].cells.length - 1 : undefined;
    const targetUnits = targetTable?.tHead?.rows[0]?.cells[0]?.textContent?.trim() || '';
    if (targetHeading.title) targetHeading.title.textContent = `Target ${targetName}`;
    if (targetHeading.identity) targetHeading.identity.textContent = `${targetName}${targetUnits ? ` · ${targetUnits}` : ''}${targetRows && targetCols ? ` · ${targetRows}×${targetCols}` : ''}`;

    resultHost.hidden = targetActive || !inner.getPrimaryAnalysis() || !resultView;
    targetHost.hidden = !targetSelect;
    toolbarHost.hidden = targetActive || !sharedToolbar;
    evidenceButton.hidden = targetActive || !root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Cell Evidence"]');
    flipButton.hidden = Boolean(split);
    flipButton.textContent = targetActive ? '← VE Table' : `${targetName} →`;
    splitButton.setAttribute('aria-pressed', split ? 'true' : 'false');
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
