function refineValueSearch(root: HTMLElement): void {
  const trigger = root.querySelector<HTMLButtonElement>('.value-search-trigger');
  const heading = root.querySelector<HTMLElement>('.value-search-head strong');
  if (trigger) {
    trigger.classList.add('value-search-trigger--icon');
    trigger.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="10.5" cy="10.5" r="6.25"></circle>
        <path d="M15.2 15.2 20 20"></path>
      </svg>
    `;
    trigger.title = 'Search Symbol Value';
    trigger.setAttribute('aria-label', 'Search Symbol Value');
  }
  if (heading) heading.textContent = 'Search Symbol Value';
}

function normalizeGraphWorkspaceLabels(root: HTMLElement): void {
  const graphSelector = root.querySelector<HTMLElement>('.graph-selector-wrap');
  if (!graphSelector) return;

  graphSelector.querySelector<HTMLElement>('.graph-selector-context')?.remove();

  const normalize = (): void => {
    const buttonLabel = graphSelector.querySelector<HTMLElement>('.graph-selector-button > span:first-child');
    if (buttonLabel && !/\s-\sGraph$/.test(buttonLabel.textContent ?? '')) {
      buttonLabel.textContent = `${buttonLabel.textContent ?? 'General'} - Graph`;
    }
    for (const label of graphSelector.querySelectorAll<HTMLElement>('.graph-selector-choice > span')) {
      if (!/\s-\sGraph$/.test(label.textContent ?? '')) label.textContent = `${label.textContent ?? 'General'} - Graph`;
    }
  };

  normalize();
  new MutationObserver(normalize).observe(graphSelector, { childList: true, subtree: true, characterData: true });
}

function placeLayoutAfterGraph(root: HTMLElement): void {
  const graphSlot = root.querySelector<HTMLElement>('.graph-selector-slot');
  const layout = root.querySelector<HTMLElement>('.logger-layout-menu-wrap');
  const loggerPage = root.querySelector<HTMLElement>('.logger-page');
  if (!graphSlot || !layout || !loggerPage) return;

  graphSlot.after(layout);

  const sync = (): void => {
    layout.hidden = loggerPage.hidden;
  };
  sync();
  new MutationObserver(sync).observe(loggerPage, { attributes: true, attributeFilter: ['hidden'] });
}

function normalizeHistogramScopeLabels(root: HTMLElement): void {
  const tableScope = root.querySelector<HTMLSelectElement>('.histogram-table-scope');
  const scatterScope = root.querySelector<HTMLSelectElement>('.scatter-scope');
  const normalize = (): void => {
    const tableAb = tableScope ? [...tableScope.options].find((option) => option.value === 'ab') : undefined;
    const tableFull = tableScope ? [...tableScope.options].find((option) => option.value === 'full') : undefined;
    if (tableAb) tableAb.textContent = 'Current A/B';
    if (tableFull) tableFull.textContent = 'Full Log';
    const scatterRange = scatterScope ? [...scatterScope.options].find((option) => option.value === 'range') : undefined;
    const scatterFull = scatterScope ? [...scatterScope.options].find((option) => option.value === 'full') : undefined;
    if (scatterRange) scatterRange.textContent = 'Current A/B';
    if (scatterFull) scatterFull.textContent = 'Full Log';
  };
  normalize();
  if (tableScope) new MutationObserver(normalize).observe(tableScope, { childList: true });
}

function dockLoggerTimelineInHistogramAnalysis(root: HTMLElement): void {
  const timelineWrap = root.querySelector<HTMLElement>('.logger-page .timeline-wrap');
  const timeline = timelineWrap?.querySelector<HTMLElement>('.timeline-shell');
  const timelineToggle = timelineWrap?.querySelector<HTMLButtonElement>('.edge-toggle--timeline');
  const histogramPage = root.querySelector<HTMLElement>('.histogram-page');
  const histogramSelect = root.querySelector<HTMLSelectElement>('.histogram-view-select');
  const tableView = root.querySelector<HTMLElement>('.histogram-table-generator-view');
  const tableStage = tableView?.querySelector<HTMLElement>('.histogram-table-stage');
  const scatterSlot = root.querySelector<HTMLElement>('.scatter-shared-timeline-slot');
  const distributionSlot = root.querySelector<HTMLElement>('.distribution-shared-timeline-slot');
  if (!timelineWrap || !timelineWrap.parentNode || !timeline || !timelineToggle
    || !histogramPage || !histogramSelect || !tableView || !tableStage || !scatterSlot || !distributionSlot) return;

  let tableSlot = tableView.querySelector<HTMLElement>('.histogram-table-shared-timeline-slot');
  if (!tableSlot) {
    tableSlot = document.createElement('div');
    tableSlot.className = 'histogram-table-shared-timeline-slot';
    tableStage.after(tableSlot);
  }

  // Keep the Logger timeline wrapper intact while docking it into Histogram. The
  // wrapper is the positioning context for the centered edge toggle; moving the
  // shell and toggle separately makes the toggle position relative to each
  // analysis slot instead, which can place it inside or behind the plot/table.
  const timelineHomeMarker = document.createComment('EpicScope Logger timeline home');
  timelineWrap.parentNode.insertBefore(timelineHomeMarker, timelineWrap);

  const restore = (): void => {
    if (timelineHomeMarker.parentNode && timelineWrap.parentNode !== timelineHomeMarker.parentNode) {
      timelineHomeMarker.parentNode.insertBefore(timelineWrap, timelineHomeMarker.nextSibling);
    }
    timeline.classList.remove('timeline-shell--analysis-docked');
  };

  const dock = (slot: HTMLElement): void => {
    if (timelineWrap.parentNode !== slot) slot.append(timelineWrap);
    timeline.classList.add('timeline-shell--analysis-docked');
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  };

  const sync = (): void => {
    if (histogramPage.hidden) {
      restore();
      return;
    }
    if (histogramSelect.value === 'table') dock(tableSlot!);
    else if (histogramSelect.value === 'scatter') dock(scatterSlot);
    else if (histogramSelect.value === 'distribution') dock(distributionSlot);
    else restore();
  };

  histogramSelect.addEventListener('change', sync);
  new MutationObserver(sync).observe(histogramPage, { attributes: true, attributeFilter: ['hidden'] });
  sync();
}

export function applyNavigationRefinements(root: HTMLElement): void {
  refineValueSearch(root);
  normalizeGraphWorkspaceLabels(root);
  placeLayoutAfterGraph(root);
  normalizeHistogramScopeLabels(root);
  dockLoggerTimelineInHistogramAnalysis(root);
}
