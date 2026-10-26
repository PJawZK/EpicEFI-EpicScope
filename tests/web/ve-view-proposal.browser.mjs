import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
const change = (control, value) => { control.value = value; control.dispatchEvent(new Event('change', { bubbles: true })); };
export async function runVeViewProposalChecks() {
  const checks = [];
  for (const layout of ['single', 'side-by-side']) for (const initialView of ['proposal', 'weight']) {
    const s = await setupVeLifecycleFixture(); s.root.hidden = false;
    s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
    try {
      const layoutSelect = s.root.querySelector('select[aria-label="VE Analyzer table view"]');
      const resultSelect = s.root.querySelector('select[aria-label="VE Analyzer result view"]');
      change(layoutSelect, layout); change(resultSelect, initialView);
      const targetTab = s.root.querySelector('[data-table-tab="target"]'), veTab = s.root.querySelector('[data-table-tab="ve"]');
      targetTab.click(); s.run();
      const deadline = performance.now() + 5000;
      while (!s.view.getPrimaryAnalysis()) { assert(performance.now() < deadline, 'Fixture analysis did not complete'); await settle(); }
      const dialog = s.root.querySelector('.ve-v50-completion-dialog'); assert(!dialog.hidden, 'Completion dialog unavailable');
      const editOwner = veProposalEditOwner(s.root); editOwner.applyValues([{ row: 0, col: 0, value: 123.456 }]); await settle();
      const primary = s.view.getPrimaryAnalysis(), revision = s.view.sessionRevision, reads = s.reads(), before = editOwner.snapshot();
      const host = s.root.querySelector('[data-ve-analyzer="ve-table-view"]'), panel = host.closest('.ve-workbench-panel');
      const table = host.querySelector('table');
      s.root.querySelector('.ve-v50-completion-view').click(); await settle();
      assert(!panel.hidden && panel.getBoundingClientRect().height > 0 && veTab.getAttribute('aria-selected') === 'true',
        `${layout}/${initialView}: View Proposal did not reveal the VE panel through its navigation owner`);
      assert(resultSelect.value === 'proposal' && layoutSelect.value === layout && dialog.hidden, 'Action did not select working view/dismiss summary or changed layout preference');
      assert(s.view.getPrimaryAnalysis() === primary && s.view.sessionRevision === revision && s.reads() === reads
        && editOwner.snapshot().values[0] === 123.456 && editOwner.snapshot().authorityGeneration === before.authorityGeneration
        && s.model.byName.get('veTable').numericValues[0] === 70 && host.querySelector('table') === table,
        'Presentation action changed authority, loaded traces, lost edits or rebuilt the table');
      targetTab.click(); s.root.querySelector('.ve-v50-summary-action').click(); s.root.querySelector('.ve-v50-completion-view').click(); await settle();
      assert(!panel.hidden && veTab.getAttribute('aria-selected') === 'true' && dialog.hidden && s.reads() === reads && s.view.sessionRevision === revision,
        'Repeated View Proposal with proposal already selected failed or recalculated');
      checks.push(`${layout}/${initialView}: View Proposal reveals working VE through existing navigation, preserving layout, tune, edits, primary analysis and table identity without trace reads`);
    } finally { s.view.dispose(); s.host.remove(); }
  }
  return { passed: checks.length, checks };
}
