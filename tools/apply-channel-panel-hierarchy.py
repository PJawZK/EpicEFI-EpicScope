from pathlib import Path

p = Path('apps/web/src/panels/inspector-panel.ts')
s = p.read_text()
old_markup = """    <header class=\"panel-header\">\n      <div>\n        <span class=\"eyebrow\">Channels</span>\n        <strong>Full Sensor List</strong>\n      </div>\n      <span class=\"panel-state\">No log loaded</span>\n    </header>\n    <div class=\"inspector-tools\" aria-disabled=\"true\">\n      <input type=\"search\" placeholder=\"Search channels\" disabled aria-label=\"Search channels\" />\n      <div class=\"filter-row\">\n        <select disabled aria-label=\"Channel group\"><option>All Groups</option></select>\n        <select disabled aria-label=\"Channel visibility\">\n          <option value=\"all\">All Channels</option>\n          <option value=\"active\">Active traces</option>\n          <option value=\"favorites\">Favorites</option>\n          <option value=\"recent\">Recently used</option>\n        </select>\n      </div>\n      <div class=\"sort-row\" aria-label=\"Channel sorting\">\n        <span>Sort</span>\n        <button type=\"button\" data-sort-key=\"name\" disabled>Name ↑</button>\n        <button type=\"button\" data-sort-key=\"group\" disabled>Group</button>\n        <button type=\"button\" data-sort-key=\"value\" disabled>Value</button>\n      </div>\n    </div>\n"""
new_markup = """    <header class=\"panel-header\">\n      <div>\n        <span class=\"eyebrow\">Channel browser</span>\n        <strong>Channels</strong>\n      </div>\n      <span class=\"panel-state\">No log loaded</span>\n    </header>\n    <div class=\"inspector-tools\" aria-disabled=\"true\">\n      <input type=\"search\" placeholder=\"Search channels\" disabled aria-label=\"Search channels\" />\n      <div class=\"filter-row\">\n        <select disabled aria-label=\"Channel group\"><option>All Groups</option></select>\n        <select disabled aria-label=\"Channel visibility\">\n          <option value=\"all\">All Channels</option>\n          <option value=\"active\">Active traces</option>\n          <option value=\"favorites\">Favorites</option>\n          <option value=\"recent\">Recently used</option>\n        </select>\n      </div>\n      <div class=\"sort-row\" aria-label=\"Channel sorting\">\n        <span>Sort</span>\n        <select class=\"channel-sort-select\" disabled aria-label=\"Sort channels by\">\n          <option value=\"name\">Name</option>\n          <option value=\"group\">Group</option>\n          <option value=\"value\">Value</option>\n        </select>\n        <button type=\"button\" class=\"channel-sort-direction\" disabled aria-label=\"Sort ascending\" title=\"Sort ascending\">↑</button>\n      </div>\n    </div>\n"""
if old_markup not in s: raise SystemExit('inspector header/tools markup not found')
s = s.replace(old_markup, new_markup, 1)
old_footer = """    <footer class=\"panel-footer\">\n      <span class=\"channel-count\">0 channels</span>\n      <div class=\"panel-footer-actions\">\n        <button type=\"button\" class=\"add-filtered\" disabled>Add filtered</button>\n        <button type=\"button\" class=\"load-selected\" disabled>Load selected</button>\n        <button type=\"button\" class=\"clear-graph\" disabled>Clear graph</button>\n      </div>\n    </footer>\n"""
new_footer = """    <footer class=\"panel-footer\">\n      <span class=\"channel-count\">0 channels</span>\n      <div class=\"panel-footer-actions\">\n        <button type=\"button\" class=\"load-selected channel-primary-action\" disabled>Load now</button>\n        <div class=\"channel-more-wrap\">\n          <button type=\"button\" class=\"channel-more-button\" aria-label=\"More channel actions\" aria-haspopup=\"menu\" aria-expanded=\"false\">⋯</button>\n          <div class=\"channel-more-menu\" role=\"menu\" hidden>\n            <button type=\"button\" class=\"add-filtered\" disabled role=\"menuitem\">Add all filtered</button>\n            <button type=\"button\" class=\"clear-graph\" disabled role=\"menuitem\">Clear active pane</button>\n          </div>\n        </div>\n      </div>\n    </footer>\n"""
if old_footer not in s: raise SystemExit('inspector footer markup not found')
s = s.replace(old_footer, new_footer, 1)
old_queries = """  const channelCount = panel.querySelector<HTMLElement>('.channel-count');\n  const sortButtons = [...panel.querySelectorAll<HTMLButtonElement>('[data-sort-key]')];\n  const addFilteredButton = panel.querySelector<HTMLButtonElement>('.add-filtered');\n  const loadSelectedButton = panel.querySelector<HTMLButtonElement>('.load-selected');\n  const clearGraphButton = panel.querySelector<HTMLButtonElement>('.clear-graph');\n\n  if (!panelState || !search || !groupSelect || !visibilitySelect || !channelList || !spacer || !viewportHost || !emptyState || !statisticsPanel || !statisticsTitle || !statisticsBody || !statisticsClose || !statisticsDragHandle || !channelCount || !addFilteredButton || !loadSelectedButton || !clearGraphButton) {\n"""
new_queries = """  const channelCount = panel.querySelector<HTMLElement>('.channel-count');\n  const sortSelect = panel.querySelector<HTMLSelectElement>('.channel-sort-select');\n  const sortDirectionButton = panel.querySelector<HTMLButtonElement>('.channel-sort-direction');\n  const addFilteredButton = panel.querySelector<HTMLButtonElement>('.add-filtered');\n  const loadSelectedButton = panel.querySelector<HTMLButtonElement>('.load-selected');\n  const clearGraphButton = panel.querySelector<HTMLButtonElement>('.clear-graph');\n  const moreButton = panel.querySelector<HTMLButtonElement>('.channel-more-button');\n  const moreMenu = panel.querySelector<HTMLElement>('.channel-more-menu');\n\n  if (!panelState || !search || !groupSelect || !visibilitySelect || !channelList || !spacer || !viewportHost || !emptyState || !statisticsPanel || !statisticsTitle || !statisticsBody || !statisticsClose || !statisticsDragHandle || !channelCount || !sortSelect || !sortDirectionButton || !addFilteredButton || !loadSelectedButton || !clearGraphButton || !moreButton || !moreMenu) {\n"""
if old_queries not in s: raise SystemExit('inspector query block not found')
s = s.replace(old_queries, new_queries, 1)
old_render = """  const renderSortButtons = (): void => {\n    for (const button of sortButtons) {\n      const key = button.dataset.sortKey;\n      const label = key === 'name' ? 'Name' : key === 'group' ? 'Group' : 'Value';\n      button.textContent = key === sortKey ? `${label} ${sortAscending ? '↑' : '↓'}` : label;\n      button.setAttribute('aria-pressed', String(key === sortKey));\n    }\n  };\n"""
new_render = """  const renderSortControls = (): void => {\n    sortSelect.value = sortKey;\n    sortDirectionButton.textContent = sortAscending ? '↑' : '↓';\n    sortDirectionButton.title = sortAscending ? 'Sort ascending' : 'Sort descending';\n    sortDirectionButton.setAttribute('aria-label', sortDirectionButton.title);\n  };\n"""
if old_render not in s: raise SystemExit('renderSortButtons not found')
s = s.replace(old_render, new_render, 1)
s = s.replace('    renderSortButtons();\n', '    renderSortControls();\n', 1)
old_handlers = """  for (const button of sortButtons) {\n    button.addEventListener('click', () => {\n      const key = button.dataset.sortKey;\n      if (key !== 'name' && key !== 'group' && key !== 'value') return;\n      if (sortKey === key) sortAscending = !sortAscending;\n      else {\n        sortKey = key;\n        sortAscending = true;\n      }\n      applyFilters();\n      if (!restoringWorkspace) workspaceMutationListener?.();\n    });\n  }\n"""
new_handlers = """  sortSelect.addEventListener('change', () => {\n    const key = sortSelect.value;\n    if (key !== 'name' && key !== 'group' && key !== 'value') return;\n    sortKey = key;\n    sortAscending = true;\n    applyFilters();\n    if (!restoringWorkspace) workspaceMutationListener?.();\n  });\n  sortDirectionButton.addEventListener('click', () => {\n    sortAscending = !sortAscending;\n    applyFilters();\n    if (!restoringWorkspace) workspaceMutationListener?.();\n  });\n\n  const closeMoreMenu = (): void => {\n    moreMenu.hidden = true;\n    moreButton.setAttribute('aria-expanded', 'false');\n  };\n  moreButton.addEventListener('click', (event) => {\n    event.stopPropagation();\n    const nextOpen = moreMenu.hidden;\n    moreMenu.hidden = !nextOpen;\n    moreButton.setAttribute('aria-expanded', String(nextOpen));\n  });\n  moreMenu.addEventListener('click', (event) => event.stopPropagation());\n  document.addEventListener('click', closeMoreMenu);\n"""
if old_handlers not in s: raise SystemExit('sort handlers not found')
s = s.replace(old_handlers, new_handlers, 1)
s = s.replace('    for (const button of sortButtons) button.disabled = false;\n', '    sortSelect.disabled = false;\n    sortDirectionButton.disabled = false;\n', 1)
s = s.replace('    for (const button of sortButtons) button.disabled = true;\n', '    sortSelect.disabled = true;\n    sortDirectionButton.disabled = true;\n', 1)
# close overflow after actions
s = s.replace("  addFilteredButton.addEventListener('click', () => {\n    if (addFilteredButton.disabled) return;", "  addFilteredButton.addEventListener('click', () => {\n    if (addFilteredButton.disabled) return;\n    closeMoreMenu();", 1)
s = s.replace("  clearGraphButton.addEventListener('click', () => {\n    for (const channelId of [...activeChannelIds]) toggleListener?.(channelId);", "  clearGraphButton.addEventListener('click', () => {\n    closeMoreMenu();\n    for (const channelId of [...activeChannelIds]) toggleListener?.(channelId);", 1)
p.write_text(s)

css = Path('apps/web/src/styles/app.css')
s = css.read_text()
append = """

/* Channel browser hierarchy */
.sort-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 28px;
  align-items: center;
}
.sort-row .channel-sort-select {
  height: 25px;
  min-width: 0;
  padding: 0 6px;
  font-size: 9px;
}
.channel-sort-direction {
  width: 28px;
  height: 25px;
  padding: 0;
  font-size: 12px;
}
.channel-more-wrap { position: relative; }
.channel-primary-action {
  min-width: 76px;
  border-color: #2b789c;
  background: #123247;
  color: #e9f6fb;
  font-weight: 750;
}
.channel-more-button { width: 30px; min-width: 30px; padding: 0 !important; font-weight: 900; }
.channel-more-menu {
  position: absolute;
  z-index: 280;
  right: 0;
  bottom: calc(100% + 5px);
  width: 145px;
  padding: 5px;
  border: 1px solid #385064;
  border-radius: 4px;
  background: #0d1822;
  box-shadow: 0 12px 28px rgba(0,0,0,.45);
}
.channel-more-menu button {
  width: 100%;
  min-height: 28px;
  padding: 0 7px;
  border: 0;
  background: transparent;
  text-align: left;
  font-size: 9px;
}
.channel-more-menu button:hover:not(:disabled) { background: #102437; }
.channel-unit {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
"""
if '/* Channel browser hierarchy */' not in s: s += append
css.write_text(s)
