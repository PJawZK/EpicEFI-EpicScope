import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { assertVeCompletion } from './ve-completion-contract.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';

const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { for (let i = 0; i < 2; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
const change = (node, value) => { node.value = value; node.dispatchEvent(new Event('change', { bubbles: true })); };
const key = (node, value) => node.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
const sourceValues = model => JSON.stringify(model.entries.map(entry => entry.numericValues));

async function analyzed() {
  const s = await setupVeLifecycleFixture();
  s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  veDelayEditOwner(s.root).applyValues([{ row: 0, col: 0, workingMs: 125 }]);
  let rows;
  const receive = event => { rows = event.detail.rows; };
  s.root.addEventListener('ve-analysis-complete', receive);
  try {
    s.run();
    const deadline = performance.now() + 10000;
    while (!rows || s.view.getReadiness().pending) {
      assert(performance.now() < deadline, 'Retention fixture analysis did not complete'); await settle();
    }
    assertVeCompletion(s.root, s.view, rows);
    s.root.querySelector('.ve-v50-completion-x').click();
    return { ...s, rows };
  } catch (error) { s.view.dispose(); s.host.remove(); throw error; }
  finally { s.root.removeEventListener('ve-analysis-complete', receive); }
}

async function editReview(s, value) {
  change(s.root.querySelector('select[aria-label="VE Analyzer result view"]'), 'proposal');
  const cell = s.root.querySelector('td[data-ve-row="0"][data-ve-col="0"]');
  cell.setPointerCapture = () => {};
  for (const type of ['pointerdown', 'pointerup']) cell.dispatchEvent(new PointerEvent(type, {
    pointerId: 91, pointerType: 'mouse', bubbles: true, cancelable: true,
  }));
  key(cell, 'F2');
  const draft = s.root.querySelector('.ve-table-inline-input');
  assert(draft, 'Review editor unavailable');
  draft.value = String(value); draft.dispatchEvent(new Event('input', { bubbles: true })); key(draft, 'Enter');
  await settle();
  assert(veProposalEditOwner(s.root).snapshot().values[0] === value, 'Review edit did not commit');
}

export async function runVeEditingRetentionChecks() {
  const checks = [];
  const storageKeys = ['epicscope.veAnalyzer.resultView', 'epicscope.veAnalyzer.tableLayout'];
  const saved = storageKeys.map(key => localStorage.getItem(key));
  try {
    localStorage.setItem(storageKeys[0], 'proposal'); localStorage.setItem(storageKeys[1], 'side-by-side');
    const s = await analyzed();
    try {
      const review = veProposalEditOwner(s.root), delay = veDelayEditOwner(s.root);
      const primary = s.view.getPrimaryAnalysis(), generated = JSON.stringify(primary.proposal);
      const source = sourceValues(s.model), baseline = review.snapshot().values[0];
      const delayValues = delay.snapshot().values, revision = s.view.sessionRevision, reads = s.reads();
      await editReview(s, 123.456789);
      let editedValues = review.snapshot().values;
      const result = s.root.querySelector('select[aria-label="VE Analyzer result view"]');
      const layout = s.root.querySelector('select[aria-label="VE Analyzer table view"]');
      const operations = [
        ...[...result.options].map(option => [`Result View ${option.value}`, () => change(result, option.value)]),
        ['single-table Target/VE navigation', () => {
          change(layout, 'single');
          s.root.querySelector('[data-table-tab="target"]').click(); s.root.querySelector('[data-table-tab="ve"]').click();
        }],
        ['side-by-side layout', () => change(layout, 'side-by-side')],
        ['unchanged context with updated callback', () => s.view.setContext({ ...s.context, openSamplesInLogger: () => {} })],
        ['unchanged tune', () => s.view.setTuneModel(s.model, 'test.msq')],
        ['refresh', () => { s.view.refresh(); s.view.refresh(); }],
        ['unused Full Log A/B and range-label changes', () => s.view.setContext({
          ...s.context, aTimeMs: 500, bTimeMs: 2500, savedRanges: [{ label: 'Renamed', startMs: 0, endMs: 2000 }],
        })],
        ['deactivate/reactivate with equivalent deferred updates', () => {
          s.view.setActive(false); s.view.setContext({ ...s.context }); s.view.setTuneModel(s.model, 'test.msq');
          s.view.refresh(); s.view.setActive(true);
        }],
        ['summary reopen/close', () => {
          s.root.querySelector('.ve-v50-summary-action').click(); assertVeCompletion(s.root, s.view, s.rows);
          s.root.querySelector('.ve-v50-completion-x').click();
        }],
      ];
      for (const [name, operation] of operations) {
        operation(); await settle();
        assert(s.view.getPrimaryAnalysis() === primary && JSON.stringify(primary.proposal) === generated,
          `${name}: generated authority changed`);
        assert(review.snapshot().values === editedValues && delay.snapshot().values === delayValues
          && s.view.sessionRevision === revision && s.reads() === reads && sourceValues(s.model) === source,
          `${name}: lost edits, invalidated authority, mutated tune or loaded traces`);
        const restoreView = result.value;
        change(result, 'proposal'); await settle();
        s.root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Undo"]').click(); await settle();
        assert(review.snapshot().values[0] === baseline, `${name}: retired review Undo (value=${review.snapshot().values[0]}, baseline=${baseline})`);
        s.root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Redo"]').click(); await settle();
        assert(review.snapshot().values[0] === 123.456789, `${name}: lost review Redo`);
        editedValues = review.snapshot().values;
        change(result, restoreView);
        checks.push(`${name} retains independent source, generated proposal, working review and edited delay without calculation`);
      }
      change(result, 'proposal'); await settle();
      const tool = name => s.root.querySelector(`.ve-proposal-shared-toolbar button[aria-label="${name}"]`);
      tool('Undo').click(); await settle();
      assert(review.snapshot().values[0] === baseline, 'Presentation/navigation retired review Undo');
      tool('Redo').click(); await settle();
      assert(review.snapshot().values[0] === 123.456789 && sourceValues(s.model) === source
        && s.view.getPrimaryAnalysis() === primary, 'Review Redo changed generated/source authority');
      checks.push('Review Undo/Redo survives the entire presentation and navigation matrix');
    } finally { s.view.dispose(); s.host.remove(); }

    for (const kind of ['source', 'tune', 'scope', 'qualification', 'delay']) {
      const s = await analyzed();
      try {
        await editReview(s, 123.456789);
        const source = sourceValues(s.model), revision = s.view.sessionRevision, reads = s.reads();
        if (kind === 'source') s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } });
        if (kind === 'tune') s.view.setTuneModel({ ...s.model }, 'replacement.msq');
        if (kind === 'scope') change(s.root.querySelector('[data-role="scope"]'), 'ab');
        if (kind === 'qualification') change(s.root.querySelector('[data-role="min-rpm"]'), '900');
        if (kind === 'delay') veDelayEditOwner(s.root).applyValues([{ row: 0, col: 0, workingMs: 140 }]);
        await settle();
        const owner = veProposalEditOwner(s.root), current = owner.snapshot().values;
        assert(!s.view.getPrimaryAnalysis() && s.view.sessionRevision > revision && current[0] === 70,
          `${kind}: obsolete proposal/review remained authoritative`);
        s.root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Undo"]').click();
        assert(owner.snapshot().values === current, `${kind}: Undo restored edits from an obsolete authority`);
        const working = veDelayEditOwner(s.root).snapshot();
        assert(kind === 'qualification' || kind === 'scope' ? working?.values[0] === 125 : kind === 'delay' ? working?.values[0] === 140 : !working,
          `${kind}: wrong working-delay invalidation policy`);
        assert(s.root.querySelector('.ve-v50-completion-dialog').hidden && s.root.querySelector('.ve-v50-summary-action').hidden
          && sourceValues(s.model) === source && s.reads() === reads, `${kind}: stale completion, tune mutation or automatic rerun`);
        checks.push(`${kind} invalidates obsolete generated/review/history/summary authority without automatic calculation`);
      } finally { s.view.dispose(); s.host.remove(); }
    }

    const stale = await analyzed();
    try {
      const gate = stale.hold(); stale.run(); await settle();
      assert(stale.root.querySelector('.ve-v50-completion-dialog').hidden
        && stale.root.querySelector('.ve-v50-summary-action').hidden && !stale.view.getPrimaryAnalysis(),
        'New run retained the prior completion summary/authority');
      stale.view.setTuneModel({ ...stale.model }, 'new-session.msq'); gate.resolve([]); await settle();
      assert(stale.root.querySelector('.ve-v50-completion-dialog').hidden
        && stale.root.querySelector('.ve-v50-summary-action').hidden && !stale.view.getPrimaryAnalysis(),
        'Stale completion reopened an obsolete summary');
      checks.push('Run start withdraws the prior completion; obsolete async work cannot reopen it in a newer session');
    } finally { stale.view.dispose(); stale.host.remove(); }
  } finally {
    storageKeys.forEach((key, index) => saved[index] === null ? localStorage.removeItem(key) : localStorage.setItem(key, saved[index]));
  }
  return { passed: checks.length, checks };
}
