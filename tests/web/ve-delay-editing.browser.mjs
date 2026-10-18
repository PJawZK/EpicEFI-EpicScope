import { installVeAnalyzerUiRefinements } from '../../apps/web/src/app/ve-analyzer-ui-refinements';
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';

const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise((resolve) => setTimeout(resolve, 0)); await new Promise((resolve) => setTimeout(resolve, 0)); };
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
const model = () => normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="2">1000 2000</constant><constant name="veLoadBins" rows="2" cols="1">50 100</constant>
<constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant><constant name="afrLoadBins" rows="2" cols="1">50 100</constant>
<constant name="veTable" rows="2" cols="2" units="%">60 70 80 90</constant><constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant>
</page></msq>`));
const channels = [['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['pw', 'PW', 'ms']]
  .map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));
const traces = channels.map((channel, index) => ({ channel, complete: true, color: '#58aef6', range: {
  startSampleIndex: 0, timeMs: Float64Array.from({ length: 60 }, (_, i) => i * 100),
  values: Float64Array.from({ length: 60 }, (_, i) => index === 2 ? (i < 12 ? 15 : 14) : index === 3 ? (i < 10 ? 4 : 5) : [1000, 50][index]),
  validity: new Uint8Array(60).fill(1),
} }));
const positions = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }];
const saved = (value, size = 2) => serializeVeDelayTable({
  rpmBins: Array.from({ length: size }, (_, i) => 1000 * (i + 1)), loadBins: Array.from({ length: size }, (_, i) => 50 * (i + 1)), rows: size, cols: size, origin: 'saved-file',
  cells: Array.from({ length: size * size }, (_, index) => ({ row: Math.floor(index / size), col: index % size, state: 'measured', workingMs: value, recommendedMs: value,
    workingProvenance: 'measured-recommendation', eventCount: 5, confidence: 'moderate', sourceEvents: [] })),
});

async function setup() {
  let gate;
  let reads = 0;
  const view = createVeAnalyzerView();
  const shell = document.createElement('section');
  const domain = document.createElement('select'); domain.className = 'analyzer-header-view-select';
  domain.append(new Option('VE Analyzer', 've')); domain.value = 've';
  const host = document.createElement('section');
  host.className = 'analyzer-page';
  host.append(view.element); shell.append(domain, host); document.body.append(shell);
  installVeAnalyzerUiRefinements(shell);
  const root = view.element; root.hidden = false;
  const context = { source: { identity: {}, sampleCount: 60, revision: 0 }, channels, traces: [], aTimeMs: 0, bTimeMs: 3000, savedRanges: [],
    loadTraces: async (ids) => { reads += 1; return gate ? gate.promise : traces.filter((trace) => ids.includes(trace.channel.id)); },
  };
  view.setContext(context); view.setTuneModel(model(), 'delay-edit.msq');
  for (const [role, id] of [['rpm', 'rpm'], ['load', 'map'], ['actual', 'afr'], ['fuelCommand', 'pw']]) {
    const control = root.querySelector(`select[data-role="${role}"]`);
    control.value = id; control.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const load = (read) => {
    const input = root.querySelector('[data-ve-analyzer="load-delay-file"]');
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'fixture-delay.json', text: read }] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  load(async () => saved(100)); await settle();
  const lambdaTrigger = root.querySelector('.ve-v50-lambda-tool-trigger');
  lambdaTrigger?.click(); await settle();
  const delayHost = root.querySelector('[data-ve-analyzer="delay-table"]');
  const lambdaDetails = delayHost?.closest('details');
  const lambdaPanel = lambdaDetails?.closest('.ve-v50-tool-surface');
  assert(lambdaTrigger && lambdaDetails?.open && lambdaPanel && !lambdaPanel.hidden, 'Lambda Delay tool did not open for editing fixture');
  const counts = { delay: 0, ve: 0, target: 0 };
  const undo = [];
  // Local fixture-host spies count actual DOM commits, never global DOM methods.
  for (const [key, element] of [['delay', delayHost], ['ve', root.querySelector('[data-ve-analyzer="ve-table-view"]')], ['target', root.querySelector('[data-ve-analyzer="target-table-view"]')]]) {
    const original = element.replaceChildren;
    element.replaceChildren = function (...children) { counts[key] += 1; return original.apply(this, children); };
    undo.push(() => { delete element.replaceChildren; });
  }
  const cells = () => [...delayHost.querySelectorAll('td[data-delay-row]')];
  const resetCounts = () => { for (const key of Object.keys(counts)) counts[key] = 0; };
  return { view, host, root, cells, counts, resetCounts, load, reads: () => reads,
    hold: () => (gate = deferred()), release: () => { gate = undefined; },
    dispose: () => { undo.forEach((restore) => restore()); shell.remove(); },
  };
}
function key(target, value) { target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
function rectangle(s, pointerType = 'mouse', last = Math.min(3, s.cells().length - 1)) {
  const start = s.cells()[0], end = s.cells()[last];
  start.scrollIntoView({ block: 'center' });
  const a = start.getBoundingClientRect(), b = end.getBoundingClientRect();
  // Synthetic fixture pointers have no native active-pointer registration.
  start.setPointerCapture = () => {};
  start.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType, bubbles: true, cancelable: true, clientX: a.x + a.width / 2, clientY: a.y + a.height / 2 }));
  if (last) s.root.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, pointerType, bubbles: true, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 }));
  s.root.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType, bubbles: true, cancelable: true }));
}
function type(s, text, finish = 'Enter') {
  key(s.cells()[0], 'F2');
  const input = s.root.querySelector('.ve-delay-inline-input');
  assert(input, 'Inline input not opened');
  input.value = text; input.dispatchEvent(new Event('input', { bubbles: true }));
  if (finish === 'blur') input.blur(); else key(input, finish);
}
const values = (s) => s.cells().map((cell) => cell.dataset.delayValue ?? '');
const all = (s, value) => values(s).every((actual) => actual === String(value));

export async function runVeDelayEditingChecks() {
  const checks = [];
  const s = await setup();
  try {
    const clickCell = (cell, shiftKey = false) => {
      cell.setPointerCapture = () => {};
      cell.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 19, pointerType: 'mouse', bubbles: true, cancelable: true, shiftKey }));
      cell.dispatchEvent(new PointerEvent('pointerup', { pointerId: 19, pointerType: 'mouse', bubbles: true, cancelable: true, shiftKey }));
    };
    clickCell(s.cells()[0], true); await settle();
    assert(s.cells().filter(c => c.dataset.delaySelected === 'true').length === 1, 'Shift-click without an anchor must select one cell');
    clickCell(s.cells()[3], true); await settle();
    assert(s.cells().every(c => c.dataset.delaySelected === 'true'), 'Shift-click failed to select the anchored rectangle');
    clickCell(s.cells()[1], true); await settle();
    assert(s.cells().filter(c => c.dataset.delaySelected === 'true').length === 2, 'Shift-click moved the original selection anchor');
    clickCell(s.cells()[3], true); await settle();
    const shiftRevision = s.view.sessionRevision, shiftReads = s.reads(); s.resetCounts();
    key(s.cells()[0], '1');
    const shiftInput = s.root.querySelector('.ve-delay-inline-input');
    assert(shiftInput?.value === '1', 'Typing did not directly start range replacement');
    shiftInput.value = '125'; shiftInput.dispatchEvent(new Event('input', { bubbles: true })); await settle();
    assert(s.cells().every(c => (c.querySelector('input')?.value ?? c.textContent) === '125') && all(s, 100) && s.view.sessionRevision === shiftRevision, 'Live range preview changed authority early or skipped cells');
    key(shiftInput, 'Enter'); await settle();
    assert(all(s, 125) && s.view.sessionRevision === shiftRevision + 1 && s.counts.delay === 1 && s.counts.ve === 1 && s.counts.target === 1 && s.reads() === shiftReads, 'Shift-selected numeric replacement did not commit once without trace reads');
    checks.push('Shift-click preserves the anchor, previews numeric replacement across the range and commits once without F2');
    s.view.editDelayCells(positions, { kind: 'set', workingMs: 100 }); await settle();
    rectangle(s); await settle();
    const before = s.view.sessionRevision, reads = s.reads(); s.resetCounts();
    type(s, '175'); await settle();
    const observed = { revisionDelta: s.view.sessionRevision - before, values: values(s), selected: s.cells().filter(c=>c.dataset.delaySelected==='true').length, ...s.counts };
    console.info('delay-edit-counts: ' + JSON.stringify(observed));
    assert(all(s, 175) && observed.revisionDelta === 1 && observed.delay === 1 && observed.ve === 1 && observed.target === 1,
      'Range edit must commit/invalidate/render once: ' + JSON.stringify(observed));
    assert(s.reads() === reads && s.cells().every((cell) => cell.dataset.delaySelected === 'true'), 'Edit loaded traces or lost selection');
    checks.push('four-cell inline edit commits once with one revision and one render per table, no trace load');

    s.resetCounts(); const stable = s.view.sessionRevision;
    type(s, '175'); await settle();
    assert(s.view.sessionRevision === stable && s.counts.delay === 0 && all(s, 175), 'Unchanged edit invalidated or rendered');
    checks.push('unchanged inline edit retains session and table DOM');

    key(s.cells()[0], 'Delete'); await settle();
    assert(all(s, '') && s.view.sessionRevision === stable + 1 && s.cells().every((cell) => cell.dataset.delayRecommended === '100' && cell.dataset.delayProvenance === 'user-edited'), 'Delete did not clear the selected working values in one operation');
    const revertAfterDelete = [...s.root.querySelectorAll('.ve-delay-shared-toolbar button')].find((candidate) => candidate.title.startsWith('Revert selected cells'));
    assert(revertAfterDelete, 'Revert tool missing after Delete');
    revertAfterDelete.click(); await settle();
    assert(all(s, 100) && s.cells().every((cell) => cell.dataset.delayProvenance === 'measured-recommendation'), 'Explicit Revert did not restore retained recommendations');
    checks.push('Delete clears working values; explicit Revert restores retained recommendation/provenance');

    const cancelRevision = s.view.sessionRevision;
    type(s, '999', 'Escape'); await settle();
    assert(all(s, 100) && s.view.sessionRevision === cancelRevision && !s.root.querySelector('[data-delay-editing="true"]'), 'Escape changed authority or left editing state');
    assert(document.activeElement?.dataset.delayAnchor === 'true', 'Anchor focus not restored');
    checks.push('preview/Escape restores values, selection and anchor focus without invalidation');

    type(s, ''); await settle();
    assert(all(s, '') && s.cells().every((cell) => cell.dataset.delayRecommended === '100' && cell.dataset.delayProvenance === 'user-edited'), 'Blank edit erased recommendation evidence');
    const blankRevision = s.view.sessionRevision;
    key(s.cells()[0], 'Delete'); await settle();
    assert(all(s, '') && s.view.sessionRevision === blankRevision, 'Delete changed an already empty working selection');
    const revertBlank = [...s.root.querySelectorAll('.ve-delay-shared-toolbar button')].find((candidate) => candidate.title.startsWith('Revert selected cells'));
    assert(revertBlank, 'Revert tool missing for explicitly cleared values');
    revertBlank.click(); await settle();
    assert(all(s, 100), 'Explicit Revert did not restore retained evidence after a blank edit');
    checks.push('blank commit and Delete preserve none; explicit Revert restores retained evidence');

    const invalidRevision = s.view.sessionRevision;
    for (const invalid of ['-2', 'bad', 'Infinity']) type(s, invalid);
    await settle(); assert(all(s, 100) && s.view.sessionRevision === invalidRevision, 'Invalid entry mutated authority');
    type(s, '180', 'blur'); await settle();
    assert(all(s, 180) && s.view.sessionRevision === invalidRevision + 1, 'Blur did not commit once');
    key(s.cells()[0], 'Backspace'); key(s.root.querySelector('.ve-delay-inline-input'), 'Enter'); await settle();
    assert(all(s, 18), 'Backspace editing changed');
    key(s.cells()[0], '2'); const decimal = s.root.querySelector('.ve-delay-inline-input');
    assert(decimal?.value === '2', 'Digit did not start replacement edit');
    decimal.value = '25.5'; decimal.dispatchEvent(new Event('input', { bubbles: true })); key(decimal, 'Enter'); await settle();
    assert(all(s, 25.5), 'Decimal working value not retained');
    checks.push('invalid entries are non-destructive; blur, Backspace and digit/decimal editing remain usable');

    rectangle(s, 'touch', 0); assert(s.root.querySelector('.ve-delay-inline-input'), 'Touch tap did not open editor');
    key(s.root.querySelector('.ve-delay-inline-input'), 'Escape'); await settle();
    assert(values(s)[0] === '25.5', 'Touch cancellation mutated authority');
    checks.push('touch tap opens existing value and cancellation remains non-destructive');

    const snapshot = values(s).join(','), revision = s.view.sessionRevision;
    let rejected = false;
    try { s.view.editDelayCells([{ row: 0, col: 0 }, { row: 20, col: 0 }], { kind: 'set', workingMs: 222 }); } catch { rejected = true; }
    assert(rejected && values(s).join(',') === snapshot && s.view.sessionRevision === revision, 'Invalid command partially committed');
    assert(!s.view.editDelayCells([], { kind: 'revert' }), 'Empty command reported a change');
    s.view.setActive(false);
    assert(!s.view.editDelayCells(positions, { kind: 'set', workingMs: 333 }) && values(s).join(',') === snapshot, 'Hidden owner accepted an edit');
    s.view.setActive(true); await settle();
    checks.push('owner rejects invalid/empty/inactive commands without partial publication');

    s.view.editDelayCells(positions, { kind: 'set', workingMs: 100 });
    s.root.querySelector('.ve-workbench-run').click();
    for (let i = 0; !s.view.getPrimaryAnalysis() && i < 1000; i++) await settle();
    const primary = s.view.getPrimaryAnalysis(); assert(primary, 'Primary run did not finish');
    let withdrawals = 0; const unsubscribe = s.view.onPrimaryAnalysisChange(() => { withdrawals += 1; });
    assert(!s.view.editDelayCells(positions, { kind: 'set', workingMs: 100 }) && s.view.getPrimaryAnalysis() === primary, 'No-op withdrew primary authority');
    const measured = [...s.root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find((cell) => cell.title.startsWith('Measured proposal'));
    assert(measured, 'Expected measured evidence cell');
    measured.setPointerCapture = () => {};
    measured.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 31, pointerType: 'mouse', bubbles: true, cancelable: true }));
    measured.dispatchEvent(new PointerEvent('pointerup', { pointerId: 31, pointerType: 'mouse', bubbles: true, cancelable: true }));
    assert(s.host.querySelector('.ve-cell-detail-popover').hidden, 'Normal VE selection unexpectedly opened Cell Evidence');
    const evidenceButton = [...s.root.querySelectorAll('.ve-proposal-shared-toolbar button')].find((candidate) => candidate.title === 'Cell Evidence');
    assert(evidenceButton, 'Cell Evidence tool missing from VE Proposal toolbar');
    evidenceButton.click(); await settle();
    assert(!s.host.querySelector('.ve-cell-detail-popover').hidden, 'Explicit Cell Evidence tool did not open retained evidence');
    s.view.editDelayCells(positions, { kind: 'set', workingMs: 145 }); await settle();
    assert(withdrawals === 1 && !s.view.getPrimaryAnalysis() && s.host.querySelector('.ve-cell-detail-popover').hidden, 'Batch did not withdraw evidence/proposal once');
    unsubscribe(); checks.push('no-op retains primary evidence; real batch withdraws primary and popup once');

    const resultView = s.root.querySelector('select[aria-label="VE Analyzer result view"]');
    const presentationReads = s.reads(), presentationRevision = s.view.sessionRevision;
    for (const option of resultView.options) {
      resultView.value = option.value; resultView.dispatchEvent(new Event('change', { bubbles: true })); await settle();
      for (const cell of s.root.querySelectorAll('[data-ve-analyzer="ve-table-view"] tbody td')) {
        const text = cell.querySelector(':scope > span').textContent;
        if (option.value === 'delay') assert(text === '145', 'Delay Result View missed batch values');
        else {
          assert(Number(text) === Number(cell.dataset.veCurrentValue), 'Fallback Result View lost source VE after edit');
          assert(cell.style.getPropertyValue('--ve-cell-level') === cell.dataset.veBaseLevel, 'Fallback heat differs from original VE heat');
        }
      }
    }
    assert(s.reads() === presentationReads && s.view.sessionRevision === presentationRevision, 'Result Views recalculated edited session');
    resultView.value = 'proposal'; resultView.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    checks.push('post-edit Result Views preserve source VE, source fallback heat and working delays without calculation');

    const pending = deferred(); s.load(() => pending.promise); await settle();
    s.view.editDelayCells(positions, { kind: 'set', workingMs: 160 });
    pending.resolve(saved(999)); await settle(); assert(all(s, 160), 'Old file completion overwrote edit');
    const gate = s.hold(); s.root.querySelector('.ve-workbench-run').click(); await settle();
    s.view.editDelayCells(positions, { kind: 'set', workingMs: 170 });
    gate.resolve(traces); s.release(); await settle();
    assert(all(s, 170) && !s.view.getPrimaryAnalysis(), 'Old analysis completed into edited session');
    checks.push('batch advances existing generations against pending file reads and analysis');

    const minEvents = s.root.querySelector('input[data-role="delay-min-events"]'); minEvents.value = '1'; minEvents.dispatchEvent(new Event('change', { bubbles: true }));
    s.root.querySelector('[data-ve-analyzer="grab-delay"]').click();
    for (let i = 0; i < 1000 && !values(s).includes('200'); i++) await settle();
    assert(values(s).includes('200') && s.root.querySelector('[data-ve-analyzer="delay-table"]').dataset.mode === 'working' && !values(s).includes('170'), 'Re-grab did not activate fresh recommendation: '+JSON.stringify(values(s))+' '+s.root.querySelector('[data-ve-analyzer="delay-result-title"]').textContent);
    checks.push('re-grab still replaces existing working edits with fresh log-derived recommendation');

    rectangle(s); key(s.cells()[0], 'F2'); const oldInput = s.root.querySelector('.ve-delay-inline-input');
    oldInput.value = '777'; oldInput.dispatchEvent(new Event('input', { bubbles: true }));
    s.view.setTuneModel(model(), 'replacement.msq');
    oldInput.blur(); s.load(async () => saved(250)); await settle();
    assert(all(s, 250) && !s.root.querySelector('.ve-delay-inline-input'), 'Stale preview committed into replacement tune');
    rectangle(s); key(s.cells()[0], 'F2'); s.root.querySelector('.ve-delay-inline-input').value = '888';
    s.view.setActive(false); s.view.setActive(true); await settle();
    assert(all(s, 250) && !s.root.querySelector('.ve-delay-inline-input'), 'Navigation committed unsaved preview');
    checks.push('replacement/navigation cancel unsaved inline edits without contaminating the next session');

    s.view.setTuneModel(model(), 'recommendation-only.msq');
    s.root.querySelector('[data-ve-analyzer="grab-delay"]').click();
    for (let i = 0; i < 1000 && s.root.querySelector('[data-ve-analyzer="use-delay"]').disabled; i++) await settle();
    assert(s.root.querySelector('[data-ve-analyzer="delay-table"]').dataset.mode === 'recommendation', 'Initial discovery auto-activated');
    const recommendationCells = s.cells().map((cell) => ({ row: Number(cell.dataset.delayRow), col: Number(cell.dataset.delayCol) }));
    const rawRecommendations = s.cells().map((cell) => cell.dataset.delayRecommended);
    s.view.editDelayCells(recommendationCells, { kind: 'set', workingMs: 333 });
    assert(s.root.querySelector('[data-ve-analyzer="save-delay"]').disabled, 'Review edit silently promoted recommendation');
    const useOutside = s.root.querySelector('.ve-v50-run-chips .ve-v50-use-delay');
    const grabOutside = s.root.querySelector('.ve-v50-run-chips .ve-v50-grab-delay');
    assert(useOutside && grabOutside && !useOutside.hidden && !useOutside.disabled,
      'Recommended Lambda delay cannot be activated from main bar');
    assert(useOutside.previousElementSibling === grabOutside, 'Use recommendation is not after Grab lambda delays');
    useOutside.click(); await settle();
    assert(all(s, 333) && s.cells().every((cell, index) => cell.dataset.delayRecommended === rawRecommendations[index]), 'Use recommendation lost reviewed edits/raw evidence');
    assert(useOutside.hidden, 'Use recommendation stayed visible after activating a working delay table');
    checks.push('recommendation-only edits stay separate and survive explicit activation with raw evidence');

    s.load(async () => saved(100, 16)); await settle();
    const large = s.cells().map((cell) => ({ row: Number(cell.dataset.delayRow), col: Number(cell.dataset.delayCol) }));
    const largeRevision = s.view.sessionRevision, largeReads = s.reads(); s.resetCounts();
    s.view.editDelayCells(large, { kind: 'set', workingMs: 500 }); await settle();
    assert(large.length === 256 && all(s, 500) && s.view.sessionRevision === largeRevision + 1 && s.counts.delay === 1 && s.counts.ve === 1 && s.counts.target === 1 && s.reads() === largeReads, 'Large selection repeated invalidation/render/read work');
    checks.push('256-cell owner command still invalidates/renders once without full-log work');

    return { passed: checks.length, checks, observed };
  } finally { s.dispose(); }
}

let native;
export async function prepareNativeDelayEdit() {
  native = await setup();
  native.cells()[0].scrollIntoView({ block: 'center' }); await settle(); native.resetCounts();
  native.before = native.view.sessionRevision;
  return [native.cells()[0], native.cells()[3]].map((cell) => { const r = cell.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
}
export async function finishNativeDelayEdit() {
  await settle();
  try {
    assert(all(native, 175) && native.view.sessionRevision === native.before + 1 && native.counts.delay === 1, 'Native pointer/keyboard range edit failed');
    return { values: values(native), revisionDelta: native.view.sessionRevision - native.before, renders: native.counts };
  } finally { native.dispose(); native = undefined; }
}

export async function readNativeDelayPreview() {
  await settle();
  const cells = native.cells();
  assert(cells.every(cell => (cell.querySelector('input')?.value ?? cell.textContent) === '175'), 'Native Shift range did not preview all cell values');
  assert(all(native, 100) && native.view.sessionRevision === native.before, 'Native preview changed delay authority before commit');
  return { selected: cells.filter(cell => cell.dataset.delaySelected === 'true').length, authorityUnchanged: true };
}