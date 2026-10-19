import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { VE_NUMERICAL_REFERENCES } from '../fixtures/ve-numerical-references';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { for (let i = 0; i < 2; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
function same(actual, expected) {
  if (typeof expected === 'number') return typeof actual === 'number' && Math.abs(actual - expected) < 1e-9;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((value, i) => same(actual[i], value));
  if (expected && typeof expected === 'object') return actual && Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => same(actual[key], value));
  return actual === expected;
}
const model = axis => normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="2">${axis}</constant><constant name="veLoadBins" rows="2" cols="1">50 100</constant>
<constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant><constant name="afrLoadBins" rows="2" cols="1">50 100</constant>
<constant name="veTable" rows="2" cols="2" units="%">70 70 70 70</constant><constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant></page></msq>`));

function delayFile(rpmBins = [1000, 2000], loadBins = [50, 100]) {
  const cols = rpmBins.length, rows = loadBins.length;
  return serializeVeDelayTable({ rpmBins, loadBins, rows, cols, origin: 'saved-file',
    cells: Array.from({ length: rows * cols }, (_, i) => ({ row: Math.floor(i / cols), col: i % cols, state: 'measured',
      recommendedMs: 100, workingMs: 100, workingProvenance: 'measured-recommendation', eventCount: 3, p10Ms: 100, p90Ms: 100,
      spreadMs: 0, confidence: 'moderate', sourceEvents: [] })) });
}
async function pickDelay(s, text) {
  const file = s.root.querySelector('[data-ve-analyzer="load-delay-file"]');
  Object.defineProperty(file, 'files', { configurable: true, value: [{ name: 'delay-axis.json', text: async () => text }] });
  file.dispatchEvent(new Event('change', { bubbles: true })); await settle();
}

export async function runVeNumericalBoundaryChecks() {
  const checks = [];
  // Includes former N01–N05 expected failures: all must now actually agree in
  // Chromium, with no expected-failure escape path in this acceptance gate.
  for (const reference of VE_NUMERICAL_REFERENCES) {
    assert(same(await reference.run(), reference.expected), `${reference.id}: ${reference.title}`);
    checks.push(`${reference.id}: ${reference.title}`);
  }
  for (const axis of ['2000 1000', '1000 1000']) {
    const s = await setupVeLifecycleFixture();
    try {
      const tune = model(axis), original = tune.byName.get('veRpmBins').numericValues.slice();
      s.view.setTuneModel(tune, 'invalid-axis.msq');
      await pickDelay(s, delayFile());
      assert(s.view.getReadiness().delayState === 'working', 'Invalid-axis fixture lacks its valid independent delay table');
      const revision = s.view.sessionRevision, reads = s.reads();
      const readiness = s.view.getReadiness();
      assert(!readiness.ready && !readiness.rows.find(row => row.id === 'rpm-axis').valid
        && readiness.blockers.some(blocker => blocker.message.includes('strictly increasing')),
        'Invalid tune axis was accepted or lacks actionable feedback');
      const grab = s.root.querySelector('[data-ve-analyzer="grab-delay"]');
      assert(grab.disabled && grab.title.includes('strictly increasing'), 'Invalid geometry left delay discovery enabled');
      grab.click();
      s.run(); await settle();
      assert(!s.view.getPrimaryAnalysis() && s.reads() === reads && s.view.sessionRevision === revision,
        'Invalid geometry started calculation or mutated authority');
      assert(JSON.stringify(tune.byName.get('veRpmBins').numericValues) === JSON.stringify(original), 'Readiness reordered original tune axes');
      checks.push(`Tune axis ${axis} blocks analysis without trace reads, tune mutation or silent normalization`);
    } finally { s.view.dispose(); s.host.remove(); }
  }
  const s = await setupVeLifecycleFixture();
  try {
    s.run(); const deadline = performance.now() + 10000;
    while (!s.view.getPrimaryAnalysis() || s.view.getReadiness().pending) {
      assert(performance.now() < deadline, 'Valid control analysis did not complete'); await settle();
    }
    const primary = s.view.getPrimaryAnalysis(), working = veDelayEditOwner(s.root).snapshot();
    const revision = s.view.sessionRevision, reads = s.reads();
    await pickDelay(s, delayFile([2000, 1000], [50]));
    assert(s.root.querySelector('[data-ve-analyzer="delay-result"]').textContent.includes('strictly increasing'), 'Invalid saved delay axis lacks actionable error');
    assert(s.view.getPrimaryAnalysis() === primary && veDelayEditOwner(s.root).snapshot().values === working.values
      && s.view.sessionRevision === revision && s.reads() === reads && s.view.getReadiness().ready,
      'Rejected saved delay destroyed the accepted working table/analysis or started work');
    checks.push('Invalid saved delay replacement preserves the accepted primary, working delay and ready session');
  } finally { s.view.dispose(); s.host.remove(); }
  return { passed: checks.length, checks };
}
