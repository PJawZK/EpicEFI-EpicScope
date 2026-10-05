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

function dockLoggerTimelineInScatter(root: HTMLElement): void {
  const timeline = root.querySelector<HTMLElement>('.logger-page .timeline-shell');
  const timelineToggle = root.querySelector<HTMLButtonElement>('.logger-page .edge-toggle--timeline');
  const histogramPage = root.querySelector<HTMLElement>('.histogram-page');
  const histogramSelect = root.querySelector<HTMLSelectElement>('.histogram-view-select');
  const scatterView = root.querySelector<HTMLElement>('.scatter-view--mlv');
  const scatterSlot = root.querySelector<HTMLElement>('.scatter-shared-timeline-slot');
  if (!timeline || !timeline.parentNode || !timelineToggle || !timelineToggle.parentNode
    || !histogramPage || !histogramSelect || !scatterView || !scatterSlot) return;

  const timelineHomeMarker = document.createComment('EpicScope Logger timeline home');
  const toggleHomeMarker = document.createComment('EpicScope Logger timeline toggle home');
  timeline.parentNode.insertBefore(timelineHomeMarker, timeline);
  timelineToggle.parentNode.insertBefore(toggleHomeMarker, timelineToggle);

  const restore = (): void => {
    if (timelineHomeMarker.parentNode && timeline.parentNode !== timelineHomeMarker.parentNode) {
      timelineHomeMarker.parentNode.insertBefore(timeline, timelineHomeMarker.nextSibling);
    }
    if (toggleHomeMarker.parentNode && timelineToggle.parentNode !== toggleHomeMarker.parentNode) {
      toggleHomeMarker.parentNode.insertBefore(timelineToggle, toggleHomeMarker.nextSibling);
    }
    timeline.classList.remove('timeline-shell--analysis-docked');
  };

  const sync = (): void => {
    const useInScatter = !histogramPage.hidden && histogramSelect.value === 'scatter' && !scatterView.hidden;
    if (useInScatter) {
      if (timeline.parentNode !== scatterSlot) scatterSlot.append(timeline);
      if (timelineToggle.parentNode !== scatterSlot) scatterSlot.append(timelineToggle);
      timeline.classList.add('timeline-shell--analysis-docked');
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    } else {
      restore();
    }
  };

  histogramSelect.addEventListener('change', sync);
  new MutationObserver(sync).observe(histogramPage, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(sync).observe(scatterView, { attributes: true, attributeFilter: ['hidden'] });
  sync();
}

export function applyNavigationRefinements(root: HTMLElement): void {
  refineValueSearch(root);
  normalizeGraphWorkspaceLabels(root);
  placeLayoutAfterGraph(root);
  dockLoggerTimelineInScatter(root);
}
