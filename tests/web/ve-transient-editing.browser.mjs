import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
import { installVeAnalyzerV50ToolSurfaces } from '../../apps/web/src/pages/ve-analyzer-v50-tool-surfaces';
import { installVeAnalyzerV50SetupDisclosurePolicy } from '../../apps/web/src/pages/ve-analyzer-v50-setup-disclosure';

const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const pointer = (target, type) => target.dispatchEvent(new PointerEvent(type, { pointerId: 108, pointerType: 'mouse', bubbles: true, cancelable: true }));
const delayFile = serializeVeDelayTable({ rpmBins: [1000, 2000], loadBins: [50, 100], rows: 2, cols: 2, origin: 'saved-file',
  cells: Array.from({ length: 4 }, (_, i) => ({ row: Math.floor(i / 2), col: i % 2, state: 'measured', workingMs: 100,
    recommendedMs: 100, workingProvenance: 'measured-recommendation', eventCount: 5, confidence: 'moderate', sourceEvents: [] })) });

export async function runVeTransientEditingChecks() {
  const checks = [];
  for (const domain of ['proposal', 'delay']) {
    localStorage.setItem('epicscope.veAnalyzer.resultView', 'proposal');
    const s = await setupVeLifecycleFixture();
    s.root.hidden = false;
    s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
    const owner = domain === 'proposal' ? veProposalEditOwner(s.root) : veDelayEditOwner(s.root);
    const cell = () => s.root.querySelector(domain === 'proposal' ? 'td[data-ve-row="0"][data-ve-col="0"]' : 'td[data-delay-row="0"][data-delay-col="0"]');
    const brush = () => s.root.querySelector(`.ve-${domain}-shared-toolbar button[aria-label="Continuous brush editing"]`);
    const draft = (value = 137) => {
      cell().dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
      const input = s.root.querySelector('.ve-table-inline-input');
      assert(input, `${domain}: inline edit unavailable`);
      input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true }));
      return input;
    };
    const unchanged = () => {
      assert(!s.view.setContext({ ...s.context, openRangeInLogger: () => {} }), `${domain}: callback-only context was destructive`);
      assert(!s.view.setTuneModel(s.model, 'test.msq'), `${domain}: unchanged tune was destructive`);
    };
    try {
      if (domain === 'delay') s.root.querySelector('.ve-v50-lambda-tool-trigger').click();
      const before = owner.snapshot(), revision = s.view.sessionRevision;
      const input = draft(); unchanged(); await settle();
      assert(input.isConnected && s.root.querySelector('.ve-table-inline-input') === input && input.value === '137'
        && owner.snapshot().values === before.values && s.view.sessionRevision === revision,
        `${domain}: unchanged updates discarded an inline draft or published its preview`);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await settle();
      assert(owner.snapshot().values[0] === 137 && owner.snapshot().authorityGeneration === before.authorityGeneration + 1,
        `${domain}: preserved inline draft did not commit once`);

      brush().click();
      const stroke = owner.snapshot(), strokeCell = cell(); strokeCell.setPointerCapture = () => {};
      pointer(strokeCell, 'pointerdown'); await pause(125); unchanged(); await pause(125);
      assert(strokeCell.isConnected && strokeCell.dataset.tableLivePreview === 'true' && owner.snapshot().values === stroke.values
        && owner.snapshot().authorityGeneration === stroke.authorityGeneration,
        `${domain}: unchanged updates cancelled the Brush or published its preview`);
      pointer(document, 'pointerup'); await settle();
      assert(owner.snapshot().authorityGeneration === stroke.authorityGeneration + 1 && owner.snapshot().values[0] !== stroke.values[0],
        `${domain}: preserved Brush did not commit once`);
      brush().click();
      draft(999);
      s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } }); await settle();
      assert(!s.root.querySelector('.ve-table-inline-input') && !owner.snapshot()?.values.includes(999),
        `${domain}: real source replacement retained/committed its draft: ${JSON.stringify({ input: Boolean(s.root.querySelector('.ve-table-inline-input')), snapshot: owner.snapshot() })}`);
      const file = s.root.querySelector('[data-ve-analyzer="load-delay-file"]');
      Object.defineProperty(file, 'files', { configurable: true, value: [{ name: 'restored-delay.json', text: async () => delayFile }] });
      file.dispatchEvent(new Event('change', { bubbles: true })); await settle();
      brush().click(); const replacementCell = cell(); replacementCell.setPointerCapture = () => {};
      pointer(replacementCell, 'pointerdown'); await pause(125);
      s.view.setTuneModel(s.model, 'replacement.msq'); await settle();
      const replacement = owner.snapshot(); pointer(document, 'pointerup'); await settle();
      assert(owner.snapshot()?.authorityGeneration === replacement?.authorityGeneration && owner.snapshot()?.values === replacement?.values
        && !s.root.querySelector('[data-table-live-preview="true"]'), `${domain}: obsolete Brush committed after tune replacement`);
      checks.push(`${domain}: unchanged context/tune retain inline and Brush edits; real replacements cancel them`);
    } finally { s.view.setActive(false); s.host.remove(); }
  }

  for (const domain of ['proposal', 'delay']) {
    const s = await setupVeLifecycleFixture(); s.root.hidden = false;
    try {
      const button = s.root.querySelector(`.ve-${domain}-shared-toolbar button[aria-label="Continuous brush editing"]`);
      const open = async () => { button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await settle();
        const popup = document.querySelector('.ve-table-tool-options'); assert(popup, `${domain}: options did not open`); return popup; };
      const popup = await open();
      s.view.setContext({ ...s.context }); s.view.setTuneModel(s.model, 'test.msq'); await settle();
      assert(popup.isConnected && document.querySelector('.ve-table-tool-options') === popup, `${domain}: no-op update discarded configuration`);
      s.view.setActive(false); s.root.hidden = true; await settle();
      assert(!popup.isConnected && !document.querySelector('.ve-table-tool-options'), `${domain}: body popover survived deactivation`);
      s.root.hidden = false; s.view.setActive(true); await settle();
      await open(); s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } }); await settle();
      assert(!document.querySelector('.ve-table-tool-options'), `${domain}: options survived real replacement`);
      checks.push(`${domain}: configuration survives no-op updates and closes on deactivation/replacement`);
    } finally { s.view.setActive(false); s.host.remove(); }
  }

  const root = document.createElement('section');
  root.innerHTML = '<div class="ve-workbench-quick-controls"><details class="ve-v50-setup-group"><summary>Setup</summary><input></details><button class="ve-v50-advanced-button">Advanced</button></div><details class="ve-workbench-advanced"><summary>Advanced</summary><div>Inputs</div></details><div class="ve-delay-workflow-state">Lambda</div><details><summary>Delay</summary><div data-ve-analyzer="delay-table"></div></details><div class="ve-v50-run-chips"><button class="ve-v50-status-chip">Inputs</button></div>';
  document.body.append(root);
  try {
    const original = root.querySelector('.ve-v50-advanced-button'), group = root.querySelector('.ve-v50-setup-group');
    let clicks = 0, fallback = 0;
    original.onclick = () => { fallback++; };
    original.addEventListener('click', () => { clicks++; });
    installVeAnalyzerV50SetupDisclosurePolicy(root); installVeAnalyzerV50ToolSurfaces(root);
    assert(root.querySelector('.ve-v50-advanced-button') === original, 'Tool installation replaced the original Advanced button');
    group.open = true; original.click(); await settle();
    const panel = root.querySelector('.ve-v50-tool-surface');
    assert(!group.open && !panel.hidden && clicks === 1 && fallback === 0, 'Advanced lost retained listeners or failed disclosure policy');
    original.click(); await settle();
    assert(panel.hidden && !root.querySelector('.ve-workbench-advanced').open && clicks === 2,
      'Advanced fallback action competed with tool closing');
    for (const selector of ['.ve-v50-exclusions-button', '.ve-v50-run-chips button', '.ve-v50-lambda-tool-trigger']) {
      group.open = true; root.querySelector(selector).click(); await settle();
      assert(!group.open && root.querySelectorAll('.ve-v50-tool-surface:not([hidden])').length === 1,
        `Tool opening retained a compact disclosure: ${selector}`);
    }
    checks.push('Advanced retains its original node/listeners; all tool entry points close compact disclosures');
  } finally { root.remove(); }
  return { passed: checks.length, checks };
}
