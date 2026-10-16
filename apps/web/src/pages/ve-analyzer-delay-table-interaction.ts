import type { VeDelayCellPosition } from '../../../../core/analysis/ve-delay-table-editing';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { veDelayEditOwner, type VeDelayCellValueEdit, type VeDelayEditOwner } from './ve-analyzer-delay-edit-owner';
import { createTableInteractionDomController } from './ve-table-interaction-dom';
import { TableInteractionSession, type TableEditSurface, type TableEditTransaction, type TableCellPosition } from './ve-table-interaction';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import '../styles/ve-table-interaction-dom.css';

const HISTORY_LIMIT = 100;

interface HistoryEntry {
  readonly before: readonly VeDelayCellValueEdit[];
  readonly after: readonly VeDelayCellValueEdit[];
}

function sameValue(left: number | undefined, right: number | undefined): boolean {
  return left === right || (left !== undefined && right !== undefined && Number.isNaN(left) && Number.isNaN(right));
}

function snapshotValue(owner: VeDelayEditOwner, row: number, col: number): number | undefined {
  const snapshot = owner.snapshot();
  if (!snapshot || row < 0 || row >= snapshot.rows || col < 0 || col >= snapshot.cols) return undefined;
  return snapshot.values[row * snapshot.cols + col];
}

class VeDelayTableEditSurface implements TableEditSurface {
  readonly #owner: VeDelayEditOwner;
  readonly #undo: HistoryEntry[] = [];
  readonly #redo: HistoryEntry[] = [];

  constructor(owner: VeDelayEditOwner) {
    this.#owner = owner;
  }

  get rows(): number { return this.#owner.snapshot()?.rows ?? 0; }
  get cols(): number { return this.#owner.snapshot()?.cols ?? 0; }

  get(row: number, col: number): number {
    const value = snapshotValue(this.#owner, row, col);
    return value === undefined ? Number.NaN : value;
  }

  valueAt(position: TableCellPosition): number | undefined {
    return snapshotValue(this.#owner, position.row, position.col);
  }

  beginTransaction(label: string): TableEditTransaction {
    const snapshot = this.#owner.snapshot();
    const revision = snapshot?.revision;
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
        if (label === 'direct-edit' && value < 0) return;
        changed.set(indexFor(row, col), Math.max(0, value));
      },
      commit: (): boolean => {
        if (!active) return false;
        active = false;
        const current = this.#owner.snapshot();
        if (!snapshot || revision === undefined || !current || current.revision !== revision || changed.size === 0) return false;
        const before: VeDelayCellValueEdit[] = [];
        const after: VeDelayCellValueEdit[] = [];
        for (const [index, value] of changed) {
          const row = Math.floor(index / cols);
          const col = index % cols;
          const previous = values[index];
          if (sameValue(previous, value)) continue;
          before.push({ row, col, workingMs: previous });
          after.push({ row, col, workingMs: value });
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
    return this.#recordExplicit(positions, (cells) => this.#owner.applyValues(cells.map(({ row, col }) => ({ row, col, workingMs: undefined }))));
  }

  revert(positions: readonly TableCellPosition[]): boolean {
    return this.#recordExplicit(positions, () => this.#owner.revert(positions as readonly VeDelayCellPosition[]));
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

  #recordExplicit(positions: readonly TableCellPosition[], action: (before: readonly VeDelayCellValueEdit[]) => boolean): boolean {
    const before = positions.map(({ row, col }) => ({ row, col, workingMs: snapshotValue(this.#owner, row, col) }));
    if (!action(before)) return false;
    const after = positions.map(({ row, col }) => ({ row, col, workingMs: snapshotValue(this.#owner, row, col) }));
    if (before.every((entry, index) => sameValue(entry.workingMs, after[index]?.workingMs))) return false;
    this.#pushUndo({ before, after });
    this.#redo.length = 0;
    return true;
  }
}

function currentDelayTable(host: HTMLElement): HTMLTableElement | undefined {
  return host.querySelector<HTMLTableElement>('table.ve-delay-table') ?? undefined;
}

/**
 * Bind the production Lambda Delay owner to the shared v50 table interaction stack.
 *
 * Values come only from the semantic owner registered by the base VE controller.
 * The rendered table is used solely for hit-testing/focus/decoration. One shared
 * interaction transaction becomes one owner applyValues() call and one VE session
 * invalidation, including Brush strokes and interpolation.
 */
export function installVeAnalyzerDelayTableInteraction(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  const owner = veDelayEditOwner(root);
  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]');
  if (!owner || !delayHost) return inner;

  delayHost.dataset.tableInteractionOwner = 'shared';
  root.querySelector<HTMLElement>('.ve-delay-inline-hint')?.setAttribute('hidden', '');
  const legacyEditor = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-editor"]');
  if (legacyEditor) legacyEditor.hidden = true;
  delayHost.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('td[data-delay-row][data-delay-col]')) return;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true });

  const surface = new VeDelayTableEditSurface(owner);
  const session = new TableInteractionSession(surface);
  let brushRadius = 1;
  const dom = createTableInteractionDomController(session, {
    adjustmentStep: () => 10,
    smoothStrength: () => 0.5,
    interpolation: () => ({ axis: 'both', method1d: 'linear', method2d: 'boundary', strength: 1, clamp: true }),
    brush: () => ({ delta: 5, radius: brushRadius, strength: 1, falloff: 'linear' }),
    readValue: (position) => surface.valueAt(position),
    adjustBrushRadius: (delta) => { brushRadius = Math.max(0, Math.min(4, brushRadius + delta)); },
  }, {
    undo: () => surface.undo(),
    redo: () => surface.redo(),
    revertSelection: (positions) => surface.revert(positions),
    clearSelection: (positions) => surface.replaceWithUndefined(positions),
    blankSelection: (positions) => surface.replaceWithUndefined(positions),
    deleteSelection: (positions) => surface.revert(positions),
    afterEdit: () => queueMicrotask(() => dom.bindTable(currentDelayTable(delayHost))),
  });

  dom.toolbar.classList.add('ve-delay-shared-toolbar');
  delayHost.insertAdjacentElement('beforebegin', dom.toolbar);

  const bind = (): void => dom.bindTable(currentDelayTable(delayHost));
  const resetInteractionSession = (): void => {
    dom.cancelActiveInteraction();
    dom.setBrushActive(false);
    session.clearSelection();
    session.clearPins();
    surface.resetHistory();
  };
  const observer = new MutationObserver(bind);
  const observe = (): void => observer.observe(delayHost, { childList: true });
  observe();

  for (const selector of ['[data-ve-analyzer="grab-delay"]', '[data-ve-analyzer="use-delay"]', '[data-ve-analyzer="load-delay"]'] as const) {
    root.querySelector<HTMLButtonElement>(selector)?.addEventListener('click', resetInteractionSession, { capture: true });
  }
  bind();

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
    editDelayCells(positions, edit) {
      const changed = inner.editDelayCells(positions, edit);
      if (changed) {
        dom.cancelActiveInteraction();
        surface.resetHistory();
        queueMicrotask(bind);
      }
      return changed;
    },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      if (changed) {
        resetInteractionSession();
        queueMicrotask(bind);
      }
      return changed;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const changed = inner.setTuneModel(model, sourceName);
      if (changed) {
        resetInteractionSession();
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
