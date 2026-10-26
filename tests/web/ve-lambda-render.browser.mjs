import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
import { veDelayPresentationOwner } from '../../apps/web/src/pages/ve-analyzer-delay-presentation-owner';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)); };
const key = (target, key) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const saved = value => serializeVeDelayTable({ rpmBins: [1000, 2000], loadBins: [50, 100], rows: 2, cols: 2, origin: 'saved-file',
  cells: Array.from({ length: 4 }, (_, i) => ({ row: Math.floor(i / 2), col: i % 2, state: 'measured', workingMs: value,
    recommendedMs: value, workingProvenance: 'measured-recommendation', eventCount: 5, confidence: 'moderate', sourceEvents: [] })) });

export async function runVeLambdaRenderChecks() {
  const checks = [], s = await setupVeLifecycleFixture(); s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  try {
    const host = s.root.querySelector('[data-ve-analyzer="delay-table"]'), empty = host.firstElementChild;
    const owner = veDelayEditOwner(s.root), presentation = veDelayPresentationOwner(s.root);
    const trigger = s.root.querySelector('.ve-v50-lambda-tool-trigger');
    const table = () => host.querySelector('table');
    const cell = () => host.querySelector('[data-delay-row="0"][data-delay-col="0"]');
    assert(!presentation.visible && !table() && owner.snapshot().values.every(value => value === 100) && s.view.getReadiness().canRun,
      'Closed Lambda allocated cells or withheld working authority/readiness');
    s.view.refresh(); s.view.refresh(); await settle();
    assert(host.firstElementChild === empty && !table() && s.reads() === 0, 'Closed refresh painted Lambda or loaded traces');
    checks.push('Closed Lambda defers grid allocation while loaded authority, readiness and refresh remain current');

    trigger.click();
    assert(presentation.visible && cell()?.dataset.delayValue === '100', 'Open did not synchronously render current values');
    key(cell(), 'F2'); const input = s.root.querySelector('.ve-delay-inline-input');
    assert(input, 'Revealed table was not synchronously editable');
    input.value = '137.5'; input.dispatchEvent(new Event('input', { bubbles: true }));
    const rendered = table(), before = owner.snapshot();
    s.view.refresh(); await settle();
    assert(table() === rendered && input.isConnected && input.value === '137.5' && owner.snapshot().values === before.values,
      'Unchanged visible readiness refresh rebuilt the grid or discarded its inline draft');
    key(input, 'Enter'); await settle();
    assert(owner.snapshot().values[0] === 137.5 && owner.snapshot().authorityGeneration === before.authorityGeneration + 1, 'Revealed inline edit failed single publication');
    checks.push('Reveal renders/binds synchronously; unchanged readiness retains grid and inline draft; commit publishes once');

    key(cell(), 'F2'); const cancelled = s.root.querySelector('.ve-delay-inline-input'); cancelled.value = '999';
    cancelled.dispatchEvent(new Event('input', { bubbles: true }));
    const revision = s.view.sessionRevision, generation = owner.snapshot().authorityGeneration;
    trigger.click(); await settle();
    assert(!presentation.visible && !cancelled.isConnected && owner.snapshot().authorityGeneration === generation && s.view.sessionRevision === revision,
      'Closing committed an unsaved draft or changed semantic authority');
    const retained = table();
    assert(owner.applyValues([{ row: 0, col: 0, workingMs: 175 }]), 'Hidden working edit rejected'); await settle();
    assert(table() === retained && cell().dataset.delayValue === '137.5' && owner.snapshot().values[0] === 175,
      'Hidden semantic edit painted the old grid or failed to update authority');
    const file = s.root.querySelector('[data-ve-analyzer="load-delay-file"]');
    Object.defineProperty(file, 'files', { configurable: true, value: [{ name: 'replacement-delay.json', text: async () => saved(200) }] });
    file.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    assert(table() === retained && owner.snapshot().values.every(value => value === 200), 'Hidden replacement file repainted or failed acceptance');
    const accepted = owner.snapshot(); trigger.click();
    assert(table() !== retained && cell().dataset.delayValue === '200' && owner.snapshot().values === accepted.values,
      'Reopening failed to render latest file state or republished authority');
    checks.push('Close cancels drafts; hidden edits/file replacement update authority without painting; reopen shows only latest state');

    const visibleTable = table();
    s.root.querySelector('.ve-v50-advanced-button').click();
    assert(!presentation.visible, 'Switching to Advanced failed to retire Lambda visibility');
    s.view.refresh(); await settle(); assert(table() === visibleTable, 'Advanced refresh repainted hidden Lambda');
    trigger.click(); assert(table() === visibleTable && presentation.visible, 'Unchanged reopen rebuilt Lambda');
    const button = s.root.querySelector('.ve-delay-shared-toolbar button[aria-label="Continuous brush editing"]');
    button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await settle();
    assert(document.querySelector('.ve-table-tool-options'), 'Options failed to open');
    trigger.click(); assert(!document.querySelector('.ve-table-tool-options'), 'Closing Lambda retained its body-mounted configuration');
    trigger.click();
    s.view.setActive(false); await settle(); const inactive = table();
    s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } }); s.view.refresh(); await settle();
    assert(table() === inactive, 'Inactive Lambda painted a deferred source');
    s.view.setActive(true); await settle();
    assert(!presentation.visible && !owner.snapshot(), 'Activation retained old source authority');
    trigger.click();
    assert(!table() && host.dataset.mode === 'none', 'Reveal retained an obsolete source grid');
    assert(s.reads() === 0, 'Lambda presentation loaded traces');
    checks.push('Tool switching and deactivation defer painting, close configuration, and reject stale source presentation on return');
  } finally { s.view.setActive(false); s.host.remove(); }

  const channels = [['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['pw', 'PW', 'ms']]
    .map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));
  const traces = channels.map((channel, index) => ({ channel, complete: true, color: '#58aef6', range: {
    startSampleIndex: 0, timeMs: Float64Array.from({ length: 60 }, (_, i) => i * 100),
    values: Float64Array.from({ length: 60 }, (_, i) => index === 2 ? (i < 12 ? 15 : 14) : index === 3 ? (i < 10 ? 4 : 5) : [1000, 50][index]), validity: new Uint8Array(60).fill(1),
  } }));
  const discovery = await setupVeLifecycleFixture(undefined, { traces });
  try {
    const host = discovery.root.querySelector('[data-ve-analyzer="delay-table"]'), original = host.firstElementChild;
    const owner = veDelayEditOwner(discovery.root);
    const field = discovery.root.querySelector('input[data-role="delay-min-events"]'); field.value = '1'; field.dispatchEvent(new Event('change', { bubbles: true }));
    discovery.root.querySelector('[data-ve-analyzer="grab-delay"]').click();
    const deadline = performance.now() + 10000;
    while (!owner.snapshot()?.values.includes(200)) { assert(performance.now() < deadline, 'Hidden re-grab did not activate recommendation'); await settle(); }
    assert(host.firstElementChild === original && !host.querySelector('table') && discovery.reads() === 1,
      'Hidden discovery/re-grab rebuilt grid or repeated trace loading');
    discovery.root.querySelector('.ve-v50-lambda-tool-trigger').click();
    assert([...host.querySelectorAll('td[data-delay-value]')].some(cell => cell.dataset.delayValue === '200'), 'Reveal missed hidden discovery authority');
    checks.push('Hidden discovery keeps status/buttons/re-grab current, loads once, defers cells and reveals its accepted working table');
  } finally { discovery.view.setActive(false); discovery.host.remove(); }
  return { passed: checks.length, checks };
}
