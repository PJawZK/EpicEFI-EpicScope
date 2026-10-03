import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { InspectorWorkspaceState } from '../state/workspace-state';

const VIRTUAL_ROW_HEIGHT = 36;
const VIRTUAL_OVERSCAN_ROWS = 6;

export interface InspectorChannelStatistics {
  readonly channelId: string;
  readonly title: string;
  readonly unit: string | undefined;
  readonly category: string | undefined;
  readonly current: number | undefined;
  readonly full: {
    readonly complete: boolean;
    readonly validCount: number;
    readonly invalidCount: number;
    readonly min: number | undefined;
    readonly max: number | undefined;
    readonly mean: number | undefined;
    readonly standardDeviation: number | undefined;
  };
  readonly visible: {
    readonly validCount: number;
    readonly min: number | undefined;
    readonly max: number | undefined;
    readonly mean: number | undefined;
  };
}

export interface InspectorPanelController {
  readonly element: HTMLElement;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  setChannels(
    channels: readonly ChannelDefinition[],
    sourceName: string,
    unavailableChannelIds?: readonly string[],
  ): void;
  setCatalogChannels(channels: readonly ChannelDefinition[], sourceName: string): void;
  setError(message: string): void;
  onChannelToggled(listener: (channelId: string) => void): void;
  onLoadSelected(listener: () => void): void;
  onAddFiltered(listener: (channelIds: readonly string[]) => void): void;
  onChannelDetailsRequested(listener: (channelId: string) => void): void;
  setActiveChannels(channelIds: readonly string[]): void;
  setQueuedChannels(channelIds: readonly string[]): void;
  setChannelValues(values: readonly { channelId: string; value: string }[]): void;
  clearChannelValues(): void;
  setChannelStatistics(statistics: InspectorChannelStatistics | undefined): void;
  onWorkspaceMutation(listener: () => void): void;
  getWorkspaceState(): InspectorWorkspaceState;
  restoreWorkspaceState(state: InspectorWorkspaceState): void;
}

export function createInspectorPanel(): InspectorPanelController {
  let visible = true;
  let channels: readonly ChannelDefinition[] = [];
  let filteredChannels: readonly ChannelDefinition[] = [];
  const unavailableChannelIds = new Set<string>();
  const activeChannelIds = new Set<string>();
  const queuedChannelIds = new Set<string>();
  const favoriteChannelIds = new Set<string>();
  const recentChannelIds: string[] = [];
  let toggleListener: ((channelId: string) => void) | undefined;
  let loadSelectedListener: (() => void) | undefined;
  let addFilteredListener: ((channelIds: readonly string[]) => void) | undefined;
  let detailsListener: ((channelId: string) => void) | undefined;
  let selectedDetailsChannelId: string | undefined;
  let workspaceMutationListener: (() => void) | undefined;
  let restoringWorkspace = false;
  let sortKey: 'name' | 'group' | 'value' = 'name';
  let sortAscending = true;
  const currentValues = new Map<string, string>();
  const renderedValueNodes = new Map<string, HTMLElement>();
  const renderedRows = new Map<string, HTMLElement>();
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
          <option value="favorites">Favorites</option>
          <option value="recent">Recently used</option>
        </select>
      </div>
      <div class="sort-row" aria-label="Channel sorting">
        <span>Sort</span>
        <button type="button" data-sort-key="name" disabled>Name ↑</button>
        <button type="button" data-sort-key="group" disabled>Group</button>
        <button type="button" data-sort-key="value" disabled>Value</button>
      </div>
    </div>
    <div class="channel-list channel-list--virtual" role="list">
      <div class="channel-list-spacer" aria-hidden="true"></div>
      <div class="channel-list-viewport"></div>
    </div>
    <section class="channel-statistics channel-statistics--floating" hidden>
      <header class="channel-statistics-drag-handle" title="Drag channel details window">
        <div>
          <span class="eyebrow">Channel details</span>
          <strong class="channel-statistics-title">—</strong>
        </div>
        <button type="button" class="channel-statistics-close" aria-label="Close channel details">×</button>
      </header>
      <div class="channel-statistics-body"></div>
    </section>
    <div class="panel-empty">
      <strong>No channels yet</strong>
      <p>Open a supported log to populate the normalized channel list.</p>
    </div>
    <footer class="panel-footer">
      <span class="channel-count">0 channels</span>
      <div class="panel-footer-actions">
        <button type="button" class="add-filtered" disabled>Add filtered</button>
        <button type="button" class="load-selected" disabled>Load selected</button>
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
  const statisticsPanel = panel.querySelector<HTMLElement>('.channel-statistics');
  const statisticsTitle = panel.querySelector<HTMLElement>('.channel-statistics-title');
  const statisticsBody = panel.querySelector<HTMLElement>('.channel-statistics-body');
  const statisticsClose = panel.querySelector<HTMLButtonElement>('.channel-statistics-close');
  const statisticsDragHandle = panel.querySelector<HTMLElement>('.channel-statistics-drag-handle');
  const channelCount = panel.querySelector<HTMLElement>('.channel-count');
  const sortButtons = [...panel.querySelectorAll<HTMLButtonElement>('[data-sort-key]')];
  const addFilteredButton = panel.querySelector<HTMLButtonElement>('.add-filtered');
  const loadSelectedButton = panel.querySelector<HTMLButtonElement>('.load-selected');
  const clearGraphButton = panel.querySelector<HTMLButtonElement>('.clear-graph');

  if (!panelState || !search || !groupSelect || !visibilitySelect || !channelList || !spacer || !viewportHost || !emptyState || !statisticsPanel || !statisticsTitle || !statisticsBody || !statisticsClose || !statisticsDragHandle || !channelCount || !addFilteredButton || !loadSelectedButton || !clearGraphButton) {
    throw new Error('Inspector panel structure is incomplete.');
  }

  const updateCount = (): void => {
    const query = search.value.trim();
    const selectedGroup = groupSelect.value;
    const filtering = query.length > 0 || selectedGroup !== '' || visibilitySelect.value !== 'all';
    const queued = queuedChannelIds.size;
    channelCount.textContent = filtering
      ? `${filteredChannels.length} / ${channels.length} channels · ${activeChannelIds.size} active${queued > 0 ? ` · ${queued} selected` : ''}`
      : `${channels.length} channels · ${activeChannelIds.size} active${queued > 0 ? ` · ${queued} selected` : ''}`;
    loadSelectedButton.disabled = queued === 0;
    loadSelectedButton.textContent = queued > 0 ? `Load now (${queued})` : 'Load now';
    clearGraphButton.disabled = activeChannelIds.size === 0;
    addFilteredButton.disabled = filteredChannels.length === 0
      || filteredChannels.every(
        (channel) => activeChannelIds.has(channel.id) || queuedChannelIds.has(channel.id),
      );
  };

  const createRow = (channel: ChannelDefinition, index: number): HTMLElement => {
    const active = activeChannelIds.has(channel.id);
    const queued = queuedChannelIds.has(channel.id);
    const favorite = favoriteChannelIds.has(channel.id);
    const unavailable = unavailableChannelIds.has(channel.id);
    const row = document.createElement('div');
    row.className = 'channel-row channel-row--virtual';
    row.classList.toggle('channel-row--active', active);
    row.classList.toggle('channel-row--queued', queued);
    row.classList.toggle('channel-row--unavailable', unavailable);
    row.setAttribute('role', 'listitem');
    row.dataset.channelId = channel.id;
    row.style.transform = `translateY(${index * VIRTUAL_ROW_HEIGHT}px)`;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'channel-row-toggle';
    toggle.dataset.channelToggle = channel.id;
    toggle.setAttribute('aria-pressed', String(active));
    toggle.disabled = false;
    toggle.title = unavailable
      ? 'Assign channel to active graph pane; data will appear when a matching log is loaded'
      : 'Toggle channel in active graph pane';

    const state = document.createElement('span');
    state.className = 'channel-trace-state';
    state.textContent = active ? '●' : queued ? '✓' : '＋';
    state.setAttribute('aria-hidden', 'true');

    const identity = document.createElement('div');
    identity.className = 'channel-identity';
    const name = document.createElement('strong');
    name.textContent = channel.displayName || channel.sourceName;
    name.title = channel.sourceName;
    identity.append(name);
    if (channel.category || channel.unit) {
      const detail = document.createElement('span');
      detail.textContent = [channel.category, channel.unit].filter(Boolean).join(' · ');
      identity.append(detail);
    }

    const value = document.createElement('span');
    value.className = 'channel-unit';
    value.textContent = currentValues.get(channel.id) ?? channel.unit ?? '—';

    toggle.append(state, identity, value);

    const actions = document.createElement('div');
    actions.className = 'channel-row-actions';

    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = 'channel-favorite';
    favoriteButton.dataset.channelFavorite = channel.id;
    favoriteButton.textContent = favorite ? '★' : '☆';
    favoriteButton.title = favorite ? 'Remove favorite' : 'Add favorite';
    favoriteButton.setAttribute('aria-pressed', String(favorite));

    const detailsButton = document.createElement('button');
    detailsButton.type = 'button';
    detailsButton.className = 'channel-details';
    detailsButton.dataset.channelDetails = channel.id;
    detailsButton.textContent = 'ⓘ';
    detailsButton.disabled = unavailable;
    detailsButton.title = unavailable
      ? 'Known from INI; this log has no data for statistics'
      : active ? 'Channel statistics' : 'Activate channel to view statistics';

    actions.append(favoriteButton, detailsButton);
    row.append(toggle, actions);
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

  const numericValue = (channelId: string): number | undefined => {
    const text = currentValues.get(channelId);
    if (!text) return undefined;
    const match = text.trim().match(/^[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
    if (!match) return undefined;
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : undefined;
  };

  const compareChannels = (left: ChannelDefinition, right: ChannelDefinition): number => {
    let result = 0;
    if (sortKey === 'name') {
      result = left.sourceName.localeCompare(right.sourceName, undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortKey === 'group') {
      result = (left.category ?? '').localeCompare(right.category ?? '', undefined, { numeric: true, sensitivity: 'base' });
      if (result === 0) result = left.sourceName.localeCompare(right.sourceName, undefined, { numeric: true, sensitivity: 'base' });
    } else {
      const leftValue = numericValue(left.id);
      const rightValue = numericValue(right.id);
      if (leftValue === undefined && rightValue === undefined) {
        result = left.sourceName.localeCompare(right.sourceName, undefined, { numeric: true, sensitivity: 'base' });
      } else if (leftValue === undefined) {
        result = 1;
      } else if (rightValue === undefined) {
        result = -1;
      } else {
        result = leftValue - rightValue;
        if (result === 0) result = left.sourceName.localeCompare(right.sourceName, undefined, { numeric: true, sensitivity: 'base' });
      }
    }
    return sortAscending ? result : -result;
  };

  const renderSortButtons = (): void => {
    for (const button of sortButtons) {
      const key = button.dataset.sortKey;
      const label = key === 'name' ? 'Name' : key === 'group' ? 'Group' : 'Value';
      button.textContent = key === sortKey ? `${label} ${sortAscending ? '↑' : '↓'}` : label;
      button.setAttribute('aria-pressed', String(key === sortKey));
    }
  };

  const applyFilters = (resetScroll = true): void => {
    const query = search.value.trim().toLocaleLowerCase();
    const selectedGroup = groupSelect.value;
    const visibility = visibilitySelect.value;

    filteredChannels = channels.filter((channel) => {
      const matchesText = query.length === 0
        || channel.sourceName.toLocaleLowerCase().includes(query)
        || channel.displayName.toLocaleLowerCase().includes(query)
        || (channel.unit?.toLocaleLowerCase().includes(query) ?? false);
      const matchesGroup = selectedGroup === ''
        || (selectedGroup === '__ungrouped__' ? !channel.category?.trim() : channel.category === selectedGroup);
      const matchesVisibility = visibility === 'all'
        || (visibility === 'active' && activeChannelIds.has(channel.id))
        || (visibility === 'favorites' && favoriteChannelIds.has(channel.id))
        || (visibility === 'recent' && recentChannelIds.includes(channel.id));
      return matchesText && matchesGroup && matchesVisibility;
    }).sort(compareChannels);

    renderSortButtons();
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

    const favoriteButton = target.closest<HTMLElement>('[data-channel-favorite]');
    const favoriteId = favoriteButton?.dataset.channelFavorite;
    if (favoriteId) {
      if (favoriteChannelIds.has(favoriteId)) favoriteChannelIds.delete(favoriteId);
      else favoriteChannelIds.add(favoriteId);
      if (visibilitySelect.value === 'favorites') applyFilters(false);
      else renderVisibleRows();
      if (!restoringWorkspace) workspaceMutationListener?.();
      return;
    }

    const detailsButton = target.closest<HTMLElement>('[data-channel-details]');
    const detailsId = detailsButton?.dataset.channelDetails;
    if (detailsId) {
      selectedDetailsChannelId = detailsId;
      detailsListener?.(detailsId);
      return;
    }

    const toggleButton = target.closest<HTMLElement>('[data-channel-toggle]');
    const channelId = toggleButton?.dataset.channelToggle;
    if (channelId) toggleListener?.(channelId);
  });

  const resizeObserver = new ResizeObserver(scheduleVisibleRender);
  resizeObserver.observe(channelList);

  search.addEventListener('input', () => {
    applyFilters();
    if (!restoringWorkspace) workspaceMutationListener?.();
  });
  groupSelect.addEventListener('change', () => {
    applyFilters();
    if (!restoringWorkspace) workspaceMutationListener?.();
  });
  visibilitySelect.addEventListener('change', () => {
    applyFilters();
    if (!restoringWorkspace) workspaceMutationListener?.();
  });

  for (const button of sortButtons) {
    button.addEventListener('click', () => {
      const key = button.dataset.sortKey;
      if (key !== 'name' && key !== 'group' && key !== 'value') return;
      if (sortKey === key) sortAscending = !sortAscending;
      else {
        sortKey = key;
        sortAscending = true;
      }
      applyFilters();
      if (!restoringWorkspace) workspaceMutationListener?.();
    });
  }

  const setVisible = (next: boolean): void => {
    if (visible === next) return;
    visible = next;
    panel.hidden = !visible;
    if (visible) scheduleVisibleRender();
    if (!restoringWorkspace) workspaceMutationListener?.();
  };

  const setChannelSource = (
    nextChannels: readonly ChannelDefinition[],
    sourceName: string,
    nextUnavailableChannelIds: readonly string[],
  ): void => {
    channels = nextChannels;
    unavailableChannelIds.clear();
    for (const channelId of nextUnavailableChannelIds) unavailableChannelIds.add(channelId);
    activeChannelIds.clear();
    queuedChannelIds.clear();
    recentChannelIds.splice(0);
    currentValues.clear();
    selectedDetailsChannelId = undefined;
    statisticsPanel.hidden = true;
    panelState.textContent = sourceName;
    search.disabled = false;
    groupSelect.disabled = false;
    visibilitySelect.disabled = false;
    for (const button of sortButtons) button.disabled = false;
    groupSelect.replaceChildren(new Option(`All (${channels.length.toLocaleString()})`, ''));

    const groupCounts = new Map<string, number>();
    let ungroupedCount = 0;
    for (const channel of channels) {
      const category = channel.category?.trim();
      if (category) groupCounts.set(category, (groupCounts.get(category) ?? 0) + 1);
      else ungroupedCount += 1;
    }
    const groups = [...groupCounts.keys()].sort((left, right) => left.localeCompare(right));
    for (const group of groups) {
      groupSelect.add(new Option(`${group} (${groupCounts.get(group)})`, group));
    }
    if (ungroupedCount > 0) groupSelect.add(new Option(`Ungrouped (${ungroupedCount})`, '__ungrouped__'));
    search.value = '';
    visibilitySelect.value = 'all';
    sortKey = 'name';
    sortAscending = true;
    applyFilters();
  };

  const setChannels = (
    nextChannels: readonly ChannelDefinition[],
    sourceName: string,
    nextUnavailableChannelIds: readonly string[] = [],
  ): void =>
    setChannelSource(nextChannels, sourceName, nextUnavailableChannelIds);

  const setCatalogChannels = (nextChannels: readonly ChannelDefinition[], sourceName: string): void =>
    setChannelSource(
      nextChannels,
      `${sourceName} · INI catalog`,
      nextChannels.map((channel) => channel.id),
    );

  const setError = (message: string): void => {
    channels = [];
    filteredChannels = [];
    unavailableChannelIds.clear();
    activeChannelIds.clear();
    queuedChannelIds.clear();
    currentValues.clear();
    recentChannelIds.splice(0);
    selectedDetailsChannelId = undefined;
    statisticsPanel.hidden = true;
    panelState.textContent = 'Import failed';
    search.disabled = true;
    groupSelect.disabled = true;
    visibilitySelect.disabled = true;
    for (const button of sortButtons) button.disabled = true;
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
    for (const channelId of next) {
      activeChannelIds.add(channelId);
      const recentIndex = recentChannelIds.indexOf(channelId);
      if (recentIndex >= 0) recentChannelIds.splice(recentIndex, 1);
      recentChannelIds.unshift(channelId);
    }
    if (recentChannelIds.length > 32) recentChannelIds.length = 32;

    if (visibilitySelect.value === 'active' || visibilitySelect.value === 'recent') {
      applyFilters(false);
      return;
    }

    for (const channelId of changed) {
      const active = activeChannelIds.has(channelId);
      const row = renderedRows.get(channelId);
      const state = renderedStateNodes.get(channelId);
      if (row) {
        row.classList.toggle('channel-row--active', active);
        row.querySelector<HTMLElement>('[data-channel-toggle]')?.setAttribute('aria-pressed', String(active));
      }
      if (state) state.textContent = active ? '●' : '＋';
    }
    updateCount();
  };

  const setQueuedChannels = (channelIds: readonly string[]): void => {
    const next = new Set(channelIds);
    const changed = new Set<string>();
    for (const channelId of queuedChannelIds) {
      if (!next.has(channelId)) changed.add(channelId);
    }
    for (const channelId of next) {
      if (!queuedChannelIds.has(channelId)) changed.add(channelId);
    }

    queuedChannelIds.clear();
    for (const channelId of next) queuedChannelIds.add(channelId);

    for (const channelId of changed) {
      const active = activeChannelIds.has(channelId);
      const queued = queuedChannelIds.has(channelId);
      const row = renderedRows.get(channelId);
      const state = renderedStateNodes.get(channelId);
      if (row) row.classList.toggle('channel-row--queued', queued);
      if (state) state.textContent = active ? '●' : queued ? '✓' : '＋';
    }
    updateCount();
  };

  const setChannelValues = (values: readonly { channelId: string; value: string }[]): void => {
    if (values.length === 0) return;
    let changed = false;
    for (const item of values) {
      if (currentValues.get(item.channelId) === item.value) continue;
      currentValues.set(item.channelId, item.value);
      changed = true;
      const valueNode = renderedValueNodes.get(item.channelId);
      if (valueNode) valueNode.textContent = item.value;
    }
    if (changed && sortKey === 'value') applyFilters(false);
  };

  const clearChannelValues = (): void => {
    if (currentValues.size === 0) return;
    currentValues.clear();
    renderVisibleRows();
  };

  const formatStatistic = (value: number | undefined, precision = 3): string =>
    value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(precision);

  const setChannelStatistics = (statistics: InspectorChannelStatistics | undefined): void => {
    if (!statistics) {
      statisticsPanel.hidden = false;
      statisticsTitle.textContent = selectedDetailsChannelId
        ? channels.find((channel) => channel.id === selectedDetailsChannelId)?.sourceName ?? 'Channel'
        : 'Channel';
      statisticsBody.innerHTML = '<p class="channel-statistics-message">Activate this channel to view decoded statistics without another file read.</p>';
      return;
    }

    const precision = Math.min(6, Math.max(0,
      channels.find((channel) => channel.id === statistics.channelId)?.precision ?? 3,
    ));
    const unit = statistics.unit ? ` ${statistics.unit}` : '';
    const cell = (label: string, value: string): string =>
      `<div><span>${label}</span><strong>${value}</strong></div>`;

    statisticsPanel.hidden = false;
    statisticsTitle.textContent = statistics.title;
    const scope = statistics.full.complete ? 'Full' : 'Loaded';
    statisticsBody.innerHTML = [
      cell('Current', statistics.current === undefined ? '—' : `${formatStatistic(statistics.current, precision)}${unit}`),
      cell(`${scope} min`, statistics.full.min === undefined ? '—' : `${formatStatistic(statistics.full.min, precision)}${unit}`),
      cell(`${scope} max`, statistics.full.max === undefined ? '—' : `${formatStatistic(statistics.full.max, precision)}${unit}`),
      cell(`${scope} mean`, statistics.full.mean === undefined ? '—' : `${formatStatistic(statistics.full.mean, precision)}${unit}`),
      cell(`${scope} std dev`, statistics.full.standardDeviation === undefined ? '—' : `${formatStatistic(statistics.full.standardDeviation, precision)}${unit}`),
      cell(`${scope} valid`, statistics.full.validCount.toLocaleString()),
      cell(`${scope} invalid`, statistics.full.invalidCount.toLocaleString()),
      cell('Visible min', statistics.visible.min === undefined ? '—' : `${formatStatistic(statistics.visible.min, precision)}${unit}`),
      cell('Visible max', statistics.visible.max === undefined ? '—' : `${formatStatistic(statistics.visible.max, precision)}${unit}`),
      cell('Visible mean', statistics.visible.mean === undefined ? '—' : `${formatStatistic(statistics.visible.mean, precision)}${unit}`),
      cell('Visible samples', statistics.visible.validCount.toLocaleString()),
    ].join('');
  };

  statisticsClose.addEventListener('click', () => {
    selectedDetailsChannelId = undefined;
    statisticsPanel.hidden = true;
  });

  statisticsDragHandle.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) return;
    event.preventDefault();
    const rect = statisticsPanel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    statisticsDragHandle.setPointerCapture(event.pointerId);

    const move = (moveEvent: PointerEvent): void => {
      const maxLeft = Math.max(0, window.innerWidth - statisticsPanel.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - statisticsPanel.offsetHeight);
      statisticsPanel.style.left = `${Math.min(maxLeft, Math.max(0, moveEvent.clientX - offsetX))}px`;
      statisticsPanel.style.top = `${Math.min(maxTop, Math.max(0, moveEvent.clientY - offsetY))}px`;
      statisticsPanel.style.right = 'auto';
    };
    const end = (endEvent: PointerEvent): void => {
      if (statisticsDragHandle.hasPointerCapture(endEvent.pointerId)) {
        statisticsDragHandle.releasePointerCapture(endEvent.pointerId);
      }
      statisticsDragHandle.removeEventListener('pointermove', move);
      statisticsDragHandle.removeEventListener('pointerup', end);
      statisticsDragHandle.removeEventListener('pointercancel', end);
    };
    statisticsDragHandle.addEventListener('pointermove', move);
    statisticsDragHandle.addEventListener('pointerup', end);
    statisticsDragHandle.addEventListener('pointercancel', end);
  });

  addFilteredButton.addEventListener('click', () => {
    if (addFilteredButton.disabled) return;
    const candidates = filteredChannels
      .map((channel) => channel.id)
      .filter((channelId) =>
        !activeChannelIds.has(channelId)
        && !queuedChannelIds.has(channelId)
      );
    if (candidates.length > 0) addFilteredListener?.(candidates);
  });

  loadSelectedButton.addEventListener('click', () => {
    if (!loadSelectedButton.disabled) loadSelectedListener?.();
  });

  // Large-log selections are intentionally staged so several row-oriented
  // channels can share one sequential source pass. For normal pointer use,
  // leaving the inspector is the natural commit gesture: the user selects the
  // channels they want and simply moves back to the graph. The footer button
  // remains as an explicit keyboard/touch/fallback action.
  panel.addEventListener('pointerleave', () => {
    if (queuedChannelIds.size > 0) loadSelectedListener?.();
  });

  clearGraphButton.addEventListener('click', () => {
    for (const channelId of [...activeChannelIds]) toggleListener?.(channelId);
  });

  applyFilters();

  const getWorkspaceState = (): InspectorWorkspaceState => ({
    visible,
    favoriteChannelIds: [...favoriteChannelIds],
    recentChannelIds: [...recentChannelIds],
    searchQuery: search.value,
    selectedGroup: groupSelect.value,
    visibilityFilter: visibilitySelect.value,
    sortKey,
    sortAscending,
  });

  const restoreWorkspaceState = (state: InspectorWorkspaceState): void => {
    restoringWorkspace = true;
    try {
      visible = state.visible;
      panel.hidden = !visible;
      favoriteChannelIds.clear();
      for (const channelId of state.favoriteChannelIds) favoriteChannelIds.add(channelId);
      recentChannelIds.splice(0, recentChannelIds.length, ...state.recentChannelIds);
      search.value = state.searchQuery;
      groupSelect.value = [...groupSelect.options].some((option) => option.value === state.selectedGroup)
        ? state.selectedGroup
        : '';
      visibilitySelect.value = [...visibilitySelect.options].some((option) => option.value === state.visibilityFilter)
        ? state.visibilityFilter
        : 'all';
      sortKey = state.sortKey;
      sortAscending = state.sortAscending;
      applyFilters(false);
      if (visible) scheduleVisibleRender();
    } finally {
      restoringWorkspace = false;
    }
  };

  return {
    element: panel,
    setVisible,
    isVisible: () => visible,
    setChannels,
    setCatalogChannels,
    setError,
    onChannelToggled: (listener) => { toggleListener = listener; },
    onLoadSelected: (listener) => { loadSelectedListener = listener; },
    onAddFiltered: (listener) => { addFilteredListener = listener; },
    onChannelDetailsRequested: (listener) => { detailsListener = listener; },
    setActiveChannels,
    setQueuedChannels,
    setChannelValues,
    clearChannelValues,
    setChannelStatistics,
    onWorkspaceMutation: (listener) => { workspaceMutationListener = listener; },
    getWorkspaceState,
    restoreWorkspaceState,
  };
}
