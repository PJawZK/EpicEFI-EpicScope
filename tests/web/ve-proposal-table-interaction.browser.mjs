import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';

const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const model = () => normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="3">1000 2000 3000</constant>
<constant name="veLoadBins" rows="3" cols="1">50 100 150</constant>
<constant name="afrRpmBins" rows="1" cols="3">1000 2000 3000</constant>
<constant name="afrLoadBins" rows="3" cols="1">50 100 150</constant>
<constant name="veTable" rows="3" cols="3" units="%">10 20 30 40 50 60 70 80 90</constant>
<constant name="afrTable" rows="3" cols="3" units="AFR">14 14 14 14 14 14 14 14 14</constant>
</page></msq>`));

function pointer(target, type, options = {}) {
  target.dispatchEvent(new PointerEvent(type, {
    pointerId: 71, pointerType: 'mouse', bubbles: true, cancelable: true, ...options,
  }));
}

function selectCell(cell, options = {}) {
  cell.setPointerCapture = () => {};
  pointer(cell, 'pointerdown', options);
  pointer(cell, 'pointerup', options);
}

function tool(root, title) {
  return [...root.querySelectorAll('.ve-proposal-shared-toolbar button')]
    .find((candidate) => !candidate.hidden && candidate.title.startsWith(title));
}

function cell(root, row, col) {
  return root.querySelector(`[data-ve-analyzer="ve-table-view"] td[data-ve-row="${row}"][data-ve-col="${col}"]`);
}

function selected(root) {
  return [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td[data-table-selected="true"]')];
}

function snapshot(root) {
  const owner = veProposalEditOwner(root);
  const value = owner?.snapshot();
  assert(value, 'VE Proposal semantic edit owner is unavailable');
  return value;
}

function valueAt(root, row, col) {
  const current = snapshot(root);
  return current.values[row * current.cols + col];
}

function directEdit(root, row, col, value) {
  const target = cell(root, row, col);
  assert(target, `Missing VE Proposal cell ${row},${col}`);
  selectCell(target);
  target.focus();
  target.dispatchEvent(new KeyboardEvent('keydown', { key: String(value)[0], bubbles: true, cancelable: true }));
  const input = root.querySelector('.ve-table-inline-input');
  assert(input, 'Direct numeric typing did not open VE Proposal inline editing');
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

export async function runVeProposalTableInteractionChecks() {
  const checks = [];
  localStorage.setItem('epicscope.veAnalyzer.resultView', 'proposal');
  localStorage.setItem('epicscope.veAnalyzer.tableLayout', 'single');

  const tune = model();
  const originalVe = [...tune.byName.get('veTable').numericValues];
  const view = createVeAnalyzerView();
  const host = document.createElement('section');
  host.className = 'analyzer-page';
  host.append(view.element);
  document.body.append(host);
  const root = view.element;
  root.hidden = false;

  try {
    view.setContext({
      source: { identity: {}, sampleCount: 0, revision: 0 },
      sourceTimeRange: { startMs: 0, endMs: 0 },
      channels: [], traces: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [],
      loadTraces: async () => [],
    });
    view.setTuneModel(tune, 'proposal-edit.msq');
    await settle();

    assert(root.querySelector('.ve-proposal-shared-toolbar'), 'VE Proposal shared edit toolbar missing');
    assert(snapshot(root).rows === 3 && snapshot(root).cols === 3, 'VE Proposal semantic surface geometry mismatch');
    checks.push('VE Proposal uses the shared semantic table-edit surface');

    const first = cell(root, 0, 0);
    assert(first, 'Initial VE Proposal cell missing');
    selectCell(first);
    await settle();
    assert(selected(root).length === 1 && selected(root)[0].dataset.veRow === '0' && selected(root)[0].dataset.veCol === '0', 'Normal VE click did not create one replace-selection');
    assert(!host.querySelector('.ve-cell-detail-popover') || host.querySelector('.ve-cell-detail-popover').hidden, 'Normal VE click unexpectedly opened Cell Evidence');
    const evidence = tool(root, 'Cell Evidence');
    assert(evidence, 'Explicit Cell Evidence action missing');
    evidence.click();
    await settle();
    const panel = host.querySelector('.ve-cell-detail-popover');
    assert(panel && !panel.hidden && panel.querySelector('.ve-evidence-detail-loading'), 'Explicit Cell Evidence action did not open the selected VE node');
    panel.querySelector('button[aria-label="Close cell detail"]')?.click();
    checks.push('normal VE click selects only; explicit Cell Evidence opens the inspector');

    const c00 = cell(root, 0, 0);
    selectCell(c00);
    c00.focus();
    const beforePreview = valueAt(root, 0, 0);
    c00.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true }));
    let input = root.querySelector('.ve-table-inline-input');
    assert(input?.value === '5', 'Direct typing did not start replacement without F2');
    input.value = '55';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    assert(valueAt(root, 0, 0) === beforePreview && input.value === '55', 'Live VE Proposal preview committed semantic authority early');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle();
    assert(valueAt(root, 0, 0) === 55, 'Direct VE Proposal replacement did not commit');
    checks.push('direct numeric typing previews without F2 and commits through the semantic review owner');

    let current00 = cell(root, 0, 0);
    selectCell(current00);
    current00.focus();
    current00.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true, cancelable: true }));
    input = root.querySelector('.ve-table-inline-input');
    assert(input, 'Commit-on-new-selection fixture failed to open inline edit');
    input.value = '66';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const next = cell(root, 0, 1);
    selectCell(next);
    await settle();
    assert(valueAt(root, 0, 0) === 66, 'Clicking a new cell did not commit the previous VE Proposal edit');
    const currentSelection = selected(root);
    assert(currentSelection.length === 1 && currentSelection[0].dataset.veRow === '0' && currentSelection[0].dataset.veCol === '1', 'New normal selection retained the previous VE selection');
    checks.push('new single selection commits the previous edit and replaces the old selection');

    selectCell(cell(root, 0, 0));
    cell(root, 0, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    await settle();
    assert(valueAt(root, 0, 0) === undefined, 'Delete did not clear VE Proposal working value to none');
    const revert = tool(root, 'Revert selected cells');
    assert(revert, 'VE Proposal Revert action missing');
    revert.click();
    await settle();
    assert(valueAt(root, 0, 0) === 10, 'VE Proposal Revert did not restore baseline value');
    checks.push('Delete clears to none and explicit Revert restores VE Proposal baseline');

    directEdit(root, 0, 0, 5);
    await settle();
    assert(cell(root, 0, 0).dataset.tableValueState === 'lower', 'Lower-than-baseline VE edit did not receive blue/lower memory state');
    directEdit(root, 0, 1, 25);
    await settle();
    assert(cell(root, 0, 1).dataset.tableValueState === 'higher', 'Higher-than-baseline VE edit did not receive red/higher memory state');
    assert(getComputedStyle(cell(root, 0, 0)).color !== getComputedStyle(cell(root, 0, 1)).color, 'MLV-style lower/higher VE text states are not visually distinct');
    checks.push('VE Proposal retains MLV-style lower/blue and higher/red baseline memory');

    selectCell(cell(root, 0, 0));
    const beforeIncrement = valueAt(root, 0, 0);
    const increment = tool(root, 'Increase selected cells');
    assert(increment, 'VE Proposal increment action missing');
    increment.click();
    await settle();
    assert(valueAt(root, 0, 0) > beforeIncrement, 'VE Proposal + tool did not change selected value');
    checks.push('VE Proposal +/- uses the shared numeric adjustment command');

    selectCell(cell(root, 0, 0));
    selectCell(cell(root, 2, 2), { shiftKey: true });
    await settle();
    assert(selected(root).length === 9, `Shift-click rectangle expected 9 VE cells, got ${selected(root).length}`);
    checks.push('VE Proposal Shift-click uses the shared anchored rectangular selection');

    const brushButton = tool(root, 'Continuous brush editing');
    assert(brushButton, 'VE Proposal Brush action missing');
    brushButton.click();
    await settle();
    assert(selected(root).length === 0, 'Activating VE Proposal Brush retained stale normal selection');
    pointer(cell(root, 1, 1), 'pointermove', { clientX: 10, clientY: 10 });
    const centerPreview = [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td[data-table-brush-preview="true"]')];
    assert(centerPreview.length > 0, 'VE Proposal Brush did not show a prospective affected-cell footprint');
    pointer(cell(root, 0, 0), 'pointermove', { clientX: 10, clientY: 10 });
    const cornerPreview = [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td[data-table-brush-preview="true"]')];
    assert(cornerPreview.length > 0 && cornerPreview.length < centerPreview.length && cell(root, 2, 2).dataset.tableBrushPreview !== 'true',
      'VE Proposal Brush hover footprint did not follow the pointer synchronously');
    pointer(cell(root, 1, 1), 'pointermove', { clientX: 10, clientY: 10 });
    const brushCenter = cell(root, 1, 1);
    const semanticBeforeBrush = valueAt(root, 1, 1);
    const textBeforeBrush = brushCenter.querySelector(':scope > span')?.textContent ?? brushCenter.textContent;
    const heatBeforeBrush = brushCenter.style.getPropertyValue('--ve-cell-level');
    brushCenter.setPointerCapture = () => {};
    pointer(brushCenter, 'pointerdown', { clientX: 10, clientY: 10 });
    await new Promise((resolve) => setTimeout(resolve, 125));
    const liveText = brushCenter.querySelector(':scope > span')?.textContent ?? brushCenter.textContent;
    const liveHeat = brushCenter.style.getPropertyValue('--ve-cell-level');
    assert(brushCenter.dataset.tableLivePreview === 'true' && liveText !== textBeforeBrush,
      'VE Proposal Brush did not render pending numeric values during the active stroke');
    assert(liveHeat !== heatBeforeBrush,
      'VE Proposal Brush did not update the cell heat/color with the pending numeric value');
    assert(valueAt(root, 1, 1) === semanticBeforeBrush,
      'VE Proposal Brush live preview committed semantic authority before pointer-up');
    pointer(document, 'pointerup', { clientX: 10, clientY: 10 });
    await settle();
    assert(valueAt(root, 1, 1) !== semanticBeforeBrush,
      'VE Proposal Brush did not commit the previewed value on pointer-up');
    brushButton.click();
    checks.push('VE Proposal Brush hover follows the pointer and live numeric/heat preview keeps one semantic commit per stroke');

    // Return to the baseline, create a sparse 3x3 surface, then exercise the
    // actual both-directions UI tool. This proves undefined interiors are valid
    // interpolation targets through the production VE Proposal adapter.
    const owner = veProposalEditOwner(root);
    assert(owner, 'VE Proposal owner missing for sparse interpolation fixture');
    owner.revert(Array.from({ length: 9 }, (_, index) => ({ row: Math.floor(index / 3), col: index % 3 })));
    owner.applyValues([1, 3, 4, 5, 7].map((index) => ({ row: Math.floor(index / 3), col: index % 3, value: undefined })));
    await settle();
    assert(valueAt(root, 1, 1) === undefined, 'Sparse interpolation fixture failed to clear the center');
    selectCell(cell(root, 0, 0));
    selectCell(cell(root, 2, 2), { shiftKey: true });
    const both = tool(root, 'Interpolate both directions');
    assert(both, 'Both-directions interpolation icon/action missing');
    assert(!both.textContent?.includes('2D'), 'Both-directions interpolation regressed to literal 2D text');
    both.click();
    await settle();
    const interpolated = snapshot(root).values;
    assert(interpolated.every((value) => value !== undefined && Number.isFinite(value)), 'Both-directions interpolation left sparse VE Proposal cells undefined');
    assert(Math.abs(valueAt(root, 1, 1) - 50) < 1e-9, `Unexpected bilinear VE center ${valueAt(root, 1, 1)}`);
    checks.push('VE Proposal both-directions interpolation fills sparse cells from valid anchors');

    const resultView = root.querySelector('select[aria-label="VE Analyzer result view"]');
    assert(resultView, 'VE Result View selector missing');
    resultView.value = 'change';
    resultView.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    assert(!tool(root, 'Increase selected cells') && tool(root, 'Cell Evidence'), 'Alternate Result View did not become read-only while retaining Cell Evidence');
    selectCell(cell(root, 1, 1));
    tool(root, 'Cell Evidence').click();
    await settle();
    assert(panel && !panel.hidden, 'Cell Evidence was unavailable on an alternate read-only Result View');
    resultView.value = 'proposal';
    resultView.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    checks.push('alternate Result Views are read-only metrics while Cell Evidence remains available');

    assert(JSON.stringify(tune.byName.get('veTable').numericValues) === JSON.stringify(originalVe), 'VE Proposal review edits mutated the source TuneModel/MSQ authority');
    checks.push('VE Proposal edits remain review state and never mutate source TuneModel authority');

    return { passed: checks.length, checks };
  } finally {
    host.remove();
  }
}