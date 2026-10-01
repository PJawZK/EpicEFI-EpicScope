import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export interface InspectorPanelController {
  readonly element: HTMLElement;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  setChannels(channels: readonly ChannelDefinition[], sourceName: string): void;
  setError(message: string): void;
  onChannelSelected(listener: (channelId: string) => void): void;
  setSelectedChannel(channelId: string | undefined): void;
  setSelectedValue(channelId: string, value: string): void;
}

export function createInspectorPanel(): InspectorPanelController {
  let visible = true;
  let channels: readonly ChannelDefinition[] = [];
  let selectedChannelId: string | undefined;
  let selectionListener: ((channelId: string) => void) | undefined;
  const currentValues = new Map<string, string>();

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
        <select disabled aria-label="Channel visibility"><option>All Channels</option></select>
      </div>
      <div class="sort-row" aria-label="Channel sorting">
        <span>Sort</span>
        <button type="button" disabled>Name</button>
        <button type="button" disabled>Group</button>
        <button type="button" disabled>Value</button>
      </div>
    </div>
    <div class="channel-list" role="list"></div>
    <div class="panel-empty">
      <strong>No channels yet</strong>
      <p>Open a supported log to populate the normalized channel list.</p>
    </div>
    <footer class="panel-footer">
      <span class="channel-count">0 channels</span>
      <div class="panel-footer-actions">
        <button type="button" disabled>Add filtered</button>
        <button type="button" disabled>Clear graph</button>
      </div>
    </footer>
  `;

  const panelState = panel.querySelector<HTMLElement>('.panel-state');
  const search = panel.querySelector<HTMLInputElement>('input[type="search"]');
  const groupSelect = panel.querySelector<HTMLSelectElement>('select[aria-label="Channel group"]');
  const channelList = panel.querySelector<HTMLElement>('.channel-list');
  const emptyState = panel.querySelector<HTMLElement>('.panel-empty');
  const channelCount = panel.querySelector<HTMLElement>('.channel-count');

  if (!panelState || !search || !groupSelect || !channelList || !emptyState || !channelCount) {
    throw new Error('Inspector panel structure is incomplete.');
  }

  const renderChannels = (): void => {
    const query = search.value.trim().toLocaleLowerCase();
    const selectedGroup = groupSelect.value;
    const filtered = channels.filter((channel) => {
      const matchesText = query.length === 0
        || channel.sourceName.toLocaleLowerCase().includes(query)
        || (channel.unit?.toLocaleLowerCase().includes(query) ?? false);
      const matchesGroup = selectedGroup === '' || channel.category === selectedGroup;
      return matchesText && matchesGroup;
    });

    channelList.replaceChildren();
    for (const channel of filtered) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'channel-row';
      row.classList.toggle('channel-row--selected', channel.id === selectedChannelId);
      row.setAttribute('role', 'listitem');
      row.dataset.channelId = channel.id;

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
      row.append(identity, value);
      row.addEventListener('click', () => {
        selectedChannelId = channel.id;
        renderChannels();
        selectionListener?.(channel.id);
      });
      channelList.append(row);
    }

    const hasChannels = channels.length > 0;
    channelList.hidden = !hasChannels;
    emptyState.hidden = hasChannels;
    channelCount.textContent = query.length > 0 || selectedGroup !== ''
      ? `${filtered.length} / ${channels.length} channels`
      : `${channels.length} channels`;
  };

  search.addEventListener('input', renderChannels);
  groupSelect.addEventListener('change', renderChannels);

  const setVisible = (next: boolean): void => {
    visible = next;
    panel.hidden = !visible;
  };

  const setChannels = (nextChannels: readonly ChannelDefinition[], sourceName: string): void => {
    channels = nextChannels;
    selectedChannelId = undefined;
    currentValues.clear();
    panelState.textContent = sourceName;
    search.disabled = false;
    groupSelect.disabled = false;
    groupSelect.replaceChildren(new Option('All Groups', ''));

    const groups = [...new Set(
      channels
        .map((channel) => channel.category)
        .filter((category): category is string => Boolean(category)),
    )].sort((left, right) => left.localeCompare(right));

    for (const group of groups) {
      groupSelect.add(new Option(group, group));
    }
    search.value = '';
    renderChannels();
  };

  const setError = (message: string): void => {
    channels = [];
    selectedChannelId = undefined;
    currentValues.clear();
    panelState.textContent = 'Import failed';
    search.disabled = true;
    groupSelect.disabled = true;
    channelList.hidden = true;
    emptyState.hidden = false;
    const title = emptyState.querySelector('strong');
    const detail = emptyState.querySelector('p');
    if (title) title.textContent = 'Could not open log';
    if (detail) detail.textContent = message;
    channelCount.textContent = '0 channels';
  };

  const setSelectedChannel = (channelId: string | undefined): void => {
    selectedChannelId = channelId;
    renderChannels();
  };

  const setSelectedValue = (channelId: string, value: string): void => {
    currentValues.set(channelId, value);
    if (channelId === selectedChannelId) renderChannels();
  };

  renderChannels();

  return {
    element: panel,
    setVisible,
    isVisible: () => visible,
    setChannels,
    setError,
    onChannelSelected: (listener) => { selectionListener = listener; },
    setSelectedChannel,
    setSelectedValue,
  };
}
