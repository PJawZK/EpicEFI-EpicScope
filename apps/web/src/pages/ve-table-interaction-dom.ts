import {
  TableInteractionSession,
  type TableBrushOptions,
  type TableBrushStroke,
  type TableCellPosition,
  type TablePreviewValue,
  type TableInterpolationOptions,
} from './ve-table-interaction';
import { installTableToolConfiguration, type TableToolConfigurationOwner } from './ve-table-tool-options-dom';
import { VE_TABLE_TOOL_ICONS } from './ve-table-icons';

export interface TableInteractionDomCommands {
  readonly undo?: () => boolean;
  readonly redo?: () => boolean;
  readonly revertSelection?: (positions: readonly TableCellPosition[]) => boolean;
  readonly clearSelection?: (positions: readonly TableCellPosition[]) => boolean;
  readonly blankSelection?: (positions: readonly TableCellPosition[]) => boolean;
  readonly deleteSelection?: (positions: readonly TableCellPosition[]) => boolean;
  readonly afterEdit?: () => void;
}

export interface TableValueSnapshot {
  readonly revision: number;
  readonly authorityGeneration: number;
  readonly rows: number;
  readonly cols: number;
  readonly values: readonly (number | undefined)[];
  readonly baselineValues: readonly (number | undefined)[];
}

/** Detect owner structure changes without treating preview text as replacement. */
export function hasAddedOrRemovedElement(records: readonly MutationRecord[], selector: string): boolean {
  return records.some(record => record.type === 'childList'
    && [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element
      && (node.matches(selector) || node.querySelector(selector) !== null)));
}

function valueFromSnapshot(snapshot: TableValueSnapshot | undefined, position: TableCellPosition, baseline = false): number | undefined {
  if (!snapshot || position.row < 0 || position.row >= snapshot.rows || position.col < 0 || position.col >= snapshot.cols) return undefined;
  return (baseline ? snapshot.baselineValues : snapshot.values)[position.row * snapshot.cols + position.col];
}

export interface TableInteractionDomPreferences {
  readonly adjustmentStep: () => number;
  readonly smoothStrength: () => number;
  readonly interpolation: () => TableInterpolationOptions;
  readonly brush: () => TableBrushOptions;
  readonly readValue?: (position: TableCellPosition) => number | undefined;
  /** Borrow one semantic snapshot per refresh/preview pass, never one per cell. */
  readonly readValues?: () => TableValueSnapshot | undefined;
  readonly baselineValue?: (position: TableCellPosition) => number | undefined;
  /** Presentation-only formatter for transient Brush values. */
  readonly formatPreviewValue?: (position: TableCellPosition, value: number) => string;
  readonly adjustBrushRadius?: (delta: 1 | -1) => void;
  readonly configuration?: TableToolConfigurationOwner;
}

export interface TableInteractionDomController {
  readonly toolbar: HTMLElement;
  bindTable(table: HTMLTableElement | undefined): void;
  refresh(): void;
  setBrushActive(active: boolean): void;
  cancelActiveInteraction(): void;
  destroy(): void;
}

function positionKey(position: TableCellPosition): string {
  return `${position.row}:${position.col}`;
}

function positionForCell(cell: HTMLTableCellElement): TableCellPosition | undefined {
  const row = Number(cell.dataset.tableRow);
  const col = Number(cell.dataset.tableCol);
  return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : undefined;
}

function editableCell(target: EventTarget | null, table: HTMLTableElement | undefined): HTMLTableCellElement | undefined {
  if (!(target instanceof Element) || !table) return undefined;
  const cell = target.closest<HTMLTableCellElement>('td[data-table-row][data-table-col]');
  return cell && table.contains(cell) ? cell : undefined;
}

function markCoordinates(table: HTMLTableElement): void {
  const body = table.tBodies[0];
  if (!body) return;
  for (let row = 0; row < body.rows.length; row += 1) {
    const tr = body.rows[row]!;
    for (let cellIndex = 1; cellIndex < tr.cells.length; cellIndex += 1) {
      const cell = tr.cells[cellIndex] as HTMLTableCellElement;
      const semanticRow = Number(cell.dataset.veRow ?? cell.dataset.delayRow);
      const semanticCol = Number(cell.dataset.veCol ?? cell.dataset.delayCol);
      const existingRow = Number(cell.dataset.tableRow);
      const existingCol = Number(cell.dataset.tableCol);
      cell.dataset.tableRow = Number.isInteger(semanticRow) ? String(semanticRow)
        : Number.isInteger(existingRow) ? String(existingRow) : String(row);
      cell.dataset.tableCol = Number.isInteger(semanticCol) ? String(semanticCol)
        : Number.isInteger(existingCol) ? String(existingCol) : String(cellIndex - 1);
    }
  }
}

function createToolButton(content: string, title: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = content;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', action);
  return button;
}

/**
 * DOM/input shell for the shared table interaction engine.
 *
 * This controller never reads table text as tune/domain authority. The DOM is used
 * only for hit-testing, focus, selection decoration and direct-edit presentation.
 * Numeric mutations always flow through TableInteractionSession -> TableEditSurface.
 */
export function createTableInteractionDomController(
  session: TableInteractionSession,
  preferences: TableInteractionDomPreferences,
  commands: TableInteractionDomCommands = {},
): TableInteractionDomController {
  let table: HTMLTableElement | undefined;
  let anchor: TableCellPosition | undefined;
  let dragPointerId: number | undefined;
  let dragStart: TableCellPosition | undefined;
  let dragAdditive = false;
  let dragMoved = false;
  let dragPointerType = '';
  let brushActive = false;
  let brushStroke: TableBrushStroke | undefined;
  let brushPointerId: number | undefined;
  let brushLast: TableCellPosition | undefined;
  let brushHover: TableCellPosition | undefined;
  let brushDirection: 1 | -1 = 1;
  let brushTimer: number | undefined;
  let inlineInput: HTMLInputElement | undefined;
  let finishInlineEdit: ((commit: boolean) => void) | undefined;
  let inlinePreviewOriginal = new Map<HTMLTableCellElement, string>();
  let brushValuePreviewOriginal = new Map<HTMLTableCellElement, { readonly text: string; readonly heatLevel: string }>();
  let pendingBrushValuePreview = new Map<string, TablePreviewValue>();
  let brushPreviewFrame: number | undefined;
  let brushPreviewKeys = new Set<string>();
  let previewHeatMin: number | undefined;
  let previewHeatMax: number | undefined;
  let gestureListenersInstalled = false;
  let destroyed = false;
  let cachedCells: HTMLTableCellElement[] = [];
  let cachedCellByKey = new Map<string, HTMLTableCellElement>();

  const toolbar = document.createElement('div');
  toolbar.className = 've-table-edit-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Table editing');

  const finishEdit = (): void => {
    commands.afterEdit?.();
    refresh();
  };

  const selectedPositions = (): readonly TableCellPosition[] => session.selectedPositions();

  const run = (action: () => boolean): void => {
    if (action()) finishEdit();
  };

  const undo = createToolButton(VE_TABLE_TOOL_ICONS.undo, 'Undo', () => run(() => commands.undo?.() ?? false));
  const redo = createToolButton(VE_TABLE_TOOL_ICONS.redo, 'Redo', () => run(() => commands.redo?.() ?? false));
  const decrement = createToolButton(VE_TABLE_TOOL_ICONS.minus, 'Decrease selected cells', () => {
    const step = preferences.adjustmentStep();
    run(() => session.adjust(-Math.abs(Number.isFinite(step) ? step : 0)));
  });
  const increment = createToolButton(VE_TABLE_TOOL_ICONS.plus, 'Increase selected cells', () => {
    const step = preferences.adjustmentStep();
    run(() => session.adjust(Math.abs(Number.isFinite(step) ? step : 0)));
  });
  const smooth = createToolButton(VE_TABLE_TOOL_ICONS.smooth, 'Smooth selected cells · right-click settings', () => run(() => session.smooth(preferences.smoothStrength())));
  const interpolateWith = (axis: 'horizontal' | 'vertical' | 'both'): void => {
    const configured = preferences.interpolation();
    run(() => session.interpolate({ ...configured, axis }));
  };
  const interpolateHorizontal = createToolButton(VE_TABLE_TOOL_ICONS.interpolateHorizontal, 'Interpolate horizontally · right-click settings', () => interpolateWith('horizontal'));
  const interpolateVertical = createToolButton(VE_TABLE_TOOL_ICONS.interpolateVertical, 'Interpolate vertically · right-click settings', () => interpolateWith('vertical'));
  const interpolateBoth = createToolButton(VE_TABLE_TOOL_ICONS.interpolateBoth, 'Interpolate both directions · right-click settings', () => interpolateWith('both'));
  const pin = createToolButton(VE_TABLE_TOOL_ICONS.pin, 'Pin or unpin selected cells', () => {
    session.togglePinsForSelection();
    refreshInteraction();
  });
  const brush = createToolButton(VE_TABLE_TOOL_ICONS.brush, 'Continuous brush editing', () => setBrushActive(!brushActive));
  const revert = createToolButton(VE_TABLE_TOOL_ICONS.revert, 'Revert selected cells', () => {
    const positions = selectedPositions();
    if (positions.length && commands.revertSelection?.(positions)) finishEdit();
  });
  const clear = createToolButton(VE_TABLE_TOOL_ICONS.clear, 'Clear selected cells', () => {
    const positions = selectedPositions();
    if (positions.length && commands.clearSelection?.(positions)) finishEdit();
  });
  toolbar.append(undo, redo, decrement, increment, pin, brush, interpolateHorizontal, interpolateVertical, interpolateBoth, smooth, revert, clear);
  const closeToolConfiguration = preferences.configuration
    ? installTableToolConfiguration(toolbar, {
      decrement,
      increment,
      smooth,
      interpolateHorizontal,
      interpolateVertical,
      interpolateBoth,
      brush,
    }, preferences.configuration, () => { refreshInteraction(); refreshToolbarTitles(); })
    : () => {};

  const rebuildCellCache = (): void => {
    cachedCells = [];
    cachedCellByKey = new Map();
    brushPreviewKeys = new Set();
    if (!table) return;
    markCoordinates(table);
    cachedCells = [...table.querySelectorAll<HTMLTableCellElement>('tbody td[data-table-row][data-table-col]')];
    for (const cell of cachedCells) {
      const position = positionForCell(cell);
      if (position) cachedCellByKey.set(positionKey(position), cell);
    }
  };

  const cellFor = (position: TableCellPosition): HTMLTableCellElement | undefined =>
    cachedCellByKey.get(positionKey(position));

  const focusAnchor = (): void => {
    if (inlineInput || !anchor) return;
    cellFor(anchor)?.focus({ preventScroll: true });
  };

  const setDataset = (cell: HTMLTableCellElement, name: string, value: string): void => {
    if (cell.dataset[name] !== value) cell.dataset[name] = value;
  };

  const syncBrushPreview = (): void => {
    const next = new Set(
      brushActive && brushHover ? session.brushFootprint(brushHover, preferences.brush()).map(positionKey) : [],
    );
    for (const key of brushPreviewKeys) {
      if (next.has(key)) continue;
      const cell = cachedCellByKey.get(key);
      if (cell) setDataset(cell, 'tableBrushPreview', 'false');
    }
    for (const key of next) {
      if (brushPreviewKeys.has(key)) continue;
      const cell = cachedCellByKey.get(key);
      if (cell) setDataset(cell, 'tableBrushPreview', 'true');
    }
    brushPreviewKeys = next;
  };

  const refreshInteraction = (): void => {
    if (!table || destroyed) return;
    const selectedPositionsNow = session.selectedPositions();
    const selected = new Set(selectedPositionsNow.map(positionKey));
    const pinned = new Set(session.pinnedPositions().map(positionKey));
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
      if (cell.getAttribute('aria-selected') !== selectedValue) cell.setAttribute('aria-selected', selectedValue);
      const tabIndex = cellKey === focusKey ? 0 : -1;
      if (cell.tabIndex !== tabIndex) cell.tabIndex = tabIndex;
      if (cell.dataset.delayRow !== undefined) {
        setDataset(cell, 'delaySelected', selectedValue);
        setDataset(cell, 'delayAnchor', anchorValue);
      }
    }
    syncBrushPreview();
    const brushState = brushActive ? 'true' : 'false';
    if (table.dataset.tableBrush !== brushState) table.dataset.tableBrush = brushState;
    if (brush.dataset.active !== brushState) brush.dataset.active = brushState;
    if (brush.getAttribute('aria-pressed') !== brushState) brush.setAttribute('aria-pressed', brushState);
  };

  const refreshValueStates = (): void => {
    if (!table || destroyed) return;
    const snapshot = preferences.readValues?.();
    let heatMin: number | undefined;
    let heatMax: number | undefined;
    for (const cell of cachedCells) {
      const position = positionForCell(cell);
      if (!position) continue;
      const currentValue = preferences.readValues ? valueFromSnapshot(snapshot, position) : preferences.readValue?.(position);
      const baselineValue = preferences.readValues ? valueFromSnapshot(snapshot, position, true) : preferences.baselineValue?.(position);
      if (currentValue !== undefined && Number.isFinite(currentValue)) {
        heatMin = heatMin === undefined ? currentValue : Math.min(heatMin, currentValue);
        heatMax = heatMax === undefined ? currentValue : Math.max(heatMax, currentValue);
      }
      // A presentation refresh must not overwrite an uncommitted Brush marker.
      if (brushValuePreviewOriginal.has(cell)) continue;
      if (currentValue !== undefined && baselineValue !== undefined && Number.isFinite(currentValue) && Number.isFinite(baselineValue)) {
        const epsilon = 1e-9 * Math.max(1, Math.abs(currentValue), Math.abs(baselineValue));
        const state = currentValue < baselineValue - epsilon ? 'lower' : currentValue > baselineValue + epsilon ? 'higher' : 'same';
        setDataset(cell, 'tableValueState', state);
      } else if (cell.dataset.tableValueState !== undefined) delete cell.dataset.tableValueState;
    }
    previewHeatMin = heatMin;
    previewHeatMax = heatMax;
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

  const stopBrushTimer = (): void => {
    if (brushTimer !== undefined) window.clearInterval(brushTimer);
    brushTimer = undefined;
  };

  const valueNodeForCell = (cell: HTMLTableCellElement): HTMLElement =>
    cell.querySelector<HTMLElement>(':scope > span') ?? cell;

  const setPreviewValueState = (cell: HTMLTableCellElement, value: number, baseline: number | undefined): void => {
    if (baseline === undefined || !Number.isFinite(baseline)) return;
    const epsilon = 1e-9 * Math.max(1, Math.abs(value), Math.abs(baseline));
    setDataset(cell, 'tableValueState', value < baseline - epsilon ? 'lower' : value > baseline + epsilon ? 'higher' : 'same');
  };

  const setPreviewHeat = (cell: HTMLTableCellElement, value: number): void => {
    if (cell.dataset.veRow === undefined || previewHeatMin === undefined || previewHeatMax === undefined) return;
    const level = previewHeatMin === previewHeatMax
      ? 0.5
      : Math.max(0, Math.min(1, (value - previewHeatMin) / (previewHeatMax - previewHeatMin)));
    cell.style.setProperty('--ve-cell-level', String(level));
  };

  const flushBrushValuePreview = (): void => {
    if (brushPreviewFrame !== undefined) {
      window.cancelAnimationFrame(brushPreviewFrame);
      brushPreviewFrame = undefined;
    }
    if (!table || pendingBrushValuePreview.size === 0) return;
    const pending = pendingBrushValuePreview;
    pendingBrushValuePreview = new Map();
    const snapshot = preferences.readValues?.();
    for (const entry of pending.values()) {
      const cell = cellFor(entry.position);
      if (!cell) continue;
      const valueNode = valueNodeForCell(cell);
      if (!brushValuePreviewOriginal.has(cell)) {
        brushValuePreviewOriginal.set(cell, {
          text: valueNode.textContent ?? '',
          heatLevel: cell.style.getPropertyValue('--ve-cell-level'),
        });
      }
      valueNode.textContent = preferences.formatPreviewValue?.(entry.position, entry.value) ?? String(Math.round(entry.value * 1000) / 1000);
      setDataset(cell, 'tableLivePreview', 'true');
      if (cell.dataset.delayRow !== undefined) setDataset(cell, 'delayPreview', 'true');
      setPreviewValueState(cell, entry.value, preferences.readValues
        ? valueFromSnapshot(snapshot, entry.position, true) : preferences.baselineValue?.(entry.position));
      setPreviewHeat(cell, entry.value);
    }
  };

  const queueBrushValuePreview = (updates: readonly TablePreviewValue[]): void => {
    if (updates.length === 0) return;
    for (const update of updates) pendingBrushValuePreview.set(positionKey(update.position), update);
    if (brushPreviewFrame !== undefined) return;
    brushPreviewFrame = window.requestAnimationFrame(() => {
      brushPreviewFrame = undefined;
      flushBrushValuePreview();
    });
  };

  const clearBrushValuePreview = (restoreText: boolean): void => {
    if (brushPreviewFrame !== undefined) window.cancelAnimationFrame(brushPreviewFrame);
    brushPreviewFrame = undefined;
    pendingBrushValuePreview.clear();
    for (const [cell, original] of brushValuePreviewOriginal) {
      if (restoreText && cell.isConnected) {
        valueNodeForCell(cell).textContent = original.text;
        if (original.heatLevel) cell.style.setProperty('--ve-cell-level', original.heatLevel);
        else cell.style.removeProperty('--ve-cell-level');
      }
      delete cell.dataset.tableLivePreview;
      delete cell.dataset.delayPreview;
    }
    brushValuePreviewOriginal.clear();
    if (restoreText) refreshValueStates();
  };

  function gestureKeyDown(event: KeyboardEvent): void {
    if (brushPointerId !== undefined && event.key === 'Shift') brushDirection = -1;
  }

  function gestureKeyUp(event: KeyboardEvent): void {
    if (brushPointerId !== undefined && event.key === 'Shift') brushDirection = 1;
  }

  const maybeRemoveGestureListeners = (): void => {
    if (!gestureListenersInstalled || dragPointerId !== undefined || brushPointerId !== undefined) return;
    document.removeEventListener('pointermove', pointerMove, true);
    document.removeEventListener('pointerup', pointerUp, true);
    document.removeEventListener('pointercancel', pointerCancel, true);
    document.removeEventListener('keydown', gestureKeyDown, true);
    document.removeEventListener('keyup', gestureKeyUp, true);
    gestureListenersInstalled = false;
  };

  const ensureGestureListeners = (): void => {
    if (gestureListenersInstalled) return;
    document.addEventListener('pointermove', pointerMove, true);
    document.addEventListener('pointerup', pointerUp, true);
    document.addEventListener('pointercancel', pointerCancel, true);
    document.addEventListener('keydown', gestureKeyDown, true);
    document.addEventListener('keyup', gestureKeyUp, true);
    gestureListenersInstalled = true;
  };

  const finishBrush = (commit: boolean): void => {
    stopBrushTimer();
    const stroke = brushStroke;
    brushStroke = undefined;
    brushPointerId = undefined;
    brushLast = undefined;
    brushDirection = 1;
    if (stroke) {
      if (commit) {
        // Flush the final pending pulse before commit so pointer-up never hides the
        // last visual state. Semantic authority still changes exactly once below.
        flushBrushValuePreview();
        if (stroke.commit()) {
          clearBrushValuePreview(false);
          finishEdit();
        } else {
          clearBrushValuePreview(true);
          refresh();
        }
      } else {
        stroke.cancel();
        clearBrushValuePreview(true);
        refresh();
      }
    } else clearBrushValuePreview(true);
    maybeRemoveGestureListeners();
  };

  const pulseBrush = (position: TableCellPosition, immediate = false): void => {
    if (!brushStroke) return;
    brushLast = position;
    if (immediate) queueBrushValuePreview(brushStroke.pulse(position, brushDirection));
  };

  const startBrush = (event: PointerEvent, position: TableCellPosition): void => {
    finishBrush(false);
    brushStroke = session.beginBrushStroke(preferences.brush());
    brushPointerId = event.pointerId;
    brushDirection = event.shiftKey ? -1 : 1;
    ensureGestureListeners();
    pulseBrush(position, true);
    brushTimer = window.setInterval(() => {
      if (!brushStroke || !brushLast) return;
      queueBrushValuePreview(brushStroke.pulse(brushLast, brushDirection));
    }, 90);
  };

  const restoreInlinePreview = (): void => {
    for (const [previewCell, text] of inlinePreviewOriginal) {
      valueNodeForCell(previewCell).textContent = text;
      delete previewCell.dataset.tablePreview;
      delete previewCell.dataset.delayPreview;
    }
    inlinePreviewOriginal.clear();
  };

  const previewInlineValue = (activeCell: HTMLTableCellElement, text: string): void => {
    for (const position of selectedPositions()) {
      const previewCell = cellFor(position);
      if (!previewCell || previewCell === activeCell) continue;
      const valueNode = valueNodeForCell(previewCell);
      if (!inlinePreviewOriginal.has(previewCell)) inlinePreviewOriginal.set(previewCell, valueNode.textContent ?? '');
      valueNode.textContent = text || '—';
      previewCell.dataset.tablePreview = 'true';
      if (previewCell.dataset.delayRow !== undefined) previewCell.dataset.delayPreview = 'true';
    }
  };

  const startInlineEdit = (position: TableCellPosition, initial?: string): void => {
    if (inlineInput) return;
    const cell = cellFor(position);
    if (!cell) return;
    if (!session.isSelected(position)) session.selectCell(position);
    anchor = position;
    refreshInteraction();
    const input = document.createElement('input');
    input.className = cell.dataset.delayRow !== undefined ? 've-table-inline-input ve-delay-inline-input' : 've-table-inline-input';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
    const current = preferences.readValue?.(position);
    const editAuthority = preferences.readValues?.();
    input.value = initial ?? (current !== undefined && Number.isFinite(current) ? String(current) : '');
    cell.dataset.tableEditing = 'true';
    if (cell.dataset.delayRow !== undefined) cell.dataset.delayEditing = 'true';
    cell.append(input);
    inlineInput = input;
    inlinePreviewOriginal = new Map();
    previewInlineValue(cell, input.value);
    input.focus({ preventScroll: true });
    if (initial === undefined) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);

    let completed = false;
    const finish = (commit: boolean): void => {
      if (completed) return;
      completed = true;
      const raw = input.value.trim();
      if (inlineInput === input) inlineInput = undefined;
      if (finishInlineEdit === finish) finishInlineEdit = undefined;
      input.remove();
      delete cell.dataset.tableEditing;
      delete cell.dataset.delayEditing;
      restoreInlinePreview();
      const currentAuthority = preferences.readValues?.();
      // Replacement rendering can blur an editor before the adapter cancels it.
      // Never start a new transaction for a draft from an obsolete authority.
      const authorityUnchanged = !preferences.readValues || (editAuthority !== undefined && currentAuthority !== undefined
        && editAuthority.revision === currentAuthority.revision
        && editAuthority.authorityGeneration === currentAuthority.authorityGeneration);
      if (commit && authorityUnchanged) {
        if (raw === '') {
          const positions = selectedPositions();
          if (positions.length && commands.blankSelection?.(positions)) finishEdit();
          else refresh();
        } else {
          const value = Number(raw);
          if (Number.isFinite(value) && session.replaceSelection(value)) finishEdit();
          else refresh();
        }
      } else refresh();
      queueMicrotask(focusAnchor);
    };
    finishInlineEdit = finish;
    input.addEventListener('input', () => previewInlineValue(cell, input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
  };

  const pointerDown = (event: PointerEvent): void => {
    const cell = editableCell(event.target, table);
    const position = cell ? positionForCell(cell) : undefined;
    if (!cell || !position) return;
    event.preventDefault();
    if (inlineInput) {
      finishInlineEdit?.(true);
      queueMicrotask(() => {
        session.selectCell(position, 'replace');
        anchor = position;
        refresh();
        cellFor(position)?.focus({ preventScroll: true });
      });
      return;
    }
    if (brushActive) {
      session.clearSelection();
      anchor = undefined;
      brushHover = position;
      refreshInteraction();
      startBrush(event, position);
      cell.setPointerCapture?.(event.pointerId);
      return;
    }
    const additive = event.ctrlKey || event.metaKey;
    const extending = event.shiftKey && anchor !== undefined;
    if (extending) session.selectCell(position, 'extend');
    else session.selectCell(position, additive ? 'toggle' : 'replace');
    if (!extending) anchor = position;
    dragStart = extending ? anchor : position;
    dragAdditive = additive;
    dragMoved = false;
    dragPointerType = event.pointerType;
    dragPointerId = event.pointerId;
    ensureGestureListeners();
    cell.setPointerCapture?.(event.pointerId);
    refreshInteraction();
  };

  function pointerMove(event: PointerEvent): void {
    if (!table || inlineInput) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const cell = editableCell(hit, table);
    const position = cell ? positionForCell(cell) : undefined;
    if (!position) return;
    if (brushActive && brushPointerId === event.pointerId && brushStroke) {
      brushDirection = event.shiftKey ? -1 : 1;
      brushHover = position;
      if (!brushLast || positionKey(brushLast) !== positionKey(position)) pulseBrush(position, true);
      syncBrushPreview();
      return;
    }
    if (dragPointerId !== event.pointerId || !dragStart) return;
    if (positionKey(position) !== positionKey(dragStart)) dragMoved = true;
    session.setRectangle(dragStart, position, dragAdditive, dragStart);
    anchor = dragStart;
    refreshInteraction();
  }

  const finishDrag = (event: PointerEvent, cancelled: boolean): void => {
    if (dragPointerId !== event.pointerId) return;
    const touchTap = !cancelled && !dragMoved && dragPointerType === 'touch' && anchor;
    dragPointerId = undefined;
    dragStart = undefined;
    dragAdditive = false;
    dragMoved = false;
    dragPointerType = '';
    maybeRemoveGestureListeners();
    if (touchTap) startInlineEdit(anchor!);
    else focusAnchor();
  };

  function pointerUp(event: PointerEvent): void {
    if (brushPointerId === event.pointerId) {
      event.preventDefault();
      finishBrush(true);
      return;
    }
    finishDrag(event, false);
  }

  function pointerCancel(event: PointerEvent): void {
    if (brushPointerId === event.pointerId) finishBrush(false);
    finishDrag(event, true);
  }

  const keyDown = (event: KeyboardEvent): void => {
    if (!table || inlineInput) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    const cell = editableCell(event.target, table);
    if (!cell) return;
    const position = positionForCell(cell);
    if (!position) return;
    anchor = anchor ?? position;

    const visualNeighbor = (key: string): HTMLTableCellElement | undefined => {
      const rowElement = cell.parentElement as HTMLTableRowElement | null;
      const body = rowElement?.parentElement as HTMLTableSectionElement | null;
      if (!rowElement || !body) return undefined;
      const rows = [...body.rows];
      const visualRow = rows.indexOf(rowElement);
      const rowCells = [...rowElement.querySelectorAll<HTMLTableCellElement>('td[data-table-row][data-table-col]')];
      const visualCol = rowCells.indexOf(cell);
      if (visualRow < 0 || visualCol < 0) return undefined;
      if (key === 'ArrowLeft') return rowCells[visualCol - 1];
      if (key === 'ArrowRight') return rowCells[visualCol + 1];
      const targetRow = rows[visualRow + (key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0)];
      if (!targetRow || (key !== 'ArrowUp' && key !== 'ArrowDown')) return undefined;
      return [...targetRow.querySelectorAll<HTMLTableCellElement>('td[data-table-row][data-table-col]')][visualCol];
    };
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const nextCell = visualNeighbor(event.key);
      const next = nextCell ? positionForCell(nextCell) : undefined;
      if (!nextCell || !next) return;
      if (event.shiftKey && anchor) session.selectCell(next, 'extend');
      else {
        session.selectCell(next, 'replace');
        anchor = next;
      }
      refreshInteraction();
      nextCell.focus({ preventScroll: true });
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      startInlineEdit(position);
      return;
    }
    if (/^[0-9.+-]$/.test(event.key)) {
      event.preventDefault();
      startInlineEdit(position, event.key);
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      const current = preferences.readValue?.(position);
      const text = current !== undefined && Number.isFinite(current) ? String(current) : '';
      startInlineEdit(position, text.slice(0, -1));
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      const positions = selectedPositions();
      const action = commands.deleteSelection ?? commands.clearSelection;
      if (positions.length && action?.(positions)) finishEdit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (brushActive) setBrushActive(false);
      session.clearSelection();
      anchor = undefined;
      refreshInteraction();
    }
  };

  const brushHoverMove = (event: PointerEvent): void => {
    if (!brushActive || brushPointerId !== undefined) return;
    const cell = editableCell(event.target, table);
    const position = cell ? positionForCell(cell) : undefined;
    if (!position || (brushHover && positionKey(brushHover) === positionKey(position))) return;
    brushHover = position;
    syncBrushPreview();
  };

  const brushHoverLeave = (): void => {
    if (!brushActive || brushPointerId !== undefined || !brushHover) return;
    brushHover = undefined;
    syncBrushPreview();
  };

  const wheel = (event: WheelEvent): void => {
    if (!brushActive || !table || !editableCell(event.target, table) || !preferences.adjustBrushRadius) return;
    event.preventDefault();
    preferences.adjustBrushRadius(event.deltaY < 0 ? 1 : -1);
    syncBrushPreview();
    refreshToolbarTitles();
  };

  const cancelActiveInteraction = (): void => {
    closeToolConfiguration();
    finishInlineEdit?.(false);
    finishBrush(false);
    dragPointerId = undefined;
    dragStart = undefined;
    dragAdditive = false;
    dragMoved = false;
    dragPointerType = '';
    maybeRemoveGestureListeners();
  };

  const bindTable = (next: HTMLTableElement | undefined): void => {
    if (table === next) {
      refresh();
      return;
    }
    cancelActiveInteraction();
    if (table) {
      table.removeEventListener('pointerdown', pointerDown);
      table.removeEventListener('pointermove', brushHoverMove);
      table.removeEventListener('pointerleave', brushHoverLeave);
      table.removeEventListener('keydown', keyDown);
      table.removeEventListener('wheel', wheel);
    }
    table = next;
    rebuildCellCache();
    if (table) {
      table.addEventListener('pointerdown', pointerDown);
      table.addEventListener('pointermove', brushHoverMove);
      table.addEventListener('pointerleave', brushHoverLeave);
      table.addEventListener('keydown', keyDown);
      table.addEventListener('wheel', wheel, { passive: false });
    }
    refresh();
  };

  const setBrushActive = (active: boolean): void => {
    if (brushActive === active) return;
    if (!active) finishBrush(false);
    brushActive = active;
    brushHover = undefined;
    if (active) {
      finishInlineEdit?.(true);
      session.clearSelection();
      anchor = undefined;
    }
    refreshInteraction();
  };

  const destroy = (): void => {
    if (destroyed) return;
    cancelActiveInteraction();
    if (table) {
      table.removeEventListener('pointerdown', pointerDown);
      table.removeEventListener('pointermove', brushHoverMove);
      table.removeEventListener('pointerleave', brushHoverLeave);
      table.removeEventListener('keydown', keyDown);
      table.removeEventListener('wheel', wheel);
    }
    table = undefined;
    destroyed = true;
    toolbar.remove();
  };

  return { toolbar, bindTable, refresh, setBrushActive, cancelActiveInteraction, destroy };
}
