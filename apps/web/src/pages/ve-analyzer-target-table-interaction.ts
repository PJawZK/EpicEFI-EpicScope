import type { LoggerAnalysisContext } from './logger-page';
import type { TuneModel } from '../../../../core/tune/tune-model';
import {
  type VeProposalEditOwner,
  type VeProposalCellValueEdit,
} from './ve-analyzer-proposal-edit-owner';
import { veTargetEditOwner } from './ve-analyzer-target-edit-owner';
import { createTableInteractionDomController } from './ve-table-interaction-dom';
import {
  TableInteractionSession,
  type TableBrushOptions,
  type TableEditSurface,
  type TableEditTransaction,
  type TableCellPosition,
  type TableInterpolationOptions,
} from './ve-table-interaction';
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

class VeTargetTableEditSurface implements TableEditSurface {
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
  canUndo(): boolean { return this.#undo.length > 0; }
  canRedo(): boolean { return this.#redo.length > 0; }

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

function currentTargetTable(host: HTMLElement): HTMLTableElement | undefined {
  const table = host.querySelector<HTMLTableElement>('table.ve-workbench-table');
  if (!table) return undefined;
  return table;
}

function precisionStep(owner: VeProposalEditOwner): number {
  const digits = owner.snapshot()?.digits;
  return digits !== undefined && Number.isInteger(digits) && digits >= 0 && digits <= 8 ? 1 / 10 ** digits : 0.1;
}

function setHistoryAvailability(toolbar: HTMLElement, surface: VeTargetTableEditSurface): void {
  const undo = toolbar.querySelector<HTMLButtonElement>('button[aria-label="Undo"]');
  const redo = toolbar.querySelector<HTMLButtonElement>('button[aria-label="Redo"]');
  undo?.setAttribute('aria-disabled', surface.canUndo() ? 'false' : 'true');
  redo?.setAttribute('aria-disabled', surface.canRedo() ? 'false' : 'true');
  if (undo) undo.dataset.commandAvailable = surface.canUndo() ? 'true' : 'false';
  if (redo) redo.dataset.commandAvailable = surface.canRedo() ? 'true' : 'false';
}

/**
 * Shared v50 edit adapter for the Target Table review surface.
 *
 * The source TuneModel stays immutable. Target changes are session-local
 * working values owned by v2, consumed by the next analysis run.
 */
export function installVeAnalyzerTargetTableInteraction(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  const owner = veTargetEditOwner(root);
  const targetHost = root.querySelector<HTMLElement>('[data-ve-analyzer="target-table-view"]');
  if (!owner || !targetHost) return inner;

  const surface = new VeTargetTableEditSurface(owner);
  const session = new TableInteractionSession(surface);
  let step: number | undefined;
  let previewDigits = owner.snapshot()?.digits;
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
    formatPreviewValue: (_position, value) => previewDigits === undefined ? String(Math.round(value * 1000) / 1000) : value.toFixed(previewDigits),
    adjustBrushRadius: (delta) => { brush = { ...brush, radius: Math.max(1, Math.min(8, brush.radius + delta)) }; },
    configuration: {
      label: 'Target Table',
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
    clearSelection: (positions) => surface.revert(positions),
    blankSelection: (positions) => surface.revert(positions),
    deleteSelection: (positions) => surface.revert(positions),
    afterEdit: () => queueMicrotask(bind),
  });

  dom.toolbar.classList.add('ve-target-shared-toolbar');
  const panelHeader = targetHost.closest<HTMLElement>('.ve-workbench-panel')?.querySelector<HTMLElement>(':scope > header');
  panelHeader?.append(dom.toolbar);

  const bind = (): void => {
    previewDigits = owner.snapshot()?.digits;
    if (!root.contains(dom.toolbar)) panelHeader?.append(dom.toolbar);
    dom.bindTable(currentTargetTable(targetHost));
    setHistoryAvailability(dom.toolbar, surface);
  };
  const observer = new MutationObserver(bind);
  const observe = (): void => observer.observe(targetHost, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ve-result-view'] });
  root.addEventListener('ve-target-table-rendered', bind);
  observe();
  bind();

  const resetInteraction = (): void => {
    dom.cancelActiveInteraction();
    dom.setBrushActive(false);
    session.clearSelection();
    session.clearPins();
    surface.resetHistory();
    setHistoryAvailability(dom.toolbar, surface);
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