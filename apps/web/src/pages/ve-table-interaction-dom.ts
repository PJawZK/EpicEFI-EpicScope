import {
  TableInteractionSession,
  type TableBrushOptions,
  type TableBrushStroke,
  type TableCellPosition,
  type TableInterpolationOptions,
} from './ve-table-interaction';

export interface TableInteractionDomCommands {
  readonly undo?: () => boolean;
  readonly redo?: () => boolean;
  readonly revertSelection?: (positions: readonly TableCellPosition[]) => boolean;
  readonly clearSelection?: (positions: readonly TableCellPosition[]) => boolean;
  readonly blankSelection?: (positions: readonly TableCellPosition[]) => boolean;
  readonly afterEdit?: () => void;
}

export interface TableInteractionDomPreferences {
  readonly adjustmentStep: () => number;
  readonly smoothStrength: () => number;
  readonly interpolation: () => TableInterpolationOptions;
  readonly brush: () => TableBrushOptions;
  readonly readValue?: (position: TableCellPosition) => number | undefined;
  readonly adjustBrushRadius?: (delta: 1 | -1) => void;
}

export interface TableInteractionDomController {
  readonly toolbar: HTMLElement;
  bindTable(table: HTMLTableElement | undefined): void;
  refresh(): void;
  setBrushActive(active: boolean): void;
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
      cell.dataset.tableRow = String(row);
      cell.dataset.tableCol = String(cellIndex - 1);
      cell.tabIndex = 0;
    }
  }
}

function createToolButton(label: string, title: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
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
  let brushDirection: 1 | -1 = 1;
  let brushTimer: number | undefined;
  let inlineInput: HTMLInputElement | undefined;
  let destroyed = false;

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

  const undo = createToolButton('↶', 'Undo', () => run(() => commands.undo?.() ?? false));
  const redo = createToolButton('↷', 'Redo', () => run(() => commands.redo?.() ?? false));
  const decrement = createToolButton('−', 'Decrease selected cells', () => {
    const step = preferences.adjustmentStep();
    run(() => session.adjust(-Math.abs(Number.isFinite(step) ? step : 0)));
  });
  const increment = createToolButton('+', 'Increase selected cells', () => {
    const step = preferences.adjustmentStep();
    run(() => session.adjust(Math.abs(Number.isFinite(step) ? step : 0)));
  });
  const smooth = createToolButton('Smooth', 'Smooth selected cells', () => run(() => session.smooth(preferences.smoothStrength())));
  const interpolate = createToolButton('Interpolate', 'Interpolate selected cells', () => run(() => session.interpolate(preferences.interpolation())));
  const pin = createToolButton('Pin', 'Pin or unpin selected cells', () => {
    session.togglePinsForSelection();
    refresh();
  });
  const brush = createToolButton('Brush', 'Continuous brush editing', () => {
    setBrushActive(!brushActive);
  });
  const revert = createToolButton('Revert', 'Revert selected cells', () => {
    const positions = selectedPositions();
    if (positions.length && commands.revertSelection?.(positions)) finishEdit();
  });
  const clear = createToolButton('Clear', 'Clear selected cells', () => {
    const positions = selectedPositions();
    if (positions.length && commands.clearSelection?.(positions)) finishEdit();
  });
  toolbar.append(undo, redo, decrement, increment, smooth, interpolate, pin, brush, revert, clear);

  const cellFor = (position: TableCellPosition): HTMLTableCellElement | undefined =>
    table?.querySelector<HTMLTableCellElement>(`td[data-table-row="${position.row}"][data-table-col="${position.col}"]`) ?? undefined;

  const focusAnchor = (): void => {
    if (inlineInput || !anchor) return;
    cellFor(anchor)?.focus({ preventScroll: true });
  };

  const refresh = (): void => {
    if (!table || destroyed) return;
    markCoordinates(table);
    const selected = new Set(session.selectedPositions().map(positionKey));
    const pinned = new Set(session.pinnedPositions().map(positionKey));
    for (const cell of table.querySelectorAll<HTMLTableCellElement>('tbody td[data-table-row][data-table-col]')) {
      const position = positionForCell(cell);
      if (!position) continue;
      const key = positionKey(position);
      const isSelected = selected.has(key);
      const isPinned = pinned.has(key);
      const isAnchor = Boolean(anchor && positionKey(anchor) === key);
      cell.dataset.tableSelected = isSelected ? 'true' : 'false';
      cell.dataset.tableAnchor = isAnchor ? 'true' : 'false';
      cell.dataset.tablePinned = isPinned ? 'true' : 'false';
      cell.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      // Preserve the accepted Lambda Delay browser contract while the old v5
      // input owner is retired behind this shared controller.
      if (cell.dataset.delayRow !== undefined) {
        cell.dataset.delaySelected = isSelected ? 'true' : 'false';
        cell.dataset.delayAnchor = isAnchor ? 'true' : 'false';
      }
    }
    table.dataset.tableBrush = brushActive ? 'true' : 'false';
    brush.dataset.active = brushActive ? 'true' : 'false';
    brush.setAttribute('aria-pressed', brushActive ? 'true' : 'false');
    const radius = preferences.brush().radius;
    brush.title = `Continuous brush editing · radius ${radius}${preferences.adjustBrushRadius ? ' · mouse wheel adjusts radius' : ''}`;
  };

  const stopBrushTimer = (): void => {
    if (brushTimer !== undefined) window.clearInterval(brushTimer);
    brushTimer = undefined;
  };

  const finishBrush = (commit: boolean): void => {
    stopBrushTimer();
    const stroke = brushStroke;
    brushStroke = undefined;
    brushPointerId = undefined;
    brushLast = undefined;
    if (!stroke) return;
    if (commit) {
      if (stroke.commit()) finishEdit();
      else refresh();
    } else {
      stroke.cancel();
      refresh();
    }
  };

  const pulseBrush = (position: TableCellPosition, immediate = false): void => {
    if (!brushStroke) return;
    brushLast = position;
    if (immediate) brushStroke.pulse(position, brushDirection);
  };

  const startBrush = (event: PointerEvent, position: TableCellPosition): void => {
    finishBrush(false);
    const options = preferences.brush();
    brushStroke = session.beginBrushStroke(options);
    brushPointerId = event.pointerId;
    brushDirection = event.shiftKey ? -1 : 1;
    pulseBrush(position, true);
    brushTimer = window.setInterval(() => {
      if (!brushStroke || !brushLast) return;
      brushStroke.pulse(brushLast, brushDirection);
    }, 90);
  };

  const startInlineEdit = (position: TableCellPosition, initial?: string): void => {
    if (inlineInput) return;
    const cell = cellFor(position);
    if (!cell) return;
    if (!session.isSelected(position)) session.selectCell(position);
    anchor = position;
    const input = document.createElement('input');
    input.className = cell.dataset.delayRow !== undefined ? 've-table-inline-input ve-delay-inline-input' : 've-table-inline-input';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
    const current = preferences.readValue?.(position);
    input.value = initial ?? (current !== undefined && Number.isFinite(current) ? String(current) : '');
    cell.dataset.tableEditing = 'true';
    if (cell.dataset.delayRow !== undefined) cell.dataset.delayEditing = 'true';
    cell.append(input);
    inlineInput = input;
    input.focus({ preventScroll: true });
    input.select();

    let completed = false;
    const finish = (commit: boolean): void => {
      if (completed) return;
      completed = true;
      const raw = input.value.trim();
      inlineInput = undefined;
      input.remove();
      delete cell.dataset.tableEditing;
      delete cell.dataset.delayEditing;
      if (commit) {
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
    if (!cell || !position || inlineInput) return;
    event.preventDefault();
    if (brushActive) {
      startBrush(event, position);
      cell.setPointerCapture?.(event.pointerId);
      return;
    }
    const additive = event.ctrlKey || event.metaKey;
    if (event.shiftKey && anchor) session.selectCell(position, 'extend');
    else session.selectCell(position, additive ? 'toggle' : 'replace');
    if (!additive || !anchor) anchor = position;
    dragStart = anchor ?? position;
    dragAdditive = additive;
    dragMoved = false;
    dragPointerType = event.pointerType;
    dragPointerId = event.pointerId;
    cell.setPointerCapture?.(event.pointerId);
    refresh();
  };

  const pointerMove = (event: PointerEvent): void => {
    if (!table || inlineInput) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const cell = editableCell(hit, table);
    const position = cell ? positionForCell(cell) : undefined;
    if (!position) return;
    if (brushActive && brushPointerId === event.pointerId && brushStroke) {
      brushDirection = event.shiftKey ? -1 : 1;
      if (!brushLast || positionKey(brushLast) !== positionKey(position)) pulseBrush(position, true);
      return;
    }
    if (dragPointerId !== event.pointerId || !dragStart) return;
    if (positionKey(position) !== positionKey(dragStart)) dragMoved = true;
    session.setRectangle(dragStart, position, dragAdditive, dragStart);
    anchor = dragStart;
    refresh();
  };

  const pointerUp = (event: PointerEvent): void => {
    if (brushPointerId === event.pointerId) {
      event.preventDefault();
      finishBrush(true);
      return;
    }
    if (dragPointerId !== event.pointerId) return;
    const touchTap = !dragMoved && dragPointerType === 'touch' && anchor;
    dragPointerId = undefined;
    dragStart = undefined;
    dragAdditive = false;
    dragMoved = false;
    dragPointerType = '';
    if (touchTap) startInlineEdit(anchor!);
    else focusAnchor();
  };

  const keyDown = (event: KeyboardEvent): void => {
    if (!table || inlineInput) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    const cell = editableCell(event.target, table);
    if (!cell) return;
    const position = positionForCell(cell);
    if (!position) return;
    anchor = anchor ?? position;

    const movement: Readonly<Record<string, readonly [number, number]>> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const delta = movement[event.key];
    if (delta) {
      event.preventDefault();
      const next = { row: Math.max(0, position.row + delta[0]), col: Math.max(0, position.col + delta[1]) };
      const nextCell = cellFor(next);
      if (!nextCell) return;
      if (event.shiftKey && anchor) session.selectCell(next, 'extend');
      else {
        session.selectCell(next, 'replace');
        anchor = next;
      }
      refresh();
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
      if (positions.length && commands.clearSelection?.(positions)) finishEdit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (brushActive) setBrushActive(false);
      session.clearSelection();
      anchor = undefined;
      refresh();
    }
  };

  const wheel = (event: WheelEvent): void => {
    if (!brushActive || !table || !editableCell(event.target, table) || !preferences.adjustBrushRadius) return;
    event.preventDefault();
    preferences.adjustBrushRadius(event.deltaY < 0 ? 1 : -1);
    refresh();
  };

  const bindTable = (next: HTMLTableElement | undefined): void => {
    if (table === next) {
      refresh();
      return;
    }
    finishBrush(false);
    inlineInput?.blur();
    if (table) {
      table.removeEventListener('pointerdown', pointerDown);
      table.removeEventListener('keydown', keyDown);
      table.removeEventListener('wheel', wheel);
    }
    table = next;
    if (table) {
      markCoordinates(table);
      table.addEventListener('pointerdown', pointerDown);
      table.addEventListener('keydown', keyDown);
      table.addEventListener('wheel', wheel, { passive: false });
    }
    refresh();
  };

  document.addEventListener('pointermove', pointerMove, { capture: true });
  document.addEventListener('pointerup', pointerUp, { capture: true });
  document.addEventListener('pointercancel', pointerUp, { capture: true });

  const setBrushActive = (active: boolean): void => {
    if (brushActive === active) return;
    if (!active) finishBrush(false);
    brushActive = active;
    refresh();
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    finishBrush(false);
    document.removeEventListener('pointermove', pointerMove, { capture: true });
    document.removeEventListener('pointerup', pointerUp, { capture: true });
    document.removeEventListener('pointercancel', pointerUp, { capture: true });
    bindTable(undefined);
    toolbar.remove();
  };

  return { toolbar, bindTable, refresh, setBrushActive, destroy };
}
