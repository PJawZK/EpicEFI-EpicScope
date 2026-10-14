export const REQUEST_RECORDED_SOURCE_UNLOAD_EVENT = 'epicscope:request-recorded-source-unload';

export const LOAD_DATA_MENU_ORDER = [
  '.load-ini',
  '.load-msq',
  '.open-log',
  '.unload-log',
  '.shim-source-button',
] as const;

function recordedLogIsActive(root: HTMLElement): boolean {
  const loadedLog = root.querySelector<HTMLElement>('.loaded-log strong');
  const label = loadedLog?.textContent?.trim() ?? '';
  return label.toLowerCase().endsWith('.mlg');
}

function requestRecordedSourceUnload(root: HTMLElement): void {
  root.dispatchEvent(new CustomEvent(REQUEST_RECORDED_SOURCE_UNLOAD_EVENT, {
    bubbles: true,
  }));
}

export function orderLoadDataMenuItems(loadMenu: HTMLElement): void {
  for (const selector of LOAD_DATA_MENU_ORDER) {
    const item = loadMenu.querySelector<HTMLElement>(selector);
    if (item) loadMenu.append(item);
  }
}

export function installSourceTransitionUi(root: HTMLElement): void {
  const loadMenu = root.querySelector<HTMLElement>('.load-data-menu');
  const openLogButton = loadMenu?.querySelector<HTMLButtonElement>('.open-log');
  const loadedLog = root.querySelector<HTMLElement>('.loaded-log strong');
  if (!loadMenu || !openLogButton || !loadedLog) return;
  if (loadMenu.querySelector('.unload-log')) return;

  const unloadLogButton = document.createElement('button');
  unloadLogButton.type = 'button';
  unloadLogButton.className = 'unload-log source-load-button';
  unloadLogButton.setAttribute('role', 'menuitem');
  unloadLogButton.innerHTML = '<strong>Unload Log</strong><small>Release the active recorded MLG source</small>';
  unloadLogButton.disabled = true;
  openLogButton.after(unloadLogButton);
  orderLoadDataMenuItems(loadMenu);

  const refreshUnloadState = (): void => {
    const active = recordedLogIsActive(root);
    unloadLogButton.disabled = !active;
    unloadLogButton.title = active
      ? 'Unload the current recorded log while preserving INI, MSQ, workspace and runtime diagnostics.'
      : 'No recorded MLG log is currently loaded.';
  };

  unloadLogButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!recordedLogIsActive(root)) return;
    requestRecordedSourceUnload(root);
  });

  // Run before the target Connect Shim handler. The app shell releases the MLG
  // synchronously, then this original click continues into shim-live-ui without
  // a reload or a second click.
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const shimButton = target.closest<HTMLButtonElement>('.shim-source-button');
    if (!shimButton) return;
    const action = shimButton.querySelector('strong')?.textContent?.trim() ?? '';
    if (!action.startsWith('Connect Shim') || !recordedLogIsActive(root)) return;
    requestRecordedSourceUnload(root);
  }, true);

  const observer = new MutationObserver(refreshUnloadState);
  observer.observe(loadedLog, { childList: true, characterData: true, subtree: true });
  refreshUnloadState();
}
