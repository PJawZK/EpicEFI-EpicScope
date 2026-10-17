from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# 1) Stop rebuilding the complete Lambda Delay value vector for every per-cell read.
v2_path = Path('apps/web/src/pages/ve-analyzer-view-v2.ts')
v2 = v2_path.read_text()
old_delay_owner = """  registerVeDelayEditOwner(root, {\n    snapshot: () => {\n      const table = workingDelayTable ?? delayRecommendation;\n      return table ? {\n        revision: sessionRevision,\n        authorityGeneration: delaySurfaceGeneration,\n        rows: table.rows,\n        cols: table.cols,\n        rpmBins: table.rpmBins,\n        loadBins: table.loadBins,\n        values: table.cells.map((cell) => cell.workingMs),\n      } : undefined;\n    },\n    applyValues: applyDelayCellValues,\n    revert: (positions) => editDelayCells(positions, { kind: 'revert' }),\n  });\n"""
new_delay_owner = """  let delayEditSnapshotCache: {\n    table: VeDelayTable;\n    revision: number;\n    authorityGeneration: number;\n    values: readonly (number | undefined)[];\n  } | undefined;\n\n  registerVeDelayEditOwner(root, {\n    snapshot: () => {\n      const table = workingDelayTable ?? delayRecommendation;\n      if (!table) {\n        delayEditSnapshotCache = undefined;\n        return undefined;\n      }\n      if (!delayEditSnapshotCache\n        || delayEditSnapshotCache.table !== table\n        || delayEditSnapshotCache.revision !== sessionRevision\n        || delayEditSnapshotCache.authorityGeneration !== delaySurfaceGeneration) {\n        delayEditSnapshotCache = {\n          table,\n          revision: sessionRevision,\n          authorityGeneration: delaySurfaceGeneration,\n          values: table.cells.map((cell) => cell.workingMs),\n        };\n      }\n      return {\n        revision: sessionRevision,\n        authorityGeneration: delaySurfaceGeneration,\n        rows: table.rows,\n        cols: table.cols,\n        rpmBins: table.rpmBins,\n        loadBins: table.loadBins,\n        values: delayEditSnapshotCache.values,\n      };\n    },\n    applyValues: applyDelayCellValues,\n    revert: (positions) => editDelayCells(positions, { kind: 'revert' }),\n  });\n"""
v2 = replace_once(v2, old_delay_owner, new_delay_owner, 'delay owner snapshot cache')
v2_path.write_text(v2)

# 2) Split the shared DOM controller's pointer/selection refresh from expensive
# semantic value/baseline decoration. Cache table cells/coordinates for the life
# of a rendered table and avoid rewriting unchanged DOM attributes.
dom_path = Path('apps/web/src/pages/ve-table-interaction-dom.ts')
dom = dom_path.read_text()
dom = replace_once(
    dom,
    """  let gestureListenersInstalled = false;\n  let destroyed = false;\n""",
    """  let gestureListenersInstalled = false;\n  let destroyed = false;\n  let cachedCells: HTMLTableCellElement[] = [];\n  let cachedCellByKey = new Map<string, HTMLTableCellElement>();\n""",
    'DOM cache fields',
)
dom = replace_once(
    dom,
    """  const cellFor = (position: TableCellPosition): HTMLTableCellElement | undefined =>\n    table?.querySelector<HTMLTableCellElement>(`td[data-table-row=\"${position.row}\"][data-table-col=\"${position.col}\"]`) ?? undefined;\n""",
    """  const rebuildCellCache = (): void => {\n    cachedCells = [];\n    cachedCellByKey = new Map();\n    if (!table) return;\n    markCoordinates(table);\n    cachedCells = [...table.querySelectorAll<HTMLTableCellElement>('tbody td[data-table-row][data-table-col]')];\n    for (const cell of cachedCells) {\n      const position = positionForCell(cell);\n      if (position) cachedCellByKey.set(positionKey(position), cell);\n    }\n  };\n\n  const cellFor = (position: TableCellPosition): HTMLTableCellElement | undefined =>\n    cachedCellByKey.get(positionKey(position));\n""",
    'cell cache',
)
start = dom.index("  const refresh = (): void => {\n")
end = dom.index("\n  const stopBrushTimer = (): void => {", start)
new_refresh = r'''  const setDataset = (cell: HTMLTableCellElement, name: string, value: string): void => {
    if (cell.dataset[name] !== value) cell.dataset[name] = value;
  };

  const refreshInteraction = (): void => {
    if (!table || destroyed) return;
    const selectedPositionsNow = session.selectedPositions();
    const selected = new Set(selectedPositionsNow.map(positionKey));
    const pinned = new Set(session.pinnedPositions().map(positionKey));
    const brushPreview = new Set(
      brushActive && brushHover ? session.brushFootprint(brushHover, preferences.brush()).map(positionKey) : [],
    );
    const activeCell = document.activeElement instanceof HTMLTableCellElement && table.contains(document.activeElement)
      ? positionForCell(document.activeElement)
      : undefined;
    const focusPosition = anchor ?? selectedPositionsNow[0] ?? activeCell ?? (cachedCells[0] ? positionForCell(cachedCells[0]) : undefined);
    const focusKey = focusPosition ? positionKey(focusPosition) : undefined;
    const anchorKey = anchor ? positionKey(anchor) : undefined;

    for (const cell of cachedCells) {
      const position = positionForCell(cell);
      if (!position) continue;
      const cellKey = positionKey(position);
      const selectedValue = selected.has(cellKey) ? 'true' : 'false';
      const anchorValue = anchorKey === cellKey ? 'true' : 'false';
      setDataset(cell, 'tableSelected', selectedValue);
      setDataset(cell, 'tableAnchor', anchorValue);
      setDataset(cell, 'tablePinned', pinned.has(cellKey) ? 'true' : 'false');
      setDataset(cell, 'tableBrushPreview', brushPreview.has(cellKey) ? 'true' : 'false');
      if (cell.getAttribute('aria-selected') !== selectedValue) cell.setAttribute('aria-selected', selectedValue);
      const tabIndex = cellKey === focusKey ? 0 : -1;
      if (cell.tabIndex !== tabIndex) cell.tabIndex = tabIndex;
      if (cell.dataset.delayRow !== undefined) {
        setDataset(cell, 'delaySelected', selectedValue);
        setDataset(cell, 'delayAnchor', anchorValue);
      }
    }
    const brushState = brushActive ? 'true' : 'false';
    if (table.dataset.tableBrush !== brushState) table.dataset.tableBrush = brushState;
    if (brush.dataset.active !== brushState) brush.dataset.active = brushState;
    if (brush.getAttribute('aria-pressed') !== brushState) brush.setAttribute('aria-pressed', brushState);
  };

  const refreshValueStates = (): void => {
    if (!table || destroyed) return;
    for (const cell of cachedCells) {
      const position = positionForCell(cell);
      if (!position) continue;
      const currentValue = preferences.readValue?.(position);
      const baselineValue = preferences.baselineValue?.(position);
      if (currentValue !== undefined && baselineValue !== undefined && Number.isFinite(currentValue) && Number.isFinite(baselineValue)) {
        const epsilon = 1e-9 * Math.max(1, Math.abs(currentValue), Math.abs(baselineValue));
        const state = currentValue < baselineValue - epsilon ? 'lower' : currentValue > baselineValue + epsilon ? 'higher' : 'same';
        setDataset(cell, 'tableValueState', state);
      } else if (cell.dataset.tableValueState !== undefined) delete cell.dataset.tableValueState;
    }
  };

  const refreshToolbarTitles = (): void => {
    const step = preferences.adjustmentStep();
    const smoothStrength = preferences.smoothStrength();
    const interpolation = preferences.interpolation();
    const brushOptions = preferences.brush();
    decrement.title = `Decrease selected cells by ${step} · right-click to change step`;
    increment.title = `Increase selected cells by ${step} · right-click to change step`;
    smooth.title = `Smooth selected cells · intensity ${smoothStrength.toFixed(2)} · right-click to change`;
    const interpolationSuffix = `strength ${(interpolation.strength ?? 1).toFixed(2)}${interpolation.clamp === false ? '' : ' · clamped'} · right-click settings`;
    interpolateHorizontal.title = `Interpolate horizontally · ${interpolation.method1d ?? 'linear'} · ${interpolationSuffix}`;
    interpolateVertical.title = `Interpolate vertically · ${interpolation.method1d ?? 'linear'} · ${interpolationSuffix}`;
    interpolateBoth.title = `Interpolate both directions · ${interpolation.method2d ?? 'bilinear'} · ${interpolationSuffix}`;
    brush.title = `Continuous brush editing · ${brushOptions.delta >= 0 ? '+' : ''}${brushOptions.delta} · radius ${brushOptions.radius} · strength ${(brushOptions.strength ?? 1).toFixed(2)} · ${brushOptions.falloff ?? 'linear'} falloff · Shift reverses${preferences.adjustBrushRadius ? ' · wheel changes radius' : ''} · right-click settings`;
  };

  const refresh = (): void => {
    if (!table || destroyed) return;
    refreshInteraction();
    refreshValueStates();
    refreshToolbarTitles();
  };
'''
dom = dom[:start] + new_refresh + dom[end:]

# Selection/hover/brush hot paths only need interaction decoration.
replacements = [
    ("""  const pin = createToolButton(VE_TABLE_TOOL_ICONS.pin, 'Pin or unpin selected cells', () => {\n    session.togglePinsForSelection();\n    refresh();\n  });\n""", """  const pin = createToolButton(VE_TABLE_TOOL_ICONS.pin, 'Pin or unpin selected cells', () => {\n    session.togglePinsForSelection();\n    refreshInteraction();\n  });\n""", 'pin interaction refresh'),
    ("""    anchor = position;\n    refresh();\n    const input = document.createElement('input');\n""", """    anchor = position;\n    refreshInteraction();\n    const input = document.createElement('input');\n""", 'inline start refresh'),
    ("""      brushHover = position;\n      refresh();\n      startBrush(event, position);\n""", """      brushHover = position;\n      refreshInteraction();\n      startBrush(event, position);\n""", 'brush pointerdown refresh'),
    ("""    cell.setPointerCapture?.(event.pointerId);\n    refresh();\n  };\n\n  function pointerMove""", """    cell.setPointerCapture?.(event.pointerId);\n    refreshInteraction();\n  };\n\n  function pointerMove""", 'selection pointerdown refresh'),
    ("""      if (!brushLast || positionKey(brushLast) !== positionKey(position)) pulseBrush(position, true);\n      refresh();\n      return;\n""", """      if (!brushLast || positionKey(brushLast) !== positionKey(position)) pulseBrush(position, true);\n      refreshInteraction();\n      return;\n""", 'brush drag refresh'),
    ("""    session.setRectangle(dragStart, position, dragAdditive, dragStart);\n    anchor = dragStart;\n    refresh();\n  }\n""", """    session.setRectangle(dragStart, position, dragAdditive, dragStart);\n    anchor = dragStart;\n    refreshInteraction();\n  }\n""", 'rectangle drag refresh'),
    ("""      refresh();\n      nextCell.focus({ preventScroll: true });\n      return;\n""", """      refreshInteraction();\n      nextCell.focus({ preventScroll: true });\n      return;\n""", 'keyboard navigation refresh'),
    ("""      session.clearSelection();\n      anchor = undefined;\n      refresh();\n    }\n""", """      session.clearSelection();\n      anchor = undefined;\n      refreshInteraction();\n    }\n""", 'escape refresh'),
    ("""    brushHover = position;\n    refresh();\n  };\n\n  const brushHoverLeave""", """    brushHover = position;\n    refreshInteraction();\n  };\n\n  const brushHoverLeave""", 'brush hover refresh'),
    ("""    brushHover = undefined;\n    refresh();\n  };\n\n  const wheel""", """    brushHover = undefined;\n    refreshInteraction();\n  };\n\n  const wheel""", 'brush leave refresh'),
    ("""    preferences.adjustBrushRadius(event.deltaY < 0 ? 1 : -1);\n    refresh();\n  };\n""", """    preferences.adjustBrushRadius(event.deltaY < 0 ? 1 : -1);\n    refreshInteraction();\n    refreshToolbarTitles();\n  };\n""", 'brush wheel refresh'),
    ("""    if (active) {\n      finishInlineEdit?.(true);\n      session.clearSelection();\n      anchor = undefined;\n    }\n    refresh();\n  };\n""", """    if (active) {\n      finishInlineEdit?.(true);\n      session.clearSelection();\n      anchor = undefined;\n    }\n    refreshInteraction();\n  };\n""", 'brush mode refresh'),
]
for old, new, label in replacements:
    dom = replace_once(dom, old, new, label)

# Cache cells when a rendered table is bound; do not re-mark/re-query on every pointer event.
old_bind = """    table = next;\n    if (table) {\n      markCoordinates(table);\n      table.addEventListener('pointerdown', pointerDown);\n      table.addEventListener('pointermove', brushHoverMove);\n      table.addEventListener('pointerleave', brushHoverLeave);\n      table.addEventListener('keydown', keyDown);\n      table.addEventListener('wheel', wheel, { passive: false });\n    }\n    refresh();\n"""
new_bind = """    table = next;\n    rebuildCellCache();\n    if (table) {\n      table.addEventListener('pointerdown', pointerDown);\n      table.addEventListener('pointermove', brushHoverMove);\n      table.addEventListener('pointerleave', brushHoverLeave);\n      table.addEventListener('keydown', keyDown);\n      table.addEventListener('wheel', wheel, { passive: false });\n    }\n    refresh();\n"""
dom = replace_once(dom, old_bind, new_bind, 'bind cell cache')

# Tool preference changes do not need semantic value re-reads.
dom = replace_once(
    dom,
    """    }, preferences.configuration, () => refresh())\n""",
    """    }, preferences.configuration, () => { refreshInteraction(); refreshToolbarTitles(); })\n""",
    'tool configuration refresh',
)

dom_path.write_text(dom)

# Add a short architecture/performance checkpoint to the existing branch notes.
doc_path = Path('docs/VE_ANALYZER_V50_MANUAL_ACCEPTANCE.md')
doc = doc_path.read_text()
marker = "## Table interaction requirements\n"
addition = """## Interaction performance checkpoint\n\nAfter the functional interaction pass, the shared table controller was found to be doing semantic value/baseline work and whole-table DOM decoration on pointer/selection hot paths. The performance pass now caches rendered cell coordinates, separates lightweight selection/Brush decoration from full semantic value refresh, avoids rewriting unchanged DOM attributes, and caches the Lambda Delay semantic value vector for one table authority generation. This is intended to preserve the accepted behavior while removing avoidable per-pointer O(table) semantic work and repeated whole-table snapshot allocation.\n\nThe next manual pass should judge click/drag/Brush responsiveness before any further visual redesign.\n\n"""
if addition not in doc:
    if marker not in doc:
        raise SystemExit('manual acceptance marker missing')
    doc = doc.replace(marker, addition + marker, 1)
    doc_path.write_text(doc)
