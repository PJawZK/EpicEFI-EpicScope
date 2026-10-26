import { createVeAnalyzerView as createUnadaptedView } from '../../apps/web/src/pages/ve-analyzer-view-v9';
import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';

const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame); };
const change = (control, value) => { control.value = value; control.dispatchEvent(new Event('change', { bubbles: true })); };
function paintedBounds(shell) {
  const canvas = shell.querySelector('canvas.ve-table-brush-overlay');
  assert(canvas && !canvas.hidden, 'Active Brush canvas missing');
  const rect = canvas.getBoundingClientRect(), scale = canvas.width / rect.width;
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let left = Infinity, top = Infinity, right = -1, bottom = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (!data[(y * canvas.width + x) * 4 + 3]) continue;
    left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
  }
  const cells = [...shell.querySelectorAll('td[data-table-brush-preview="true"]')].map(cell => cell.getBoundingClientRect());
  assert(cells.length && Number.isFinite(left), 'Brush has no footprint/paint');
  const expected = { left: Math.min(...cells.map(r => r.left)), top: Math.min(...cells.map(r => r.top)),
    right: Math.max(...cells.map(r => r.right)), bottom: Math.max(...cells.map(r => r.bottom)) };
  const actual = { left: rect.left + left / scale, top: rect.top + top / scale, right: rect.left + right / scale, bottom: rect.top + bottom / scale };
  assert(Object.keys(actual).every(key => Math.abs(actual[key] - expected[key]) <= 2),
    `Stale Brush geometry: ${JSON.stringify({ actual, expected })}`);
  return { width: rect.width, height: rect.height, footprintHeight: expected.bottom - expected.top };
}

export async function runVeTableLayoutChecks() {
  const checks = [];
  localStorage.setItem('epicscope.veAnalyzer.resultView', 'proposal');
  for (const initial of ['single', 'side-by-side']) {
    localStorage.setItem('epicscope.veAnalyzer.tableLayout', initial);
    const fixture = await setupVeLifecycleFixture();
    try {
      const layout = fixture.root.querySelector('select[aria-label="VE Analyzer table view"]');
      assert(fixture.root.querySelectorAll('[data-table-tab]').length === 2, `${initial}: original tabs were detached at installation`);
      change(layout, 'single'); fixture.root.querySelector('.ve-v50-table-flip').click(); await settle();
      assert(!fixture.root.querySelector('[data-ve-analyzer="target-table-view"]').closest('.ve-workbench-panel').hidden,
        `${initial}: Target navigation lost its original tab handler`);
      checks.push(`Saved ${initial} layout retains original tabs and functioning Target navigation`);
    } finally { fixture.view.setActive(false); fixture.host.remove(); }
  }
  localStorage.setItem('epicscope.veAnalyzer.tableLayout', 'side-by-side');
  const s = await setupVeLifecycleFixture();
  s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  try {
    await settle();
    const layout = s.root.querySelector('select[aria-label="VE Analyzer table view"]');
    const target = s.root.querySelector('select[data-role="target-table"]');
    const result = s.root.querySelector('select[aria-label="VE Analyzer result view"]');
    const tabs = s.root.querySelector('.ve-workbench-table-tabs');
    const toolbar = s.root.querySelector('.ve-proposal-shared-toolbar');
    const nodes = [target, result, tabs, toolbar], parents = nodes.map(node => node.parentElement);
    const vePanel = s.root.querySelector('[data-ve-analyzer="ve-table-view"]').closest('.ve-workbench-panel');
    const targetPanel = s.root.querySelector('[data-ve-analyzer="target-table-view"]').closest('.ve-workbench-panel');
    change(layout, 'side-by-side'); await settle();
    target.focus();
    for (let i = 0; i < 3; i++) { s.view.setContext({ ...s.context }); s.view.setTuneModel(s.model, 'test.msq'); s.view.refresh(); }
    await settle();
    assert(document.activeElement === target && nodes.every((node, i) => node.parentElement === parents[i]), 'Unchanged refresh moved controls or lost focus');
    checks.push('Unchanged context/tune/refresh preserve original header parents and selector focus');
    change(layout, 'single'); await settle();
    s.root.querySelector('[data-table-tab="target"]').click(); await settle();
    assert(!targetPanel.hidden && vePanel.hidden && target.closest('header') === targetPanel.querySelector('header'), 'Single Target actions are unreachable');
    s.root.querySelector('.ve-v50-table-flip').click(); await settle();
    assert(!vePanel.hidden && targetPanel.hidden && target.closest('header') === vePanel.querySelector('header'), 'Single VE return failed');
    change(layout, 'side-by-side'); await settle();
    assert(!vePanel.hidden && !targetPanel.hidden && nodes.every((node, i) => node.parentElement === parents[i]) && toolbar.closest('header') === vePanel.querySelector('header'), 'Split transition detached semantic controls');
    checks.push('Single VE/Target and split routing retain controls, tabs, and the VE toolbar');

    for (const domain of ['proposal', 'delay']) {
      if (domain === 'delay') { s.root.querySelector('.ve-v50-lambda-tool-trigger').click(); await settle(); }
      const owner = domain === 'proposal' ? veProposalEditOwner(s.root) : veDelayEditOwner(s.root);
      const selector = domain === 'proposal' ? 'td[data-ve-row="0"][data-ve-col="0"]' : 'td[data-delay-row="0"][data-delay-col="0"]';
      const cell = () => s.root.querySelector(selector);
      const shell = cell().closest('.ve-workbench-table-wrap, .ve-delay-table-shell');
      shell.style.setProperty('flex', 'none', 'important'); shell.style.setProperty('min-height', '0', 'important');
      shell.style.setProperty('height', '100px', 'important'); shell.style.setProperty('max-height', 'none', 'important');
      await settle();
      s.root.querySelector(`.ve-${domain}-shared-toolbar button[aria-label="Continuous brush editing"]`).click();
      const hover = () => cell().dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 218, pointerType: 'mouse' }));
      hover(); await settle(); const before = paintedBounds(shell), authority = owner.snapshot();
      shell.style.setProperty('height', '220px', 'important'); await settle();
      const larger = paintedBounds(shell);
      assert(larger.height > before.height && owner.snapshot().authorityGeneration === authority.authorityGeneration, `${domain}: Resize changed authority or failed to grow: ${JSON.stringify({ before, larger, clientHeight: shell.clientHeight, computed: getComputedStyle(shell).height, generation: owner.snapshot().authorityGeneration, previousGeneration: authority.authorityGeneration })}`);
      if (domain === 'proposal') assert(larger.footprintHeight > before.footprintHeight, 'Resize did not exercise final row fitting');
      shell.style.setProperty('height', '80px', 'important'); await settle();
      const smaller = paintedBounds(shell);
      shell.scrollTop = 10; shell.scrollLeft = 10; await settle(); paintedBounds(shell);
      assert(smaller.height < larger.height, 'Canvas retained its old scroll extent after shrink');
      // A stroke rebuilds the table. The final fitted rows must match its new overlay.
      const start = owner.snapshot(); cell().setPointerCapture = () => {};
      cell().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 218, pointerType: 'mouse' }));
      await new Promise(resolve => setTimeout(resolve, 125));
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 218, pointerType: 'mouse' }));
      await settle(); hover(); await settle(); paintedBounds(shell);
      assert(owner.snapshot().authorityGeneration === start.authorityGeneration + 1, 'Brush release did not publish exactly once');
      if (domain === 'proposal') {
        change(layout, 'single'); await settle(); paintedBounds(shell);
        change(layout, 'side-by-side'); await settle(); paintedBounds(shell);
      }
      checks.push(`${domain}: canvas pixels follow final rows after growth, shrink, commit${domain === 'proposal' ? ' and layout transitions' : ''}`);
    }
    const wrapper = s.root.querySelector('[data-ve-analyzer="ve-table-view"]');
    const fittedTable = wrapper.querySelector('table');
    s.view.setActive(false); await settle();
    const rowHeight = fittedTable.style.getPropertyValue('--ve-v50-row-height');
    wrapper.style.setProperty('height', '240px', 'important');
    const hiddenHtml = s.root.innerHTML; await settle();
    assert(s.root.innerHTML === hiddenHtml, 'Inactive resize callback changed presentation');
    s.view.setActive(true); await settle();
    assert(fittedTable.style.getPropertyValue('--ve-v50-row-height') !== rowHeight, 'Activation did not fit deferred geometry');
    checks.push('Inactive layout frames defer DOM writes and activation fits deferred geometry');
    assert(s.reads() === 0, 'Presentation geometry loaded log traces');
    checks.push('Layout and Brush geometry remain presentation-only without trace loads');
  } finally { s.view.setActive(false); s.host.remove(); }
  const legacy = await setupVeLifecycleFixture(createUnadaptedView);
  legacy.root.hidden = false;
  try {
    const layout = legacy.root.querySelector('select[aria-label="VE Analyzer table view"]');
    const target = legacy.root.querySelector('select[data-role="target-table"]');
    change(layout, 'single'); legacy.root.querySelector('[data-table-tab="target"]').click(); await settle();
    target.focus(); const parent = target.parentElement;
    legacy.view.refresh(); legacy.view.setContext({ ...legacy.context }); await settle();
    assert(target.parentElement === parent && document.activeElement === target, 'Unadapted header lost focus on unchanged placement');
    change(layout, 'side-by-side'); await settle();
    assert(target.isConnected && !legacy.root.querySelector('[data-ve-analyzer="target-table-view"]').closest('.ve-workbench-panel').hidden,
      'Unadapted split placement failed');
    checks.push('Unadapted v7 header retains its own placement and preserves focus on unchanged updates');
  } finally { legacy.view.setActive(false); legacy.host.remove(); }
  return { passed: checks.length, checks };
}
