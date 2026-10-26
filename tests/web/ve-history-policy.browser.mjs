import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)); };
const key = (target, value) => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));

export async function runVeHistoryPolicyChecks() {
  const checks = [];
  for (const domain of ['proposal', 'delay']) {
    localStorage.setItem('epicscope.veAnalyzer.resultView', 'proposal');
    const s = await setupVeLifecycleFixture(); s.root.hidden = false;
    s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
    try {
      const delay = domain === 'delay', owner = delay ? veDelayEditOwner(s.root) : veProposalEditOwner(s.root);
      if (delay) s.root.querySelector('.ve-v50-lambda-tool-trigger').click();
      const cell = () => s.root.querySelector(delay ? 'td[data-delay-row="0"][data-delay-col="0"]' : 'td[data-ve-row="0"][data-ve-col="0"]');
      const tool = label => s.root.querySelector(`.ve-${domain}-shared-toolbar button[aria-label="${label}"]`);
      const select = () => {
        const target = cell(); target.setPointerCapture = () => {};
        for (const type of ['pointerdown', 'pointerup']) target.dispatchEvent(new PointerEvent(type, { pointerId: 81, pointerType: 'mouse', bubbles: true, cancelable: true }));
      };
      const direct = async value => {
        select(); key(cell(), 'F2'); const input = s.root.querySelector('.ve-table-inline-input');
        assert(input, `${domain}: inline editor unavailable`); input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true })); key(input, 'Enter'); await settle();
      };
      const before = owner.snapshot(); await direct(-5);
      assert(owner.snapshot().values[0] === (delay ? 100 : 0)
        && owner.snapshot().authorityGeneration === before.authorityGeneration + (delay ? 0 : 1),
        `${domain}: shared transaction changed negative direct-entry policy`);
      checks.push(`${domain}: negative direct entry preserves ${delay ? 'rejection without publication' : 'nonnegative Proposal clamping'}`);

      const external = delay ? { row: 0, col: 0, workingMs: 77 } : { row: 0, col: 0, value: 77 };
      assert(owner.applyValues([external]), `${domain}: owner setup rejected`); await settle();
      select(); tool('Revert selected cells').click(); await settle();
      const baseline = delay ? 100 : 70;
      assert(owner.snapshot().values[0] === baseline, `${domain}: Revert used the other domain's baseline policy`);
      assert(cell().dataset.tableValueState === (delay ? 'higher' : 'same'), `${domain}: working display baseline was lost during own publication`);
      tool('Undo').click(); await settle(); assert(owner.snapshot().values[0] === 77, `${domain}: Revert Undo failed`);
      tool('Redo').click(); await settle(); assert(owner.snapshot().values[0] === baseline, `${domain}: Revert Redo failed`);
      select(); key(cell(), 'Delete'); await settle(); assert(owner.snapshot().values[0] === undefined, `${domain}: clear was not recorded`);
      tool('Undo').click(); await settle(); assert(owner.snapshot().values[0] === baseline, `${domain}: clear Undo did not restore value`);
      if (delay) assert(cell().dataset.delayRecommended === '100', 'History changed raw delay recommendation');
      assert(s.model.byName.get('veTable').numericValues[0] === 70, `${domain}: history mutated source TuneModel`);
      checks.push(`${domain}: shared clear/Revert history preserves domain baseline, recommendation and immutable source tune`);

      await direct(145.125);
      if (delay) { const trigger = s.root.querySelector('.ve-v50-lambda-tool-trigger'); trigger.click(); trigger.click(); }
      else {
        const view = s.root.querySelector('select[aria-label="VE Analyzer result view"]');
        for (const value of ['weight', 'proposal']) { view.value = value; view.dispatchEvent(new Event('change', { bubbles: true })); await settle(); }
      }
      tool('Undo').click(); await settle(); assert(owner.snapshot().values[0] === baseline, `${domain}: presentation retired own history`);
      const replacement = delay ? { row: 0, col: 0, workingMs: 234 } : { row: 0, col: 0, value: 234 };
      owner.applyValues([replacement]); await settle();
      tool('Undo').click(); tool('Redo').click(); await settle();
      assert(owner.snapshot().values[0] === 234 && tool('Undo').dataset.commandAvailable === 'false' && tool('Redo').dataset.commandAvailable === 'false',
        `${domain}: external owner publication retained old Undo/Redo`);
      assert(s.reads() === 0, `${domain}: table history loaded traces`);
      checks.push(`${domain}: own history survives presentation; external publication retires both stacks without trace reads`);
    } finally { s.view.setActive(false); s.host.remove(); }
  }
  return { passed: checks.length, checks };
}
