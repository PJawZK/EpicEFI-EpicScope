import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
const channels = [['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['pw', 'PW', 'ms']]
  .map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));
const traces = channels.map((channel, index) => ({ channel, complete: true, color: '#58aef6', range: {
  startSampleIndex: 0, timeMs: Float64Array.from({ length: 60 }, (_, i) => i * 100),
  values: Float64Array.from({ length: 60 }, (_, i) => index === 2 ? (i < 12 ? 15 : 14) : index === 3 ? (i < 10 ? 4 : 5) : [1000, 50][index]),
  validity: new Uint8Array(60).fill(1),
} }));
async function setup() {
  const s = await setupVeLifecycleFixture(undefined, { channels, traces }); s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  s.view.setTuneModel({ ...s.model }, 'initial.msq');
  const minimum = s.root.querySelector('input[data-role="delay-min-events"]'); minimum.value = '1'; minimum.dispatchEvent(new Event('change', { bubbles: true }));
  const grab = () => s.root.querySelector('[data-ve-analyzer="grab-delay"]').click();
  const use = s.root.querySelector('[data-ve-analyzer="use-delay"]');
  grab(); await settle();
  assert(!use.disabled && s.root.querySelector('[data-ve-analyzer=save-delay]').disabled, 'Initial fixture must remain inactive recommendation: ' + JSON.stringify(s.view.getReadiness()));
  use.click(); await settle();
  const owner = veDelayEditOwner(s.root); assert(owner.snapshot().values.includes(200), 'Initial fixture recommendation not activated');
  owner.applyValues([{ row: 0, col: 0, workingMs: 177 }]); await settle();
  return { ...s, owner, grab, use };
}
export async function runVeDelayWorkflowChecks() {
  const checks = [];
  for (const kind of ['failure', 'refresh']) {
    const s = await setup();
    try {
      const before = s.owner.snapshot(), revision = s.view.sessionRevision;
      const held = s.hold(); s.grab(); await settle();
      if (kind === 'failure') held.reject(Error('Discovery read failed'));
      else s.view.refresh();
      await settle();
      assert(s.owner.snapshot().values[0] === 177 && s.view.sessionRevision === revision && s.owner.snapshot().authorityGeneration === before.authorityGeneration,
        `${kind}: stale recommendation replaced working edits without a successful discovery`);
      if (kind === 'failure') { s.view.refresh(); assert(s.root.querySelector('[data-ve-analyzer="delay-result-title"]').textContent === 'Could not discover lambda delays', 'Discovery error hidden by activation/refresh'); }
      else { assert(s.root.querySelector('[data-ve-analyzer="delay-result-title"]').textContent.startsWith('Analyzing'), 'Refresh erased pending discovery feedback'); held.resolve(traces); await settle(); assert(s.owner.snapshot().values[0] === 200 && s.view.sessionRevision === revision + 1, 'Successful re-grab failed to replace edits once'); }
      checks.push(`${kind}: only fresh successful discovery may replace working edits`);
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      const revision = s.view.sessionRevision, held = s.hold(); s.grab();
      const flat = traces.map(t => ({ ...t, range: { ...t.range, values: new Float64Array(t.range.values.length).fill(t.range.values[0]) } }));
      held.resolve(flat); await settle();
      assert(s.owner.snapshot().values[0] === 177 && s.view.sessionRevision === revision && s.use.disabled, 'Insufficient discovery replaced accepted working edits');
      checks.push('A successful search with no usable recommendation keeps working edits and cannot activate');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      const revision = s.view.sessionRevision, held = s.hold(); s.grab(); held.resolve([]); await settle(); s.view.refresh();
      assert(s.owner.snapshot().values[0] === 177 && s.view.sessionRevision === revision
        && s.root.querySelector('[data-ve-analyzer="delay-result-title"]').textContent === 'Could not discover lambda delays', 'Unavailable scoped channels did not preserve working authority and actionable feedback');
      checks.push('Unavailable scoped channels retain working edits and show a persistent discovery error');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      s.view.setTuneModel({ ...s.model }, 'recommendation-only.msq'); s.grab(); await settle();
      assert(s.view.getReadiness().delayState === 'recommendation', 'Recommendation-only readiness fixture missing');
      const held = s.hold(); s.grab(); held.resolve([]); await settle();
      assert(s.view.getReadiness().delayState === 'missing' && s.use.disabled, 'Missing traces left readiness advertising a withdrawn recommendation');
      checks.push('Unavailable scoped channels withdraw recommendation-only readiness through the existing owner');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  const menu = document.querySelector('.load-data-menu');
  const selectors = ['load-ini', 'load-msq', 'open-log', 'unload-log', 'shim-source-button'];
  const order = [...menu.children].flatMap(el => selectors.filter(name => el.classList.contains(name)));
  assert(JSON.stringify(order) === JSON.stringify(selectors), 'Runtime Load Data ordering changed: ' + order);
  checks.push('Runtime Load Data order remains INI, MSQ, Log, Unload, Connect with existing owner');
  return { passed: checks.length, checks };
}

export async function runVeDelayGrabPresentationChecks() {
  const checks = [];
  for (const outcome of ['success', 'error', 'empty', 'flat', 'stale', 'hidden']) {
    const s = await setup();
    try {
      const surface = s.root.querySelector('.ve-v50-tool-surface:has(.ve-v50-tool-lambda)');
      const grab = s.root.querySelector('.ve-v50-grab-delay');
      assert(surface.hidden, 'Fixture unexpectedly opens the Lambda tool');
      const before = s.owner.snapshot(), reads = s.reads(), held = s.hold();
      grab.click(); await settle();
      assert(surface.hidden, 'Grab lambda delays opened the table instead of only discovering values');
      const feedback = s.root.querySelector('.ve-v50-delay-feedback');
      assert(!feedback.hidden && feedback.dataset.state === 'pending' && grab.disabled && s.reads() === reads + 1, 'Hidden-table discovery lacks visible progress or single-request guard');
      grab.click(); s.view.refresh(); await settle();
      assert(s.reads() === reads + 1 && feedback.dataset.state === 'pending' && surface.hidden, 'Refresh or repeated click restarted discovery or opened table');
      if (outcome === 'stale') s.view.setTuneModel({ ...s.model }, 'new-session.msq');
      if (outcome === 'hidden') { s.view.setActive(false); assert(feedback.hidden, 'Inactive view retained operation feedback'); }
      if (outcome === 'error') held.reject(Error('Controlled discovery read error'));
      else held.resolve(outcome === 'empty' ? [] : outcome === 'flat' ? traces.map(trace => ({ ...trace, range: { ...trace.range, values: new Float64Array(60).fill(trace.range.values[0]) } })) : traces);
      await settle();
      if (outcome === 'hidden') { s.view.setActive(true); await settle(); }
      assert(surface.hidden, `${outcome}: completion opened table`);
      if (outcome === 'success') assert(s.owner.snapshot().values[0] === 200 && feedback.dataset.state === 'success', 'Fresh discovery failed to replace working177 with200');
      else if (outcome === 'stale') assert(!s.owner.snapshot() && feedback.hidden && !grab.textContent.includes('Grabbing'), 'Old discovery/status completed into replacement session');
      else if (outcome === 'flat' || outcome === 'hidden') assert(s.owner.snapshot().values === before.values && !grab.disabled && !grab.textContent.includes('Grabbing') && (outcome !== 'flat' || feedback.dataset.state === 'warning'), 'No-event/hidden discovery changed working values or left progress stuck');
      else assert(s.owner.snapshot().values === before.values && feedback.dataset.state === 'error' && !grab.disabled, 'Failed discovery lost working authority, actionable feedback or retry');
      checks.push(`${outcome}: discover without opening table; retain typed progress/result and correct working authority`);
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      s.view.setTuneModel({ ...s.model }, 'recommendation.msq');
      const surface = s.root.querySelector('.ve-v50-tool-surface:has(.ve-v50-tool-lambda)');
      s.root.querySelector('.ve-v50-grab-delay').click(); await settle();
      assert(surface.hidden && s.view.getReadiness().delayState === 'recommendation' && s.root.querySelector('[data-ve-analyzer=save-delay]').disabled, 'New recommendation was activated or shown automatically');
      s.root.querySelector('.ve-v50-use-delay').click(); await settle();
      assert(surface.hidden && s.owner.snapshot().values[0] === 200 && s.view.getReadiness().delayState === 'working', 'Explicit activation did not remain independent from table opening');
      s.root.querySelector('.ve-v50-run-chips > .ve-v50-status-chip:nth-child(2)').click(); await settle();
      assert(!surface.hidden && surface.querySelector('table.ve-delay-table'), 'Explicit Lambda action did not open retained table');
      s.root.querySelector('.ve-v50-grab-delay').click(); await settle();
      assert(!surface.hidden, 'Grab unexpectedly closed an already-open table');
      checks.push('Recommendation/activation/opening stay separate; an explicitly open table stays open');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  return { passed: checks.length, checks };
}
