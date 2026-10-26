import type { TableCellPosition, TableEditSurface, TableEditTransaction } from './ve-table-interaction';

export interface TableEditAuthoritySnapshot {
  readonly revision: number;
  readonly authorityGeneration: number;
  readonly rows: number;
  readonly cols: number;
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  readonly values: readonly (number | undefined)[];
}

export interface TableEditHistoryPolicy<Snapshot extends TableEditAuthoritySnapshot, Edit extends TableCellPosition> {
  readonly snapshot: () => Snapshot | undefined;
  readonly applyValues: (edits: readonly Edit[]) => boolean;
  readonly revert: (positions: readonly TableCellPosition[]) => boolean;
  readonly normalizeValue: (value: number, label: string) => number | undefined;
  readonly createEdit: (position: TableCellPosition, value: number | undefined) => Edit;
  readonly editValue: (edit: Edit) => number | undefined;
}

const HISTORY_LIMIT = 100;
interface HistoryEntry<Edit> {
  readonly before: readonly Edit[];
  readonly after: readonly Edit[];
}
function sameValue(left: number | undefined, right: number | undefined): boolean {
  return left === right || (left !== undefined && right !== undefined && Number.isNaN(left) && Number.isNaN(right));
}
function snapshotValue(snapshot: TableEditAuthoritySnapshot | undefined, row: number, col: number): number | undefined {
  if (!snapshot || row < 0 || row >= snapshot.rows || col < 0 || col >= snapshot.cols) return undefined;
  return snapshot.values[row * snapshot.cols + col];
}

/** Shared numeric edit mechanics only; domain owners retain publication policy. */
export class TableEditHistorySurface<Snapshot extends TableEditAuthoritySnapshot, Edit extends TableCellPosition> implements TableEditSurface {
  readonly #policy: TableEditHistoryPolicy<Snapshot, Edit>;
  readonly #undo: HistoryEntry<Edit>[] = [];
  readonly #redo: HistoryEntry<Edit>[] = [];
  #historyRevision: number | undefined;
  #historyGeneration: number | undefined;
  #publishing = false;

  constructor(policy: TableEditHistoryPolicy<Snapshot, Edit>) {
    this.#policy = policy;
  }

  get rows(): number { return this.#policy.snapshot()?.rows ?? 0; }
  get cols(): number { return this.#policy.snapshot()?.cols ?? 0; }
  rowCoordinate(row: number): number { return this.#policy.snapshot()?.loadBins[row] ?? row; }
  colCoordinate(col: number): number { return this.#policy.snapshot()?.rpmBins[col] ?? col; }
  canUndo(): boolean { this.synchronizeHistory(); return this.#undo.length > 0; }
  canRedo(): boolean { this.synchronizeHistory(); return this.#redo.length > 0; }

  get(row: number, col: number): number {
    const value = snapshotValue(this.#policy.snapshot(), row, col);
    return value === undefined ? Number.NaN : value;
  }

  valueAt(position: TableCellPosition): number | undefined {
    return snapshotValue(this.#policy.snapshot(), position.row, position.col);
  }

  protected currentSnapshot(): Snapshot | undefined { return this.#policy.snapshot(); }

  protected authorityReplaced(): void {}

  beginTransaction(label: string): TableEditTransaction {
    const snapshot = this.synchronizeHistory();
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
        const normalized = this.#policy.normalizeValue(value, label);
        if (normalized !== undefined) changed.set(indexFor(row, col), normalized);
      },
      commit: (): boolean => {
        if (!active) return false;
        active = false;
        const current = this.#policy.snapshot();
        if (!snapshot || authorityGeneration === undefined || !current || current.authorityGeneration !== authorityGeneration || current.revision !== snapshot.revision || changed.size === 0) return false;
        const before: Edit[] = [];
        const after: Edit[] = [];
        for (const [index, value] of changed) {
          const row = Math.floor(index / cols);
          const col = index % cols;
          const previous = values[index];
          if (sameValue(previous, value)) continue;
          before.push(this.#policy.createEdit({ row, col }, previous));
          after.push(this.#policy.createEdit({ row, col }, value));
        }
        if (after.length === 0 || !this.#publish(() => this.#policy.applyValues(after))) return false;
        this.#pushUndo({ before, after });
        this.#redo.length = 0;
        return true;
      },
      cancel: (): void => { active = false; },
    };
  }

  replaceWithUndefined(positions: readonly TableCellPosition[]): boolean {
    return this.#recordExplicit(positions, () => this.#policy.applyValues(positions.map(position => this.#policy.createEdit(position, undefined))));
  }

  revert(positions: readonly TableCellPosition[]): boolean {
    return this.#recordExplicit(positions, () => this.#policy.revert(positions));
  }

  undo(): boolean {
    this.synchronizeHistory();
    const entry = this.#undo.pop();
    if (!entry) return false;
    if (!this.#publish(() => this.#policy.applyValues(entry.before))) {
      this.#undo.push(entry);
      return false;
    }
    this.#redo.push(entry);
    if (this.#redo.length > HISTORY_LIMIT) this.#redo.shift();
    return true;
  }

  redo(): boolean {
    this.synchronizeHistory();
    const entry = this.#redo.pop();
    if (!entry) return false;
    if (!this.#publish(() => this.#policy.applyValues(entry.after))) {
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

  // Follow the authority head, not rendered table identity. Own edits and
  // Undo/Redo advance that head without retiring their history; any external
  // revision/value replacement retires both stacks, even at the same geometry.
  protected synchronizeHistory(): Snapshot | undefined {
    const snapshot = this.#policy.snapshot();
    if (!this.#publishing && (snapshot?.revision !== this.#historyRevision
      || snapshot?.authorityGeneration !== this.#historyGeneration)) {
      this.resetHistory();
      this.authorityReplaced();
      this.#historyRevision = snapshot?.revision;
      this.#historyGeneration = snapshot?.authorityGeneration;
    }
    return snapshot;
  }

  #publish(action: () => boolean): boolean {
    // Owner publication can synchronously bind the new DOM and query history.
    // Do not mistake that reentrant read for an external authority replacement.
    this.#publishing = true;
    try {
      return action();
    } finally {
      this.#publishing = false;
      const snapshot = this.#policy.snapshot();
      this.#historyRevision = snapshot?.revision;
      this.#historyGeneration = snapshot?.authorityGeneration;
    }
  }

  #pushUndo(entry: HistoryEntry<Edit>): void {
    this.#undo.push(entry);
    if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
  }

  #recordExplicit(positions: readonly TableCellPosition[], action: () => boolean): boolean {
    const previous = this.synchronizeHistory();
    const before = positions.map(position => this.#policy.createEdit(position, snapshotValue(previous, position.row, position.col)));
    if (!this.#publish(action)) return false;
    const current = this.#policy.snapshot();
    const after = positions.map(position => this.#policy.createEdit(position, snapshotValue(current, position.row, position.col)));
    if (before.every((entry, index) => sameValue(this.#policy.editValue(entry), this.#policy.editValue(after[index]!)))) return false;
    this.#pushUndo({ before, after });
    this.#redo.length = 0;
    return true;
  }
}
