import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
let nativeFixture;
export async function prepareVeCompletionFocusCheck() {
  const s = await setupVeLifecycleFixture(); s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  const run = s.root.querySelector('.ve-workbench-run'); run.focus(); s.run();
  const deadline = performance.now() + 5000;
  while (!s.view.getPrimaryAnalysis()) { assert(performance.now() < deadline, 'Analysis did not complete'); await settle(); }
  nativeFixture = s;
  return s.root.querySelector('.ve-v50-completion-dialog').contains(document.activeElement);
}
export function checkVeCompletionNativeFocus(expected) {
  const s = nativeFixture, dialog = s.root.querySelector('.ve-v50-completion-dialog');
  if (expected === 'inside') assert(dialog.contains(document.activeElement), 'Native Tab escaped the completion dialog');
  else assert(dialog.hidden && document.activeElement === s.root.querySelector('.ve-workbench-run'), 'Native Escape did not close and restore Run focus');
  return true;
}
export function disposeVeCompletionFocusCheck() { nativeFixture?.view.dispose(); nativeFixture?.host.remove(); nativeFixture = undefined; }
export async function runVeCompletionFocusChecks() {
  const checks = [];
  await prepareVeCompletionFocusCheck(); const s = nativeFixture;
  const dialog = s.root.querySelector('.ve-v50-completion-dialog'), close = s.root.querySelector('.ve-v50-completion-x');
  const view = s.root.querySelector('.ve-v50-completion-view'), summary = s.root.querySelector('.ve-v50-summary-action'), run = s.root.querySelector('.ve-workbench-run');
  const key = (target, value, shiftKey = false) => { const e = new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }); target.dispatchEvent(e); return e; };
  try {
    const primary = s.view.getPrimaryAnalysis(), revision = s.view.sessionRevision, reads = s.reads();
    view.focus(); const forward = key(view, 'Tab');
    assert(forward.defaultPrevented && document.activeElement === close, 'Forward Tab does not wrap at final dialog action');
    const reverse = key(close, 'Tab', true);
    assert(reverse.defaultPrevented && document.activeElement === view, 'Reverse Tab does not wrap at first dialog action');
    checks.push('Dialog boundary Tab/Shift-Tab wrap within existing actions');
    key(view, 'Escape'); assert(dialog.hidden && document.activeElement === run, 'Escape did not restore Run focus');
    checks.push('Escape dismisses summary and restores the original Run focus');
    for (const selector of ['.ve-v50-completion-x', '.ve-v50-completion-dialog footer > button', '.ve-v50-completion-view']) {
      summary.focus(); summary.click(); s.root.querySelector(selector).click();
      assert(dialog.hidden && document.activeElement === summary, 'Dismissal did not restore Summary opener: ' + selector);
    }
    checks.push('Close icon, Close action and View Proposal restore Summary opener');
    summary.focus(); summary.click(); s.view.setActive(false);
    assert(dialog.hidden && document.activeElement !== run && document.activeElement !== summary, 'Hidden view dismissal stole focus back into inactive controls');
    s.view.setActive(true);
    assert(s.view.getPrimaryAnalysis() === primary && s.view.sessionRevision === revision && s.reads() === reads, 'Dialog navigation changed analysis authority');
    checks.push('Inactive dismissal does not restore hidden-view focus or change retained authority');
    return { passed: checks.length, checks };
  } finally { disposeVeCompletionFocusCheck(); }
}
