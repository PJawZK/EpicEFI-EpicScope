function renameValueSearch(root: HTMLElement): void {
  const trigger = root.querySelector<HTMLButtonElement>('.value-search-trigger');
  const heading = root.querySelector<HTMLElement>('.value-search-head strong');
  if (trigger) {
    trigger.innerHTML = '<span aria-hidden="true">⌕</span> Search Symbol Value';
    trigger.title = 'Search symbol values';
  }
  if (heading) heading.textContent = 'Search Symbol Value';
}

function normalizeGraphWorkspaceLabels(root: HTMLElement): void {
  const graphSelector = root.querySelector<HTMLElement>('.graph-selector-wrap');
  if (!graphSelector) return;

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

export function applyNavigationRefinements(root: HTMLElement): void {
  renameValueSearch(root);
  normalizeGraphWorkspaceLabels(root);
  placeLayoutAfterGraph(root);
}
