import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
async function visible(fixture) {
  const s = await setupVeLifecycleFixture(undefined, fixture); s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018'; return s;
}
async function finished(s) {
  const deadline = performance.now() + 5000;
  while (s.view.getReadiness().pending) { assert(performance.now() < deadline, 'Analysis did not settle'); await settle(); }
}
export async function runVeCompletionSummaryChecks() {
  const checks = [], observed = [];
  for (const boundary of ['primary', 'render', 'success']) {
    const s = await visible(); let completions = 0;
    const supersede = e => { if (s.view.getPrimaryAnalysis() && (boundary !== 'success' || e.detail.state === 'success')) s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } }); };
    const unsubscribe = boundary === 'primary' ? s.view.onPrimaryAnalysisChange(() => supersede()) : () => {};
    if (boundary !== 'primary') s.root.addEventListener(boundary === 'success' ? 've-analysis-stage-changed' : 've-proposal-table-rendered', supersede);
    s.root.addEventListener('ve-analysis-complete', () => completions++);
    try {
      s.run(); await finished(s); await settle();
      assert(!s.view.getPrimaryAnalysis() && completions === 0 && s.root.querySelector('.ve-v50-completion-dialog').hidden
        && s.root.querySelector('.ve-v50-summary-action').hidden, 'Superseded success published an obsolete completion summary');
      checks.push(`Reentrant source replacement during ${boundary} publication cannot publish stale completion`);
    } finally { unsubscribe(); s.view.dispose(); s.host.remove(); }
  }
  for (const kind of ['measured', 'weak', 'withheld', 'no-evidence', 'partial', 'compensated']) {
    const channels = [['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['pw', 'PW', 'ms'], ['trim', 'stftCorrection1', '%']]
      .map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));
    if (kind === 'partial') channels.pop(); // Coverage-only case must not auto-select applied trim.
    const traces = channels.map((channel, i) => ({ channel, complete: kind !== 'partial', range: {
      startSampleIndex: 0, timeMs: Float64Array.from({ length: 60 }, (_, j) => j * 100),
      values: new Float64Array(60).fill([1000, 50, kind === 'compensated' ? 14 : 15, 4, 5][i]), validity: new Uint8Array(60).fill(1),
    } }));
    const s = await visible(kind === 'partial' || kind === 'compensated' ? { channels, traces } : undefined); let rows;
    s.root.addEventListener('ve-analysis-complete', e => { rows = e.detail.rows; });
    try {
      if (kind === 'compensated') for (const [role, value] of [['stft', 'trim'], ['fuel-correction-mode', 'percent']]) {
        const field = s.root.querySelector(`[data-role="${role}"]`); field.value = value; field.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (['weak', 'withheld', 'no-evidence'].includes(kind)) {
        const role = kind === 'withheld' ? 'max-absolute-change' : 'min-evidence-weight';
        const field = s.root.querySelector(`[data-role="${role}"]`); field.value = kind === 'withheld' ? '0' : '99999'; field.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (kind === 'no-evidence') {
        // An admitted RPM range entirely outside configured qualification yields no evidence.
        const field = s.root.querySelector('[data-role="min-rpm"]'); field.value = '8000'; field.dispatchEvent(new Event('change', { bubbles: true }));
      }
      s.run(); await finished(s); await settle();
      const primary = s.view.getPrimaryAnalysis(); assert(primary && rows, 'Missing accepted primary/summary');
      const { evidence: e, proposal: p } = primary, map = new Map(rows);
      const expected = {
        'Input samples': e.inputSampleCount, 'State-excluded samples': primary.stateExcludedCount,
        'Delay unavailable': e.delayUnavailableSampleCount, 'Stable eligible samples': e.eligibleSampleCount,
        'Transient rejected': e.transientRejectedSampleCount, 'Contributing samples': e.contributingSampleCount,
        'Measured proposal cells': p.measuredCellCount, 'Weak evidence cells': p.weakCellCount,
        'Withheld by limits': p.withheldCellCount, 'No-evidence cells': p.noEvidenceCellCount,
      };
      for (const [label, value] of Object.entries(expected)) assert(map.get(label) === value.toLocaleString(), `${kind}: incorrect ${label}`);
      assert(e.inputSampleCount === 60 && map.get('Tune source') === 'test.msq' && map.get('VE table') === 'veTable'
        && map.get('Target table') === 'afrTable' && map.get('Tune mutation') === 'None' && map.get('Coverage') === (kind === 'partial' ? 'Partial decoded' : 'Complete'), 'Summary source/input/coverage metadata differs from fixture');
      const states = ['measured', 'weak-evidence', 'withheld-limit', 'no-evidence'].map(state => p.cells.filter(c => c.state === state).length);
      assert(states.every((count, i) => count === [p.measuredCellCount, p.weakCellCount, p.withheldCellCount, p.noEvidenceCellCount][i])
        && states.reduce((a, b) => a + b, 0) === 4, 'Generated proposal category partition is inconsistent');
      assert(kind === 'no-evidence' ? p.noEvidenceCellCount === 4 : states[kind === 'partial' || kind === 'compensated' ? 0 : ['measured', 'weak', 'withheld'].indexOf(kind)] > 0, 'Fixture did not exercise requested outcome');
      if (['measured', 'partial', 'compensated'].includes(kind)) {
        const cell = p.cells.find(c => c.state === 'measured');
        assert(Math.abs(cell.evidenceCandidate - (kind === 'compensated' ? 73.5 : 75)) < 1e-9, 'Independent raw-candidate reference differs');
      }
      if (kind === 'compensated') assert(map.get('Fuel correction handling') === 'Compensated · percent fuel applied'
        && map.get('Fuel correction samples') === `${e.fuelCorrectionCompensatedSampleCount.toLocaleString()} compensated · ${e.fuelCorrectionUnavailableSampleCount.toLocaleString()} unavailable`
        && map.get('Fuel correction source').includes('stftCorrection1'), 'Compensated summary has incorrect source/basis/counts');
      const stage = s.root.querySelector('[data-ve-analyzer="stage"]');
      assert(stage.dataset.state === 'success' && (p.measuredCellCount > 0 ? stage.textContent.includes('proposed') : stage.textContent.includes('No cells qualified')),
        `${kind}: success feedback does not distinguish actionable from empty generated proposals`);
      const primaryBefore = primary, revision = s.view.sessionRevision, reads = s.reads(), serialized = JSON.stringify(rows);
      veProposalEditOwner(s.root).applyValues([{ row: 0, col: 0, value: 123.456 }]);
      s.view.refresh(); s.view.setContext(s.context); await settle();
      const shown = [...s.root.querySelectorAll('.ve-v50-completion-rows > div')].map(el => [el.firstElementChild.textContent, el.lastElementChild.textContent]);
      assert(JSON.stringify(shown) === serialized && s.view.getPrimaryAnalysis() === primaryBefore && s.view.sessionRevision === revision
        && s.reads() === reads && s.model.byName.get('veTable').numericValues[0] === 70, 'Working edits/refresh changed generated summary, tune or primary authority');
      observed.push({ kind, input: e.inputSampleCount, contributing: e.contributingSampleCount, states, rows });
      checks.push(`${kind}: summary matches retained generated authority and factual outcome, independent of working edits`);
    } finally { s.view.dispose(); s.host.remove(); }
  }
  return { passed: checks.length, checks, observed };
}
