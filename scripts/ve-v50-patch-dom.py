from pathlib import Path


def patch(path: str, replacements: list[tuple[str, str]]) -> None:
    p = Path(path)
    s = p.read_text()
    for old, new in replacements:
        if old not in s:
            raise SystemExit(f'{path}: missing pattern: {old[:120]!r}')
        s = s.replace(old, new, 1)
    p.write_text(s)


patch('apps/web/src/pages/ve-table-interaction-dom.ts', [
("import { installTableToolConfiguration, type TableToolConfigurationOwner } from './ve-table-tool-options-dom';\n",
 "import { installTableToolConfiguration, type TableToolConfigurationOwner } from './ve-table-tool-options-dom';\nimport { VE_TABLE_TOOL_ICONS } from './ve-table-icons';\n"),
("  readonly readValue?: (position: TableCellPosition) => number | undefined;\n  readonly adjustBrushRadius?: (delta: 1 | -1) => void;\n",
 "  readonly readValue?: (position: TableCellPosition) => number | undefined;\n  readonly baselineValue?: (position: TableCellPosition) => number | undefined;\n  readonly adjustBrushRadius?: (delta: 1 | -1) => void;\n"),
("function createToolButton(label: string, title: string, action: () => void): HTMLButtonElement {\n  const button = document.createElement('button');\n  button.type = 'button';\n  button.textContent = label;\n  button.title = title;\n",
 "function createToolButton(content: string, title: string, action: () => void): HTMLButtonElement {\n  const button = document.createElement('button');\n  button.type = 'button';\n  button.innerHTML = content;\n  button.title = title;\n  button.setAttribute('aria-label', title);\n"),
("  let brushLast: TableCellPosition | undefined;\n  let brushDirection: 1 | -1 = 1;\n",
 "  let brushLast: TableCellPosition | undefined;\n  let brushHover: TableCellPosition | undefined;\n  let brushDirection: 1 | -1 = 1;\n"),
("  const undo = createToolButton('↶', 'Undo', () => run(() => commands.undo?.() ?? false));\n  const redo = createToolButton('↷', 'Redo', () => run(() => commands.redo?.() ?? false));\n  const decrement = createToolButton('−', 'Decrease selected cells', () => {\n",
 "  const undo = createToolButton(VE_TABLE_TOOL_ICONS.undo, 'Undo', () => run(() => commands.undo?.() ?? false));\n  const redo = createToolButton(VE_TABLE_TOOL_ICONS.redo, 'Redo', () => run(() => commands.redo?.() ?? false));\n  const decrement = createToolButton(VE_TABLE_TOOL_ICONS.minus, 'Decrease selected cells', () => {\n"),
("  const increment = createToolButton('+', 'Increase selected cells', () => {\n",
 "  const increment = createToolButton(VE_TABLE_TOOL_ICONS.plus, 'Increase selected cells', () => {\n"),
("  const smooth = createToolButton('Smooth', 'Smooth selected cells · right-click settings', () => run(() => session.smooth(preferences.smoothStrength())));\n",
 "  const smooth = createToolButton(VE_TABLE_TOOL_ICONS.smooth, 'Smooth selected cells · right-click settings', () => run(() => session.smooth(preferences.smoothStrength())));\n"),
("  const interpolateHorizontal = createToolButton('H', 'Interpolate horizontally · right-click settings', () => interpolateWith('horizontal'));\n  const interpolateVertical = createToolButton('V', 'Interpolate vertically · right-click settings', () => interpolateWith('vertical'));\n  const interpolateBoth = createToolButton('2D', 'Interpolate both directions · right-click settings', () => interpolateWith('both'));\n  const pin = createToolButton('Pin', 'Pin or unpin selected cells', () => {\n",
 "  const interpolateHorizontal = createToolButton(VE_TABLE_TOOL_ICONS.interpolateHorizontal, 'Interpolate horizontally · right-click settings', () => interpolateWith('horizontal'));\n  const interpolateVertical = createToolButton(VE_TABLE_TOOL_ICONS.interpolateVertical, 'Interpolate vertically · right-click settings', () => interpolateWith('vertical'));\n  const interpolateBoth = createToolButton(VE_TABLE_TOOL_ICONS.interpolateBoth, 'Interpolate both directions · right-click settings', () => interpolateWith('both'));\n  const pin = createToolButton(VE_TABLE_TOOL_ICONS.pin, 'Pin or unpin selected cells', () => {\n"),
("  const brush = createToolButton('Brush', 'Continuous brush editing', () => setBrushActive(!brushActive));\n  const revert = createToolButton('Revert', 'Revert selected cells', () => {\n",
 "  const brush = createToolButton(VE_TABLE_TOOL_ICONS.brush, 'Continuous brush editing', () => setBrushActive(!brushActive));\n  const revert = createToolButton(VE_TABLE_TOOL_ICONS.revert, 'Revert selected cells', () => {\n"),
("  const clear = createToolButton('Clear', 'Clear selected cells', () => {\n",
 "  const clear = createToolButton(VE_TABLE_TOOL_ICONS.clear, 'Clear selected cells', () => {\n"),
("    const pinned = new Set(session.pinnedPositions().map(positionKey));\n    const activeCell = document.activeElement instanceof HTMLTableCellElement && table.contains(document.activeElement)\n",
 "    const pinned = new Set(session.pinnedPositions().map(positionKey));\n    const brushPreview = new Set(\n      brushActive && brushHover ? session.brushFootprint(brushHover, preferences.brush()).map(positionKey) : [],\n    );\n    const activeCell = document.activeElement instanceof HTMLTableCellElement && table.contains(document.activeElement)\n"),
("      cell.dataset.tablePinned = isPinned ? 'true' : 'false';\n      cell.setAttribute('aria-selected', isSelected ? 'true' : 'false');\n",
 "      cell.dataset.tablePinned = isPinned ? 'true' : 'false';\n      cell.dataset.tableBrushPreview = brushPreview.has(cellKey) ? 'true' : 'false';\n      const currentValue = preferences.readValue?.(position);\n      const baselineValue = preferences.baselineValue?.(position);\n      if (currentValue !== undefined && baselineValue !== undefined && Number.isFinite(currentValue) && Number.isFinite(baselineValue)) {\n        const epsilon = 1e-9 * Math.max(1, Math.abs(currentValue), Math.abs(baselineValue));\n        cell.dataset.tableValueState = currentValue < baselineValue - epsilon ? 'lower' : currentValue > baselineValue + epsilon ? 'higher' : 'same';\n      } else delete cell.dataset.tableValueState;\n      cell.setAttribute('aria-selected', isSelected ? 'true' : 'false');\n"),
("    if (!cell || !position || inlineInput) return;\n    event.preventDefault();\n    if (brushActive) {\n      anchor = position;\n      refresh();\n      startBrush(event, position);\n",
 "    if (!cell || !position) return;\n    event.preventDefault();\n    if (inlineInput) {\n      finishInlineEdit?.(true);\n      queueMicrotask(() => {\n        session.selectCell(position, 'replace');\n        anchor = position;\n        refresh();\n        cellFor(position)?.focus({ preventScroll: true });\n      });\n      return;\n    }\n    if (brushActive) {\n      session.clearSelection();\n      anchor = undefined;\n      brushHover = position;\n      refresh();\n      startBrush(event, position);\n"),
("    if (brushActive && brushPointerId === event.pointerId && brushStroke) {\n      brushDirection = event.shiftKey ? -1 : 1;\n      if (!brushLast || positionKey(brushLast) !== positionKey(position)) pulseBrush(position, true);\n      return;\n    }\n",
 "    if (brushActive && brushPointerId === event.pointerId && brushStroke) {\n      brushDirection = event.shiftKey ? -1 : 1;\n      brushHover = position;\n      if (!brushLast || positionKey(brushLast) !== positionKey(position)) pulseBrush(position, true);\n      refresh();\n      return;\n    }\n"),
("  const wheel = (event: WheelEvent): void => {\n",
 "  const brushHoverMove = (event: PointerEvent): void => {\n    if (!brushActive || brushPointerId !== undefined) return;\n    const cell = editableCell(event.target, table);\n    const position = cell ? positionForCell(cell) : undefined;\n    if (!position || (brushHover && positionKey(brushHover) === positionKey(position))) return;\n    brushHover = position;\n    refresh();\n  };\n\n  const brushHoverLeave = (): void => {\n    if (!brushActive || brushPointerId !== undefined || !brushHover) return;\n    brushHover = undefined;\n    refresh();\n  };\n\n  const wheel = (event: WheelEvent): void => {\n"),
("      table.removeEventListener('pointerdown', pointerDown);\n      table.removeEventListener('keydown', keyDown);\n      table.removeEventListener('wheel', wheel);\n",
 "      table.removeEventListener('pointerdown', pointerDown);\n      table.removeEventListener('pointermove', brushHoverMove);\n      table.removeEventListener('pointerleave', brushHoverLeave);\n      table.removeEventListener('keydown', keyDown);\n      table.removeEventListener('wheel', wheel);\n"),
("      table.addEventListener('pointerdown', pointerDown);\n      table.addEventListener('keydown', keyDown);\n      table.addEventListener('wheel', wheel, { passive: false });\n",
 "      table.addEventListener('pointerdown', pointerDown);\n      table.addEventListener('pointermove', brushHoverMove);\n      table.addEventListener('pointerleave', brushHoverLeave);\n      table.addEventListener('keydown', keyDown);\n      table.addEventListener('wheel', wheel, { passive: false });\n"),
("  const setBrushActive = (active: boolean): void => {\n    if (brushActive === active) return;\n    if (!active) finishBrush(false);\n    brushActive = active;\n    refresh();\n  };\n",
 "  const setBrushActive = (active: boolean): void => {\n    if (brushActive === active) return;\n    if (!active) finishBrush(false);\n    brushActive = active;\n    brushHover = undefined;\n    if (active) {\n      finishInlineEdit?.(true);\n      session.clearSelection();\n      anchor = undefined;\n    }\n    refresh();\n  };\n"),
("      table.removeEventListener('pointerdown', pointerDown);\n      table.removeEventListener('keydown', keyDown);\n      table.removeEventListener('wheel', wheel);\n    }\n    table = undefined;\n",
 "      table.removeEventListener('pointerdown', pointerDown);\n      table.removeEventListener('pointermove', brushHoverMove);\n      table.removeEventListener('pointerleave', brushHoverLeave);\n      table.removeEventListener('keydown', keyDown);\n      table.removeEventListener('wheel', wheel);\n    }\n    table = undefined;\n"),
])

patch('apps/web/src/pages/ve-analyzer-delay-table-interaction.ts', [
("  readonly #undo: HistoryEntry[] = [];\n  readonly #redo: HistoryEntry[] = [];\n",
 "  readonly #undo: HistoryEntry[] = [];\n  readonly #redo: HistoryEntry[] = [];\n  #baseline: readonly (number | undefined)[] | undefined;\n  #baselineRows = 0;\n  #baselineCols = 0;\n"),
("  valueAt(position: TableCellPosition): number | undefined {\n    return snapshotValue(this.#owner, position.row, position.col);\n  }\n\n  beginTransaction(label: string): TableEditTransaction {\n",
 "  valueAt(position: TableCellPosition): number | undefined {\n    return snapshotValue(this.#owner, position.row, position.col);\n  }\n\n  baselineValueAt(position: TableCellPosition): number | undefined {\n    const snapshot = this.#owner.snapshot();\n    if (!snapshot) return undefined;\n    if (!this.#baseline || this.#baselineRows !== snapshot.rows || this.#baselineCols !== snapshot.cols) {\n      this.#baseline = [...snapshot.values];\n      this.#baselineRows = snapshot.rows;\n      this.#baselineCols = snapshot.cols;\n    }\n    return this.#baseline[position.row * snapshot.cols + position.col];\n  }\n\n  resetBaseline(): void {\n    this.#baseline = undefined;\n    this.#baselineRows = 0;\n    this.#baselineCols = 0;\n  }\n\n  beginTransaction(label: string): TableEditTransaction {\n"),
("    readValue: (position) => surface.valueAt(position),\n    adjustBrushRadius: (delta) => saveToolPreferences({\n",
 "    readValue: (position) => surface.valueAt(position),\n    baselineValue: (position) => surface.baselineValueAt(position),\n    adjustBrushRadius: (delta) => saveToolPreferences({\n"),
("    deleteSelection: (positions) => surface.revert(positions),\n",
 "    deleteSelection: (positions) => surface.replaceWithUndefined(positions),\n"),
("    surface.resetHistory();\n  };\n",
 "    surface.resetHistory();\n    surface.resetBaseline();\n  };\n"),
("  for (const selector of ['[data-ve-analyzer=\"grab-delay\"]', '[data-ve-analyzer=\"use-delay\"]', '[data-ve-analyzer=\"load-delay\"]'] as const) {\n    root.querySelector<HTMLButtonElement>(selector)?.addEventListener('click', resetInteractionSession, { capture: true });\n  }\n  root.querySelector<HTMLInputElement>('[data-ve-analyzer=\"load-delay-file\"]')\n    ?.addEventListener('change', resetInteractionSession, { capture: true });\n",
 "  root.querySelector<HTMLButtonElement>('[data-ve-analyzer=\"grab-delay\"]')\n    ?.addEventListener('click', () => dom.cancelActiveInteraction(), { capture: true });\n  root.querySelector<HTMLButtonElement>('[data-ve-analyzer=\"use-delay\"]')\n    ?.addEventListener('click', resetInteractionSession, { capture: true });\n  root.querySelector<HTMLInputElement>('[data-ve-analyzer=\"load-delay-file\"]')\n    ?.addEventListener('change', resetInteractionSession, { capture: true });\n"),
("      if (changed) {\n        surface.resetHistory();\n        queueMicrotask(bind);\n      }\n",
 "      if (changed) {\n        surface.resetHistory();\n        queueMicrotask(bind);\n      }\n"),
])

patch('apps/web/src/pages/ve-table-tool-options-dom.ts', [
("    host.append(element);\n    const rect = host.getBoundingClientRect();\n    element.style.left = `${Math.max(0, Math.min(event.clientX - rect.left, rect.width - 300))}px`;\n    element.style.top = `${host.offsetHeight + 4}px`;\n    popover = element;\n",
 "    element.style.visibility = 'hidden';\n    host.append(element);\n    const hostRect = host.getBoundingClientRect();\n    const anchor = event.currentTarget instanceof HTMLElement ? event.currentTarget.getBoundingClientRect() : hostRect;\n    const popupWidth = element.offsetWidth;\n    const popupHeight = element.offsetHeight;\n    const gap = 4;\n    const pad = 8;\n    const roomBelow = window.innerHeight - anchor.bottom;\n    const roomAbove = anchor.top;\n    const direction = roomBelow < popupHeight + gap && roomAbove > roomBelow ? 'up' : 'down';\n    const viewportLeft = Math.max(pad, Math.min(event.clientX, window.innerWidth - popupWidth - pad));\n    element.style.left = `${viewportLeft - hostRect.left}px`;\n    element.style.top = direction === 'up'\n      ? `${anchor.top - hostRect.top - popupHeight - gap}px`\n      : `${anchor.bottom - hostRect.top + gap}px`;\n    element.dataset.direction = direction;\n    element.style.visibility = '';\n    popover = element;\n"),
("      `${both ? '2D interpolation' : 'Interpolation'} · ${owner.label}`,\n",
 "      `${both ? 'Both-directions interpolation' : 'Interpolation'} · ${owner.label}`,\n"),
])

p = Path('apps/web/src/styles/ve-table-interaction-dom.css')
s = p.read_text()
marker = '/* Frozen v50 table tool visual vocabulary. */'
if marker not in s:
    s += '''\n\n/* Frozen v50 table tool visual vocabulary. */\n.ve-table-edit-toolbar > button {\n  width: 29px;\n  height: 29px;\n  min-height: 29px;\n  padding: 0;\n  display: inline-grid;\n  place-items: center;\n}\n.ve-table-edit-toolbar > button svg {\n  width: 16px;\n  height: 16px;\n  fill: none;\n  stroke: currentColor;\n  stroke-width: 1.7;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  pointer-events: none;\n}\n\n.ve-workbench-table td[data-table-value-state='lower'],\n.ve-delay-table td[data-table-value-state='lower'] { color: #73bfff !important; }\n.ve-workbench-table td[data-table-value-state='higher'],\n.ve-delay-table td[data-table-value-state='higher'] { color: #ff7d83 !important; }\n\n.ve-workbench-table td[data-table-brush-preview='true'],\n.ve-delay-table td[data-table-brush-preview='true'] {\n  outline: 2px solid rgba(126, 214, 244, .92);\n  outline-offset: -2px;\n  box-shadow: inset 0 0 0 1px rgba(126, 214, 244, .3);\n  z-index: 2;\n}\n'''
p.write_text(s)
