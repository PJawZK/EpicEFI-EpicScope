import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
const channels = [['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['pw', 'PW', 'ms']].map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));
const traces = channels.map((channel, i) => ({ channel, complete: true, color: '#fff', range: { startSampleIndex: 0, timeMs: Float64Array.from({ length: 60 }, (_, j) => 100 * j), values: new Float64Array(60).fill([1500, 75, 15, 4][i]), validity: new Uint8Array(60).fill(1) } }));
export async function runVePinnedAnalysisChecks() {
  const s = await setupVeLifecycleFixture(undefined, { channels, traces }); const checks = []; s.root.hidden = false;
  const owner = veProposalEditOwner(s.root);
  const tool = name => [...s.root.querySelectorAll('.ve-proposal-shared-toolbar button')].find(b => b.getAttribute('aria-label')?.startsWith(name));
  const cell = () => s.root.querySelector('td[data-ve-row="0"][data-ve-col="0"]');
  const pin = () => { const node = cell(); node.setPointerCapture = () => {}; for (const type of ['pointerdown', 'pointerup']) node.dispatchEvent(new PointerEvent(type, { pointerId: 35, bubbles: true, cancelable: true })); tool('Pin or unpin').click(); };
  const run = async () => { s.run(); const end = performance.now() + 10000; while (!s.view.getPrimaryAnalysis() || s.view.getReadiness().pending) { assert(performance.now() < end, 'Pinned fixture analysis timed out'); await settle(); } };
  try {
    await run(); const first = s.view.getPrimaryAnalysis();
    assert(first.proposal.cells[0].state === 'measured', 'Fixture must generate evidence for selected cell');
    owner.applyValues([{ row: 0, col: 0, value: 123.456 }, { row: 1, col: 1, value: 111 }]); await settle();
    const revision = s.view.sessionRevision, reads = s.reads(); pin(); await settle();
    assert(!s.view.getPrimaryAnalysis() && s.view.sessionRevision === revision + 1 && s.reads() === reads, 'Pin must invalidate once without automatic calculation');
    assert(owner.snapshot().values[0] === 123.456 && owner.snapshot().values[3] === 111, 'Pinning lost working edits');
    checks.push('Pin invalidates generated authority once without trace reads or losing working edits');
    await run();
    const next = s.view.getPrimaryAnalysis();
    assert(next.proposal.cells[0].state === 'pinned' && next.proposal.cells[0].proposedValue === undefined && next.proposal.pinnedCellCount === 1, 'Pinned cell received a proposal or false no-evidence state');
    assert(owner.snapshot().values[0] === 123.456 && next.evidence.cells[0].totalWeight > 0 && next.proposal.cells.slice(1).some(c => c.state === 'measured'), 'Pinned working value, truthful evidence or neighboring proposals lost');
    assert(cell().dataset.tablePinned === 'true', 'Pin decoration lost through analysis');
    checks.push('Run protects pinned working value while retaining truthful evidence and neighboring proposals');
    owner.applyValues([{ row: 0, col: 0, value: undefined }]); await run();
    assert(owner.snapshot().values[0] === undefined && s.view.getPrimaryAnalysis().proposal.cells[0].state === 'pinned', 'Run filled an explicitly blank pinned cell');
    owner.applyValues([{ row: 0, col: 0, value: 91 }]); await run();
    assert(owner.snapshot().values[0] === 91, 'Direct edit of pinned value was not retained on next run');
    s.view.setActive(false); s.view.setActive(true); await settle();
    assert(owner.snapshot().pinnedPositions.length === 1 && cell().dataset.tablePinned === 'true', 'Navigation lost semantic pin');
    checks.push('Blank/directly edited pinned values and pin decorations survive reruns and navigation');
    const readsBeforeViews = s.reads(), revisionBeforeViews = s.view.sessionRevision;
    const resultView = s.root.querySelector('select[aria-label="VE Analyzer result view"]');
    for (const mode of ['samples', 'change', 'proposal']) { resultView.value = mode; resultView.dispatchEvent(new Event('change', { bubbles: true })); await settle(); }
    assert(cell().dataset.tablePinned === 'true' && owner.snapshot().values[0] === 91 && s.reads() === readsBeforeViews && s.view.sessionRevision === revisionBeforeViews, 'Result Views lost pins or triggered analytical work');
    assert(owner.setPinned([{ row: 0, col: 0 }]) === false && owner.setPinned([{ row: -1, col: 0 }]) === false && s.view.sessionRevision === revisionBeforeViews, 'No-op/invalid pin updates mutated the session');
    const scope = s.root.querySelector('select[data-role="scope"]'); scope.value = 'ab'; scope.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    s.view.setContext({ ...s.context, aTimeMs: 500, bTimeMs: 2500 }); await settle();
    assert(owner.snapshot().pinnedPositions.length === 1 && owner.snapshot().values[0] === 91 && cell().dataset.tablePinned === 'true', 'Scope edits cleared tune-bound protection');
    checks.push('Result Views and real scope changes retain tune-bound pins; duplicate/invalid pin updates are non-destructive');
    const held = s.hold(); s.run(); await settle(); owner.setPinned([]); await settle(); held.resolve(traces); await settle();
    assert(!s.view.getPrimaryAnalysis() && !s.view.getReadiness().pending && owner.snapshot().pinnedPositions.length === 0, 'Obsolete pinned async run published after unpin');
    await run(); assert(s.view.getPrimaryAnalysis().proposal.cells[0].state === 'measured', 'Unpinned node did not rejoin proposals');
    checks.push('Pin changes cancel stale async completions; unpin restores proposal eligibility');
    pin(); const model = { ...s.model }; s.view.setTuneModel(model, 'replacement.msq'); await settle();
    assert(owner.snapshot().pinnedPositions.length === 0 && cell().dataset.tablePinned !== 'true', 'Real tune replacement retained incompatible pins');
    assert(s.model.byName.get('veTable').numericValues.every(v => v === 70), 'Pin handling mutated original tune');
    checks.push('Real tune replacement retires pins and preserves original source values');
    const replacement = await setupVeLifecycleFixture(); replacement.root.hidden = false;
    try {
      replacement.run();
      const end = performance.now() + 10000;
      while (!replacement.view.getPrimaryAnalysis() || replacement.view.getReadiness().pending) { assert(performance.now() < end, 'Replacement fixture timed out'); await settle(); }
      const replacementOwner = veProposalEditOwner(replacement.root);
      replacementOwner.applyValues([{ row: 0, col: 0, value: 123 }]);
      const unsubscribe = replacement.view.onPrimaryAnalysisChange(() => {
        if (!replacement.view.getPrimaryAnalysis()) { unsubscribe(); replacement.view.setTuneModel({ ...replacement.model }, 'reentrant.msq'); }
      });
      replacementOwner.setPinned([{ row: 0, col: 0 }]); await settle();
      assert(replacementOwner.snapshot().values.every(value => value === 70) && replacementOwner.snapshot().pinnedPositions.length === 0, 'Pin invalidation carried old review values into a synchronously replaced tune');
      checks.push('Reentrant tune replacement during pin invalidation cannot inherit old working values');
    } finally { replacement.view.dispose(); replacement.host.remove(); }
    return { passed: checks.length, checks };
  } finally { s.view.dispose(); s.host.remove(); }
}
