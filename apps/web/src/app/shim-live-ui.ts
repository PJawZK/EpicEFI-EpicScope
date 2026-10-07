import { createShimCaptureSource } from '../adapters/shim/shim-capture-source';
import { ShimTelemetryClient, type ShimTelemetryClientEvent } from '../adapters/shim/shim-telemetry-client';
import { ShimLiveSession } from '../adapters/shim/shim-live-session';
import type { ShimSchema } from '../adapters/shim/shim-protocol';
import { dispatchShimCaptureSource } from './shim-capture-source-event';

const STYLE_ID = 'epicscope-shim-live-ui-style';

export function sameOriginShimTelemetryUrl(locationLike: Pick<Location, 'protocol' | 'host'>): string {
  const scheme = locationLike.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${locationLike.host}/telemetry`;
}

export function shimDeliveryRate(maxDeliveryHz: number): number {
  return Math.max(1, Math.min(10, maxDeliveryHz));
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .shim-source-button { display:flex; flex-direction:column; align-items:flex-start; width:100%; gap:2px; }
    .shim-source-button small { opacity:.72; }
    .shim-live-toolbar { display:flex; align-items:center; gap:6px; }
    .shim-live-toolbar[hidden] { display:none; }
    .shim-live-state { font-size:calc(.78rem * var(--epicscope-font-info-scale, 1)); opacity:.78; white-space:nowrap; }
    .shim-live-record { font-weight:650; }
    .shim-live-record[data-recording="true"] { outline:1px solid currentColor; }
    .shim-channel-dialog { width:min(720px, calc(100vw - 32px)); max-height:min(720px, calc(100vh - 32px)); border:1px solid var(--border, #49515f); border-radius:10px; padding:0; background:var(--panel, #15191f); color:inherit; }
    .shim-channel-dialog::backdrop { background:rgba(0,0,0,.55); }
    .shim-channel-panel { display:flex; flex-direction:column; max-height:min(720px, calc(100vh - 32px)); }
    .shim-channel-panel > header, .shim-channel-panel > footer { display:flex; align-items:center; gap:8px; padding:12px 14px; border-bottom:1px solid var(--border, #49515f); }
    .shim-channel-panel > footer { border-bottom:0; border-top:1px solid var(--border, #49515f); justify-content:flex-end; }
    .shim-channel-title { display:flex; flex-direction:column; gap:2px; flex:1; }
    .shim-channel-title small, .shim-channel-count { opacity:.72; font-size:calc(.8rem * var(--epicscope-font-info-scale, 1)); }
    .shim-channel-search { margin:10px 14px 6px; width:calc(100% - 28px); box-sizing:border-box; }
    .shim-channel-list { overflow:auto; padding:6px 14px 12px; display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:4px 12px; }
    .shim-channel-choice { display:flex; align-items:center; gap:7px; min-width:0; padding:5px 0; }
    .shim-channel-choice span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .shim-channel-choice small { margin-left:auto; opacity:.65; white-space:nowrap; }
    .shim-live-detail { white-space:nowrap; }
  `;
  document.head.append(style);
}

function setButtonText(button: HTMLButtonElement, strong: string, small: string): void {
  button.innerHTML = `<strong>${strong}</strong><small>${small}</small>`;
}

export function installShimLiveUi(root: HTMLElement): void {
  ensureStyles();
  const loadMenu = root.querySelector<HTMLElement>('.load-data-menu');
  const loggerTools = root.querySelector<HTMLElement>('.logger-tools-slot');
  const modeChip = root.querySelector<HTMLElement>('.mode-chip');
  const loadedLog = root.querySelector<HTMLElement>('.loaded-log');
  const appStatus = root.querySelector<HTMLElement>('.app-status');
  const parserStatus = root.querySelector<HTMLElement>('.parser-status');
  if (!loadMenu || !loggerTools || !modeChip || !loadedLog || !appStatus || !parserStatus) return;
  if (loadMenu.querySelector('.shim-source-button')) return;

  const connectButton = document.createElement('button');
  connectButton.type = 'button';
  connectButton.className = 'source-load-button shim-source-button';
  connectButton.setAttribute('role', 'menuitem');
  setButtonText(connectButton, 'Connect Shim…', 'Same-origin live telemetry');
  loadMenu.append(connectButton);

  const toolbar = document.createElement('div');
  toolbar.className = 'shim-live-toolbar';
  toolbar.hidden = true;
  toolbar.innerHTML = `
    <button type="button" class="shim-live-channels">Channels…</button>
    <button type="button" class="shim-live-record" disabled>Record</button>
    <button type="button" class="shim-live-open-capture" disabled>Open Capture</button>
    <button type="button" class="shim-live-follow" aria-pressed="true" disabled>Follow</button>
    <span class="shim-live-state">Disconnected</span>
  `;
  loggerTools.prepend(toolbar);

  const channelsButton = toolbar.querySelector<HTMLButtonElement>('.shim-live-channels')!;
  const recordButton = toolbar.querySelector<HTMLButtonElement>('.shim-live-record')!;
  const openCaptureButton = toolbar.querySelector<HTMLButtonElement>('.shim-live-open-capture')!;
  const followButton = toolbar.querySelector<HTMLButtonElement>('.shim-live-follow')!;
  const liveState = toolbar.querySelector<HTMLElement>('.shim-live-state')!;

  const dialog = document.createElement('dialog');
  dialog.className = 'shim-channel-dialog';
  dialog.innerHTML = `
    <div class="shim-channel-panel">
      <header>
        <div class="shim-channel-title"><strong>Shim logging channels</strong><small>Select one-stream capture channels.</small></div>
        <span class="shim-channel-count">0 selected</span>
      </header>
      <input class="shim-channel-search" type="search" placeholder="Filter channels…" aria-label="Filter shim channels" />
      <div class="shim-channel-list"></div>
      <footer>
        <button type="button" class="shim-channel-clear">Clear</button>
        <button type="button" class="shim-channel-close">Done</button>
      </footer>
    </div>
  `;
  root.append(dialog);
  const search = dialog.querySelector<HTMLInputElement>('.shim-channel-search')!;
  const list = dialog.querySelector<HTMLElement>('.shim-channel-list')!;
  const count = dialog.querySelector<HTMLElement>('.shim-channel-count')!;
  const clear = dialog.querySelector<HTMLButtonElement>('.shim-channel-clear')!;
  const close = dialog.querySelector<HTMLButtonElement>('.shim-channel-close')!;

  let client: ShimTelemetryClient | undefined;
  let session: ShimLiveSession | undefined;
  let schema: ShimSchema | undefined;
  let selected = new Set<string>();
  let maxChannels = 0;
  let connected = false;
  let captureId: string | undefined;
  let followLatest = true;
  let lastLiveDispatchMs = 0;

  const updateSelectionCount = (): void => {
    count.textContent = `${selected.size} selected${maxChannels > 0 ? ` / ${maxChannels} max` : ''}`;
    recordButton.disabled = !connected || selected.size === 0 || selected.size > maxChannels || session?.isRecording === true;
    const canOpenCapture = Boolean(session?.capture && session.capture.sampleCount > 0 && session.dataSource && schema && client?.welcome);
    openCaptureButton.disabled = !canOpenCapture;
    openCaptureButton.textContent = session?.isRecording ? (captureOpened ? 'Viewing Live' : 'View Live') : 'Open Capture';
    followButton.disabled = !captureOpened || !session?.isRecording;
  };

  const renderChannelList = (): void => {
    const query = search.value.trim().toLowerCase();
    const fragment = document.createDocumentFragment();
    for (const channel of schema?.channels ?? []) {
      const haystack = `${channel.id} ${channel.name} ${channel.unit ?? ''}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;
      const label = document.createElement('label');
      label.className = 'shim-channel-choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.has(channel.id);
      input.disabled = !input.checked && selected.size >= maxChannels;
      input.addEventListener('change', () => {
        if (input.checked) selected.add(channel.id); else selected.delete(channel.id);
        updateSelectionCount();
        renderChannelList();
      });
      const name = document.createElement('span');
      name.textContent = channel.name || channel.id;
      name.title = channel.id;
      const unit = document.createElement('small');
      unit.textContent = channel.unit ?? '';
      label.append(input, name, unit);
      fragment.append(label);
    }
    list.replaceChildren(fragment);
    updateSelectionCount();
  };

  let captureOpened = false;
  const setHeaderLive = (detail: string): void => {
    if (captureOpened) return;
    modeChip.textContent = session?.isRecording ? 'LIVE · SHIM · RECORDING' : 'LIVE · SHIM';
    loadedLog.title = 'Live ts_shim source';
    const label = loadedLog.querySelector<HTMLElement>(':scope > span');
    const value = loadedLog.querySelector<HTMLElement>(':scope > strong');
    if (label) label.textContent = 'Shim';
    if (value) { value.textContent = detail; value.classList.add('shim-live-detail'); }
    parserStatus.textContent = 'TS-SHIM · same-origin telemetry';
  };

  const resetRecordedHeader = (): void => {
    modeChip.textContent = 'RECORDED';
    parserStatus.textContent = 'LOG-MLG · local file parsing';
  };

  const handleClientEvent = (event: ShimTelemetryClientEvent): void => {
    if (event.type === 'welcome') {
      connected = true;
      maxChannels = event.welcome.limits.maxChannelsPerStream;
      toolbar.hidden = false;
      setButtonText(connectButton, 'Disconnect Shim', `${event.welcome.limits.maxRateHz} Hz max · ${event.welcome.clockId}`);
      setHeaderLive(event.welcome.ecu.signature || 'ECU connected');
      liveState.textContent = event.welcome.simulator ? 'Connected · simulator' : 'Connected';
      appStatus.textContent = 'Shim connected';
      updateSelectionCount();
      return;
    }
    if (event.type === 'schema') {
      schema = event.schema;
      const available = new Set(schema.channels.map((channel) => channel.id));
      selected = new Set([...selected].filter((id) => available.has(id)));
      renderChannelList();
      liveState.textContent = schema.decodable ? `${schema.channels.length} channels` : 'Schema unavailable';
      return;
    }
    if (event.type === 'state') {
      if (event.state === 'disconnected') {
        connected = false;
        toolbar.hidden = true;
        setButtonText(connectButton, 'Connect Shim…', 'Same-origin live telemetry');
        liveState.textContent = 'Disconnected';
        if (!session?.isRecording && !captureOpened) resetRecordedHeader();
      } else if (event.state === 'reconnecting') {
        toolbar.hidden = false;
        liveState.textContent = 'Reconnecting…';
        modeChip.textContent = 'LIVE · SHIM · RECONNECTING';
      } else if (event.state === 'ecu-down') {
        toolbar.hidden = false;
        liveState.textContent = 'ECU down';
      } else if (event.state === 'incompatible-schema') {
        toolbar.hidden = false;
        liveState.textContent = 'Incompatible schema';
      } else if (event.state !== 'ready') {
        toolbar.hidden = false;
        liveState.textContent = event.state.replaceAll('-', ' ');
      }
      updateSelectionCount();
      return;
    }
    if (event.type === 'reconnectScheduled') {
      liveState.textContent = `Reconnect in ${(event.delayMs / 1000).toFixed(1)} s`;
      return;
    }
    if (event.type === 'protocolError') appStatus.textContent = `Shim: ${event.error.message}`;
  };

  const connect = (): void => {
    if (client) return;
    const url = sameOriginShimTelemetryUrl(window.location);
    client = new ShimTelemetryClient({ url });
    session = new ShimLiveSession(client);
    client.onEvent(handleClientEvent);
    session.onEvent((event) => {
      if (event.type === 'captureChanged') {
        const loss = event.deliveryLossCount > 0 ? ` · loss ${event.deliveryLossCount}` : '';
        liveState.textContent = `${event.sampleCount.toLocaleString()} samples${loss}`;
        modeChip.textContent = captureOpened ? 'LIVE · SHIM · FOLLOW' : 'LIVE · SHIM · RECORDING';
        updateSelectionCount();
        const now = performance.now();
        if (captureOpened && now - lastLiveDispatchMs >= 100) {
          const capture = session?.capture;
          const dataSource = session?.dataSource;
          const welcome = client?.welcome;
          if (capture && dataSource && schema && welcome && capture.sampleCount > 0) {
            lastLiveDispatchMs = now;
            dispatchShimCaptureSource(root, createShimCaptureSource({ captureId: captureId ?? `shim:${Date.now()}:${welcome.generation}`, capture, channelData: dataSource, schema }), 'refresh', followLatest);
          }
        }
      } else if (event.type === 'state') {
        recordButton.dataset.recording = String(event.state === 'recording' || event.state === 'waiting-stream' || event.state === 'waiting-reconnect');
        if (event.state === 'recording' || event.state === 'waiting-stream' || event.state === 'waiting-reconnect') {
          recordButton.textContent = 'Stop';
          recordButton.disabled = false;
          updateSelectionCount();
          modeChip.textContent = event.state === 'waiting-reconnect' ? 'LIVE · SHIM · RECONNECTING' : (captureOpened ? 'LIVE · SHIM · FOLLOW' : 'LIVE · SHIM · RECORDING');
        } else if (event.state === 'stopped') {
          recordButton.textContent = 'Record';
          recordButton.dataset.recording = 'false';
          appStatus.textContent = `Shim capture stopped · ${session?.capture?.sampleCount ?? 0} samples retained`;
          setHeaderLive(`${session?.capture?.sampleCount.toLocaleString() ?? '0'} samples retained`);
          updateSelectionCount();
        }
      } else if (event.type === 'error') {
        appStatus.textContent = `Shim recording error: ${event.error.message}`;
      }
    });
    toolbar.hidden = false;
    liveState.textContent = 'Connecting…';
    appStatus.textContent = 'Connecting to same-origin shim…';
    client.connect();
  };

  const disconnect = (): void => {
    if (!client) return;
    if (session?.isRecording) session.stopRecording();
    session?.dispose();
    client.disconnect();
    client = undefined;
    session = undefined;
    schema = undefined;
    selected.clear();
    connected = false;
    maxChannels = 0;
    captureId = undefined;
    toolbar.hidden = true;
    setButtonText(connectButton, 'Connect Shim…', 'Same-origin live telemetry');
    if (!captureOpened) resetRecordedHeader();
    appStatus.textContent = captureOpened ? 'Shim disconnected · retained capture remains active' : 'Shim disconnected';
  };

  connectButton.addEventListener('click', () => {
    if (client) disconnect(); else connect();
  });
  channelsButton.addEventListener('click', () => {
    renderChannelList();
    dialog.showModal();
    search.focus();
  });
  search.addEventListener('input', renderChannelList);
  clear.addEventListener('click', () => { selected.clear(); renderChannelList(); });
  close.addEventListener('click', () => dialog.close());
  recordButton.addEventListener('click', () => {
    if (!session || !client) return;
    if (session.isRecording) {
      session.stopRecording();
      return;
    }
    if (selected.size === 0) {
      appStatus.textContent = 'Select at least one shim channel before recording.';
      return;
    }
    const welcome = client.welcome;
    if (!welcome) return;
    captureId = `shim:${Date.now()}:${welcome.generation}`;
    captureOpened = false;
    followLatest = true;
    followButton.setAttribute('aria-pressed', 'true');
    followButton.textContent = 'Follow';
    lastLiveDispatchMs = 0;
    openCaptureButton.disabled = true;
    session.startRecording({
      channels: [...selected],
      mode: 'series',
      rateHz: welcome.limits.maxRateHz,
      deliveryHz: shimDeliveryRate(welcome.limits.maxDeliveryHz),
    });
    setHeaderLive(`${selected.size} channels · ${welcome.limits.maxRateHz} Hz`);
    appStatus.textContent = `Shim recording armed · ${selected.size} channels`;
  });
  openCaptureButton.addEventListener('click', () => {
    const capture = session?.capture;
    const dataSource = session?.dataSource;
    const welcome = client?.welcome;
    if (!capture || !dataSource || !schema || !welcome || capture.sampleCount === 0) return;
    const source = createShimCaptureSource({ captureId: captureId ?? `shim:${Date.now()}:${welcome.generation}`, capture, channelData: dataSource, schema });
    captureOpened = true;
    dispatchShimCaptureSource(root, source, 'open', followLatest);
    modeChip.textContent = session?.isRecording ? 'LIVE · SHIM · FOLLOW' : 'CAPTURE · SHIM';
    appStatus.textContent = session?.isRecording
      ? `Live shim view active · ${source.recordCount.toLocaleString()} samples`
      : `Shim capture opened · ${source.recordCount.toLocaleString()} samples`;
    updateSelectionCount();
  });
  followButton.addEventListener('click', () => {
    followLatest = !followLatest;
    followButton.setAttribute('aria-pressed', String(followLatest));
    followButton.textContent = followLatest ? 'Follow' : 'Follow Off';
    appStatus.textContent = followLatest ? 'Live follow enabled' : 'Live follow paused · inspect history freely';
  });
}
