import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { createVeAnalyzerView as createLegacy } from '../../apps/web/src/pages/ve-analyzer-view-v9';
import { focusVeReadinessTarget } from '../../apps/web/src/pages/ve-analyzer-readiness';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame); };
const key = (target, key) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const change = (target, value) => { target.value = value; target.dispatchEvent(new Event('input', { bubbles: true })); };

export async function runVePresentationLifetimeChecks() {
  const checks = [];
  const s = await setupVeLifecycleFixture(); s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  try {
    const stable = s.root.querySelector('[data-role="stable-ms"]');
    const flow = s.root.querySelector('.ve-delay-workflow-state').textContent;
    const panel = s.root.querySelector('.ve-run-info-popout');
    const info = s.root.querySelector('.ve-v50-run-info');
    change(stable, ''); await settle();
    assert(panel.hidden && !panel.firstChild, 'Closed readiness information eagerly constructed details');
    assert(!s.root.querySelector('.ve-run-blocker-panel').firstChild && s.root.querySelector('.ve-run-quick-fix').hidden
      && s.root.querySelector('.ve-delay-workflow-state').textContent === flow, 'Compact mode rendered hidden legacy projections');
    assert(s.root.querySelector('.ve-v50-run-blocker').textContent.includes('Minimum stable duration'), 'Visible compact status missed blocker');
    checks.push('Compact readiness skips hidden legacy projections and closed detail construction');

    info.focus(); info.click();
    const close = panel.querySelector('.ve-run-info-close'), content = panel.firstChild;
    assert(!panel.hidden && document.activeElement === close && info.getAttribute('aria-expanded') === 'true', 'Readiness opening did not expose/focus its dialog');
    const chipText = s.root.querySelector('.ve-v50-status-chip').firstChild;
    s.view.refresh(); s.view.refresh(); await settle();
    assert(s.root.querySelector('.ve-v50-status-chip').firstChild === chipText, 'Unchanged status projection replaced its text node');
    assert(panel.firstChild === content && document.activeElement === close, 'Unchanged refresh rebuilt an open readiness panel');
    key(close, 'Escape');
    assert(panel.hidden && document.activeElement === info && info.getAttribute('aria-expanded') === 'false', 'Readiness Escape failed to restore visible trigger');
    info.click(); assert(panel.firstChild === content, 'Unchanged reopen rebuilt readiness details');
    panel.querySelector('.ve-run-info-close').click(); assert(document.activeElement === info, 'Readiness Close focused hidden legacy control');
    checks.push('Readiness details retain DOM and restore the visible information trigger on Close/Escape');

    const advanced = s.root.querySelector('.ve-v50-advanced-button'); advanced.focus(); advanced.click();
    const advancedPanel = s.root.querySelector('.ve-v50-tool-surface:has(.ve-v50-tool-advanced)');
    assert(!advancedPanel.hidden && advancedPanel.getAttribute('role') === 'dialog' && !advancedPanel.hasAttribute('aria-modal')
      && document.activeElement === advancedPanel.querySelector('.ve-v50-tool-surface-close'), 'Advanced focus/nonmodal semantics missing');
    key(document.activeElement, 'Escape');
    assert(advancedPanel.hidden && document.activeElement === advanced, 'Advanced Escape did not return focus');
    s.root.querySelector('.ve-v50-run-fix').click(); await settle();
    assert(document.activeElement === stable, 'Compact Fix lost readiness reveal routing');
    checks.push('Advanced is a nonmodal keyboard dialog; Escape restores focus and Fix keeps semantic target routing');

    const delay = s.root.querySelector('.ve-v50-run-chips > .ve-v50-status-chip:nth-child(2)');
    delay.focus(); delay.click();
    const delayPanel = s.root.querySelector('.ve-v50-tool-surface:has(.ve-v50-tool-lambda)');
    const delayCell = delayPanel.querySelector('td[data-delay-row="0"][data-delay-col="0"]');
    key(delayCell, 'F2');
    const draft = delayPanel.querySelector('.ve-delay-inline-input'); assert(draft, 'Lambda keyboard editor did not open');
    change(draft, '999'); key(draft, 'Escape');
    assert(!delayPanel.hidden && !draft.isConnected && veDelayEditOwner(s.root).snapshot().values.every(value => value === 100),
      'Editor Escape closed its parent dialog or committed a cancelled draft');
    delayPanel.querySelector('.ve-v50-tool-surface-close').click();
    assert(delayPanel.hidden && document.activeElement === delay, 'Lambda Close failed to restore actual visible opener');
    delay.click();
    const values = veDelayEditOwner(s.root).snapshot().values;
    const outside = document.createElement('button'); outside.textContent = 'Navigation'; s.host.append(outside); outside.focus();
    s.view.setActive(false); await settle();
    assert(delayPanel.hidden && document.activeElement === outside && !s.view.getReadiness().active, 'Navigation retained tool UI or stole focus');
    s.view.setActive(true); await settle();
    assert(veDelayEditOwner(s.root).snapshot().values === values && s.reads() === 0, 'Navigation damaged working authority or performed analysis');
    checks.push('Lambda restores its visible opener; navigation closes panels without stealing focus or changing working authority');

    change(stable, '0'); await settle();
    const cell = s.root.querySelector('[data-ve-analyzer="ve-table-view"] td[data-ve-row]');
    s.root.dispatchEvent(new CustomEvent('ve-cell-evidence-open', {detail:{cell}}));
    const evidence = s.host.querySelector('.ve-cell-detail-popover');
    const head = evidence.querySelector('header'); head.setPointerCapture = () => {};
    head.dispatchEvent(new PointerEvent('pointerdown', {pointerId:401,bubbles:true,cancelable:true,clientX:30,clientY:30}));
    assert(evidence.dataset.dragging === 'true', 'Inspector drag did not start');
    const gate = s.hold(); s.run(); await settle();
    assert(s.view.getReadiness().pending && s.reads() === 1, 'Pending disposal fixture did not start');
    let notifications = 0; s.view.onReadinessChange(() => notifications++);
    s.view.onPrimaryAnalysisChange(() => notifications++);
    s.view.dispose(); const terminalRevision = s.view.sessionRevision, terminalNotifications = notifications;
    s.view.dispose(); s.view.setActive(true); s.view.setContext(s.context); s.view.setTuneModel(s.model, 'test.msq'); s.view.refresh();
    const left = evidence.style.left;
    document.dispatchEvent(new PointerEvent('pointermove', {pointerId:401,bubbles:true,clientX:400,clientY:400}));
    gate.resolve([]); await settle();
    assert(evidence.hidden && evidence.dataset.dragging === 'false' && evidence.style.left === left,
      'Disposal retained inspector document drag listeners');
    assert(!s.view.getReadiness().active && !s.view.getReadiness().pending && !s.view.getPrimaryAnalysis()
      && s.view.sessionRevision === terminalRevision && s.reads() === 1 && notifications === terminalNotifications,
      'Disposed controller reactivated, notified, performed work or accepted an obsolete completion');
    assert(!s.view.editDelayCells([{row:0,col:0}], { kind:'set', workingMs:999 }), 'Disposed semantic edit was accepted');
    assert(!s.root.querySelector('.ve-table-edit-toolbar') && !s.root.querySelector('.ve-table-brush-overlay'), 'Disposal retained editing toolbars/overlays');
    checks.push('Terminal idempotent disposal cancels pending authority, removes editing resources and rejects reactivation/stale completions');
  } finally { s.view.dispose(); s.host.remove(); }

  // Legacy constructors preserve their independent presentation contract.
  const legacy = await setupVeLifecycleFixture(createLegacy);
  try {
    change(legacy.root.querySelector('[data-role="stable-ms"]'), ''); await settle();
    assert(legacy.root.querySelector('.ve-run-blocker-panel').textContent.includes('Minimum stable duration')
      && !legacy.root.querySelector('.ve-run-quick-fix').hidden, 'Compact opt-in changed the standalone legacy projection');
    checks.push('Standalone legacy factories retain blocker and Quick Fix presentation');
  } finally { legacy.view.dispose(); legacy.host.remove(); }

  // Delayed replacement file completion cannot resurrect authority after teardown.
  const load = await setupVeLifecycleFixture();
  try {
    let release; const input = load.root.querySelector('[data-ve-analyzer="load-delay-file"]');
    Object.defineProperty(input, 'files', { configurable: true, value: [{name:'late.json', text:()=>new Promise(resolve=>{release=resolve;})}] });
    input.dispatchEvent(new Event('change', {bubbles:true})); await settle(); assert(release, 'File replacement did not start');
    const outside = document.createElement('button'); outside.textContent = 'New view'; load.host.append(outside);
    load.root.hidden = false;
    focusVeReadinessTarget(load.root, '[data-role="rpm"]'); outside.focus();
    load.view.dispose(); release('{}'); await settle();
    assert(load.root.hidden && document.activeElement === outside, 'Queued readiness focus escaped terminal disposal');
    assert(!load.view.getReadiness().active && !veDelayEditOwner(load.root).snapshot(), 'Late file completion restored disposed authority');
    checks.push('Replacement file completion and queued readiness focus are rejected after terminal disposal');
  } finally { load.view.dispose(); load.host.remove(); }
  return { passed:checks.length, checks };
}
