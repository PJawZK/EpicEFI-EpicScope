import {
  SHIM_HTTP_ROUTES,
  ShimHttpReadOnlyClient,
  type ShimHttpInspection,
  type ShimHttpRoute,
} from '../adapters/shim/shim-http-client';

const STYLE_ID = 'epicscope-shim-http-ui-style';
const PREVIEW_LIMIT = 64 * 1024;
const ROUTES = Object.keys(SHIM_HTTP_ROUTES) as ShimHttpRoute[];

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .shim-http-button[hidden] { display:none; }
    .shim-http-dialog { width:min(900px, calc(100vw - 32px)); max-height:min(760px, calc(100vh - 32px)); border:1px solid var(--border, #49515f); border-radius:10px; padding:0; background:var(--panel, #15191f); color:inherit; }
    .shim-http-dialog::backdrop { background:rgba(0,0,0,.55); }
    .shim-http-panel { display:flex; flex-direction:column; max-height:min(760px, calc(100vh - 32px)); }
    .shim-http-panel > header, .shim-http-panel > footer { display:flex; align-items:center; gap:8px; padding:12px 14px; border-bottom:1px solid var(--border, #49515f); }
    .shim-http-panel > footer { border-bottom:0; border-top:1px solid var(--border, #49515f); justify-content:flex-end; }
    .shim-http-title { display:flex; flex-direction:column; gap:2px; flex:1; }
    .shim-http-title small, .shim-http-meta { opacity:.72; font-size:calc(.8rem * var(--epicscope-font-info-scale, 1)); }
    .shim-http-routes { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; padding:12px 14px 0; }
    .shim-http-route { display:flex; flex-direction:column; align-items:flex-start; min-width:0; gap:2px; }
    .shim-http-route span, .shim-http-route small { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .shim-http-route small { opacity:.68; }
    .shim-http-route[data-state="ok"] { outline:1px solid rgba(85,190,130,.45); }
    .shim-http-route[data-state="error"] { outline:1px solid rgba(235,105,105,.45); }
    .shim-http-result { margin:12px 14px; min-height:300px; overflow:auto; border:1px solid var(--border, #49515f); border-radius:7px; background:rgba(0,0,0,.16); }
    .shim-http-result-meta { padding:9px 11px; border-bottom:1px solid var(--border, #49515f); font-size:calc(.8rem * var(--epicscope-font-info-scale, 1)); opacity:.82; }
    .shim-http-result pre { margin:0; padding:11px; white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    @media (max-width:700px) { .shim-http-routes { grid-template-columns:1fr; } }
  `;
  document.head.append(style);
}

function previewText(result: ShimHttpInspection): string {
  if (result.error) return `Request failed: ${result.error}`;
  let text: string;
  if (result.json !== undefined) {
    try { text = JSON.stringify(result.json, null, 2); }
    catch { text = result.text; }
  } else {
    text = result.text || '(empty response body)';
  }
  if (result.jsonError) text += `\n\nJSON parse note: ${result.jsonError}`;
  if (text.length <= PREVIEW_LIMIT) return text;
  return `${text.slice(0, PREVIEW_LIMIT)}\n\n… preview truncated at ${PREVIEW_LIMIT.toLocaleString()} characters …`;
}

export function installShimHttpUi(root: HTMLElement): void {
  ensureStyles();
  const loggerTools = root.querySelector<HTMLElement>('.logger-tools-slot');
  const liveToolbar = root.querySelector<HTMLElement>('.shim-live-toolbar');
  if (!loggerTools || !liveToolbar || root.querySelector('.shim-http-button')) return;

  const client = new ShimHttpReadOnlyClient(window.location.origin);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'shim-http-button';
  button.textContent = 'Shim HTTP…';
  button.title = 'Inspect read-only shim HTTP API surfaces';
  liveToolbar.insertAdjacentElement('afterend', button);

  const dialog = document.createElement('dialog');
  dialog.className = 'shim-http-dialog';
  dialog.innerHTML = `
    <div class="shim-http-panel">
      <header>
        <div class="shim-http-title">
          <strong>Shim HTTP · read-only inspection</strong>
          <small>GET-only inspection of the documented INI, live-object and trigger-log route families. EpicScope does not interpret unknown payload fields.</small>
        </div>
        <button type="button" class="shim-http-refresh">Refresh</button>
        <button type="button" class="shim-http-close" aria-label="Close shim HTTP inspection">×</button>
      </header>
      <div class="shim-http-routes"></div>
      <section class="shim-http-result">
        <div class="shim-http-result-meta">Choose a route.</div>
        <pre></pre>
      </section>
      <footer>
        <span class="shim-http-meta">Read-only · same-origin · no tune writes or ECU commands</span>
      </footer>
    </div>
  `;
  root.append(dialog);

  const routesHost = dialog.querySelector<HTMLElement>('.shim-http-routes')!;
  const resultMeta = dialog.querySelector<HTMLElement>('.shim-http-result-meta')!;
  const resultText = dialog.querySelector<HTMLElement>('.shim-http-result pre')!;
  const refreshButton = dialog.querySelector<HTMLButtonElement>('.shim-http-refresh')!;
  const closeButton = dialog.querySelector<HTMLButtonElement>('.shim-http-close')!;
  const results = new Map<ShimHttpRoute, ShimHttpInspection>();
  let selectedRoute: ShimHttpRoute = 'inis';
  let generation = 0;

  const routeButtons = new Map<ShimHttpRoute, HTMLButtonElement>();
  for (const route of ROUTES) {
    const routeButton = document.createElement('button');
    routeButton.type = 'button';
    routeButton.className = 'shim-http-route';
    routeButton.innerHTML = `<span>${route === 'inis' ? 'Matching INI' : route === 'objects' ? 'Live tune objects' : 'Trigger log'}</span><small>${SHIM_HTTP_ROUTES[route]}</small>`;
    routeButton.addEventListener('click', () => {
      selectedRoute = route;
      const result = results.get(route);
      if (result) {
        resultMeta.textContent = `${result.path} · ${result.status === undefined ? 'transport error' : `HTTP ${result.status} ${result.statusText}`.trim()} · ${result.elapsedMs.toFixed(1)} ms${result.contentType ? ` · ${result.contentType}` : ''}`;
        resultText.textContent = previewText(result);
      } else {
        resultMeta.textContent = SHIM_HTTP_ROUTES[route];
        resultText.textContent = 'No inspection result yet.';
      }
    });
    routeButtons.set(route, routeButton);
    routesHost.append(routeButton);
  }

  const renderResult = (route: ShimHttpRoute): void => {
    routeButtons.forEach((routeButton, candidate) => {
      routeButton.setAttribute('aria-pressed', String(candidate === route));
    });
    const result = results.get(route);
    if (!result) return;
    resultMeta.textContent = `${result.path} · ${result.status === undefined ? 'transport error' : `HTTP ${result.status} ${result.statusText}`.trim()} · ${result.elapsedMs.toFixed(1)} ms${result.contentType ? ` · ${result.contentType}` : ''}`;
    resultText.textContent = previewText(result);
  };

  const inspectAll = async (): Promise<void> => {
    const requestGeneration = ++generation;
    refreshButton.disabled = true;
    resultMeta.textContent = 'Inspecting documented shim HTTP routes…';
    resultText.textContent = '';
    for (const route of ROUTES) {
      const routeButton = routeButtons.get(route)!;
      routeButton.dataset.state = 'loading';
      routeButton.querySelector('small')!.textContent = `${SHIM_HTTP_ROUTES[route]} · loading…`;
    }

    const inspected = await client.inspectAll();
    if (requestGeneration !== generation) return;
    results.clear();
    for (const result of inspected) {
      results.set(result.route, result);
      const routeButton = routeButtons.get(result.route)!;
      routeButton.dataset.state = result.ok && !result.jsonError ? 'ok' : 'error';
      const status = result.status === undefined ? 'transport error' : `HTTP ${result.status}`;
      routeButton.querySelector('small')!.textContent = `${result.path} · ${status}`;
    }
    refreshButton.disabled = false;
    renderResult(selectedRoute);
  };

  button.addEventListener('click', () => {
    dialog.showModal();
    void inspectAll();
  });
  refreshButton.addEventListener('click', () => { void inspectAll(); });
  closeButton.addEventListener('click', () => dialog.close());

  const syncVisibility = (): void => {
    button.hidden = liveToolbar.hidden;
    if (liveToolbar.hidden && dialog.open) dialog.close();
  };
  const observer = new MutationObserver(syncVisibility);
  observer.observe(liveToolbar, { attributes: true, attributeFilter: ['hidden'] });
  syncVisibility();
}
