import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
const key = (target, value) => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function saved(value, cols = 2) {
  return serializeVeDelayTable({ rpmBins: cols === 2 ? [1000, 2000] : [1000], loadBins: [50, 100], rows: 2, cols, origin: 'saved-file',
    cells: Array.from({ length: 2 * cols }, (_, i) => ({ row: Math.floor(i / cols), col: i % cols, state: 'measured', workingMs: value,
      recommendedMs: value, workingProvenance: 'measured-recommendation', eventCount: 5, confidence: 'moderate', sourceEvents: [] })) });
}
function pick(s, text) {
  const input = s.root.querySelector('[data-ve-analyzer="load-delay-file"]');
  Object.defineProperty(input, 'files', { configurable: true, value: text ? [{ name: 'replacement.json', text }] : [] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
async function fixture() {
  const s = await setupVeLifecycleFixture(); s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  s.root.querySelector('.ve-v50-lambda-tool-trigger').click();
  const owner = veDelayEditOwner(s.root);
  const cell = () => s.root.querySelector('td[data-delay-row="0"][data-delay-col="0"]');
  const tool = label => s.root.querySelector(`.ve-delay-shared-toolbar button[aria-label="${label}"]`);
  const select = () => { const c = cell(); c.setPointerCapture = () => {};
    for (const type of ['pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(type, { pointerId: 81, pointerType: 'mouse', bubbles: true, cancelable: true })); };
  const draft = value => { select(); key(cell(), 'F2'); const input = s.root.querySelector('.ve-table-inline-input');
    assert(input, 'Inline editor unavailable'); input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); return input; };
  const direct = async value => { key(draft(value), 'Enter'); await settle(); };
  return { ...s, owner, cell, tool, select, draft, direct };
}
export async function runVeDelayReplacementChecks() {
  const checks = [];
  for (const failure of ['parse', 'validation', 'read', 'empty']) {
    const s = await fixture();
    try {
      await s.direct(145); await s.run(); await settle();
      const primary = s.view.getPrimaryAnalysis(), before = s.owner.snapshot(), revision = s.view.sessionRevision, reads = s.reads();
      assert(primary, 'Primary fixture analysis missing');
      // Keep a private preview open while the replacement is pending/rejected.
      s.select(); s.tool('Pin or unpin selected cells').click();
      const input = s.draft(177);
      const selected = s.cell().dataset.delaySelected;
      pick(s, failure === 'empty' ? undefined : failure === 'parse' ? () => Promise.resolve('{broken') : failure === 'validation' ? () => Promise.resolve(JSON.stringify({ ...JSON.parse(saved(200)), rpmBins: [2000, 1000] })) : () => Promise.reject(Error('Read failed')));
      await settle();
      assert(s.root.querySelector('.ve-table-inline-input') === input && input.value === '177', `${failure}: rejected/empty replacement destroyed editing draft`);
      assert(s.cell().dataset.delaySelected === selected && selected === 'true' && s.cell().dataset.tablePinned === 'true', `${failure}: selection or pins lost`);
      assert(s.owner.snapshot().values[0] === 145 && s.owner.snapshot().authorityGeneration === before.authorityGeneration
        && s.view.sessionRevision === revision && s.view.getPrimaryAnalysis() === primary && s.reads() === reads, `${failure}: accepted authority changed`);
      if (failure !== 'empty') assert(s.root.querySelector('[data-ve-analyzer="delay-result-title"]').textContent === 'Could not load delay table', `${failure}: missing error`);
      key(input, 'Escape'); s.tool('Undo').click(); await settle();
      assert(s.owner.snapshot().values[0] === 100, `${failure}: Undo history lost`);
      s.tool('Redo').click(); await settle(); assert(s.owner.snapshot().values[0] === 145, `${failure}: Redo history lost`);
      checks.push(`${failure}: accepted primary/value/generation, selection, draft and Undo/Redo survive rejection or empty picker`);
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await fixture();
    try {
      await s.direct(145); s.run(); await settle();
      assert(s.view.getPrimaryAnalysis(), 'Accepted-replacement primary fixture missing');
      s.select(); s.tool('Pin or unpin selected cells').click();
      s.draft(177); const before = s.owner.snapshot(), revision = s.view.sessionRevision, reads = s.reads();
      const pending = deferred(); pick(s, () => pending.promise); await settle();
      assert(s.root.querySelector('.ve-table-inline-input'), 'Pending load destroyed draft');
      pending.resolve(saved(222, 1)); await settle();
      assert(s.owner.snapshot().cols === 1 && s.owner.snapshot().values.every(v => v === 222)
        && s.owner.snapshot().authorityGeneration > before.authorityGeneration && s.view.sessionRevision === revision + 1, 'Accepted replacement not published once');
      assert(!s.view.getPrimaryAnalysis(), 'Accepted replacement retained obsolete primary evidence');
      assert(!s.root.querySelector('.ve-table-inline-input') && !s.root.querySelector('[data-delay-selected="true"]')
        && !s.root.querySelector('[data-table-pinned="true"]'), 'Accepted replacement retained stale draft/selection/pins');
      assert(s.tool('Undo').dataset.commandAvailable === 'false' && s.tool('Redo').dataset.commandAvailable === 'false', 'Accepted replacement retained old history');
      s.select(); s.tool('Revert selected cells').click(); await settle();
      assert(s.owner.snapshot().values[0] === 222 && s.reads() === reads, 'Replacement baseline stale or traces loaded');
      checks.push('Successful changed-geometry replacement publishes once and retires old private interactions/history with new baseline');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await fixture();
    try {
      const a = deferred(); pick(s, () => a.promise); pick(s, () => Promise.resolve(saved(333))); await settle();
      const revision = s.view.sessionRevision; a.resolve(saved(111)); await settle();
      assert(s.owner.snapshot().values.every(v => v === 333) && s.view.sessionRevision === revision, 'Older success overwrote later acceptance');
      const b = deferred(); pick(s, () => b.promise); pick(s, () => Promise.resolve('{bad')); await settle();
      b.resolve(saved(444)); await settle();
      assert(s.owner.snapshot().values.every(v => v === 333) && s.view.sessionRevision === revision, 'Older success survived later rejected request');
      checks.push('Latest request wins: older success cannot overwrite newer acceptance or newer rejection');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  for (const boundary of ['hidden', 'context', 'tune', 'edit', 'disposed']) {
    const s = await fixture();
    try {
      const pending = deferred(); pick(s, () => pending.promise);
      if (boundary === 'hidden') s.view.setActive(false);
      else if (boundary === 'context') s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } });
      else if (boundary === 'tune') s.view.setTuneModel({ ...s.model }, 'new.msq');
      else if (boundary === 'edit') await s.direct(166);
      else s.view.dispose();
      const revision = s.view.sessionRevision, before = s.owner.snapshot();
      pending.resolve(saved(999)); await settle();
      assert(s.view.sessionRevision === revision && s.owner.snapshot()?.values[0] === before?.values[0], `${boundary}: stale file published`);
      checks.push(`${boundary}: obsolete file completion cannot publish into newer/inactive lifecycle`);
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await fixture();
    try {
      await s.direct(145); s.tool('Undo').click(); await settle();
      pick(s, () => Promise.resolve('{bad')); await settle();
      assert(s.tool('Redo').dataset.commandAvailable === 'true', 'Rejected load retired an existing Redo stack');
      s.tool('Redo').click(); await settle(); assert(s.owner.snapshot().values[0] === 145, 'Existing Redo no longer applies');
      pick(s, () => Promise.resolve(saved(555))); await settle();
      assert(s.owner.snapshot().values.every(v => v === 555) && s.tool('Undo').dataset.commandAvailable === 'false', 'Same-geometry acceptance retained old history');
      checks.push('Rejected replacement preserves an existing Redo stack; same-geometry acceptance retires it');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  return { passed: checks.length, checks };
}
