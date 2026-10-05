const ANALYZER_VIEWS = [
  ['compare', 'Range Compare'],
  ['tune-table', 'Tune Table'],
  ['boost', 'Boost · Experimental'],
  ['idle', 'Idle · Experimental'],
  ['ae-map', 'AE / MAP Predict · Experimental'],
  ['fueling', 'Fueling · Experimental'],
  ['ignition', 'Ignition · Experimental'],
  ['fuel-injector', 'Fuel Pressure / Injector · Experimental'],
  ['trigger-sync', 'Trigger / Sync · Experimental'],
] as const;

function renameWeightedMean(root: HTMLElement): void {
  const rewrite = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE && /MLV weighted mean/i.test(node.textContent ?? '')) {
      node.textContent = (node.textContent ?? '').replace(/MLV weighted mean/gi, 'Weighted Mean');
      return;
    }
    for (const child of node.childNodes) rewrite(child);
  };

  rewrite(root);
  const histogram = root.querySelector<HTMLElement>('.histogram-table-generator-view');
  if (!histogram) return;
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) rewrite(node);
      if (record.type === 'characterData') rewrite(record.target);
    }
  }).observe(histogram, { childList: true, subtree: true, characterData: true });
}

function createAnalyzerHeaderSelector(root: HTMLElement): void {
  const headerLeft = root.querySelector<HTMLElement>('.header-left');
  const histogramSlot = root.querySelector<HTMLElement>('.histogram-selector-slot');
  const analyzerSwitch = root.querySelector<HTMLElement>('.analyzer-view-switch');
  const analyzerPage = root.querySelector<HTMLElement>('.analyzer-page');
  if (!headerLeft || !analyzerSwitch || !analyzerPage) return;

  analyzerSwitch.style.display = 'none';

  const selector = document.createElement('label');
  selector.className = 'histogram-header-view analyzer-header-view';
  selector.style.display = 'none';
  selector.innerHTML = `
    <select class="analyzer-header-view-select" aria-label="Analyzer analysis view">
      ${ANALYZER_VIEWS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
    </select>
  `;

  if (histogramSlot) histogramSlot.after(selector);
  else headerLeft.append(selector);

  const select = selector.querySelector<HTMLSelectElement>('select');
  if (!select) return;

  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-analyzer-view]')];
  const activeButton = buttons.find((button) => button.classList.contains('analyzer-view-choice--active'));
  if (activeButton?.dataset.analyzerView) select.value = activeButton.dataset.analyzerView;

  select.addEventListener('change', () => {
    const button = buttons.find((candidate) => candidate.dataset.analyzerView === select.value);
    button?.click();
  });

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const view = button.dataset.analyzerView;
      if (view) select.value = view;
    });
  }

  const syncVisibility = (): void => {
    selector.style.display = analyzerPage.hidden ? 'none' : 'inline-flex';
  };
  syncVisibility();
  new MutationObserver(syncVisibility).observe(analyzerPage, { attributes: true, attributeFilter: ['hidden'] });
}

function streamlineGlobalNavigation(root: HTMLElement): void {
  root.querySelector<HTMLElement>('.mode-chip')?.remove();
  for (const state of root.querySelectorAll<HTMLElement>('.global-switch-menu .module-state')) state.remove();
}

export function applyUiRefinements(root: HTMLElement): void {
  streamlineGlobalNavigation(root);
  createAnalyzerHeaderSelector(root);
  renameWeightedMean(root);
}
