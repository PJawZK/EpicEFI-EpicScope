import type { ChannelDefinition } from '../../../../core/log-model/log-types';

const VIRTUAL_ROW_HEIGHT = 36;
const VIRTUAL_OVERSCAN_ROWS = 6;

export interface InspectorPanelController {
  readonly element: HTMLElement;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  setChannels(channels: readonly ChannelDefinition[], sourceName: string): void;
  setError(message: string): void;
  onChannelToggled(listener: (channelId: string) => void): void;
  setActiveChannels(channelIds: readonly string[]): void;
  setChannelValues(values: readonly { channelId: string; value: string }[]): void;
  clearChannelValues(): void;
}

export function createInspectorPanel(): InspectorPanelController {
  let visible = true;
  let channels: readonly ChannelDefinition[] = [];
  let filteredChannels: readonly ChannelDefinition[] = [];
  const activeChannelIds = new Set<string>();
  let toggleListener: ((channelId: string) => void) | undefined;
  const currentValues = new Map<string, string>();
  const renderedValueNodes = new Map<string, HTMLElement>();
  const renderedRows = new Map<string, HTMLButtonElement>();
  const renderedStateNodes = new Map<string, HTMLElement>();
  let scrollFrame: number | undefined;

  const panel = document.createElement('aside');
  panel.className = 'inspector-panel';
  panel.setAttribute('aria-label', 'Channel inspector');

  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <span class="eyebrow">Channels</span>
        <strong>Full Sensor List</strong>
      </div>
      <span class="panel-state">No log loaded</span>
    </header>
    <div class="inspector-tools" aria-disabled="true">
      <input type="search" placeholder="Search channels" disabled aria-label="Search channels" />
      <div class="filter-row">
        <select disabled aria-label="Channel group"><option>All Groups</option></select>
        <select disabled aria-label="Channel visibility">
          <option value="all">All Channels</option>
          <option value="active">Active traces</option>
        </select>
      </div>
      <div class="sort-row" aria-label="Channel sorting">
        <span>Sort</span>
        <button type="button" disabled>Name</button>
        <button type="button" disabled>Group</button>
        <button type="button" disabled>Value</button>
      </div>
    </div>
    <div class="channel-list channel-list--virtual" role="list">
      <div class="channel-list-spacer" aria-hidden="true"></div>
      <div class="channel-list-viewport"></div>
    </div>
    <div class="panel-empty">
      <strong>No channels yet</strong>
      <p>Open a supported log to populate the normalized channel list.</p>
    </div>
    <footer class="panel-footer">
      <span class="channel-count">0 channels</span>
      <div class="panel-footer-actions">
        <button type="button" disabled>Add filtered</button>
        <button type="button" class="clear-graph" disabled>Clear graph</button>
      </div>
    </footer>
  `;

  const panelState = panel.querySelector<HTMLElement>('.panel-state');
  const search = panel.querySelector<HTMLInputElement>('input[type="search"]');
  const groupSelect = panel.querySelector<HTMLSelectElement>('select[aria-label="Channel group"]');
  const visibilitySelect = panel.querySelector<HTMLSelectElement>('select[aria-label="Channel visibility"]');
  const channelList = panel.querySelector<HTMLElement>('.channel-list');
  const spacer = panel.querySelector<HTMLElement>('.channel-list-spacer');
  const viewportHost = panel.querySelector<HTMLElement>('.channel-list-viewport');
  const emptyState = panel.querySelector<HTMLElement>('.panel-empty');
  const channelCount = panel.querySelector<HTMLElement>('.channel-count');
  const clearGraphButton = panel.querySelector<HTMLButtonElement>('.clear-graph');

  if (!panelState || !search || !groupSelect || !visibilitySelect || !channelList || !spacer || !viewportHost || !emptyState || !channelCount || !clearGraphButton) {
    throw new Error('Inspector panel structure is incomplete.');
  }

  const updateCount = (): void => {
    const query = search.value.trim();
    const selectedGroup = groupSelect.value;
    const filtering = query.length > 0 || selectedGroup !== '' || visibilitySelect.value === 'active';
    channelCount.textContent = filtering
      ? `${filteredChannels.length} / ${channels.length} channels · ${activeChannelIds.size} active`
      : `${channels.length} channels · ${activeChannelIds.size} active`;
    clearGraphButton.disabled = activeChannelIds.size === 0;
  };

  const createRow = (channel: ChannelDefinition, index: number): HTMLButtonElement => {
    const active = activeChannelIds.has(channel.id);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'channel-row channel-row--virtual';
    row.classList.toggle('channel-row--active', active);
    row.setAttribute('role', 'listitem');
    row.setAttribute('aria-pressed', String(active));
    row.dataset.channelId = channel.id;
    row.style.transform = `translateY(${index * VIRTUAL_ROW_HEIGHT}px)`;

    const state = document.createElement('span');
    state.className = 'channel-trace-state';
    state.textContent = active ? '●' : '＋';
    state.setAttribute('aria-hidden', 'true');

    const identity = document.createElement('div');
    identity.className = 'channel-identity';
    const name = document.createElement('strong');
    name.textContent = channel.sourceName;
    identity.append(name);
    if (channel.category) {
      const category = document.createElement('span');
      category.textContent = channel.category;
      identity.append(category);
    }

    const value = document.createElement('span');
    value.className = 'channel-unit';
    value.textContent = currentValues.get(channel.id) ?? channel.unit ?? '—';

    row.append(state, identity, value);
    renderedValueNodes.set(channel.id, value);
    renderedRows.set(channel.id, row);
    renderedStateNodes.set(channel.id, state);
    return row;
  };

  const renderVisibleRows = (): void => {
    renderedValueNodes.clear();
    renderedRows.clear();
    renderedStateNodes.clear();

    const height = Math.max(channelList.clientHeight, VIRTUAL_ROW_HEIGHT * 12);
    const firstVisible = Math.floor(channelList.scrollTop / VIRTUAL_ROW_HEIGHT);
    const visibleCount = Math.ceil(height / VIRTUAL_ROW_HEIGHT);
    const start = Math.max(0, firstVisible - VIRTUAL_OVERSCAN_ROWS);
    const end = Math.min(
      filteredChannels.length,
      firstVisible + visibleCount + VIRTUAL_OVERSCAN_ROWS,
    );

    const fragment = document.createDocumentFragment();
    for (let index = start; index < end; index += 1) {
      const channel = filteredChannels[index];
      if (channel) fragment.append(createRow(channel, index));
    }
    viewportHost.replaceChildren(fragment);
  };

  const scheduleVisibleRender = (): void => {
    if (scrollFrame !== undefined) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = undefined;
      renderVisibleRows();
    });
  };

  const applyFilters = (resetScroll = true): void => {
    const query = search.value.trim().toLocaleLowerCase();
    const selectedGroup = groupSelect.value;
    const visibility = visibilitySelect.value;

    filteredChannels = channels.filter((channel) => {
      const matchesText = query.length === 0
        || channel.sourceName.toLocaleLowerCase().includes(query)
        || (channel.unit?.toLocaleLowerCase().includes(query) ?? false);
      const matchesGroup = selectedGroup === '' || channel.category === selectedGroup;
      const matchesVisibility = visibility !== 'active' || activeChannelIds.has(channel.id);
      return matchesText && matchesGroup && matchesVisibility;
    });

    spacer.style.height = `${filteredChannels.length * VIRTUAL_ROW_HEIGHT}px`;
    if (resetScroll) channelList.scrollTop = 0;
    renderVisibleRows();

    const hasChannels = channels.length > 0;
    channelList.hidden = !hasChannels;
    emptyState.hidden = hasChannels;
    updateCount();
  };

  channelList.addEventListener('scroll', scheduleVisibleRender, { passive: true });
  channelList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest<HTMLButtonElement>('.channel-row');
    const channelId = row?.dataset.channelId;
    if (channelId) toggleListener?.(channelId);
  });

  const resizeObserver = new ResizeObserver(scheduleVisibleRender);
  resizeObserver.observe(channelList);

  search.addEventListener('input', () => applyFilters());
  groupSelect.addEventListener('change', () => applyFilters());
  visibilitySelect.addEventListener('change', () => applyFilters());

  const setVisible = (next: boolean): void => {
    visible = next;
    panel.hidden = !visible;
    if (visible) scheduleVisibleRender();
  };

  const setChannels = (nextChannels: readonly ChannelDefinition[], sourceName: string): void => {
    channels = nextChannels;
    activeChannelIds.clear();
    currentValues.clear();
    panelState.textContent = sourceName;
    search.disabled = false;
    groupSelect.disabled = false;
    visibilitySelect.disabled = false;
    groupSelect.replaceChildren(new Option('All Groups', ''));

    const groups = [...new Set(
      channels
        .map((channel) => channel.category)
        .filter((category): category is string => Boolean(category)),
    )].sort((left, right) => left.localeCompare(right));

    for (const group of groups) groupSelect.add(new Option(group, group));
    search.value = '';
    visibilitySelect.value = 'all';
    applyFilters();
  };

  const setError = (message: string): void => {
    channels = [];
    filteredChannels = [];
    activeChannelIds.clear();
    currentValues.clear();
    panelState.textContent = 'Import failed';
    search.disabled = true;
    groupSelect.disabled = true;
    visibilitySelect.disabled = true;
    spacer.style.height = '0px';
    viewportHost.replaceChildren();
    channelList.hidden = true;
    emptyState.hidden = false;
    const title = emptyState.querySelector('strong');
    const detail = emptyState.querySelector('p');
    if (title) title.textContent = 'Could not open log';
    if (detail) detail.textContent = message;
    channelCount.textContent = '0 channels';
    clearGraphButton.disabled = true;
  };

  const setActiveChannels = (channelIds: readonly string[]): void => {
    const next = new Set(channelIds);
    const changed = new Set<string>();
    for (const channelId of activeChannelIds) {
      if (!next.has(channelId)) changed.add(channelId);
    }
    for (const channelId of next) {
      if (!activeChannelIds.has(channelId)) changed.add(channelId);
    }

    activeChannelIds.clear();
    for (const channelId of next) activeChannelIds.add(channelId);

    if (visibilitySelect.value === 'active') {
      applyFilters(false);
      return;
    }

    for (const channelId of changed) {
      const active = activeChannelIds.has(channelId);
      const row = renderedRows.get(channelId);
      const state = renderedStateNodes.get(channelId);
      if (row) {
        row.classList.toggle('channel-row--active', active);
        row.setAttribute('aria-pressed', String(active));
      }
      if (state) state.textContent = active ? '●' : '＋';
    }
    updateCount();
  };

  const setChannelValues = (values: readonly { channelId: string; value: string }[]): void => {
    if (values.length === 0) return;
    for (const item of values) {
      if (currentValues.get(item.channelId) === item.value) continue;
      currentValues.set(item.channelId, item.value);
      const valueNode = renderedValueNodes.get(item.channelId);
      if (valueNode) valueNode.textContent = item.value;
    }
  };

  const clearChannelValues = (): void => {
    if (currentValues.size === 0) return;
    currentValues.clear();
    renderVisibleRows();
  };

  clearGraphButton.addEventListener('click', () => {
    for (const channelId of [...activeChannelIds]) toggleListener?.(channelId);
  });

  applyFilters();

  return {
    element: panel,
    setVisible,
    isVisible: () => visible,
    setChannels,
    setError,
    onChannelToggled: (listener) => { toggleListener = listener; },
    setActiveChannels,
    setChannelValues,
    clearChannelValues,
  };
}
