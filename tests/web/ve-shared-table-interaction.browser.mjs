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
    let openedRange;
    view.setContext({
      source: { identity: {}, sampleCount: 60, revision: 0 }, sourceTimeRange: { startMs: 0, endMs: 5900 },
      channels, traces: [], aTimeMs: 0, bTimeMs: 3000, savedRanges: [],
      loadTraces: async (ids) => traces.filter((trace) => ids.includes(trace.channel.id)),
      openRangeInLogger: (request) => { openedRange = request; },
    });
    view.setTuneModel(model(), 'shared-table.msq');
    for (const [role, id] of [['rpm', 'rpm'], ['load', 'map'], ['actual', 'afr'], ['fuelCommand', 'pw']]) {
      const control = root.querySelector(`select[data-role="${role}"]`);
      control.value = id;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const layoutSelect = root.querySelector('select[aria-label="VE Analyzer table view"]');
    assert(layoutSelect, 'VE table layout select missing');
    layoutSelect.value = 'single';
    layoutSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const targetFlip = root.querySelector('.ve-v50-table-flip');
    assert(targetFlip, 'Target navigation button missing');
    targetFlip.click(); await settle();
    const targetPanel = root.querySelector('[data-ve-analyzer="target-table-view"]')?.closest('.ve-workbench-panel');
    const targetActions = targetPanel?.querySelector('.ve-v50-table-actions');
    assert(targetActions && !targetPanel.hidden && targetActions.querySelector('.ve-v50-target-host select[data-role="target-table"]')
      && targetActions.querySelector('button[aria-label="Toggle VE and Target split view"]')
      && targetActions.querySelector('.ve-v50-table-flip'),
      `Target view lost its non-edit header actions: ${JSON.stringify({ targetHidden: targetPanel?.hidden, layout: layoutSelect.value, targetTabSelected: root.querySelector('[data-table-tab="target"]')?.getAttribute('aria-selected'), tabCount: root.querySelectorAll('[data-table-tab]').length, actionsParent: root.querySelector('.ve-v50-table-actions')?.parentElement?.outerHTML.slice(0,350), targetHeader: targetPanel?.querySelector(':scope > header')?.outerHTML.slice(0,450), switchText: root.querySelector('.ve-v50-table-flip')?.textContent })}`);
    assert(!targetPanel.querySelector('.ve-target-shared-toolbar'),
      'Target unexpectedly received the VE-style edit toolbar');
    targetActions.querySelector('.ve-v50-table-flip').click(); await settle();
    assert(!root.querySelector('[data-ve-analyzer="ve-table-view"]').closest('.ve-workbench-panel').hidden,
      'Returning to VE did not restore VE table');
    const splitToggle = root.querySelector('.ve-v50-table-actions button[aria-label="Toggle VE and Target split view"]');
    splitToggle.click(); await settle();
    assert(layoutSelect.value === 'side-by-side', 'Split toggle failed to activate side-by-side mode');
    assert(targetPanel.querySelector(':scope > header .ve-v50-table-actions')
      && targetPanel.querySelector(':scope > header .ve-v50-target-host')
      && targetPanel.querySelector(':scope > header button[aria-label="Cell Evidence"]'),
      'Split mode does not keep Target, mode and Evidence controls in Target header');
    splitToggle.click(); await settle();
    assert(layoutSelect.value === 'single', 'Split toggle failed to return to single mode');
    checks.push('Target preserves dropdown, split and return actions without a duplicate edit toolbar');

    const fileInput = root.querySelector('[data-ve-analyzer="load-delay-file"]');
    installDelayFile(fileInput, 100);
    await settle();
    const lambdaTrigger = root.querySelector('.ve-v50-lambda-tool-trigger');
    lambdaTrigger?.click();
    await settle();
    const lambdaDetails = root.querySelector('[data-ve-analyzer="delay-table"]')?.closest('details');
    const lambdaPanel = lambdaDetails?.closest('.ve-v50-tool-surface');
    assert(lambdaTrigger && lambdaDetails?.open && lambdaPanel && !lambdaPanel.hidden,
      'Lambda Delay tool did not open for shared interaction fixture');

    const cells = () => [...root.querySelectorAll('[data-ve-analyzer="delay-table"] td[data-delay-row]')];
    const values = () => cells().map((cell) => Number(cell.dataset.delayValue));
    const toolbar = root.querySelector('.ve-delay-shared-toolbar');
    assert(toolbar, 'Shared Lambda Delay toolbar missing');
    assert(root.querySelector('[data-ve-analyzer="delay-table"]').dataset.tableInteractionOwner === 'shared', 'Shared owner marker missing');
    checks.push('shared owner and toolbar are active');

    assert(cells().filter((cell) => cell.tabIndex === 0).length === 1 && cells().filter((cell) => cell.tabIndex === -1).length === cells().length - 1,
      'Editable delay table did not use one roving tab stop');
    checks.push('table keyboard navigation exposes one roving tab stop instead of one Tab stop per cell');

    const lowerLeft = root.querySelector('[data-ve-analyzer="delay-table"] td[data-delay-row="0"][data-delay-col="0"]');
    const upperLeft = root.querySelector('[data-ve-analyzer="delay-table"] td[data-delay-row="1"][data-delay-col="0"]');
    selectCell(lowerLeft);
    lowerLeft.focus();
    lowerLeft.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    assert(document.activeElement === upperLeft && upperLeft.dataset.tableSelected === 'true', 'ArrowUp followed semantic row numbering instead of the visually higher reversed-load row');
    upperLeft.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert(document.activeElement === lowerLeft && lowerLeft.dataset.tableSelected === 'true', 'ArrowDown did not return to the visually lower reversed-load row');
    lowerLeft.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true, cancelable: true }));
    assert(document.activeElement === upperLeft && cells().filter((cell) => cell.dataset.tableSelected === 'true').length === 2, 'Shift+ArrowUp did not extend selection in visual table direction');
    checks.push('Up/Down and Shift+Up follow visual row direction on the reversed load axis');

    const minRpm = root.querySelector('input[data-role="min-rpm"]');
    const rangeSummary = root.querySelector('[data-ve-v50-summary="range"]');
    minRpm.value = '1234';
    view.refresh();
    await settle();
    assert(rangeSummary?.textContent?.includes('1234'), 'Compact setup summary did not resync after programmatic controller refresh');
    checks.push('compact setup summaries resync after controller-driven/programmatic changes');

    const scopeSelect = root.querySelector('select[data-role="scope"]');
    scopeSelect.value = 'ab';
    scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const scopeNavigator = root.querySelector('.ve-analysis-scope-navigator');
    const scopeOpen = root.querySelector('[data-ve-scope-open]');
    assert(scopeNavigator?.dataset.state === 'range' && root.querySelector('[data-ve-scope-start]')?.textContent === '00:00' && root.querySelector('[data-ve-scope-end]')?.textContent === '00:06',
      'Scope navigator did not use authoritative source extent with the selected Analyzer range');
    scopeOpen.click();
    assert(openedRange?.startMs === 0 && openedRange?.endMs === 3000 && openedRange?.label === 'Current A/B', 'Scope handoff did not send the selected semantic range to Logger');
    checks.push('scope navigator uses authoritative source extent and explicit selected-range Logger handoff');

    const initial = view.sessionRevision;
    selectCell(cells()[0]);
    selectCell(cells()[1], true);
    assert(cells().slice(0, 2).every((cell) => cell.dataset.tableSelected === 'true' && cell.dataset.delaySelected === 'true'), 'Shared selection did not decorate compatibility and v50 state');
    button(root, 'Increase selected cells').click();
    await settle();
    assert(values()[0] === 105 && values()[1] === 105 && view.sessionRevision === initial + 1, 'Shared +/- edit did not publish one semantic change');
    checks.push('additive selection and +/- use one semantic owner transaction');

    button(root, 'Undo').click(); await settle();
    assert(values()[0] === 100 && values()[1] === 100, 'Undo did not restore owner values');
    button(root, 'Redo').click(); await settle();
    assert(values()[0] === 105 && values()[1] === 105, 'Redo did not restore shared edit');
    checks.push('shared owner-backed undo/redo works');

    const decrementButton = button(root, 'Decrease selected cells');
    decrementButton.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await settle();
    const stepDialog = document.querySelector('.ve-table-tool-options');
    const popupBounds = stepDialog?.getBoundingClientRect();
    assert(popupBounds && popupBounds.left >= 0 && popupBounds.right <= window.innerWidth + 2
      && popupBounds.top >= 0 && popupBounds.bottom <= window.innerHeight + 2,
      'Tool option popup escaped the viewport');
    const stepInput = stepDialog?.querySelector('input[type="number"]');
    assert(stepDialog && stepInput && stepDialog.getAttribute('aria-label') === 'Increment step', 'Right-click did not open increment-step configuration');
    stepInput.value = '7';
    stepInput.dispatchEvent(new Event('change', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(button(root, 'Increase selected cells').title.includes('by 7'), 'Configured increment step did not refresh toolbar presentation');
    const storedTools = JSON.parse(localStorage.getItem('epicscope.veAnalyzer.tableTools.v1') || '{}');
    assert(storedTools.delay?.adjustmentStep === 7, 'Configured table step was not persisted by the production preference owner');
    assert(button(root, 'Interpolate horizontally') && button(root, 'Interpolate vertically') && button(root, 'Interpolate both directions'), 'Explicit H/V/2D interpolation tools are missing');
    checks.push('right-click tool configuration persists and explicit H/V/2D interpolation controls are present');

    selectCell(cells()[0]);
    button(root, 'Pin').click();
    assert(cells()[0].dataset.tablePinned === 'true', 'Pin state was not presented');
    const pinnedBefore = values()[0];
    selectCell(cells()[0]);
    selectCell(cells()[1], true);
    button(root, 'Decrease selected cells').click(); await settle();
    assert(values()[0] === pinnedBefore && values()[1] === 98, 'Pinned cell was changed by destructive bulk adjustment');
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
    c3.scrollIntoView({ block: 'nearest' });
    await settle();
    const end = c3.getBoundingClientRect();
    const originalElementFromPoint = document.elementFromPoint.bind(document);
    document.elementFromPoint = (x, y) => {
      if (x >= end.left && x <= end.right && y >= end.top && y <= end.bottom) return c3;
      return originalElementFromPoint(x, y);
    };
    try {
      pointer(c1, 'pointerdown', { ctrlKey: true });
      pointer(document, 'pointermove', { ctrlKey: true, clientX: end.left + end.width / 2, clientY: end.top + end.height / 2 });
      pointer(document, 'pointerup', { ctrlKey: true, clientX: end.left + end.width / 2, clientY: end.top + end.height / 2 });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
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
    const brushCell = cells()[2];
    const brushTextBefore = brushCell.textContent;
    pointer(brushCell, 'pointerdown');
    await new Promise((resolve) => setTimeout(resolve, 125));
    assert(brushCell.dataset.tableLivePreview === 'true' && brushCell.textContent !== brushTextBefore,
      'Held Lambda Brush did not show its pending numeric value before pointer-up');
    assert(values()[2] === beforeBrush && view.sessionRevision === brushRevision,
      'Lambda Brush live preview committed semantic authority before pointer-up');
    await new Promise((resolve) => setTimeout(resolve, 100));
    pointer(document, 'pointerup');
    await settle();
    assert(values()[2] > beforeBrush && view.sessionRevision === brushRevision + 1, 'Held Brush did not accumulate and commit once');
    checks.push('held Brush previews live numeric values while one stroke publishes one semantic revision');

    installDelayFile(fileInput, 180);
    await settle();
    selectCell(cells()[2]);
    if (brushButton.getAttribute('aria-pressed') !== 'true') brushButton.click();
    const reverseStart = values()[2];
    const reverseRevision = view.sessionRevision;
    cells()[2].setPointerCapture = () => {};
    pointer(cells()[2], 'pointerdown');
    await new Promise((resolve) => setTimeout(resolve, 120));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 320));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
    pointer(document, 'pointerup');
    await settle();
    assert(values()[2] < reverseStart && view.sessionRevision === reverseRevision + 1,
      'Stationary held Brush did not reverse direction when Shift changed without pointer motion');
    checks.push('held Brush reacts to Shift reversal even while the pointer remains stationary');

    return { passed: checks.length, checks };
  } finally {
    root.remove();
  }
}