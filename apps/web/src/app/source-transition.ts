const AUTO_CONNECT_SHIM_KEY = 'epicscope.auto-connect-shim-after-source-unload.v1';
const SOURCE_RESET_PARAM = '__epicscope_source_reset';

function recordedLogIsActive(root: HTMLElement): boolean {
  const loadedLog = root.querySelector<HTMLElement>('.loaded-log strong');
  const label = loadedLog?.textContent?.trim() ?? '';
  return label.toLowerCase().endsWith('.mlg');
}

function setAutoConnectShim(): void {
  try {
    sessionStorage.setItem(AUTO_CONNECT_SHIM_KEY, '1');
  } catch {
    // Session storage is an enhancement only. A manual reconnect remains available.
  }
}

function consumeAutoConnectShim(): boolean {
  try {
    const pending = sessionStorage.getItem(AUTO_CONNECT_SHIM_KEY) === '1';
    sessionStorage.removeItem(AUTO_CONNECT_SHIM_KEY);
    return pending;
  } catch {
    return false;
  }
}

function clearSourceResetParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SOURCE_RESET_PARAM)) return;
  url.searchParams.delete(SOURCE_RESET_PARAM);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function reloadWithoutRecordedSource(autoConnectShim: boolean): void {
  if (autoConnectShim) setAutoConnectShim();
  const url = new URL(window.location.href);
  url.searchParams.set(SOURCE_RESET_PARAM, String(Date.now()));
  window.location.replace(url.toString());
}

export function installSourceTransitionUi(root: HTMLElement): void {
  const loadMenu = root.querySelector<HTMLElement>('.load-data-menu');
  const openLogButton = loadMenu?.querySelector<HTMLButtonElement>('.open-log');
  const loadedLog = root.querySelector<HTMLElement>('.loaded-log strong');
  if (!loadMenu || !openLogButton || !loadedLog) return;
  if (loadMenu.querySelector('.unload-log')) return;

  clearSourceResetParam();

  const unloadLogButton = document.createElement('button');
  unloadLogButton.type = 'button';
  unloadLogButton.className = 'unload-log source-load-button';
  unloadLogButton.setAttribute('role', 'menuitem');
  unloadLogButton.innerHTML = '<strong>Unload Log</strong><small>Release the active recorded MLG source</small>';
  unloadLogButton.disabled = true;
  openLogButton.after(unloadLogButton);

  const refreshUnloadState = (): void => {
    const active = recordedLogIsActive(root);
    unloadLogButton.disabled = !active;
    unloadLogButton.title = active
      ? 'Unload the current recorded log while preserving locally saved workspace and INI state.'
      : 'No recorded MLG log is currently loaded.';
  };

  unloadLogButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!recordedLogIsActive(root)) return;
    reloadWithoutRecordedSource(false);
  });

  // Shim and recorded MLG are mutually exclusive Logger sources. Intercept a
  // Connect Shim action before shim-live-ui sees it, release the local File-backed
  // source, then reconnect automatically after the clean application bootstrap.
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const shimButton = target.closest<HTMLButtonElement>('.shim-source-button');
    if (!shimButton) return;
    const action = shimButton.querySelector('strong')?.textContent?.trim() ?? '';
    if (!action.startsWith('Connect Shim') || !recordedLogIsActive(root)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    reloadWithoutRecordedSource(true);
  }, true);

  const observer = new MutationObserver(refreshUnloadState);
  observer.observe(loadedLog, { childList: true, characterData: true, subtree: true });
  refreshUnloadState();

  if (consumeAutoConnectShim()) {
    window.setTimeout(() => {
      const shimButton = root.querySelector<HTMLButtonElement>('.shim-source-button');
      const action = shimButton?.querySelector('strong')?.textContent?.trim() ?? '';
      if (shimButton && action.startsWith('Connect Shim')) shimButton.click();
    }, 250);
  }
}
