import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
import { veTableProjection } from '../../apps/web/src/pages/ve-analyzer-table-projection';

const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)); };
const close = (actual, expected) => actual !== '' && Math.abs(Number(actual) - expected) < 1e-10;

export async function runVeResultProjectionChecks() {
  const checks = [];
  localStorage.setItem('epicscope.veAnalyzer.resultView', 'proposal');
  const s = await setupVeLifecycleFixture();
  s.root.hidden = false;
  try {
    s.run();
    const deadline = performance.now() + 10000;
    while (!s.view.getPrimaryAnalysis()) { assert(performance.now() < deadline, 'Analysis did not complete'); await settle(); }
    await settle();
    const primary = s.view.getPrimaryAnalysis();
    const index = primary.evidence.cells.findIndex(cell => cell.totalWeight > 0);
    assert(index >= 0, 'Fixture did not retain evidence');
    const row = Math.floor(index / primary.veTable.cols), col = index % primary.veTable.cols;
    const cell = () => s.root.querySelector(`td[data-ve-row="${row}"][data-ve-col="${col}"]`);
    const resultView = s.root.querySelector('select[aria-label="VE Analyzer result view"]');
    const choose = async view => { resultView.value = view; resultView.dispatchEvent(new Event('change', { bubbles: true })); await settle(); };
    const source = primary.veTable.numericValues[index], generated = primary.proposal.cells[index], evidence = primary.evidence.cells[index];
    const owner = veProposalEditOwner(s.root);
    const originalRevision = s.view.sessionRevision, originalReads = s.reads();
    const table = cell().closest('table'), projection = veTableProjection(table), originalValues = owner.snapshot().values;
    cell().title = 'Translated tooltip without any numeric metrics';
    const expected = { change: generated.changeValue ?? source, 'change-percent': generated.changePercent ?? source,
      'mixture-error': evidence.correctionPercent ?? source, samples: evidence.sampleCount, weight: evidence.totalWeight,
      confidence: ({ limited: 1, moderate: 2, strong: 3 })[evidence.confidence] ?? source,
      spread: evidence.correctionSpreadPercent ?? source, delay: 100 };
    for (const [view, value] of Object.entries(expected)) {
      await choose(view);
      assert(close(cell().dataset.veResultValue, value), `${view}: typed metric lost precision or depended on tooltip: ${cell().dataset.veResultValue} vs ${value}`);
      assert(cell().closest('table') === table && veTableProjection(table) === projection, `${view}: presentation rebuilt its source projection`);
    }
    assert(s.view.getPrimaryAnalysis() === primary && s.view.sessionRevision === originalRevision && owner.snapshot().values === originalValues,
      'Result View changes invalidated semantic authority');
    checks.push('Every alternate Result View uses full-precision typed metrics independently of tooltip text, without replacing its projection');

    assert(owner.applyValues([{ row, col, value: 137.123456 }]), 'Review edit rejected'); await settle();
    const editedTable = cell().closest('table');
    assert(veTableProjection(editedTable) === projection && veTableProjection(editedTable).cells[index].current === source,
      'Edited table projection confused source and review values');
    await choose('proposal'); assert(close(cell().dataset.veResultValue, 137.123456), 'Proposal lost working review precision');
    cell().title = 'Measured proposal. Current 999, proposed 999, change +999%. weight 999; samples 999.';
    await choose('change'); assert(close(cell().dataset.veResultValue, expected.change), 'Review edit/tooltip changed generated change metric');
    await choose('weight'); assert(close(cell().dataset.veResultValue, evidence.totalWeight), 'Review edit changed retained evidence weight');
    assert(owner.applyValues([{ row, col, value: undefined }]), 'Blank review edit rejected'); await settle();
    await choose('proposal'); assert(cell().querySelector(':scope > span').textContent === '—', 'Blank review did not remain blank');
    await choose('samples'); assert(close(cell().dataset.veResultValue, evidence.sampleCount), 'Blank review discarded generated evidence');
    assert(primary.veTable.numericValues[index] === source && s.view.getPrimaryAnalysis() === primary, 'Review mutated source/generated authority');
    checks.push('Source VE, generated metrics and edited/blank review values remain distinct through Result View switches');

    const selected = cell(); selected.setPointerCapture = () => {};
    selected.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 71, pointerType: 'mouse' }));
    selected.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 71, pointerType: 'mouse' }));
    s.root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Cell Evidence"]').click(); await settle();
    assert(!s.host.querySelector('.ve-cell-detail-popover').hidden && s.reads() === originalReads, 'Cell evidence failed to reuse retained analysis');
    checks.push('Evidence popup still consumes retained primary data without trace reads after review edits and metric switches');

    const delay = veDelayEditOwner(s.root), beforeDelay = delay.snapshot();
    assert(delay.applyValues(beforeDelay.values.map((_, i) => ({ row: Math.floor(i / beforeDelay.cols), col: i % beforeDelay.cols, workingMs: 97.321456 }))), 'Delay update rejected');
    await settle(); await choose('delay');
    assert(close(cell().dataset.veResultValue, 97.321456) && !s.view.getPrimaryAnalysis(), 'Delay view used rounded display data or stale analysis');
    await choose('weight'); assert(close(cell().dataset.veResultValue, source), 'Invalidated evidence survived delay change instead of source fallback');
    assert(s.reads() === originalReads, 'Presentation loaded additional log data');
    checks.push('Real delay changes invalidate generated evidence; delay interpolation retains full working precision and missing metrics use source fallback');
  } finally { s.view.setActive(false); s.host.remove(); }
  return { passed: checks.length, checks };
}
