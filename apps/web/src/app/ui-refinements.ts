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

function createLoggerLayoutMenu(root: HTMLElement): void {
  const tools = root.querySelector<HTMLElement>('.logger-header-tools');
  const layoutSelect = tools?.querySelector<HTMLSelectElement>('.graph-layout-select');
  const arrangeSelect = tools?.querySelector<HTMLSelectElement>('.graph-arrange-select');
  if (!tools || !layoutSelect || !arrangeSelect) return;

  const paneActions = [...tools.querySelectorAll<HTMLButtonElement>('.graph-pane-action')];
  const clearButton = paneActions.find((button) => /remove all channels/i.test(button.title) || /clear pane/i.test(button.textContent ?? ''));
  const resetButton = paneActions.find((button) => /reset this workspace layout/i.test(button.title) || /reset layout/i.test(button.textContent ?? ''));

  const wrap = document.createElement('div');
  wrap.className = 'logger-layout-menu-wrap';
  wrap.innerHTML = `
    <button type="button" class="logger-layout-menu-button" aria-haspopup="menu" aria-expanded="false">
      <span>Layout</span><span class="logger-layout-chevron" aria-hidden="true"></span>
    </button>
    <div class="logger-layout-menu" role="menu" hidden>
      <section class="logger-layout-section">
        <header>Workspace layout</header>
        <button type="button" class="logger-layout-choice" data-layout-value="single"><span class="layout-radio"></span><span>Single graph</span></button>
        <button type="button" class="logger-layout-choice" data-layout-value="grid4"><span class="layout-radio"></span><span>2 × 2 · 4 graphs</span></button>
        <button type="button" class="logger-layout-choice" data-layout-value="grid5"><span class="layout-radio"></span><span>2 × 3 · 5 graphs</span></button>
        <button type="button" class="logger-layout-choice" data-layout-value="grid6"><span class="layout-radio"></span><span>3 × 2 · 6 graphs</span></button>
        <button type="button" class="logger-layout-choice" data-layout-value="freeform"><span class="layout-radio"></span><span>Freeform · 5 graphs</span></button>
      </section>
      <section class="logger-layout-section logger-arrange-section">
        <header>Freeform quick arrange</header>
        <button type="button" class="logger-arrange-choice" data-arrange-value="mosaic">Mosaic</button>
        <button type="button" class="logger-arrange-choice" data-arrange-value="columns">Two columns</button>
        <button type="button" class="logger-arrange-choice" data-arrange-value="rows">Horizontal rows</button>
        <button type="button" class="logger-arrange-choice" data-arrange-value="cascade">Cascade</button>
      </section>
      <footer class="logger-layout-actions">
        <button type="button" class="logger-layout-reset"><span aria-hidden="true">↺</span><span>Reset</span></button>
        <button type="button" class="logger-layout-clear"><span aria-hidden="true">⌫</span><span>Clear</span></button>
      </footer>
    </div>
  `;

  layoutSelect.before(wrap);
  layoutSelect.classList.add('ui-refinement-source-control');
  arrangeSelect.classList.add('ui-refinement-source-control');
  clearButton?.classList.add('ui-refinement-source-control');
  resetButton?.classList.add('ui-refinement-source-control');

  const trigger = wrap.querySelector<HTMLButtonElement>('.logger-layout-menu-button');
  const menu = wrap.querySelector<HTMLElement>('.logger-layout-menu');
  const layoutChoices = [...wrap.querySelectorAll<HTMLButtonElement>('[data-layout-value]')];
  const arrangeChoices = [...wrap.querySelectorAll<HTMLButtonElement>('[data-arrange-value]')];
  const resetProxy = wrap.querySelector<HTMLButtonElement>('.logger-layout-reset');
  const clearProxy = wrap.querySelector<HTMLButtonElement>('.logger-layout-clear');
  if (!trigger || !menu || !resetProxy || !clearProxy) return;

  const sync = (): void => {
    for (const choice of layoutChoices) {
      const active = choice.dataset.layoutValue === layoutSelect.value;
      choice.classList.toggle('logger-layout-choice--active', active);
      choice.setAttribute('aria-checked', String(active));
    }
    const freeform = layoutSelect.value === 'freeform';
    for (const choice of arrangeChoices) {
      choice.disabled = !freeform;
      choice.classList.toggle('logger-arrange-choice--active', freeform && choice.dataset.arrangeValue === arrangeSelect.value);
    }
    clearProxy.disabled = clearButton?.disabled ?? true;
    resetProxy.disabled = resetButton?.disabled ?? true;
  };

  const close = (): void => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) sync();
  });
  menu.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', close);

  for (const choice of layoutChoices) {
    choice.addEventListener('click', () => {
      if (!choice.dataset.layoutValue) return;
      layoutSelect.value = choice.dataset.layoutValue;
      layoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });
  }
  for (const choice of arrangeChoices) {
    choice.addEventListener('click', () => {
      if (choice.disabled || !choice.dataset.arrangeValue) return;
      arrangeSelect.value = choice.dataset.arrangeValue;
      arrangeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });
  }
  resetProxy.addEventListener('click', () => { resetButton?.click(); sync(); });
  clearProxy.addEventListener('click', () => { clearButton?.click(); sync(); });
  layoutSelect.addEventListener('change', sync);
  arrangeSelect.addEventListener('change', sync);
  sync();
}

function createCompactHistoryControl(root: HTMLElement): void {
  const undo = root.querySelector<HTMLButtonElement>('.workspace-undo');
  const redo = root.querySelector<HTMLButtonElement>('.workspace-redo');
  if (!undo || !redo || !undo.parentElement || undo.parentElement !== redo.parentElement) return;

  const wrap = document.createElement('div');
  wrap.className = 'history-split-control';
  undo.before(wrap);
  wrap.append(undo, redo);
  undo.classList.add('history-split-undo');
  redo.classList.add('history-split-redo');
  undo.textContent = '↶';
  redo.textContent = '↷';
  undo.setAttribute('aria-label', 'Undo workspace change');
  redo.setAttribute('aria-label', 'Redo workspace change');
}

function reorganizeSettings(root: HTMLElement): void {
  const popover = root.querySelector<HTMLElement>('.settings-popover');
  const head = popover?.querySelector<HTMLElement>('.settings-popover-head');
  if (!popover || !head) return;

  const playback = popover.querySelector<HTMLSelectElement>('.setting-playback-speed')?.closest<HTMLElement>('.settings-field');
  const samplePoints = popover.querySelector<HTMLInputElement>('.setting-sample-points')?.closest<HTMLElement>('.settings-toggle');
  const overviewTraces = popover.querySelector<HTMLInputElement>('.setting-overview-traces')?.closest<HTMLElement>('.settings-toggle');
  const performance = popover.querySelector<HTMLInputElement>('.setting-performance')?.closest<HTMLElement>('.settings-toggle');
  const shortcuts = popover.querySelector<HTMLElement>('.settings-shortcuts');
  const ini = popover.querySelector<HTMLElement>('.settings-ini-source');
  const persistenceRows = [...popover.querySelectorAll<HTMLElement>('.settings-persistence')];
  const note = popover.querySelector<HTMLElement>('.settings-note');

  const modeSection = document.createElement('section');
  modeSection.className = 'settings-section settings-mode-section';
  modeSection.innerHTML = `
    <header><div><strong class="settings-mode-title">Logger</strong><small>Current mode</small></div></header>
    <div class="settings-mode-body settings-mode-body--logger"></div>
    <div class="settings-mode-body settings-mode-body--analyzer" hidden>
      <p><strong>Analyzer</strong><span class="settings-current-function">Range Compare</span></p>
      <small>Function-specific analysis controls stay in the Analyzer workspace so their state remains visible while tuning the analysis.</small>
    </div>
    <div class="settings-mode-body settings-mode-body--histogram" hidden>
      <p><strong>Histogram</strong><span class="settings-current-histogram">Table Generator</span></p>
      <small>Table, filter and calculation controls stay with the active Histogram workspace instead of becoming hidden settings.</small>
    </div>
  `;

  const globalSection = document.createElement('section');
  globalSection.className = 'settings-section settings-global-section';
  globalSection.innerHTML = '<header><div><strong>Interface</strong><small>Applies to EpicScope</small></div></header><div class="settings-section-body"></div>';

  const dataSection = document.createElement('section');
  dataSection.className = 'settings-section settings-data-section';
  dataSection.innerHTML = '<header><div><strong>Data & storage</strong><small>Catalogs, workspace and cache</small></div></header><div class="settings-section-body"></div>';

  head.after(modeSection, globalSection, dataSection);

  const loggerBody = modeSection.querySelector<HTMLElement>('.settings-mode-body--logger');
  const globalBody = globalSection.querySelector<HTMLElement>('.settings-section-body');
  const dataBody = dataSection.querySelector<HTMLElement>('.settings-section-body');
  if (loggerBody) {
    for (const node of [playback, samplePoints, overviewTraces, shortcuts]) if (node) loggerBody.append(node);
  }
  if (globalBody && performance) globalBody.append(performance);
  if (dataBody) {
    if (ini) dataBody.append(ini);
    for (const row of persistenceRows) dataBody.append(row);
    if (note) dataBody.append(note);
  }

  const headSmall = head.querySelector<HTMLElement>('small');
  if (headSmall) headSmall.textContent = 'Global + current mode';

  const analyzerPage = root.querySelector<HTMLElement>('.analyzer-page');
  const histogramPage = root.querySelector<HTMLElement>('.histogram-page');
  const loggerPage = root.querySelector<HTMLElement>('.logger-page');
  const analyzerSelect = root.querySelector<HTMLSelectElement>('.analyzer-header-view-select');
  const histogramSelect = root.querySelector<HTMLSelectElement>('.histogram-view-select');
  const title = modeSection.querySelector<HTMLElement>('.settings-mode-title');
  const analyzerBody = modeSection.querySelector<HTMLElement>('.settings-mode-body--analyzer');
  const histogramBody = modeSection.querySelector<HTMLElement>('.settings-mode-body--histogram');
  const currentFunction = modeSection.querySelector<HTMLElement>('.settings-current-function');
  const currentHistogram = modeSection.querySelector<HTMLElement>('.settings-current-histogram');

  const sync = (): void => {
    const mode = !analyzerPage?.hidden ? 'analyzer' : !histogramPage?.hidden ? 'histogram' : 'logger';
    if (title) title.textContent = mode === 'logger' ? 'Logger' : mode === 'analyzer' ? 'Analyzer' : 'Histogram';
    if (loggerBody) loggerBody.hidden = mode !== 'logger';
    if (analyzerBody) analyzerBody.hidden = mode !== 'analyzer';
    if (histogramBody) histogramBody.hidden = mode !== 'histogram';
    if (currentFunction && analyzerSelect) currentFunction.textContent = analyzerSelect.selectedOptions[0]?.textContent ?? 'Analyzer';
    if (currentHistogram && histogramSelect) currentHistogram.textContent = histogramSelect.selectedOptions[0]?.textContent ?? 'Histogram';
  };

  analyzerSelect?.addEventListener('change', sync);
  histogramSelect?.addEventListener('change', sync);
  for (const page of [loggerPage, analyzerPage, histogramPage]) {
    if (page) new MutationObserver(sync).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  }
  sync();
}

function streamlineGlobalNavigation(root: HTMLElement): void {
  root.querySelector<HTMLElement>('.mode-chip')?.remove();
  for (const state of root.querySelectorAll<HTMLElement>('.global-switch-menu .module-state')) state.remove();
}

export function applyUiRefinements(root: HTMLElement): void {
  streamlineGlobalNavigation(root);
  createAnalyzerHeaderSelector(root);
  createLoggerLayoutMenu(root);
  createCompactHistoryControl(root);
  reorganizeSettings(root);
  renameWeightedMean(root);
}
