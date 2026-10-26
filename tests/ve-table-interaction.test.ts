import { describe, expect, it } from 'vitest';
import {
  TableInteractionSession,
  type TableEditSurface,
  type TableEditTransaction,
} from '../apps/web/src/pages/ve-table-interaction';

function memorySurface(rows: number, cols: number, initial: readonly number[], rowCoordinates?: readonly number[], colCoordinates?: readonly number[]) {
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
    ...(rowCoordinates ? { rowCoordinate: (row: number) => rowCoordinates[row] ?? row } : {}),
    ...(colCoordinates ? { colCoordinate: (col: number) => colCoordinates[col] ?? col } : {}),
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
          const changed = draft.some((value, index) => !Object.is(value, values[index]));
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
  for (const axis of ['horizontal', 'vertical'] as const) {
    for (const method1d of ['linear', 'shape'] as const) {
      for (const strength of [0, 0.5, 1]) {
        it(`${axis}/${method1d} preserves strength ${strength} on a 32-cell 200-to-150 range`, () => {
          const initial = [200, ...new Array<number>(30).fill(100), 150];
          const memory = memorySurface(axis === 'horizontal' ? 1 : 32, axis === 'horizontal' ? 32 : 1, initial);
          const session = new TableInteractionSession(memory.surface);
          session.setRectangle({ row: 0, col: 0 }, axis === 'horizontal' ? { row: 0, col: 31 } : { row: 31, col: 0 });
          expect(session.interpolate({ axis, method1d, strength, clamp: true })).toBe(strength > 0);
          const values = memory.values();
          expect(values[0]).toBe(200);
          expect(values[31]).toBe(150);
          for (let index = 1; index < 31; index += 1) {
            expect(values[index]).toBeCloseTo(100 + (100 - 50 * index / 31) * strength, 10);
          }
          expect(memory.commits()).toBe(strength > 0 ? 1 : 0);
        });
      }
    }
  }

  for (const method2d of ['bilinear', 'boundary'] as const) {
    for (const strength of [0, 0.5, 1]) {
      it(`${method2d} respects strength ${strength} without projecting the original into boundary limits`, () => {
        const memory = memorySurface(3, 3, [200, 180, 150, 200, 100, 150, 200, 180, 150]);
        const session = new TableInteractionSession(memory.surface);
        session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
        expect(session.interpolate({ axis: 'both', method2d, strength, clamp: true })).toBe(strength > 0);
        expect(memory.values()[4]).toBe(100 + ((method2d === 'bilinear' ? 175 : 180) - 100) * strength);
        expect(memory.values()[0]).toBe(200);
        expect(memory.values()[8]).toBe(150);
        expect(memory.commits()).toBe(strength > 0 ? 1 : 0);
      });
    }
  }

  it('clamps an overshooting boundary target before blending from the existing value', () => {
    for (const shouldClamp of [false, true]) {
      const memory = memorySurface(3, 3, [10, 100, 20, 100, 1000, 100, 30, 100, 40]);
      const session = new TableInteractionSession(memory.surface);
      session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
      session.interpolate({ axis: 'both', method2d: 'boundary', strength: 0.5, clamp: shouldClamp });
      expect(memory.values()[4]).toBe(shouldClamp ? 550 : 587.5);
    }
  });

  for (const axis of ['horizontal', 'vertical'] as const) {
    for (const method2d of ['bilinear', 'boundary'] as const) {
      it(`delegates ${method2d} on a single ${axis} line without losing half strength`, () => {
        const memory = memorySurface(axis === 'horizontal' ? 1 : 3, axis === 'horizontal' ? 3 : 1, [200, 100, 150]);
        const session = new TableInteractionSession(memory.surface);
        session.setRectangle({ row: 0, col: 0 }, axis === 'horizontal' ? { row: 0, col: 2 } : { row: 2, col: 0 });
        session.interpolate({ axis: 'both', method2d, strength: 0.5, clamp: true });
        expect(memory.values()).toEqual([200, 137.5, 150]);
      });
    }
  }

  for (const axis of ['horizontal', 'vertical'] as const) {
    it(`distinguishes neighbor-informed shape from linear ${axis} interpolation`, () => {
      for (const method1d of ['linear', 'shape'] as const) {
        const memory = memorySurface(axis === 'horizontal' ? 1 : 5, axis === 'horizontal' ? 5 : 1, [0, 1, 100, 3, 6]);
        const session = new TableInteractionSession(memory.surface);
        session.setRectangle(axis === 'horizontal' ? { row: 0, col: 1 } : { row: 1, col: 0 }, axis === 'horizontal' ? { row: 0, col: 3 } : { row: 3, col: 0 });
        session.interpolate({ axis, method1d, strength: 0.5, clamp: true });
        expect(memory.values()[2]).toBeCloseTo(method1d === 'linear' ? 51 : (100 + 63 / 34) / 2, 10);
        expect(memory.values().filter((_, index) => index !== 2)).toEqual([0, 1, 3, 6]);
      }
    });
  }

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

  it('uses physical axis spacing for linear interpolation', () => {
    const memory = memorySurface(1, 3, [0, 99, 40], undefined, [1000, 1500, 3000]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 0, col: 2 });
    expect(session.interpolate({ axis: 'horizontal', method1d: 'linear', strength: 1 })).toBe(true);
    expect(memory.values()[1]).toBeCloseTo(10, 8);
  });

  it('keeps shape interpolation monotone on highly uneven physical bins', () => {
    const memory = memorySurface(1, 5, [0, 10, 999, 30, 40], undefined, [0, 1, 8, 9, 30]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 1 }, { row: 0, col: 3 });
    expect(session.interpolate({ axis: 'horizontal', method1d: 'shape', strength: 1, clamp: true })).toBe(true);
    expect(memory.values()[2]).toBeGreaterThanOrEqual(10);
    expect(memory.values()[2]).toBeLessThanOrEqual(30);
    expect(memory.commits()).toBe(1);
  });

  it('uses physical row/column fractions for 2D interpolation', () => {
    const memory = memorySurface(
      3, 3,
      [0, 90, 20, 90, 90, 90, 40, 90, 60],
      [0, 1, 4],
      [0, 1, 4],
    );
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
    expect(session.interpolate({ axis: 'both', method2d: 'bilinear', strength: 1 })).toBe(true);
    expect(memory.values()[4]).toBeCloseTo(15, 8);
  });

  it('applies a 2D bilinear surface as one transaction', () => {
    const memory = memorySurface(3, 3, [0, 90, 20, 90, 90, 90, 40, 90, 60]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
    expect(session.interpolate({ axis: 'both', method2d: 'bilinear', strength: 1 })).toBe(true);
    expect(memory.values()[4]).toBe(30);
    expect(memory.commits()).toBe(1);
  });

  it('rejects irregular 2D selections rather than inferring a hidden bounding rectangle', () => {
    const memory = memorySurface(3, 3, [0, 10, 20, 30, 40, 50, 60, 70, 80]);
    const session = new TableInteractionSession(memory.surface);
    session.setSelection([
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      { row: 2, col: 0 },
      { row: 2, col: 2 },
      { row: 1, col: 1 },
    ]);
    expect(session.interpolate({ axis: 'both', method2d: 'bilinear', strength: 1 })).toBe(false);
    expect(memory.values()).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
    expect(memory.commits()).toBe(0);
  });

  it('does not let an undefined/non-finite interpolation anchor contaminate the table', () => {
    const memory = memorySurface(3, 3, [0, 10, 20, 30, 40, 50, Number.NaN, 70, 80]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
    expect(session.interpolate({ axis: 'both', method2d: 'boundary', strength: 1 })).toBe(false);
    expect(memory.values()[6]).toBeNaN();
    expect(memory.commits()).toBe(0);
    expect(memory.cancels()).toBe(1);
  });

  it('fills an empty interior cell during shape interpolation instead of treating it as required support', () => {
    const memory = memorySurface(1, 5, [0, Number.NaN, 20, 30, 40]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 0, col: 4 });
    expect(session.interpolate({ axis: 'horizontal', method1d: 'shape', strength: 1 })).toBe(true);
    expect(memory.values()[1]).toBeGreaterThanOrEqual(0);
    expect(memory.values()[1]).toBeLessThanOrEqual(40);
    expect(memory.commits()).toBe(1);
  });

  it('fills empty interior and edge cells from four finite 2D bilinear corners', () => {
    const memory = memorySurface(3, 3, [0, Number.NaN, 20, Number.NaN, Number.NaN, Number.NaN, 40, Number.NaN, 60]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
    expect(session.interpolate({ axis: 'both', method2d: 'bilinear', strength: 1 })).toBe(true);
    expect(memory.values()[1]).toBe(10);
    expect(memory.values()[3]).toBe(20);
    expect(memory.values()[4]).toBe(30);
    expect(memory.commits()).toBe(1);
  });

  it('synthesizes missing edge samples for Boundary Surface interpolation', () => {
    const memory = memorySurface(3, 3, [0, Number.NaN, 20, Number.NaN, Number.NaN, Number.NaN, 40, Number.NaN, 60]);
    const session = new TableInteractionSession(memory.surface);
    session.setRectangle({ row: 0, col: 0 }, { row: 2, col: 2 });
    expect(session.interpolate({ axis: 'both', method2d: 'boundary', strength: 1 })).toBe(true);
    expect(memory.values()[4]).toBe(30);
    expect(memory.commits()).toBe(1);
  });

  it('reports a Brush footprint without pinned cells', () => {
    const memory = memorySurface(3, 3, new Array(9).fill(0));
    const session = new TableInteractionSession(memory.surface);
    session.selectCell({ row: 1, col: 1 });
    session.togglePinsForSelection();
    const footprint = session.brushFootprint({ row: 1, col: 1 }, { delta: 1, radius: 1, strength: 1, falloff: 'flat' });
    expect(footprint).not.toContainEqual({ row: 1, col: 1 });
    expect(footprint.length).toBe(4);
  });

  it('keeps a continuous Brush stroke inside one transaction and accumulates pulses', () => {
    const memory = memorySurface(3, 3, new Array(9).fill(0));
    const session = new TableInteractionSession(memory.surface);
    const brush = session.beginBrushStroke({ delta: 2, radius: 0, strength: 1, falloff: 'flat' });
    expect(brush.pulse({ row: 1, col: 1 })).toEqual([{ position: { row: 1, col: 1 }, value: 2 }]);
    expect(brush.pulse({ row: 1, col: 1 })).toEqual([{ position: { row: 1, col: 1 }, value: 4 }]);
    expect(brush.pulse({ row: 1, col: 1 })).toEqual([{ position: { row: 1, col: 1 }, value: 6 }]);
    expect(memory.values()[4]).toBe(0);
    expect(memory.commits()).toBe(0);
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
