// Browser regression module: with Vite running, import this file through its /@fs/ URL
// in Chromium and await runVeAnalyzerResultViewChecks(). No DOM emulator is used.
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { installVeAnalyzerUiRefinements } from '../../apps/web/src/app/ve-analyzer-ui-refinements';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';

const tune = () => normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="2">1000 2000</constant>
<constant name="veLoadBins" rows="2" cols="1">50 100</constant>
<constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant>
<constant name="afrLoadBins" rows="2" cols="1">50 100</constant>
<constant name="veTable" rows="2" cols="2" units="%">60 70 80 90</constant>
<constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant>
</page></msq>`));

const channels = [
  ['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['pw', 'PW', 'ms'],
].map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));

const traces = channels.map((channel, index) => ({
  channel,
  complete: true,
  color: '#58aef6',
  range: {
    startSampleIndex: 0,
    timeMs: Float64Array.from({ length: 60 }, (_, i) => i * 100),
    values: new Float64Array(60).fill([1000, 50, 15, 4][index]),
    validity: new Uint8Array(60).fill(1),
  },
}));

function delayFile(value = 100) {
  return serializeVeDelayTable({
    rpmBins: [1000, 2000], loadBins: [50, 100], rows: 2, cols: 2, origin: 'saved-file',
    cells: Array.from({ length: 4 }, (_, i) => ({
      row: Math.floor(i / 2), col: i % 2, state: 'measured', workingMs: value,
      recommendedMs: value, workingProvenance: 'measured-recommendation',
      eventCount: 5, confidence: 'moderate', sourceEvents: [],
    })),
  });
}

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function change(root, role, value) {
  const control = root.querySelector(`select[data-role="${role}"]`);
  assert(control, `Missing ${role}`);
  control.value = value;
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function loadDelay(root) {
  const input = root.querySelector('[data-ve-analyzer="load-delay-file"]');
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [{ name: 'delays.json', text: () => Promise.resolve(delayFile()) }],
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function text(cell) {
  return cell.querySelector(':scope > span')?.textContent?.trim() ?? '';
}

function baseLevel(cell) {
  return cell.dataset.veBaseLevel ?? cell.style.getPropertyValue('--ve-cell-level');
}

function byCurrent(root, value) {
  return [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] tbody td')]
    .find((cell) => Number(cell.dataset.veCurrentValue) === value);
}

async function completed(view, root) {
  const deadline = performance.now() + 10000;
  while (!view.getPrimaryAnalysis()) {
    if (performance.now() > deadline) {
      throw new Error(`VE did not complete: ${root.querySelector('[data-ve-analyzer="stage"]')?.textContent ?? ''}`);
    }
    await settle();
  }
}

export async function runVeAnalyzerResultViewChecks() {
  localStorage.removeItem('epicscope.veAnalyzer.resultView');

  let loadCount = 0;
  const model = tune();
  const context = {
    source: { identity: {}, sampleCount: 60, revision: 0 },
    channels,
    traces: [],
    loadTraces: async (ids) => {
      loadCount += 1;
      return traces.filter((trace) => ids.includes(trace.channel.id));
    },
    aTimeMs: 0,
    bTimeMs: 3000,
    savedRanges: [],
  };

  const shell = document.createElement('section');
  const domain = document.createElement('select');
  domain.className = 'analyzer-header-view-select';
  domain.append(new Option('VE Analyzer', 've'));
  domain.value = 've';
  const analyzerPage = document.createElement('section');
  analyzerPage.className = 'analyzer-page';
  const view = createVeAnalyzerView();
  analyzerPage.append(view.element);
  shell.append(domain, analyzerPage);
  document.body.append(shell);
  installVeAnalyzerUiRefinements(shell);

  view.setContext(context);
  view.setTuneModel(model, 'result-view-regression.msq');
  change(view.element, 'rpm', 'rpm');
  change(view.element, 'load', 'map');
  change(view.element, 'actual', 'afr');
  change(view.element, 'fuelCommand', 'pw');
  loadDelay(view.element);
  await settle();

  const run = view.element.querySelector('.ve-workbench-run');
  assert(run && !run.disabled, 'Fixture must be ready to run');
  run.click();
  await completed(view, view.element);
  await settle();

  const primary = view.getPrimaryAnalysis();
  assert(primary, 'Primary analysis missing');
  const readsAfterRun = loadCount;
  const resultView = view.element.querySelector('select[aria-label="VE Analyzer result view"]');
  assert(resultView, 'Result View selector missing');

  // The app-level UI refinement reverses load rows. Distinct tune values prove
  // Result View maps by authoritative coordinates rather than rendered row order.
  const cells = [60, 70, 80, 90].map((value) => byCurrent(view.element, value));
  assert(cells.every(Boolean), 'Model-derived current VE metadata did not survive the reversed load-axis presentation');
  const [measured, weak, evidenceOnly, noEvidence] = cells;

  // Keep one genuine measured title from the analyzer, then exercise the other
  // presentation classes explicitly. Their current VE must still come from the
  // retained primary TuneEntry, not from whichever Result View was visible last.
  const genuineMeasured = [...view.element.querySelectorAll('[data-ve-analyzer="ve-table-view"] tbody td')]
    .find((cell) => cell.title.startsWith('Measured proposal'));
  assert(genuineMeasured, 'Fixture did not produce a measured proposal');
  measured.title = genuineMeasured.title;
  weak.title = 'Weak evidence only. Raw candidate 77 (+10.0%); no proposal is emitted. Robust median +10.0%; P10 +8.0%; P90 +12.0%; spread 4.0%; confidence limited; weight 3.500; samples 8.';
  evidenceOnly.title = 'Robust median +4.0%; P10 +2.0%; P90 +6.0%; spread 4.0%; confidence moderate; weight 2.000; samples 5.';
  noEvidence.title = '';

  const bases = new Map(cells.map((cell) => [cell, baseLevel(cell)]));
  const cycle = ['proposal', 'change', 'change-percent', 'mixture-error', 'samples', 'weight', 'confidence', 'spread', 'delay', 'proposal'];

  for (let repetition = 0; repetition < 2; repetition += 1) {
    for (const value of cycle) {
      resultView.value = value;
      resultView.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();

      assert(view.getPrimaryAnalysis() === primary, `${value} replaced primary-analysis identity`);
      assert(loadCount === readsAfterRun, `${value} triggered additional trace loading`);

      if (value === 'delay') {
        for (const cell of cells) assert(text(cell) === '100', 'A valid interpolated Lambda Delay was replaced by base VE fallback');
        continue;
      }

      if (value === 'proposal') {
        assert(text(weak) === '70', 'Weak cell did not fall back to original VE in Proposed VE view');
        assert(text(evidenceOnly) === '80', 'Evidence-only cell did not fall back to original VE in Proposed VE view');
        assert(text(noEvidence) === '90', 'No-evidence cell did not fall back to original VE in Proposed VE view');
      }
      if (value === 'samples') {
        assert(text(weak) === '8', 'Weak-cell Samples metric was not retained');
        assert(text(evidenceOnly) === '5', 'Evidence-only Samples metric was not retained');
        assert(text(noEvidence) === '90', 'No-evidence Samples fallback lost original VE');
        assert(noEvidence.style.getPropertyValue('--ve-cell-level') === '0.5', 'No-evidence Samples fallback lost neutral heat level');
      }
      if (value === 'confidence') {
        assert(text(weak) === 'Limited', 'Weak-cell Confidence metric was not retained');
        assert(text(evidenceOnly) === 'Moderate', 'Evidence-only Confidence metric was not retained');
        assert(text(noEvidence) === '90', 'No-evidence Confidence fallback lost original VE');
      }
      if (value === 'change') {
        assert(text(weak) === '+7', 'Weak-cell VE change was not calculated from original VE 70');
        assert(text(evidenceOnly) === '80', 'Evidence-only VE-change fallback lost original VE');
        assert(text(noEvidence) === '90', 'No-evidence VE-change fallback lost original VE');
      }
      if (value === 'mixture-error') {
        assert(text(weak) === '+10%', 'Weak-cell mixture metric was not retained');
        assert(text(evidenceOnly) === '+4%', 'Evidence-only mixture metric was not retained');
        assert(text(noEvidence) === '90', 'No-evidence mixture fallback lost original VE');
      }

      for (const cell of cells) {
        const isBase = cell === noEvidence
          || (cell === evidenceOnly && (value === 'change' || value === 'change-percent'))
          || (cell === weak && value === 'proposal');
        if (isBase) {
          const expected = value === 'proposal' ? bases.get(cell) : '0.5';
          assert(cell.style.getPropertyValue('--ve-cell-level') === expected, `${value} did not restore ${value === 'proposal' ? 'base' : 'neutral fallback'} heat level`);
        }
      }
    }
  }

  shell.remove();
  return {
    passed: 1,
    checks: ['full-stack Result View keeps source-authoritative VE values, proposal/neutral fallback heat and real delay metrics through repeated cycles'],
  };
}
