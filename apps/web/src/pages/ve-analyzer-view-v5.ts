import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import {
  createVeAnalyzerView as createVeAnalyzerViewV4,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v4';

type CellKey = `${number}:${number}`;
type EditAction = 'apply' | 'clear' | 'revert';

function keyFor(row: number, col: number): CellKey {
  return `${row}:${col}`;
}

function parseKey(key: CellKey): { row: number; col: number } {
  const [row, col] = key.split(':').map(Number);
  return { row: row!, col: col! };
}

function cellCoordinates(cell: HTMLTableCellElement): { row: number; col: number } | undefined {
  const row = Number(cell.dataset.delayRow);
  const col = Number(cell.dataset.delayCol);
  return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : undefined;
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV4();
  const root = inner.element;
  root.classList.add('ve-inline-delay-editing');

  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]')!;
  const legacyBulk = root.querySelector<HTMLElement>('.ve-delay-bulk-editor');
  legacyBulk?.remove();

  const legacyEditor = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-editor"]')!;
  const legacyWorking = root.querySelector<HTMLInputElement>('[data-ve-analyzer="delay-cell-working"]')!;
  const legacyApply = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="delay-cell-apply"]')!;
  const legacyRevert = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="delay-cell-revert"]')!;

  const hint = document.createElement('div');
  hint.className = 've-delay-inline-hint';
  hint.textContent = 'Select a cell and type to replace its value. Drag to select a range. Delete clears to no working delay. Enter/F2 edits the current value · Esc cancels.';
  delayHost.insertAdjacentElement('beforebegin', hint);

  const selected = new Set<CellKey>();
  let anchor: CellKey | undefined;
  let dragPointerId: number | undefined;
  let dragMoved = false;
  let inlineInput: HTMLInputElement | undefined;
  let previewOriginal = new Map<CellKey, string>();
  let committing = false;

  const cells = (): HTMLTableCellElement[] => [...delayHost.querySelectorAll<HTMLTableCellElement>('td[data-delay-row][data-delay-col]')];

  const cellFor = (key: CellKey): HTMLTableCellElement | undefined => {
    const { row, col } = parseKey(key);
    return delayHost.querySelector<HTMLTableCellElement>(`td[data-delay-row="${row}"][data-delay-col="${col}"]`) ?? undefined;
  };

  const focusAnchor = (): void => {
    if (!anchor || inlineInput) return;
    cellFor(anchor)?.focus({ preventScroll: true });
  };

  const refreshSelection = (): void => {
    const visible = new Set<CellKey>();
    for (const cell of cells()) {
      const pos = cellCoordinates(cell);
      if (!pos) continue;
      const key = keyFor(pos.row, pos.col);
      visible.add(key);
      cell.dataset.delaySelected = selected.has(key) ? 'true' : 'false';
      cell.dataset.delayAnchor = anchor === key ? 'true' : 'false';
      cell.tabIndex = 0;
      cell.setAttribute('aria-selected', selected.has(key) ? 'true' : 'false');
    }
    for (const key of [...selected]) if (!visible.has(key)) selected.delete(key);
    if (anchor && !visible.has(anchor)) anchor = undefined;
  };

  const selectRectangle = (from: CellKey, to: CellKey): void => {
    const a = parseKey(from);
    const b = parseKey(to);
    selected.clear();
    const rowMin = Math.min(a.row, b.row);
    const rowMax = Math.max(a.row, b.row);
    const colMin = Math.min(a.col, b.col);
    const colMax = Math.max(a.col, b.col);
    for (let row = rowMin; row <= rowMax; row += 1) {
      for (let col = colMin; col <= colMax; col += 1) selected.add(keyFor(row, col));
    }
    refreshSelection();
  };

  const selectSingle = (cell: HTMLTableCellElement): void => {
    const pos = cellCoordinates(cell);
    if (!pos) return;
    const key = keyFor(pos.row, pos.col);
    selected.clear();
    selected.add(key);
    anchor = key;
    refreshSelection();
    cell.focus({ preventScroll: true });
  };

  // v2 still owns the actual delay-table state. Call its installed callbacks
  // directly instead of synthesizing browser clicks. This keeps visible table
  // focus/selection under v5 control and avoids click -> rerender -> click races.
  const invokeUnderlyingEditor = (key: CellKey, action: EditAction, value?: number): void => {
    const cell = cellFor(key);
    if (!cell) return;
    cell.onclick?.call(cell, new MouseEvent('click'));
    if (action === 'apply') {
      if (value === undefined) return;
      legacyWorking.value = String(value);
      legacyApply.onclick?.call(legacyApply, new MouseEvent('click'));
    } else if (action === 'clear') {
      legacyWorking.value = '';
      legacyApply.onclick?.call(legacyApply, new MouseEvent('click'));
    } else {
      legacyRevert.onclick?.call(legacyRevert, new MouseEvent('click'));
    }
  };

  const restorePreview = (): void => {
    for (const [key, text] of previewOriginal) {
      const cell = cellFor(key);
      if (cell) {
        cell.textContent = text;
        delete cell.dataset.delayPreview;
      }
    }
    previewOriginal.clear();
  };

  const previewValue = (text: string): void => {
    for (const key of selected) {
      const cell = cellFor(key);
      if (!cell) continue;
      if (!previewOriginal.has(key)) previewOriginal.set(key, cell.textContent ?? '');
      if (anchor === key && inlineInput) continue;
      cell.textContent = text || '—';
      cell.dataset.delayPreview = 'true';
    }
  };

  const editSelection = (action: EditAction, value?: number): boolean => {
    if (selected.size === 0 || committing) return false;
    const keys = [...selected];
    committing = true;
    try {
      for (const key of keys) invokeUnderlyingEditor(key, action, value);
    } finally {
      committing = false;
      refreshSelection();
      queueMicrotask(focusAnchor);
    }
    return true;
  };

  const applyEditToSelection = (text: string): boolean => {
    if (text === '') return editSelection('clear');
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) return false;
    return editSelection('apply', value);
  };

  const endInlineEdit = (commit: boolean): void => {
    const input = inlineInput;
    if (!input) return;
    const text = input.value.trim();
    inlineInput = undefined;
    restorePreview();
    if (commit) applyEditToSelection(text);
    refreshSelection();
    queueMicrotask(focusAnchor);
  };

  const startInlineEdit = (initialText?: string, mode: 'replace' | 'existing' = 'existing'): void => {
    if (!anchor || selected.size === 0 || inlineInput || committing) return;
    const activeCell = cellFor(anchor);
    if (!activeCell) return;
    const current = activeCell.dataset.delayValue ?? '';
    previewOriginal = new Map([...selected].map((key) => [key, cellFor(key)?.textContent ?? '']));
    const input = document.createElement('input');
    input.className = 've-delay-inline-input';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = mode === 'replace' ? (initialText ?? '') : (initialText ?? current);
    activeCell.replaceChildren(input);
    activeCell.dataset.delayEditing = 'true';
    inlineInput = input;
    previewValue(input.value);
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener('input', () => previewValue(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        endInlineEdit(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        endInlineEdit(false);
      }
    });
    input.addEventListener('blur', () => {
      if (inlineInput === input) endInlineEdit(true);
    });
  };

  const clearSelection = (): void => {
    if (selected.size === 0) return;
    restorePreview();
    editSelection('clear');
  };

  const closestDelayCell = (target: EventTarget | null): HTMLTableCellElement | null =>
    target instanceof Element ? target.closest<HTMLTableCellElement>('td[data-delay-row][data-delay-col]') : null;

  root.addEventListener('pointerdown', (event) => {
    if (committing || inlineInput) return;
    const cell = closestDelayCell(event.target);
    if (!cell || !delayHost.contains(cell)) return;
    event.preventDefault();
    event.stopPropagation();
    selectSingle(cell);
    dragPointerId = event.pointerId;
    dragMoved = false;
    cell.setPointerCapture?.(event.pointerId);
  }, { capture: true });

  root.addEventListener('pointermove', (event) => {
    if (committing || dragPointerId !== event.pointerId || !anchor || inlineInput) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const cell = closestDelayCell(hit);
    if (!cell || !delayHost.contains(cell)) return;
    const pos = cellCoordinates(cell);
    if (!pos) return;
    const key = keyFor(pos.row, pos.col);
    if (key !== anchor) dragMoved = true;
    selectRectangle(anchor, key);
  }, { capture: true });

  root.addEventListener('pointerup', (event) => {
    if (committing || dragPointerId !== event.pointerId) return;
    const pointerType = event.pointerType;
    dragPointerId = undefined;
    event.preventDefault();
    event.stopPropagation();
    if (!dragMoved && pointerType === 'touch') startInlineEdit(undefined, 'existing');
    else queueMicrotask(focusAnchor);
  }, { capture: true });

  root.addEventListener('click', (event) => {
    if (committing) return;
    const cell = closestDelayCell(event.target);
    if (!cell || !delayHost.contains(cell)) return;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true });

  root.addEventListener('keydown', (event) => {
    if (committing || inlineInput || selected.size === 0) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    if (/^[0-9.]$/.test(event.key)) {
      event.preventDefault();
      startInlineEdit(event.key, 'replace');
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      clearSelection();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      const current = anchor ? (cellFor(anchor)?.dataset.delayValue ?? '') : '';
      startInlineEdit(current.slice(0, -1), 'replace');
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      startInlineEdit(undefined, 'existing');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      selected.clear();
      anchor = undefined;
      refreshSelection();
    }
  }, { capture: true });

  const observer = new MutationObserver(() => {
    if (!inlineInput && !committing) {
      refreshSelection();
      queueMicrotask(focusAnchor);
    }
  });
  observer.observe(delayHost, { childList: true, subtree: true });

  legacyEditor.setAttribute('aria-hidden', 'true');
  refreshSelection();

  return {
    element: root,
    setContext(context: LoggerAnalysisContext) {
      inner.setContext(context);
      selected.clear();
      anchor = undefined;
      queueMicrotask(refreshSelection);
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      inner.setTuneModel(model, sourceName);
      selected.clear();
      anchor = undefined;
      queueMicrotask(refreshSelection);
    },
    refresh() {
      inner.refresh();
      queueMicrotask(() => {
        refreshSelection();
        focusAnchor();
      });
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v4';
