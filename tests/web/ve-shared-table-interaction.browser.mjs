import { loadVeTableToolPreferences, resetVeTableToolPreferences, saveVeTableToolPreferences } from '../../apps/web/src/state/ve-table-tool-preferences';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
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
  const checks = [], preferences = loadVeTableToolPreferences('delay');
  const storageKeys = ['epicscope.veAnalyzer.tableTools.v1', 'epicscope.veAnalyzer.resultView', 'epicscope.veAnalyzer.tableLayout'];
  const savedStorage = storageKeys.map(key => localStorage.getItem(key));
  resetVeTableToolPreferences('delay');
  localStorage.setItem(storageKeys[1], 'proposal'); localStorage.setItem(storageKeys[2], 'single');
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
    const revisionBeforeRefresh = view.sessionRevision;
    minRpm.value = '1234';
    view.refresh();
    await settle();
    assert(root.querySelector('input[data-role="min-rpm"]') === minRpm && minRpm.value === '1234',
      'Programmatic refresh replaced the range control or discarded its current value');
    assert(view.sessionRevision === revisionBeforeRefresh, 'Presentation refresh invalidated the semantic session');
    for (const [id, label] of [
      ['qualification', 'Analysis Mode'], ['scope', 'Log Scope'], ['range', 'RPM / Load Range'],
      ['guards', 'Stability Filter'], ['cell-change', 'Change Filter'], ['mixture', 'Mixture Source'],
    ]) {
      assert(root.querySelector(`[data-ve-v50-summary="${id}"]`)?.textContent === label,
        `Compact ${id} label did not retain its purpose-only presentation after refresh`);
    }
    minRpm.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    assert(view.sessionRevision === revisionBeforeRefresh + 1 && minRpm.value === '1234',
      'Range change did not reach the existing semantic owner exactly once');
    checks.push('purpose-only setup labels preserve control identity/value through refresh and range changes invalidate once');

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
    // Escape closes the Lambda tool too; resume editing through its owner.
    if (lambdaPanel.hidden) lambdaTrigger.click();

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
    assert(brushCell.dataset.tableValueState === (Number(brushCell.textContent) < 100 ? 'lower' : 'higher'),
      'Preview text mutations overwrote the pending delay marker');
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
    const reverseCell = cells()[2], reverseAt = performance.now();
    pointer(reverseCell, 'pointerdown');
    await new Promise((resolve) => setTimeout(resolve, 120));
    const beforeShift = {preview:reverseCell.textContent,connected:reverseCell.isConnected,elapsed:performance.now()-reverseAt};
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 320));
    const afterShift = {preview:reverseCell.textContent,connected:reverseCell.isConnected,elapsed:performance.now()-reverseAt};
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
    pointer(document, 'pointerup');
    await settle();
    assert(values()[2] < reverseStart && view.sessionRevision === reverseRevision + 1,
      'Stationary held Brush did not reverse direction when Shift changed without pointer motion '+JSON.stringify({reverseStart,beforeShift,afterShift,final:values()[2],revisionDelta:view.sessionRevision-reverseRevision}));
    checks.push('held Brush reacts to Shift reversal even while the pointer remains stationary');

    button(root, 'Continuous brush editing').click();
    installDelayFile(fileInput, 200); await settle();
    selectCell(cells()[0]); button(root, 'Increase selected cells').click(); await settle();
    const once = values()[0];
    selectCell(cells()[0]); button(root, 'Increase selected cells').click(); await settle();
    const twice = values()[0];
    for (const [action, expected] of [['Undo', once], ['Undo', 200], ['Redo', once], ['Redo', twice]]) {
      button(root, action).click(); await settle();
      assert(values()[0] === expected, `${action} lost multi-step delay history across own publications`);
    }
    view.setActive(false); view.setActive(true); root.querySelector('.ve-v50-lambda-tool-trigger').click(); view.refresh(); await settle();
    button(root, 'Undo').click(); await settle();
    assert(values()[0] === once, 'Unchanged delay navigation/refresh retired history');
    checks.push('multi-step delay history survives own revisions and unchanged navigation/refresh');

    const owner = veDelayEditOwner(root);
    assert(owner.applyValues([{ row: 1, col: 0, workingMs: 333 }]), 'External delay edit fixture failed');
    button(root, 'Redo').click(); await settle();
    assert(values()[0] === 333 && button(root, 'Redo').getAttribute('aria-disabled') === 'true',
      'External delay owner publication retained stale history');
    installDelayFile(fileInput, 400); await settle();
    button(root, 'Undo').click(); button(root, 'Redo').click(); await settle();
    assert(values().every(value => value === 400) && button(root, 'Undo').getAttribute('aria-disabled') === 'true',
      'Same-size delay replacement accepted history from the old table');
    checks.push('external delay owner commands and same-size file replacement retire Undo and Redo');

    const size = 32;
    const bins = Array.from({ length: size }, (_, i) => 1000 + i * 100);
    const loads = Array.from({ length: size }, (_, i) => 50 + i * 5);
    const entries = [['veRpmBins', 1, size, bins], ['veLoadBins', size, 1, loads],
      ['afrRpmBins', 1, size, bins], ['afrLoadBins', size, 1, loads],
      ['veTable', size, size, Array(size * size).fill(60)], ['afrTable', size, size, Array(size * size).fill(14)]];
    const largeTune = normalizeMsqTune(parseMsq('<msq><page>' + entries.map(([name, rows, cols, values]) =>
      `<constant name="${name}" rows="${rows}" cols="${cols}">${values.join(' ')}</constant>`).join('') + '</page></msq>'));
    localStorage.setItem('epicscope.veAnalyzer.resultView', 'proposal');
    const large = createVeAnalyzerView();
    const host = document.createElement('section'); host.className = 'analyzer-page';
    host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
    host.append(large.element); document.body.append(host); large.element.hidden = false;
    let reads = 0;
    try {
      large.setContext({ source: { identity: {}, sampleCount: 60, revision: 0 }, channels, traces: [],
        aTimeMs: 0, bTimeMs: 3000, savedRanges: [], loadTraces: async () => { reads++; return traces; } });
      large.setTuneModel(largeTune, 'brush-scale.msq');
      const file = serializeVeDelayTable({ rpmBins: bins, loadBins: loads, rows: size, cols: size, origin: 'saved-file',
        cells: Array.from({ length: size * size }, (_, index) => ({ row: Math.floor(index / size), col: index % size,
          state: 'measured', workingMs: 100, recommendedMs: 100, workingProvenance: 'measured-recommendation',
          eventCount: 5, confidence: 'moderate', sourceEvents: [] })) });
      const input = large.element.querySelector('[data-ve-analyzer="load-delay-file"]');
      Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'scale-delay.json', text: async () => file }] });
      input.dispatchEvent(new Event('change', { bubbles: true })); await settle();
      for (const domain of ['proposal', 'delay']) {
        if (domain === 'delay') large.element.querySelector('.ve-v50-lambda-tool-trigger').click();
        const owner = domain === 'proposal' ? veProposalEditOwner(large.element) : veDelayEditOwner(large.element);
        const selector = domain === 'proposal' ? 'td[data-ve-row="16"][data-ve-col="16"]' : 'td[data-delay-row="16"][data-delay-col="16"]';
        const toolbar = large.element.querySelector(`.ve-${domain}-shared-toolbar`);
        const brush = toolbar.querySelector('button[aria-label="Continuous brush editing"]');
        brush.click();
        const before = owner.snapshot(), index = 16 * size + 16;
        const currentCell = large.element.querySelector(selector), table = currentCell.closest('table');
        const text = () => (currentCell.querySelector(':scope > span') ?? currentCell).textContent;
        const originalText = text(), originalState = currentCell.dataset.tableValueState;
        currentCell.setPointerCapture = () => {};
        pointer(currentCell, 'pointerdown'); await new Promise(resolve => setTimeout(resolve, 200));
        assert(owner.snapshot().values === before.values && owner.snapshot().authorityGeneration === before.authorityGeneration
          && currentCell.closest('table') === table && table.isConnected && currentCell.dataset.tableLivePreview === 'true'
          && text() !== originalText && currentCell.dataset.tableValueState !== 'same',
          `${domain} 32x32 preview rebuilt/published authority or lost its live marker`);
        pointer(document, 'pointercancel'); await settle();
        assert(owner.snapshot().values === before.values && owner.snapshot().authorityGeneration === before.authorityGeneration
          && text() === originalText && currentCell.dataset.tableValueState === originalState,
          `${domain} 32x32 cancellation failed to restore text/state`);
        pointer(currentCell, 'pointerdown'); await new Promise(resolve => setTimeout(resolve, 125));
        pointer(document, 'pointerup'); await settle();
        assert(owner.snapshot().authorityGeneration === before.authorityGeneration + 1 && owner.snapshot().values[index] !== before.values[index],
          `${domain} 32x32 stroke did not commit exactly once`);
        brush.click();
      }
      assert(reads === 0, 'Brush preview/edit loaded traces instead of using retained values');
      checks.push('32x32 proposal/delay Brush previews preserve live markers and retained authority; cancel restores and release commits once');
    } finally { large.dispose(); host.remove(); }

    return { passed: checks.length, checks };
  } finally {
    view.dispose(); root.remove();
    saveVeTableToolPreferences('delay', preferences);
    storageKeys.forEach((key, i) => savedStorage[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, savedStorage[i]));
  }
}
