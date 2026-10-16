import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';

const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const model = () => normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="2">1000 2000</constant><constant name="veLoadBins" rows="2" cols="1">50 100</constant>
<constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant><constant name="afrLoadBins" rows="2" cols="1">50 100</constant>
<constant name="veTable" rows="2" cols="2" units="%">60 70 80 90</constant><constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant>
</page></msq>`));

const channels = [['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['pw', 'PW', 'ms']]
  .map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));

const traces = channels.map((channel, index) => ({ channel, complete: true, color: '#58aef6', range: {
  startSampleIndex: 0,
  timeMs: Float64Array.from({ length: 60 }, (_, i) => i * 100),
  values: Float64Array.from({ length: 60 }, (_, i) => index === 2 ? (i < 12 ? 15 : 14) : index === 3 ? (i < 10 ? 4 : 5) : [1000, 50][index]),
  validity: new Uint8Array(60).fill(1),
} }));

const saved = (value) => serializeVeDelayTable({
  rpmBins: [1000, 2000], loadBins: [50, 100], rows: 2, cols: 2, origin: 'saved-file',
  cells: Array.from({ length: 4 }, (_, index) => ({
    row: Math.floor(index / 2), col: index % 2, state: 'measured',
    workingMs: value, recommendedMs: value, workingProvenance: 'measured-recommendation',
    eventCount: 5, confidence: 'moderate', sourceEvents: [],
  })),
});

function pointer(target, type, options = {}) {
  target.dispatchEvent(new PointerEvent(type, {
    pointerId: 23, pointerType: 'mouse', bubbles: true, cancelable: true, ...options,
  }));
}

function selectCell(cell, additive = false) {
  cell.setPointerCapture = () => {};
  pointer(cell, 'pointerdown', { ctrlKey: additive });
  pointer(cell, 'pointerup', { ctrlKey: additive });
}

function button(root, title) {
  return [...root.querySelectorAll('.ve-delay-shared-toolbar button')].find((candidate) => candidate.title.startsWith(title));
}

function installDelayFile(input, value) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [{ name: `shared-delay-${value}.json`, text: async () => saved(value) }],
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function runVeSharedTableInteractionChecks() {
  const checks = [];
  const view = createVeAnalyzerView();
  const root = view.element;
  root.hidden = false;
  document.body.append(root);

  try {
    view.setContext({
      source: { identity: {}, sampleCount: 60, revision: 0 }, channels, traces: [], aTimeMs: 0, bTimeMs: 3000, savedRanges: [],
      loadTraces: async (ids) => traces.filter((trace) => ids.includes(trace.channel.id)),
    });
    view.setTuneModel(model(), 'shared-table.msq');
    for (const [role, id] of [['rpm', 'rpm'], ['load', 'map'], ['actual', 'afr'], ['fuelCommand', 'pw']]) {
      const control = root.querySelector(`select[data-role="${role}"]`);
      control.value = id;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const fileInput = root.querySelector('[data-ve-analyzer="load-delay-file"]');
    installDelayFile(fileInput, 100);
    await settle();

    const cells = () => [...root.querySelectorAll('[data-ve-analyzer="delay-table"] td[data-delay-row]')];
    const values = () => cells().map((cell) => Number(cell.dataset.delayValue));
    const toolbar = root.querySelector('.ve-delay-shared-toolbar');
    assert(toolbar, 'Shared Lambda Delay toolbar missing');
    assert(root.querySelector('[data-ve-analyzer="delay-table"]').dataset.tableInteractionOwner === 'shared', 'Shared owner marker missing');
    checks.push('shared owner and toolbar are active');

    const initial = view.sessionRevision;
    selectCell(cells()[0]);
    selectCell(cells()[1], true);
    assert(cells().slice(0, 2).every((cell) => cell.dataset.tableSelected === 'true' && cell.dataset.delaySelected === 'true'), 'Shared selection did not decorate compatibility and v50 state');
    button(root, 'Increase selected cells').click();
    await settle();
    assert(values()[0] === 110 && values()[1] === 110 && view.sessionRevision === initial + 1, 'Shared +/- edit did not publish one semantic change');
    checks.push('additive selection and +/- use one semantic owner transaction');

    button(root, 'Undo').click(); await settle();
    assert(values()[0] === 100 && values()[1] === 100, 'Undo did not restore owner values');
    button(root, 'Redo').click(); await settle();
    assert(values()[0] === 110 && values()[1] === 110, 'Redo did not restore shared edit');
    checks.push('shared owner-backed undo/redo works');

    selectCell(cells()[0]);
    button(root, 'Pin').click();
    assert(cells()[0].dataset.tablePinned === 'true', 'Pin state was not presented');
    const pinnedBefore = values()[0];
    selectCell(cells()[0]);
    selectCell(cells()[1], true);
    button(root, 'Decrease selected cells').click(); await settle();
    assert(values()[0] === pinnedBefore && values()[1] === 100, 'Pinned cell was changed by destructive bulk adjustment');
    checks.push('pins remain session-local and protect bulk edits');

    selectCell(cells()[0]);
    const inlineRevision = view.sessionRevision;
    cells()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
    const input = root.querySelector('.ve-table-inline-input.ve-delay-inline-input');
    assert(input && input.value === String(values()[0]), 'F2 did not open with owner-backed current value');
    input.value = '135';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle();
    assert(values()[0] === 135 && view.sessionRevision === inlineRevision + 1, 'Direct edit did not commit through Lambda owner');
    checks.push('direct edit reads and writes semantic owner values');

    button(root, 'Revert selected cells').click(); await settle();
    assert(values()[0] === 100, 'Revert did not restore retained recommendation');
    checks.push('semantic Revert preserves recommendation authority');

    selectCell(cells()[0]);
    cells()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
    const staleInput = root.querySelector('.ve-table-inline-input.ve-delay-inline-input');
    assert(staleInput, 'Lifecycle cancellation fixture did not open an inline edit');
    staleInput.value = '999';
    installDelayFile(fileInput, 180);
    await settle();
    assert(!root.querySelector('.ve-table-inline-input') && values().every((value) => value === 180), 'Replacing delay authority committed a stale inline edit');
    checks.push('delay authority replacement cancels active inline editing instead of committing it');

    selectCell(cells()[0]);
    const c1 = cells()[1];
    const c3 = cells()[3];
    c1.setPointerCapture = () => {};
    const end = c3.getBoundingClientRect();
    pointer(c1, 'pointerdown', { ctrlKey: true });
    pointer(document, 'pointermove', { ctrlKey: true, clientX: end.left + end.width / 2, clientY: end.top + end.height / 2 });
    pointer(document, 'pointerup', { ctrlKey: true, clientX: end.left + end.width / 2, clientY: end.top + end.height / 2 });
    const selectedCount = cells().filter((cell) => cell.dataset.tableSelected === 'true').length;
    assert(selectedCount === 3, `Ctrl-drag used stale selection anchor; expected 3 selected cells, got ${selectedCount}`);
    checks.push('Ctrl/Cmd drag starts from the newly clicked cell while preserving additive selection');

    selectCell(cells()[2]);
    const brushButton = button(root, 'Continuous brush editing');
    brushButton.click();
    assert(brushButton.getAttribute('aria-pressed') === 'true', 'Brush mode did not activate');
    const beforeBrush = values()[2];
    const brushRevision = view.sessionRevision;
    cells()[2].setPointerCapture = () => {};
    pointer(cells()[2], 'pointerdown');
    await new Promise((resolve) => setTimeout(resolve, 210));
    pointer(document, 'pointerup');
    await settle();
    assert(values()[2] > beforeBrush && view.sessionRevision === brushRevision + 1, 'Held Brush did not accumulate and commit once');
    checks.push('held Brush accumulates while one stroke publishes one semantic revision');

    return checks;
  } finally {
    root.remove();
  }
}
