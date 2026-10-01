export interface InspectorPanelController {
  readonly element: HTMLElement;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
}

export function createInspectorPanel(): InspectorPanelController {
  let visible = true;

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
    <div class="panel-empty">
      <strong>No channels yet</strong>
      <p>Open a supported log to populate the normalized channel list.</p>
    </div>
    <footer class="panel-footer">
      <span>0 channels</span>
      <div class="panel-footer-actions">
        <button type="button" disabled>Add filtered</button>
        <button type="button" disabled>Clear graph</button>
      </div>
    </footer>
  `;

  const setVisible = (next: boolean): void => {
    visible = next;
    panel.hidden = !visible;
  };

  return {
    element: panel,
    setVisible,
    isVisible: () => visible,
  };
}
