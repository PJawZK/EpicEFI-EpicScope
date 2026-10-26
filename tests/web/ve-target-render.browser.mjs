import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
import { veTableProjection } from '../../apps/web/src/pages/ve-analyzer-table-projection';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';

const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)); };
const change = (root, role, value) => {
  const control = root.querySelector(`select[data-role="${role}"]`);
  assert(control && [...control.options].some(option => option.value === value), `Missing option ${role}/${value}`);
  control.value = value; control.dispatchEvent(new Event('change', { bubbles: true }));
};
const replacement = () => normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="2">1000 2000</constant>
<constant name="veLoadBins" rows="2" cols="1">50 100</constant>
<constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant>
<constant name="afrLoadBins" rows="2" cols="1">50 100</constant>
<constant name="afrRpmBins2" rows="1" cols="2">1000 3000</constant>
<constant name="afrLoadBins2" rows="2" cols="1">40 120</constant>
<constant name="veTable" rows="2" cols="2" units="%">70 70 70 70</constant>
<constant name="afrTable" rows="2" cols="2" units="AFR">15 15 15 15</constant>
<constant name="afrTable2" rows="2" cols="2" units="AFR">18.5 18.5 18.5 18.5</constant>
</page></msq>`));

export async function runVeTargetRenderChecks() {
  const checks = [];
  localStorage.setItem('epicscope.veAnalyzer.tableLayout', 'side-by-side');
  localStorage.setItem('epicscope.veAnalyzer.resultView', 'proposal');
  const s = await setupVeLifecycleFixture(); s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  try {
    await settle();
    const targetHost = s.root.querySelector('[data-ve-analyzer="target-table-view"]');
    const target = () => targetHost.querySelector('table');
    const ve = () => s.root.querySelector('[data-ve-analyzer="ve-table-view"] table');
    const retained = target(), projection = veTableProjection(retained), beforeVe = ve();
    const targetCell = retained.querySelector('td'); targetCell.tabIndex = 0; targetCell.focus();
    const owner = veProposalEditOwner(s.root), before = owner.snapshot();
    assert(owner.applyValues([{ row: 0, col: 0, value: 123.456 }]), 'Review edit rejected'); await settle();
    assert(ve() === beforeVe && owner.snapshot().authorityGeneration === before.authorityGeneration + 1, 'VE edit replaced its grid or failed single publication');
    assert(target() === retained && veTableProjection(retained) === projection && document.activeElement === targetCell,
      'Proposal edit rebuilt Target, replaced its projection or discarded its focused cell');
    assert(s.model.byName.get('veTable').numericValues[0] === 70 && projection.cells[0].current === 14, 'Review edit mutated source tune/Target');
    checks.push('Proposal edit updates VE once while preserving Target DOM, typed projection, focused cell and source tune');

    s.view.refresh(); s.view.refresh(); s.view.setContext({ ...s.context }); s.view.setTuneModel(s.model, 'test.msq'); await settle();
    const result = s.root.querySelector('select[aria-label="VE Analyzer result view"]');
    for (const value of ['weight', 'proposal']) { result.value = value; result.dispatchEvent(new Event('change', { bubbles: true })); await settle(); }
    const layout = s.root.querySelector('select[aria-label="VE Analyzer table view"]');
    for (const value of ['single', 'side-by-side']) { layout.value = value; layout.dispatchEvent(new Event('change', { bubbles: true })); await settle(); }
    assert(target() === retained && veTableProjection(retained) === projection && s.reads() === 0, 'Unrelated refresh/presentation rebuilt Target or loaded traces');
    checks.push('Repeated refresh, unchanged context/tune, Result Views and layouts retain unchanged Target without trace reads');

    s.run(); assert(target() === retained, 'Run start rebuilt Target');
    const deadline = performance.now() + 10000;
    while (!s.view.getPrimaryAnalysis()) { assert(performance.now() < deadline, 'Analysis did not complete'); await settle(); }
    await settle(); assert(target() === retained && s.reads() === 1, 'Analysis completion rebuilt Target or duplicated reads');
    const primary = s.view.getPrimaryAnalysis();
    const delay = veDelayEditOwner(s.root);
    assert(delay.applyValues([{ row: 0, col: 0, workingMs: 135 }]), 'Delay edit rejected'); await settle();
    assert(target() === retained && !s.view.getPrimaryAnalysis() && primary && delay.snapshot().values[0] === 135,
      'Delay edit rebuilt Target or failed semantic invalidation');
    const revision = s.view.sessionRevision;
    s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } }); await settle();
    assert(target() === retained && s.view.sessionRevision > revision && !s.view.getPrimaryAnalysis(), 'Source replacement redrew unchanged Target or failed invalidation');
    checks.push('Run start/completion, delay changes and real source replacement preserve Target while retaining analysis invalidation');

    const tune = replacement(); s.view.setTuneModel(tune, 'replacement.msq'); await settle();
    assert(target() !== retained && veTableProjection(target()).cells.every(cell => cell.current === 15), 'Accepted tune replacement retained old Target values');
    const first = target(); change(s.root, 'target-table', 'afrTable2'); await settle();
    assert(target() !== first && veTableProjection(target()).cells.every(cell => cell.current === 18.5), 'Target selection retained previous entry');
    let previous = target(); change(s.root, 'target-rpm-axis', 'afrRpmBins2'); await settle();
    assert(target() !== previous && target().tHead.rows[0].cells[2].textContent === '3000', 'Target RPM mapping retained old geometry');
    previous = target(); change(s.root, 'target-load-axis', 'afrLoadBins2'); await settle();
    assert(target() !== previous && target().tBodies[0].rows[0].cells[0].textContent === '120', 'Target load mapping retained old geometry');
    checks.push('Real tune, Target entry and each axis replacement rebuild the correct typed values and geometry');

    change(s.root, 'target-table', ''); await settle(); const empty = targetHost.firstElementChild;
    assert(!target() && empty.textContent.includes('No table selected'), 'Missing Target retained stale cells');
    s.view.refresh(); await settle(); assert(targetHost.firstElementChild === empty, 'Repeated missing-Target refresh rebuilt the empty state');
    change(s.root, 'target-table', 'afrTable'); await settle(); assert(target() && veTableProjection(target()).cells[0].current === 15, 'Target restore stayed empty');
    s.view.setTuneModel(undefined); await settle(); assert(!target(), 'Tune unload retained Target');
    s.view.setTuneModel(tune, 'restored.msq'); await settle(); assert(target() && veTableProjection(target()).cells[0].current === 15, 'Tune restore retained stale empty state');
    checks.push('Missing Target and tune unload clear stale content; unchanged empty states are retained and restore renders current values');
  } finally { s.view.setActive(false); s.host.remove(); }
  return { passed: checks.length, checks };
}
