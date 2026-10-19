import { describe, expect, it } from 'vitest';
import { TableEditHistorySurface, type TableEditAuthoritySnapshot } from '../apps/web/src/pages/ve-table-edit-history';
import type { TableCellPosition } from '../apps/web/src/pages/ve-table-interaction';
interface Edit extends TableCellPosition { readonly value: number | undefined }
function fixture() {
  let state: TableEditAuthoritySnapshot = { revision: 0, authorityGeneration: 1, rows: 1, cols: 2,
    rpmBins: [1000, 2000], loadBins: [50], values: [10, undefined] };
  let publications = 0, accept = true;
  let onPublish: (() => void) | undefined;
  const apply = (edits: readonly Edit[]) => {
    if (!accept) return false;
    const values = [...state.values];
    for (const edit of edits) values[edit.row * state.cols + edit.col] = edit.value;
    state = { ...state, values, revision: state.revision + 1, authorityGeneration: state.authorityGeneration + 1 };
    publications++; onPublish?.(); return true;
  };
  const surface = new TableEditHistorySurface({ snapshot: () => state, applyValues: apply,
    revert: positions => apply(positions.map(position => ({ ...position, value: position.col === 0 ? 10 : undefined }))),
    normalizeValue: (value, _label) => value,
    createEdit: (position, value): Edit => ({ ...position, value }), editValue: edit => edit.value });
  const edit = (value: number) => { const tx = surface.beginTransaction('direct-edit'); tx.set(0, 0, value); return tx.commit(); };
  return { surface, edit, state: () => state, count: () => publications,
    replace: (patch: Partial<TableEditAuthoritySnapshot>) => { state = { ...state, ...patch }; },
    accept: (value: boolean) => { accept = value; }, observe: (callback: () => void) => { onPublish = callback; } };
}

describe('generation-aware shared table history', () => {
  it('keeps preview private, cancels/no-ops without publication and commits once', () => {
    const f = fixture(), tx = f.surface.beginTransaction('brush');
    tx.set(0, 0, 12.345); tx.set(0, 1, 0); tx.set(-1, 0, 20); tx.set(0, 0, NaN);
    expect(tx.get(0, 0)).toBe(12.345); expect(tx.get(0, 1)).toBe(0);
    expect(f.state().values).toEqual([10, undefined]); expect(f.count()).toBe(0);
    expect(tx.commit()).toBe(true); expect(tx.commit()).toBe(false);
    expect(f.state().values).toEqual([12.345, 0]); expect(f.count()).toBe(1);
    const cancelled = f.surface.beginTransaction('brush'); cancelled.set(0, 0, 99); cancelled.cancel();
    expect(cancelled.commit()).toBe(false); expect(f.edit(12.345)).toBe(false); expect(f.count()).toBe(1);
  });

  it.each(['revision', 'authorityGeneration'] as const)('rejects a stale transaction when only %s changes', field => {
    const f = fixture(), tx = f.surface.beginTransaction('brush'); tx.set(0, 0, 99);
    f.replace({ [field]: f.state()[field] + 1 });
    expect(tx.commit()).toBe(false); expect(f.state().values[0]).toBe(10); expect(f.count()).toBe(0);
  });

  it('preserves own multi-step history across reentrant availability reads and unchanged snapshots', () => {
    const f = fixture(); f.observe(() => { f.surface.canUndo(); f.surface.canRedo(); });
    expect(f.edit(20)).toBe(true); expect(f.edit(30)).toBe(true);
    f.replace({});
    expect(f.surface.undo()).toBe(true); expect(f.state().values[0]).toBe(20);
    expect(f.surface.undo()).toBe(true); expect(f.state().values[0]).toBe(10);
    expect(f.surface.redo()).toBe(true); expect(f.surface.redo()).toBe(true); expect(f.state().values[0]).toBe(30);
  });

  it.each(['revision', 'authorityGeneration'] as const)('retires Undo and Redo on external %s replacement at the same geometry', field => {
    const f = fixture(); f.edit(20); f.edit(30); f.surface.undo();
    f.replace({ [field]: f.state()[field] + 1, values: [70, undefined] });
    expect(f.surface.canUndo()).toBe(false); expect(f.surface.canRedo()).toBe(false);
    expect(f.surface.undo()).toBe(false); expect(f.surface.redo()).toBe(false); expect(f.state().values[0]).toBe(70);
  });

  it('rejects owner-denied commits/undo without losing usable history', () => {
    const f = fixture(); f.edit(20); f.accept(false);
    expect(f.edit(30)).toBe(false); expect(f.surface.undo()).toBe(false); expect(f.state().values[0]).toBe(20);
    f.accept(true); expect(f.surface.undo()).toBe(true); expect(f.state().values[0]).toBe(10);
    expect(f.surface.redo()).toBe(true); expect(f.state().values[0]).toBe(20);
  });

  it('records clear/revert through their policies and preserves undefined values across Undo/Redo', () => {
    const f = fixture(); const positions = [{ row: 0, col: 0 }, { row: 0, col: 1 }];
    expect(f.surface.replaceWithUndefined(positions)).toBe(true); expect(f.state().values).toEqual([undefined, undefined]);
    expect(f.surface.undo()).toBe(true); expect(f.state().values).toEqual([10, undefined]);
    expect(f.surface.redo()).toBe(true); expect(f.surface.revert(positions)).toBe(true); expect(f.state().values).toEqual([10, undefined]);
    expect(f.surface.undo()).toBe(true); expect(f.state().values).toEqual([undefined, undefined]);
  });

  it('bounds history at 100 entries; no-ops/cancel preserve Redo and a fresh edit retires it', () => {
    const f = fixture(); for (let i = 1; i <= 105; i++) expect(f.edit(i)).toBe(true);
    let count = 0; while (f.surface.undo()) count++;
    expect(count).toBe(100); expect(f.state().values[0]).toBe(5);
    expect(f.edit(5)).toBe(false);
    const tx = f.surface.beginTransaction('brush'); tx.set(0, 0, 999); tx.cancel();
    expect(f.surface.canRedo()).toBe(true); count = 0; while (f.surface.redo()) count++;
    expect(count).toBe(100); expect(f.state().values[0]).toBe(105);
    f.surface.undo(); expect(f.edit(999)).toBe(true); expect(f.surface.canRedo()).toBe(false);
  });
});
