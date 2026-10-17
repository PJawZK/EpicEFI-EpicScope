import type { LoggerAnalysisContext } from './logger-page';
import type { TuneModel } from '../../../../core/tune/tune-model';
import {
  veProposalEditOwner,
  type VeProposalCellValueEdit,
  type VeProposalEditOwner,
} from './ve-analyzer-proposal-edit-owner';
import { createTableInteractionDomController } from './ve-table-interaction-dom';
import {
  TableInteractionSession,
  type TableBrushOptions,
  type TableEditSurface,
  type TableEditTransaction,
  type TableCellPosition,
  type TableInterpolationOptions,
} from './ve-table-interaction';
import { VE_TABLE_TOOL_ICONS } from './ve-table-icons';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import '../styles/ve-table-interaction-dom.css';

const HISTORY_LIMIT = 100;

interface HistoryEntry {
  readonly before: readonly VeProposalCellValueEdit[];
  readonly after: readonly VeProposalCellValueEdit[];
}

function sameValue(left: number | undefined, right: number | undefined): boolean {
  return left === right || (left !== undefined && right !== undefined && Number.isNaN(left) && Number.isNaN(right));
}

function snapshotValue(owner: VeProposalEditOwner, row: number, col: number): number | undefined {
  const snapshot = owner.snapshot();
  if (!snapshot || row < 0 || row >= snapshot.rows || col < 0 || col >= snapshot.cols) return undefined;
  return snapshot.values[row * snapshot.cols + col];
}

class VeProposalTableEditSurface implements TableEditSurface {
  readonly #owner: VeProposalEditOwner;
  readonly #undo: HistoryEntry[] = [];
  readonly #redo: HistoryEntry[] = [];

  constructor(owner: VeProposalEditOwner) {
    this.#owner = owner;
  }

  get rows(): number { return this.#owner.snapshot()?.rows ?? 0; }
  get cols(): number { return this.#owner.snapshot()?.cols ?? 0; }
  rowCoordinate(row: number): number { return this.#owner.snapshot()?.loadBins[row] ?? row; }
  colCoordinate(col: number): number { return this.#owner.snapshot()?.rpmBins[col] ?? col; }

  get(row: number, col: number): number {
    const value = snapshotValue(this.#owner, row, col);
    return value === undefined ? Number.NaN : value;
  }

  valueAt(position: TableCellPosition): number | undefined {
    return snapshotValue(this.#owner, position.row, position.col);
  }

  baselineValueAt(position: TableCellPosition): number | undefined {
    const snapshot = this.#owner.snapshot();
    if (!snapshot || position.row < 0 || position.row >= snapshot.rows || position.col < 0 || position.col >= snapshot.cols) return undefined;
    return snapshot.baselineValues[position.row * snapshot.cols + position.col];
  }

  beginTransaction(_label: string): TableEditTransaction {
    const snapshot = this.#owner.snapshot();
    const authorityGeneration = snapshot?.authorityGeneration;
    const rows = snapshot?.rows ?? 0;
    const cols = snapshot?.cols ?? 0;
    const values = snapshot ? [...snapshot.values] : [];
    const changed = new Map<number, number>();
    let active = true;
    const indexFor = (row: number, col: number): number => row * cols + col;
    const inside = (row: number, col: number): boolean => row >= 0 && row < rows && col >= 0 && col < cols;

    return {
      get: (row, col): number => {
        if (!active || !inside(row, col)) return Number.NaN;
        const index = indexFor(row, col);
        const pending = changed.get(index);
        if (pending !== undefined) return pending;
        const value = values[index];
        return value === undefined ? Number.NaN : value;
      },
      set: (row, col, value): void => {
        if (!active || !inside(row, col) || !Number.isFinite(value)) return;
        changed.set(indexFor(row, col), Math.max(0, value));
      },
      commit: (): boolean => {
        if (!active) return false;
        active = false;
        const current = this.#owner.snapshot();
        if (!snapshot || authorityGeneration === undefined || !current || current.authorityGeneration !== authorityGeneration || changed.size === 0) return false;
        const before: VeProposalCellValueEdit[] = [];
        const after: VeProposalCellValueEdit[] = [];
        for (const [index, value] of changed) {
          const row = Math.floor(index / cols);
          const col = index % cols;
          const previous = values[index];
          if (sameValue(previous, value)) continue;
          before.push({ row, col, value: previous });
          after.push({ row, col, value });
        }
        if (after.length === 0 || !this.#owner.applyValues(after)) return false;
        this.#pushUndo({ before, after });
        this.#redo.length = 0;
        return true;
      },
      cancel: (): void => { active = false; },
    };
  }

  replaceWithUndefined(positions: readonly TableCellPosition[]): boolean {
    return this.#recordExplicit(positions, () => this.#owner.applyValues(positions.map(({ row, col }) => ({ row, col, value: undefined }))));
  }

  revert(positions: readonly TableCellPosition[]): boolean {
    return this.#recordExplicit(positions, () => this.#owner.revert(positions));
  }

  undo(): boolean {
    const entry = this.#undo.pop();
    if (!entry) return false;
    if (!this.#owner.applyValues(entry.before)) {
      this.#undo.push(entry);
      return false;
    }
    this.#redo.push(entry);
    if (this.#redo.length > HISTORY_LIMIT) this.#redo.shift();
    return true;
  }

  redo(): boolean {
    const entry = this.#redo.pop();
    if (!entry) return false;
    if (!this.#owner.applyValues(entry.after)) {
      this.#redo.push(entry);
      return false;
    }
    this.#pushUndo(entry);
    return true;
  }

  resetHistory(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
  }

  #pushUndo(entry: HistoryEntry): void {
    this.#undo.push(entry);
    if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
  }

  #recordExplicit(positions: readonly TableCellPosition[], action: () => boolean): boolean {
    const before = positions.map(({ row, col }) => ({ row, col, value: snapshotValue(this.#owner, row, col) }));
    if (!action()) return false;
    const after = positions.map(({ row, col }) => ({ row, col, value: snapshotValue(this.#owner, row, col) }));
    if (before.every((entry, index) => sameValue(entry.value, after[index]?.value))) return false;
    this.#pushUndo({ before, after });
    this.#redo.length = 0;
    return true;
  }
}

function currentProposalTable(host: HTMLElement): HTMLTableElement | undefined {
  const table = host.querySelector<HTMLTableElement>('table.ve-workbench-table');
  if (!table) return undefined;
  return !table.dataset.veResultView || table.dataset.veResultView === 'proposal' ? table : undefined;
}

function precisionStep(owner: VeProposalEditOwner): number {
  const digits = owner.snapshot()?.digits;
  return digits !== undefined && Number.isInteger(digits) && digits >= 0 && digits <= 8 ? 1 / 10 ** digits : 0.1;
}

/**
 * Shared v50 edit adapter for the VE Proposal review surface.
 *
 * The source TuneModel remains immutable. All edits are review/working proposal
 * values owned by v2 and flow through the same generic selection/edit engine as
 * Lambda Delay. Alternate Result Views remain read-only metrics.
 */
export function installVeAnalyzerProposalTableInteraction(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  const owner = veProposalEditOwner(root);
  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  if (!owner || !veHost) return inner;

  const surface = new VeProposalTableEditSurface(owner);
  const session = new TableInteractionSession(surface);
  let step: number | undefined;
  let smoothStrength = 0.5;
  let interpolation: TableInterpolationOptions = { axis: 'both', method1d: 'linear', method2d: 'bilinear', strength: 1, clamp: true };
  let brush: TableBrushOptions = { delta: precisionStep(owner), radius: 2, strength: 0.7, falloff: 'soft' };
  const currentStep = (): number => step ?? precisionStep(owner);
  const resetTool = (kind: 'step' | 'smooth' | 'interpolation' | 'brush'): void => {
    if (kind === 'step') step = undefined;
    else if (kind === 'smooth') smoothStrength = 0.5;
    else if (kind === 'interpolation') interpolation = { axis: 'both', method1d: 'linear', method2d: 'bilinear', strength: 1, clamp: true };
    else brush = { delta: precisionStep(owner), radius: 2, strength: 0.7, falloff: 'soft' };
  };

  const dom = createTableInteractionDomController(session, {
    adjustmentStep: currentStep,
    smoothStrength: () => smoothStrength,
    interpolation: () => interpolation,
    brush: () => brush,
    readValue: (position) => surface.valueAt(position),
    baselineValue: (position) => surface.baselineValueAt(position),
    adjustBrushRadius: (delta) => { brush = { ...brush, radius: Math.max(1, Math.min(8, brush.radius + delta)) }; },
    configuration: {
      label: 'VE Proposal',
      adjustmentStep: currentStep,
      setAdjustmentStep: (value) => { step = value; },
      smoothStrength: () => smoothStrength,
      setSmoothStrength: (value) => { smoothStrength = value; },
      interpolation: () => interpolation,
      setInterpolation: (value) => { interpolation = { ...value, axis: 'both' }; },
      brush: () => brush,
      setBrush: (value) => { brush = value; },
      reset: resetTool,
    },
  }, {
    undo: () => surface.undo(),
    redo: () => surface.redo(),
    revertSelection: (positions) => surface.revert(positions),
    clearSelection: (positions) => surface.replaceWithUndefined(positions),
    blankSelection: (positions) => surface.replaceWithUndefined(positions),
    deleteSelection: (positions) => surface.replaceWithUndefined(positions),
    afterEdit: () => queueMicrotask(bind),
  });

  dom.toolbar.classList.add('ve-proposal-shared-toolbar');
  let evidencePosition: TableCellPosition | undefined;
  const rememberEvidencePosition = (event: PointerEvent): void => {
    const cell = event.target instanceof Element
      ? event.target.closest<HTMLTableCellElement>('td[data-ve-row][data-ve-col]')
      : null;
    if (!cell || !veHost.contains(cell)) return;
    const row = Number(cell.dataset.veRow);
    const col = Number(cell.dataset.veCol);
    if (Number.isInteger(row) && Number.isInteger(col)) evidencePosition = { row, col };
  };
  // Evidence selection is semantic and independent from editability. Alternate
  // Result Views remain read-only, but clicking a VE node still selects the node
  // that the explicit Cell Evidence action will inspect.
  veHost.addEventListener('pointerdown', rememberEvidencePosition, { capture: true });

  const evidence = document.createElement('button');
  evidence.type = 'button';
  evidence.innerHTML = VE_TABLE_TOOL_ICONS.cell;
  evidence.title = 'Cell Evidence';
  evidence.setAttribute('aria-label', 'Cell Evidence');
  evidence.addEventListener('click', () => {
    const position = evidencePosition ?? session.selectedPositions()[0];
    if (!position) return;
    const cell = veHost.querySelector<HTMLTableCellElement>(`td[data-ve-row="${position.row}"][data-ve-col="${position.col}"]`)
      ?? veHost.querySelector<HTMLTableCellElement>(`td[data-table-row="${position.row}"][data-table-col="${position.col}"]`);
    if (!cell) return;
    root.dispatchEvent(new CustomEvent('ve-cell-evidence-open', { bubbles: false, detail: { cell } }));
  });
  dom.toolbar.append(evidence);

  // v7 owns .ve-table-header-controls and intentionally replaceChildren()s it
  // whenever layout/table selectors are resynchronised. The edit toolbar is a
  // separate owner and must therefore be a stable sibling in the panel header,
  // not a child of v7's replaceable control host.
  const panelHeader = veHost.closest<HTMLElement>('.ve-workbench-panel')?.querySelector<HTMLElement>('header')
    ?? root.querySelector<HTMLElement>('.ve-workbench-panel header');
  panelHeader?.append(dom.toolbar);

  const bind = (): void => {
    const renderedTable = veHost.querySelector<HTMLTableElement>('table.ve-workbench-table') ?? undefined;
    const table = currentProposalTable(veHost);
    dom.bindTable(table);
    // Keep the explicit Evidence action available for alternate read-only result
    // views while hiding edit commands that would mutate proposal review values.
    for (const button of [...dom.toolbar.querySelectorAll<HTMLButtonElement>('button')]) {
      if (button !== evidence) button.hidden = !table;
    }
    evidence.hidden = !renderedTable;
    dom.toolbar.hidden = !renderedTable;
  };
  const observer = new MutationObserver(bind);
  const observe = (): void => observer.observe(veHost, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ve-result-view'] });
  root.addEventListener('ve-proposal-table-rendered', bind);
  observe();
  bind();

  const resetInteraction = (): void => {
    dom.cancelActiveInteraction();
    dom.setBrushActive(false);
    session.clearSelection();
    session.clearPins();
    surface.resetHistory();
    evidencePosition = undefined;
  };

  return {
    element: root,
    setActive(active) {
      if (!active) {
        dom.cancelActiveInteraction();
        dom.setBrushActive(false);
        observer.disconnect();
      }
      inner.setActive(active);
      if (active) {
        observe();
        queueMicrotask(bind);
      }
    },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      if (changed) {
        resetInteraction();
        queueMicrotask(bind);
      }
      return changed;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const changed = inner.setTuneModel(model, sourceName);
      if (changed) {
        resetInteraction();
        queueMicrotask(bind);
      }
      return changed;
    },
    refresh() {
      inner.refresh();
      queueMicrotask(bind);
    },
  };
}
