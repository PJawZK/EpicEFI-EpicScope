import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
const change = (s, value) => { const select = s.root.querySelector('[data-role="scope"]'); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); };
async function setup() {
  const s = await setupVeLifecycleFixture(); s.root.hidden = false;
  s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  let request, loads = [];
  const context = { ...s.context, sourceTimeRange: { startMs: 0, endMs: 5900 },
    savedRanges: [{ label: 'Alpha', startMs: 1000, endMs: 2000 }, { label: 'Beta', startMs: 3000, endMs: 4000 }],
    loadTraces: (...args) => { loads.push(args.slice(1)); return s.context.loadTraces(...args); }, openRangeInLogger: r => { request = r; } };
  s.view.setContext(context);
  return { ...s, context, request: () => request, loads };
}
async function analyze(s) {
  s.run(); const end = performance.now() + 5000;
  while (s.view.getReadiness().pending) { assert(performance.now() < end, 'Scope analysis did not finish'); await settle(); }
  assert(s.view.getPrimaryAnalysis(), 'Scoped primary analysis missing');
}
export async function runVeTimelineScopeChecks() {
  const checks = [];
  {
    const s = await setup();
    try {
      change(s, 'saved:1'); await analyze(s); const primary = s.view.getPrimaryAnalysis(), revision = s.view.sessionRevision, reads = s.reads();
      s.view.setContext({ ...s.context, savedRanges: [...s.context.savedRanges].reverse() }); await settle();
      assert(s.root.querySelector('[data-role="scope"]').value === 'saved:0' && s.view.getPrimaryAnalysis() === primary
        && s.view.sessionRevision === revision && s.reads() === reads && veDelayEditOwner(s.root).snapshot().values[0] === 100,
        'Saved range reorder changed selected bounds/analysis or retired working delay');
      s.view.refresh(); assert(s.root.querySelector('[data-role="scope"]').value === 'saved:0', 'Refresh restored stale saved index');
      checks.push('Saved range reorder preserves semantic selection, primary, revision and working delay');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      change(s, 'ab'); await analyze(s); const revision = s.view.sessionRevision, reads = s.reads();
      s.view.setContext({ ...s.context, aTimeMs: 2000, bTimeMs: 4000 }); await settle();
      assert(veDelayEditOwner(s.root).snapshot()?.values[0] === 100 && !s.view.getPrimaryAnalysis() && s.view.sessionRevision === revision + 1 && s.reads() === reads,
        'Logger A/B update rebuilt/cleared working authority or calculated eagerly');
      await analyze(s); assert(JSON.stringify(s.loads.at(-1)) === '[2000,4000]', 'A/B selection did not reach analysis loader');
      checks.push('Logger A/B update invalidates once, keeps working delay and reaches scoped analysis');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      const row=s.root.querySelector('[data-ve-timeline-current]'),track=s.root.querySelector('[data-ve-range-track]'),label=s.root.querySelector('[data-ve-timeline-label]');
      assert(s.root.querySelectorAll('.ve-timeline-choice').length===1,'More than one timeline row is rendered');
      const colors=[];
      for (const [value, expected] of [['saved:1', [3000,4000]], ['ab', [0,3000]], ['full', [0,5900]]]) {
        const revision=s.view.sessionRevision,reads=s.reads();
        s.root.querySelector(`[data-scope-value="${value}"]`).click();await settle();
        assert(s.root.querySelector('[data-role="scope"]').value===value&&s.view.sessionRevision===revision+1&&s.reads()===reads,'Log Scope did not delegate one semantic scope change');
        const band=s.root.querySelector(value==='ab'?'[data-ve-edit-range]':'[data-ve-scope-range]');
        assert(!band.hidden&&s.root.querySelectorAll('.ve-timeline-choice').length===1,'Selected scope does not use the single track');colors.push(getComputedStyle(band).backgroundColor);
        const bounds=track.getBoundingClientRect(),text=label.getBoundingClientRect();assert(bounds.left-text.right<=8,'Timeline reserves unused filler after its label');
        s.root.querySelector('[data-ve-scope-open]').click();assert(JSON.stringify([s.request().startMs,s.request().endMs])===JSON.stringify(expected),'Logger handoff invented bounds');
        s.root.querySelector(`[data-scope-value="${value}"]`).click();assert(s.view.sessionRevision===revision+1,'Re-selecting active scope invalidated analysis');
      }
      assert(new Set(colors).size===3,'Selected Full/A-B/saved scopes lack distinct colors');
      change(s,'saved:0');await settle();s.view.setContext(s.context);s.view.refresh();await settle();assert(s.root.querySelector('[data-ve-timeline-current]')===row,'No-op context rebuilt shared timeline');
      s.view.setContext({...s.context,sourceTimeRange:{startMs:0,endMs:10000}});await settle();assert(s.root.querySelector('[data-ve-timeline-current]')===row&&s.root.querySelector('[data-ve-scope-range]').style.left==='10%','Extent update rebuilt track or left stale geometry');
      checks.push('One compact timeline follows Log Scope, retains distinct colors and exact bounds, and reuses nodes');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      change(s, 'saved:1'); const revision = s.view.sessionRevision;
      s.view.setContext({ ...s.context, savedRanges: [s.context.savedRanges[0]] }); await settle();
      assert(s.root.querySelector('[data-role="scope"]').value === 'full' && s.view.sessionRevision === revision + 1
        && veDelayEditOwner(s.root).snapshot()?.values[0] === 100, 'Removed saved range silently rebound or cleared delay');
      checks.push('Removed selected saved range falls back explicitly to Full Log without index rebinding');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      s.view.setContext({ ...s.context, sourceTimeRange: undefined, aTimeMs: NaN, savedRanges: [] }); await settle();
      assert(s.root.querySelector('[data-ve-scope-open]').disabled && s.root.querySelector('[data-scope-value="ab"]').disabled
        && s.root.querySelector('[data-ve-scope-start]').textContent === '--:--', 'Unknown extent or invalid Logger range fabricated usable bounds');
      checks.push('Unavailable extent and nonfinite Logger ranges remain unavailable, never fabricated');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      const traces = await s.context.loadTraces(['rpm', 'map', 'afr', 'pw']);
      const held = s.hold(); s.run(); await settle();
      s.root.querySelector('[data-scope-value="saved:0"]').click();
      held.resolve(traces); await settle(); await settle();
      assert(!s.view.getPrimaryAnalysis() && s.root.querySelector('.ve-v50-completion-dialog').hidden, 'Old-scope completion survived timeline selection');
      checks.push('Timeline selection rejects an obsolete pending analysis completion');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  {
    const s = await setup();
    try {
      change(s, 'saved:1'); const node = s.root.querySelector('[data-ve-timeline-current]');
      s.view.setActive(false); s.view.setContext({ ...s.context, savedRanges: [...s.context.savedRanges].reverse() }); await settle();
      assert(s.root.querySelector('[data-ve-timeline-current]') === node, 'Hidden context update rebuilt timeline DOM');
      s.view.setActive(true); await settle();
      assert(s.root.querySelector('[data-role="scope"]').value === 'saved:0' && s.root.querySelector('[data-ve-timeline-label]').textContent === 'Beta', 'Restored timeline lost deferred semantic range selection');
      s.view.setContext({ ...s.context, source: { ...s.context.source, identity: {} } }); await settle();
      assert(s.root.querySelector('[data-role="scope"]').value === 'full' && !veDelayEditOwner(s.root).snapshot(), 'Source replacement retained old-log saved selection/working delay');
      checks.push('Hidden updates defer timeline work; restoration remaps selection and real source replacement retires old authority');
    } finally { s.view.dispose(); s.host.remove(); }
  }
  return { passed: checks.length, checks };
}

let native;
export async function prepareVeTimelineNativeCheck() {
  native = await setup(); native.nativeRevision = native.view.sessionRevision; native.nativeReads = native.reads();
  native.root.querySelector('[data-ve-v50-setup=scope]').open=true;native.root.querySelector('[data-scope-value="ab"]').focus();
}
export function checkVeTimelineNativeCheck(value, offset) {
  assert(native.root.querySelector('[data-role="scope"]').value === value && native.view.sessionRevision === native.nativeRevision + offset
    && native.reads() === native.nativeReads, 'Native timeline key did not delegate one scope change: ' + JSON.stringify({expected:value,actual:native.root.querySelector('[data-role=scope]').value,revision:native.view.sessionRevision,before:native.nativeRevision,reads:native.reads(),beforeReads:native.nativeReads,focus:document.activeElement?.outerHTML.slice(0,160)}));
  native.root.querySelector('[data-ve-v50-setup=scope]').open=true;native.root.querySelector('[data-scope-value="saved:0"]').focus(); return true;
}
export function disposeVeTimelineNativeCheck() { native?.view.dispose(); native?.host.remove(); native = undefined; }
