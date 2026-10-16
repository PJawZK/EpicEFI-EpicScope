import { describe, expect, it } from 'vitest';
import {
  TableInteractionSession,
  type TableEditSurface,
  type TableEditTransaction,
} from '../apps/web/src/pages/ve-table-interaction';

function memorySurface(rows: number, cols: number, initial: readonly number[]) {
  let values = [...initial];
  const labels: string[] = [];
  let commits = 0;
  let cancels = 0;
  const surface: TableEditSurface = {
    rows,
    cols,
    get(row, col) {
      return values[row * cols + col]!;
    },
    beginTransaction(label): TableEditTransaction {
      labels.push(label);
      const draft = [...values];
      let active = true;
      return {
        get(row, col) {
          return draft[row * cols + col]!;
        },
        set(row, col, value) {
          if (!active) throw new Error('transaction already closed');
          draft[row * cols + col] = value;
        },
        commit() {
          if (!active) return false;
          active = false;
          const changed = draft.some((value, index) => value !== values[index]);
          if (changed) {
            values = draft;
            commits += 1;
          }
          return changed;
        },
        cancel() {
          if (!active) return;
          active = false;
          cancels += 1;
        },
      };
    },
  };
  return {
    surface,
    values: () => [...values],
    labels: () => [...labels],
    commits: () => commits,
    cancels: () => cancels,
  };
}

describe('VE shared table interaction boundary', () => {
  it('keeps pins session-local and protects destructive bulk adjustment', () => {
    const memory = memorySurface(2, 2, [1, 2, 3, 4]);
    const session = new TableInteractionSession(memory.surface);
    session.setSelection([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
    session.togglePinsForSelection();
    session.selectCell({ row: 1, col: 0 });
    expect(session.adjust(5)).toBe(true);
    expect(memory.values()).toEqual([1, 2, 8, 4]);
    expect(memory.commits()).toBe(1);
  });

  it('allows deliberate direct edits to override a pin', () => {
    const memory = memorySurface(1, 2, [10, 20]);
    const session = new TableInteractionSession(memory.surface);
    session.selectCell({ row: 0, col: 0 });
    session.togglePinsForSelection();
    expect(session.replaceSelection(42)).toBe(true);
    expect(memory.values()).toEqual([42, 20]);
  });

  it('smooths from one pre-edit snapshot and lets surrounding cells influence the result', () => {
    const memory = memorySurface(3, 3, [0, 0, 0, 0, 90, 0, 0, 0, 0]);
    const session = new TableInteractionSession(memory.surface);
    session.selectCell({ row: 1, col: 1 });
    expect(session.smooth(1)).toBe(true);
    expect(memory.values()[4]).toBe(10);
    expect(memory.commits()).toBe(1);
  });

  it('uses pinned cells as interior anchors for horizontal interpolation', () => {
    const memory = memorySurface(1, 5, [0, 99, 20, 99, 40]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 0, col: 4 });
    session.selectCell({ row: 0, col: 2 });
    session.togglePinsForSelection();
    session.setRectangle({ row: 0, col: 0 }, { row: 0, col: 4 });
    expect(session.interpolate({ axis: 'horizontal', method1d: 'linear', strength: 1, clamp: true })).toBe(true);
    expect(memory.values()).toEqual([0, 10, 20, 30, 40]);
  });

  it('applies a 2D bilinear surface as one transaction', () => {
    const memory = memorySurface(3, 3, [0, 90, 20, 90, 90, 90, 40, 90, 60]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
    expect(session.interpolate({ axis: 'both', method2d: 'bilinear', strength: 1 })).toBe(true);
    expect(memory.values()[4]).toBe(30);
    expect(memory.commits()).toBe(1);
  });

  it('keeps a continuous Brush stroke inside one transaction and accumulates pulses', () => {
    const memory = memorySurface(3, 3, new Array(9).fill(0));
    const session = new TableInteractionSession(memory.surface);
    const brush = session.beginBrushStroke({ delta: 2, radius: 0, strength: 1, falloff: 'flat' });
    brush.pulse({ row: 1, col: 1 });
    brush.pulse({ row: 1, col: 1 });
    brush.pulse({ row: 1, col: 1 });
    expect(brush.commit()).toBe(true);
    expect(memory.values()[4]).toBe(6);
    expect(memory.labels()).toEqual(['brush']);
    expect(memory.commits()).toBe(1);
  });

  it('skips pinned cells during Brush without splitting the stroke transaction', () => {
    const memory = memorySurface(1, 3, [0, 0, 0]);
    const session = new TableInteractionSession(memory.surface);
    session.selectCell({ row: 0, col: 1 });
    session.togglePinsForSelection();
    const brush = session.beginBrushStroke({ delta: 3, radius: 1, strength: 1, falloff: 'flat' });
    brush.pulse({ row: 0, col: 1 });
    expect(brush.commit()).toBe(true);
    expect(memory.values()).toEqual([3, 0, 3]);
    expect(memory.commits()).toBe(1);
  });
});
