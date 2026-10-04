from pathlib import Path

app = Path('apps/web/src/app/app-shell.ts')
s = app.read_text()
old_modes = """          <button type=\"button\" class=\"global-module-choice global-module-choice--active\" role=\"menuitem\" aria-current=\"page\">\n            <span>\n              <strong>Logger / Analyzer</strong>\n              <small>Recorded log analysis</small>\n            </span>\n            <span class=\"module-state\">Active</span>\n          </button>\n"""
new_modes = """          <button type=\"button\" class=\"global-module-choice global-module-choice--active\" role=\"menuitem\" aria-current=\"page\">\n            <span>\n              <strong>Logger</strong>\n              <small>Recorded log viewing and navigation</small>\n            </span>\n            <span class=\"module-state\">Active</span>\n          </button>\n          <button type=\"button\" class=\"global-module-choice\" role=\"menuitem\" aria-disabled=\"true\" disabled>\n            <span>\n              <strong>Analyzer</strong>\n              <small>Range and channel analysis</small>\n            </span>\n            <span class=\"module-state\">Planned</span>\n          </button>\n          <button type=\"button\" class=\"global-module-choice\" role=\"menuitem\" aria-disabled=\"true\" disabled>\n            <span>\n              <strong>Histogram</strong>\n              <small>Distribution and binned analysis</small>\n            </span>\n            <span class=\"module-state\">Planned</span>\n          </button>\n"""
if old_modes not in s: raise SystemExit('mode block not found')
s = s.replace(old_modes, new_modes, 1)
old_actions = """    <div class=\"header-actions\">\n      <button type=\"button\" class=\"open-log source-load-button\" data-load-state=\"idle\">Open Log</button>\n      <button type=\"button\" class=\"load-ini source-load-button\" data-load-state=\"idle\">Load INI</button>\n      <div class=\"logger-tools-slot\"></div>\n      <button type=\"button\" class=\"workspace-undo\" disabled title=\"Undo workspace change\">↶</button>\n      <button type=\"button\" class=\"workspace-redo\" disabled title=\"Redo workspace change\">↷</button>\n      <button type=\"button\" disabled>Tools ▾</button>\n"""
new_actions = """    <div class=\"header-actions\">\n      <div class=\"load-data-wrap\">\n        <button type=\"button\" class=\"load-data-button\" aria-haspopup=\"menu\" aria-expanded=\"false\">Load Data <span aria-hidden=\"true\">▾</span></button>\n        <div class=\"load-data-menu\" role=\"menu\" hidden>\n          <div class=\"load-data-menu-head\">\n            <strong>Load Data</strong>\n            <small>Choose the source to add to the current workspace.</small>\n          </div>\n          <button type=\"button\" class=\"open-log source-load-button\" data-load-state=\"idle\" role=\"menuitem\">\n            <strong>Open Log…</strong><small>MLG recorded log</small>\n          </button>\n          <button type=\"button\" class=\"load-ini source-load-button\" data-load-state=\"idle\" role=\"menuitem\">\n            <strong>Load INI…</strong><small>Firmware channel catalog</small>\n          </button>\n        </div>\n      </div>\n      <div class=\"logger-tools-slot\"></div>\n      <button type=\"button\" class=\"workspace-undo\" disabled title=\"Undo workspace change\">↶</button>\n      <button type=\"button\" class=\"workspace-redo\" disabled title=\"Redo workspace change\">↷</button>\n"""
if old_actions not in s: raise SystemExit('header actions block not found')
s = s.replace(old_actions, new_actions, 1)
old_queries = """  const brandButton = header.querySelector<HTMLButtonElement>('.brand-button');\n  const brandMenu = header.querySelector<HTMLElement>('.global-switch-menu');\n  const openButton = header.querySelector<HTMLButtonElement>('.open-log');\n"""
new_queries = """  const brandButton = header.querySelector<HTMLButtonElement>('.brand-button');\n  const brandMenu = header.querySelector<HTMLElement>('.global-switch-menu');\n  const loadDataButton = header.querySelector<HTMLButtonElement>('.load-data-button');\n  const loadDataMenu = header.querySelector<HTMLElement>('.load-data-menu');\n  const openButton = header.querySelector<HTMLButtonElement>('.open-log');\n"""
if old_queries not in s: raise SystemExit('header query block not found')
s = s.replace(old_queries, new_queries, 1)
old_check = """  if (!brandButton || !brandMenu || !openButton || !loadIniButton || !loadedLog || !appStatus || !parserStatus || !settingsButton || !settingsPopover || !playbackSpeed || !samplePoints || !overviewTraces || !performanceVisible || !undoButton || !redoButton || !unloadIniButton || !iniStatus || !forgetWorkspaceButton || !persistenceStatus || !clearChannelCacheButton || !channelCacheStatus) {\n"""
new_check = """  if (!brandButton || !brandMenu || !loadDataButton || !loadDataMenu || !openButton || !loadIniButton || !loadedLog || !appStatus || !parserStatus || !settingsButton || !settingsPopover || !playbackSpeed || !samplePoints || !overviewTraces || !performanceVisible || !undoButton || !redoButton || !unloadIniButton || !iniStatus || !forgetWorkspaceButton || !persistenceStatus || !clearChannelCacheButton || !channelCacheStatus) {\n"""
if old_check not in s: raise SystemExit('header structure check not found')
s = s.replace(old_check, new_check, 1)
old_close = """  const closeBrandMenu = (): void => {\n    brandMenu.hidden = true;\n    brandButton.classList.remove('brand-button--open');\n    brandButton.setAttribute('aria-expanded', 'false');\n  };\n\n  brandButton.addEventListener('click', (event) => {\n"""
new_close = """  const closeBrandMenu = (): void => {\n    brandMenu.hidden = true;\n    brandButton.classList.remove('brand-button--open');\n    brandButton.setAttribute('aria-expanded', 'false');\n  };\n\n  const closeLoadDataMenu = (): void => {\n    loadDataMenu.hidden = true;\n    loadDataButton.setAttribute('aria-expanded', 'false');\n  };\n\n  loadDataButton.addEventListener('click', (event) => {\n    event.stopPropagation();\n    const nextOpen = loadDataMenu.hidden;\n    loadDataMenu.hidden = !nextOpen;\n    loadDataButton.setAttribute('aria-expanded', String(nextOpen));\n    if (nextOpen) {\n      closeBrandMenu();\n      closeSettings();\n    }\n  });\n  loadDataMenu.addEventListener('click', (event) => event.stopPropagation());\n\n  brandButton.addEventListener('click', (event) => {\n"""
if old_close not in s: raise SystemExit('brand close block not found')
s = s.replace(old_close, new_close, 1)
old_doc = """  document.addEventListener('click', () => {\n    closeBrandMenu();\n    closeSettings();\n  });\n\n  openButton.addEventListener('click', () => fileInput.click());\n  loadIniButton.addEventListener('click', () => iniInput.click());\n"""
new_doc = """  document.addEventListener('click', () => {\n    closeBrandMenu();\n    closeLoadDataMenu();\n    closeSettings();\n  });\n\n  openButton.addEventListener('click', () => {\n    closeLoadDataMenu();\n    fileInput.click();\n  });\n  loadIniButton.addEventListener('click', () => {\n    closeLoadDataMenu();\n    iniInput.click();\n  });\n"""
if old_doc not in s: raise SystemExit('document/open handler block not found')
s = s.replace(old_doc, new_doc, 1)
app.write_text(s)

logger = Path('apps/web/src/pages/logger-page.ts')
s = logger.read_text()
old_selector = """  root.innerHTML = `\n    <button type=\"button\" class=\"graph-selector-button\" aria-haspopup=\"menu\" aria-expanded=\"false\">\n"""
new_selector = """  root.innerHTML = `\n    <span class=\"graph-selector-context\">Graphs</span>\n    <button type=\"button\" class=\"graph-selector-button\" aria-haspopup=\"menu\" aria-expanded=\"false\">\n"""
if old_selector not in s: raise SystemExit('graph selector template not found')
s = s.replace(old_selector, new_selector, 1)
old_compare = """  const compareButton = document.createElement('button');\n  compareButton.type = 'button';\n  compareButton.disabled = true;\n  compareButton.textContent = 'Compare';\n  headerTools.append(\n    valueSearch.element,\n    layoutSelect,\n    arrangeSelect,\n    clearPaneButton,\n    resetLayoutButton,\n    compareButton,\n  );\n"""
new_compare = """  headerTools.append(\n    valueSearch.element,\n    layoutSelect,\n    arrangeSelect,\n    clearPaneButton,\n    resetLayoutButton,\n  );\n"""
if old_compare not in s: raise SystemExit('compare placeholder block not found')
s = s.replace(old_compare, new_compare, 1)
logger.write_text(s)

css = Path('apps/web/src/styles/app.css')
s = css.read_text()
append = """

/* Workflow hierarchy: source loading and graph workspace context */
.load-data-wrap { position: relative; }
.load-data-button {
  min-width: 96px !important;
  border-color: #2b789c;
  background: #123247;
  color: #e9f6fb;
  font-weight: 800;
}
.load-data-button:hover:not(:disabled),
.load-data-button[aria-expanded=\"true\"] {
  border-color: #4397c3;
  background: #17435f;
}
.load-data-menu {
  position: absolute;
  z-index: 260;
  top: calc(100% + 6px);
  right: 0;
  width: 250px;
  padding: 6px;
  border: 1px solid #385064;
  border-radius: 5px;
  background: #0d1822;
  box-shadow: 0 16px 38px rgba(0, 0, 0, .52);
}
.load-data-menu-head {
  display: grid;
  gap: 2px;
  padding: 6px 7px 8px;
  border-bottom: 1px solid #253946;
}
.load-data-menu-head strong { color: var(--headline); font-size: 11px; }
.load-data-menu-head small { color: var(--muted); font-size: 8px; }
.load-data-menu .source-load-button {
  width: 100%;
  min-height: 42px;
  height: auto;
  margin-top: 5px;
  display: grid;
  justify-items: start;
  align-content: center;
  gap: 2px;
  padding: 7px 9px;
  text-align: left;
}
.load-data-menu .source-load-button strong { font-size: 10px; }
.load-data-menu .source-load-button small { color: #9db0bc; font-size: 8px; font-weight: 600; }
.graph-selector-wrap {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.graph-selector-context {
  color: #7f929f;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .03em;
}
"""
if '/* Workflow hierarchy: source loading and graph workspace context */' not in s:
    s += append
css.write_text(s)

logger_css = Path('apps/web/src/styles/logger-ui.css')
s = logger_css.read_text()
append = """

.global-module-choice:disabled {
  opacity: .58;
  cursor: default;
}
.global-module-choice:disabled .module-state { color: #718796; }
"""
if '.global-module-choice:disabled {' not in s:
    s += append
logger_css.write_text(s)
