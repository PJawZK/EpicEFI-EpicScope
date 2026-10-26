import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { veTableProjection } from '../../apps/web/src/pages/ve-analyzer-table-projection';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const key = (target, value) => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
const pointer = (target, type, shiftKey = false) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 61, pointerType: 'mouse', shiftKey }));

export async function runVeGroup3Checks() {
  const checks = [];
  const fractional = await setupVeLifecycleFixture();
  try {
    const model = normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="2">1000.25 2000.75</constant><constant name="veLoadBins" rows="2" cols="1">50.25 100.75</constant>
<constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant><constant name="afrLoadBins" rows="2" cols="1">50 100</constant>
<constant name="veTable" rows="2" cols="2" units="%">60 70 80 90</constant><constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant></page></msq>`));
    fractional.view.setTuneModel(model, 'fractional.msq');
    const delay = serializeVeDelayTable({ rpmBins: [1000.25, 2000.75], loadBins: [50.25, 100.75], rows: 2, cols: 2, origin: 'saved-file',
      cells: Array.from({ length: 4 }, (_, i) => ({ row: Math.floor(i / 2), col: i % 2, state: 'measured', workingMs: 100,
        recommendedMs: 100, eventCount: 5, confidence: 'moderate', sourceEvents: [] })) });
    const file = fractional.root.querySelector('[data-ve-analyzer="load-delay-file"]');
    Object.defineProperty(file, 'files', { configurable: true, value: [{ name: 'fractional.json', text: async () => delay }] });
    file.dispatchEvent(new Event('change', { bubbles: true })); await settle(); fractional.run();
    const deadline = performance.now() + 10000;
    while (!fractional.view.getPrimaryAnalysis()) { assert(performance.now() < deadline, 'Fractional analysis did not complete'); await settle(); }
    const cell = fractional.root.querySelector('td[data-ve-row="1"][data-ve-col="1"]');
    for (const header of cell.closest('table').querySelectorAll('th')) header.textContent = 'rounded/translated';
    const open = target => fractional.root.dispatchEvent(new CustomEvent('ve-cell-evidence-open', { detail: { cell: target } }));
    open(cell);
    const panel = fractional.host.querySelector('.ve-cell-detail-popover'), grid = panel.querySelector('.ve-evidence-detail-grid');
    const original = [...grid.querySelectorAll('.ve-evidence-detail-metric')].find(node => node.firstElementChild.textContent === 'Original VE');
    assert(!panel.hidden && original.lastElementChild.textContent === '90', 'Fractional/renamed headers selected the wrong semantic cell');
    const foreign = document.createElement('section'); foreign.innerHTML = '<div data-ve-analyzer="ve-table-view"><table><tbody><tr><td data-ve-row="0" data-ve-col="0"></td></tr></tbody></table></div>';
    document.body.append(foreign); open(foreign.querySelector('td')); foreign.remove();
    open(cell.cloneNode(true));
    assert(!panel.hidden && panel.querySelector('.ve-evidence-detail-grid') === grid, 'Foreign/detached evidence event altered the current popup');
    cell.dataset.veRow = '99'; open(cell); assert(panel.hidden, 'Out-of-bounds semantic cell was accepted');
    cell.dataset.veRow = ''; open(cell); assert(panel.hidden, 'Empty semantic coordinate was accepted');
    cell.dataset.veRow = '1'; open(cell);
    assert(!panel.hidden && panel.querySelector('.ve-evidence-detail-grid') === grid && fractional.reads() === 1,
      'Valid semantic reopen lost cached evidence or reloaded traces');
    checks.push('Fractional axes and translated headers use semantic evidence identity; foreign, detached and invalid cells are rejected without losing cache reuse');
  } finally { fractional.view.setActive(false); fractional.host.remove(); }

  localStorage.setItem('epicscope.veAnalyzer.resultView', 'proposal');
  const s = await setupVeLifecycleFixture(); s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  try {
    await settle();
    const list = s.root.querySelector('.ve-v50-scope-choice-list'), buttons = [...list.children];
    const ab = buttons.find(button => button.dataset.scopeValue === 'ab');
    ab.closest('details').open = true; await settle(); ab.focus();
    const revision = s.view.sessionRevision, input = s.root.querySelector('input[data-role="min-rpm"]');
    input.value = '1234'; input.dispatchEvent(new Event('input', { bubbles: true }));
    s.view.refresh(); s.view.setContext({ ...s.context }); await settle();
    assert(buttons.every((node, i) => list.children[i] === node) && document.activeElement === ab,
      `Unrelated scope update: ${JSON.stringify({ retained: buttons.map((node, i) => list.children[i] === node), focused: document.activeElement?.outerHTML.slice(0,160), beforeRevision: revision, afterRevision: s.view.sessionRevision, options: [...list.children].map(node => node.textContent) })}`);
    ab.click(); await settle();
    assert(s.root.querySelector('select[data-role="scope"]').value === 'ab' && buttons.every((node, i) => list.children[i] === node)
      && ab.getAttribute('aria-pressed') === 'true' && list.querySelectorAll('[data-selected="true"]').length === 1,
      'Scope selection replaced buttons or lost semantic selection');
    const beforeLabels = [...list.children];
    s.view.setContext({ ...s.context, savedRanges: [{ label: 'renamed range', startMs: 0, endMs: 2000 }] }); await settle();
    assert([...list.children].some(node => node.textContent.includes('renamed range')) && list.firstElementChild !== beforeLabels[0], 'Changed range catalog retained stale labels');
    checks.push('Scope choices preserve nodes/focus on unrelated updates and selection; changed option labels rebuild the current catalog');

    const owner = veProposalEditOwner(s.root), table = () => s.root.querySelector('[data-ve-analyzer="ve-table-view"] table');
    const cell = col => table().querySelector(`td[data-ve-row="0"][data-ve-col="${col}"]`);
    const retained = table(), projection = veTableProjection(retained);
    s.view.refresh(); s.view.refresh(); await settle(); assert(table() === retained && veTableProjection(table()) === projection, 'Unchanged VE refresh rebuilt its grid/projection');
    const first = owner.snapshot(); owner.applyValues([{ row: 0, col: 0, value: 123.456 }]); await settle();
    assert(table() === retained && veTableProjection(table()) === projection && cell(0).querySelector(':scope > span').textContent === '123.46' && owner.snapshot().values[0] === 123.456
      && owner.snapshot().authorityGeneration === first.authorityGeneration + 1, 'Working edit did not patch its existing cell with one publication');
    checks.push('Unchanged VE refresh retains grid/projection; working publication patches values without rebuilding geometry or generated metrics');

    for (const [col, shift] of [[0, false], [1, true]]) { cell(col).setPointerCapture = () => {}; pointer(cell(col), 'pointerdown', shift); pointer(cell(col), 'pointerup', shift); }
    key(cell(0), 'F2'); const draft = s.root.querySelector('.ve-table-inline-input'); draft.value = '144.75'; draft.dispatchEvent(new Event('input', { bubbles: true }));
    const pending = owner.snapshot(); s.view.refresh(); await settle();
    assert(draft.isConnected && draft.value === '144.75' && cell(1).querySelector(':scope > span').textContent === '144.75' && owner.snapshot().values === pending.values,
      'Refresh destroyed an inline/range preview or published it early');
    key(draft, 'Enter'); await settle();
    assert(owner.snapshot().values[0] === 144.75 && owner.snapshot().values[1] === 144.75
      && owner.snapshot().authorityGeneration === pending.authorityGeneration + 1 && table() === retained, 'Range draft did not publish once into retained cells');
    checks.push('VE refresh preserves active inline/range previews and commits once without cell replacement');

    const brush = s.root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Continuous brush editing"]'); brush.click();
    cell(0).setPointerCapture = () => {}; const before = owner.snapshot(); pointer(cell(0), 'pointerdown'); await pause(125);
    s.view.refresh(); await pause(125);
    assert(table() === retained && cell(0).dataset.tableLivePreview === 'true' && owner.snapshot().values === before.values, 'VE refresh cancelled or published a Brush preview');
    pointer(document, 'pointerup'); await settle();
    assert(owner.snapshot().authorityGeneration === before.authorityGeneration + 1 && table() === retained
      && Number(cell(0).querySelector(':scope > span').textContent) === Number(owner.snapshot().values[0].toFixed(2))
      && owner.snapshot().values[0] !== before.values[0], 'Retained Brush failed one release publication/display');
    assert(s.reads() === 0, 'Scope/render presentation unexpectedly read traces');
    checks.push('Held Brush survives VE refresh, keeps preview authority private and commits once into the retained grid');
  } finally { s.view.setActive(false); s.host.remove(); }
  return { passed: checks.length, checks };
}
