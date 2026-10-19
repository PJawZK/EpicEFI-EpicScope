import { registerVeTableHeaderPlacement } from './ve-analyzer-table-header-placement';
import { registerVeReadinessTargetRevealer } from './ve-analyzer-readiness';
import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import { VE_TABLE_TOOL_ICONS } from './ve-table-icons';
import './ve-analyzer-v50-table-header.css';

interface CompactHeading {
  readonly title: HTMLElement | undefined;
  readonly identity: HTMLElement | undefined;
}

function prepareCompactHeading(header: HTMLElement | null | undefined): CompactHeading {
  const block = header?.querySelector<HTMLElement>(':scope > div:not(.ve-table-header-controls):not(.ve-v50-table-actions)');
  const title = block?.querySelector<HTMLElement>('strong') ?? undefined;
  const legacyDescription = block?.querySelector<HTMLElement>(':scope > span');
  if (legacyDescription) legacyDescription.classList.add('ve-v50-legacy-table-description');

  let identity = block?.querySelector<HTMLElement>('.ve-v50-table-identity') ?? undefined;
  if (!identity && block) {
    identity = document.createElement('span');
    identity.className = 've-v50-table-identity';
    block.append(identity);
  }
  return { title, identity };
}

/**
 * Compact v50 presentation over the existing v7 table-layout/result controls.
 * Existing selects, tab buttons and shared toolbar remain the semantic owners;
 * this adapter only supplies the reference workbench composition.
 */
export function installVeAnalyzerV50TableHeader(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  let disposed = false;
  const events = new AbortController();
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
  const veHeading = prepareCompactHeading(veHeader);
  const targetHeading = prepareCompactHeading(targetHeader);

  const controls = veHeader.querySelector<HTMLElement>('.ve-table-header-controls');
  if (!controls) return inner;

  const layout = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer table view"]');
  const resultView = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer result view"]');
  const veSelect = root.querySelector<HTMLSelectElement>('select[data-role="ve-table"]');
  const targetSelect = root.querySelector<HTMLSelectElement>('select[data-role="target-table"]');
  const tabs = root.querySelector<HTMLElement>('.ve-workbench-table-tabs');

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
  splitButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16"/></svg>';
  splitButton.addEventListener('click', () => {
    if (!layout) return;
    layout.value = layout.value === 'single' ? 'side-by-side' : 'single';
    layout.dispatchEvent(new Event('change', { bubbles: true }));
  }, { signal: events.signal });

  const evidenceButton = document.createElement('button');
  evidenceButton.type = 'button';
  evidenceButton.className = 've-v50-table-icon-button';
  evidenceButton.setAttribute('aria-label', 'Cell Evidence');
  evidenceButton.title = 'Cell Evidence';
  evidenceButton.innerHTML = VE_TABLE_TOOL_ICONS.cell;
  evidenceButton.addEventListener('click', () => {
    root.querySelector<HTMLButtonElement>('.ve-proposal-shared-toolbar button[aria-label="Cell Evidence"]')?.click();
  }, { signal: events.signal });

  const evidenceHint = document.createElement('span');
  evidenceHint.className = 've-v50-evidence-hint';
  evidenceHint.hidden = true;
  evidenceHint.textContent = 'Select a VE cell first';
  root.addEventListener('ve-cell-evidence-unavailable', () => {
    evidenceHint.hidden = false;
  }, { signal: events.signal });
  veHost?.addEventListener('pointerdown', () => { evidenceHint.hidden = true; }, { capture: true, signal: events.signal });

  const flipButton = document.createElement('button');
  flipButton.type = 'button';
  flipButton.className = 've-v50-table-flip';
  flipButton.addEventListener('click', () => {
    const targetActive = Boolean(targetPanel && !targetPanel.hidden);
    // Tabs remain mounted under the semantic layout owner.
    const currentTab = root.querySelector<HTMLButtonElement>(
      targetActive ? '[data-table-tab="ve"]' : '[data-table-tab="target"]',
    );
    currentTab?.click();
  }, { signal: events.signal });

  // Present one visible Cell Evidence action; the toolbar's semantic button stays hidden visually.
  actions.append(toolbarHost, targetHost, splitButton, evidenceButton, evidenceHint, flipButton);
  veHeader.append(resultHost);
  (targetHeader ?? veHeader).append(actions);

  // Keep semantic controls mounted, including tabs used by single/split actions.
  const layoutLabel = layout?.closest<HTMLElement>('label');
  layoutLabel?.classList.add('ve-v50-semantic-control');
  tabs?.classList.add('ve-v50-semantic-control');
  controls.replaceChildren(...[layoutLabel, veSelect, tabs].filter((node): node is HTMLElement => Boolean(node)));
  const sharedToolbar = root.querySelector<HTMLElement>('.ve-proposal-shared-toolbar');
  if (sharedToolbar && sharedToolbar.parentElement !== veHeader) veHeader.append(sharedToolbar);

  let active = true;
  let syncQueued = false;
  const scheduleSync = (): void => {
    if (!active || syncQueued) return;
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      if (active) sync();
    });
  };

  const sync = (): void => {
    if (!active) return;
    const split = layout?.value === 'side-by-side';
    // The visible production panel is authoritative. v7 can change its panel
    // visibility before ARIA tab state settles, especially on programmatic tabs.
    const targetActive = !split && Boolean(targetPanel && !targetPanel.hidden);
    // In split mode place layout/Target/Evidence controls on the Target side.
    // In single mode dock them on the visible table's right edge, so the
    // controls never disappear with the hidden Target panel.
    const activeHeader = split || targetActive ? (targetHeader ?? veHeader) : veHeader;
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
    // Target does not yet own a mutable table surface. Do not bind VE edits to Target.
    toolbarHost.hidden = targetActive || !sharedToolbar;
    evidenceButton.hidden = !root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Cell Evidence"]');
    flipButton.hidden = Boolean(split);
    flipButton.textContent = targetActive ? '← VE Table' : `${targetName} →`;
    splitButton.setAttribute('aria-pressed', split ? 'true' : 'false');
  };

  const unregisterRevealer = registerVeReadinessTargetRevealer(root, (target) => {
    if (target !== veSelect && target !== targetSelect) return undefined;
    if (target === veSelect) {
      if (vePanel?.hidden) root.querySelector<HTMLButtonElement>('[data-table-tab="ve"]')?.click();
      veSelect.classList.add('ve-v50-readiness-target');
    }
    sync();
    return target;
  });

  const unregisterPlacement = registerVeTableHeaderPlacement(root, sync);
  sync();
  root.addEventListener('change', (event) => {
    if (event.target === veSelect) veSelect?.classList.remove('ve-v50-readiness-target');
    scheduleSync();
  }, { signal: events.signal });
  root.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('.ve-v50-table-flip, .ve-workbench-table-tabs [data-table-tab], .ve-v50-table-icon-button')) {
      scheduleSync();
    }
  }, { signal: events.signal });
  root.addEventListener('ve-proposal-table-rendered', scheduleSync, { signal: events.signal });
  const unsubscribePrimary = inner.onPrimaryAnalysisChange(scheduleSync);
  scheduleSync();

  return {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      active = false;
      unsubscribePrimary(); unregisterPlacement(); unregisterRevealer();
      inner.dispose();
    },
    setActive(nextActive) { if (disposed) return;
      active = nextActive;
      inner.setActive(nextActive);
      if (nextActive) scheduleSync();
    },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      if (disposed) return false;
      const changed = inner.setContext(context);
      if (active) scheduleSync();
      return changed;
    },
    setTuneModel(model, sourceName) {
      if (disposed) return false;
      const changed = inner.setTuneModel(model, sourceName);
      if (active) scheduleSync();
      return changed;
    },
    refresh() {
      if (disposed) return;
      inner.refresh();
      if (active) scheduleSync();
    },
  };
}
