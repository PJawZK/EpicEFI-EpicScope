import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
import { createTimelineShell } from '../../apps/web/src/components/timeline-shell';
import { createGraphViewport } from '../../apps/web/src/components/graph-viewport';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
export async function runVeTimelineSelectionChecks() {
  const s = await setupVeLifecycleFixture(); s.root.hidden = false; s.host.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#081018';
  const checks = []; let commits = 0;
  let context = { ...s.context, aTimeMs: undefined, bTimeMs: undefined, savedRanges: [], sourceTimeRange: { startMs: 0, endMs: 5900 },
    setAnalysisRange: ({ startMs, endMs }) => { commits++; context = { ...context, aTimeMs: startMs, bTimeMs: endMs }; s.view.setContext(context); return true; } };
  s.view.setContext(context); await settle();
  const field = () => s.root.querySelector('select[data-role=scope]');
  const track = () => s.root.querySelector('[data-ve-range-track]');
  const pointer = (node, type, fraction) => { const rect = track().getBoundingClientRect(); node.dispatchEvent(new PointerEvent(type, { pointerId: 43, pointerType: 'mouse', button: 0, bubbles: true, cancelable: true, clientX: rect.left + rect.width * fraction, clientY: rect.top + rect.height / 2 })); };
  const drag = async (start, end, target = track()) => { track().setPointerCapture = () => {}; pointer(target, 'pointerdown', start); pointer(track(), 'pointermove', end); pointer(track(), 'pointerup', end); await settle(); };
  try {
    assert(track(), 'VE scope overview has no range selection track');
    const choices = s.root.querySelectorAll('.ve-v50-scope-choice');
    assert(choices.length === 2 && choices[1].disabled && field().value === 'full', 'Full Log and unavailable Selected Range choices not explicit');
    s.run(); const end = performance.now() + 10000;
    while (!s.view.getPrimaryAnalysis() || s.view.getReadiness().pending) { assert(performance.now() < end, 'Timeline fixture run timed out'); await settle(); }
    const primary = s.view.getPrimaryAnalysis(), revision = s.view.sessionRevision, reads = s.reads();
    track().setPointerCapture = () => {}; pointer(track(), 'pointerdown', 0.2); pointer(track(), 'pointermove', 0.8);
    assert(commits === 0 && s.view.getPrimaryAnalysis() === primary && field().value === 'full', 'Pointer preview changed analytical authority');
    pointer(track(), 'pointerup', 0.8); await settle();
    assert(commits === 1 && Math.abs(context.aTimeMs - 1180) < 1e-6 && Math.abs(context.bTimeMs - 4720) < 1e-6 && field().value === 'ab', 'Gesture did not commit real A/B bounds and select them');
    assert(!s.view.getPrimaryAnalysis() && s.view.sessionRevision === revision + 1 && s.reads() === reads && veDelayEditOwner(s.root).snapshot().values[0] === 100, 'Range selection invalidated twice, loaded traces or lost working delay');
    checks.push('Initial Full Log exposes two choices; drag previews locally and commits one selected A/B range without calculation');
    const before = s.view.sessionRevision;
    await drag(0.2, 0.3, s.root.querySelector('[data-ve-range-handle=a]'));
    assert(commits === 2 && Math.abs(context.aTimeMs - 1770) < 1e-6 && Math.abs(context.bTimeMs - 4720) < 1e-6 && s.view.sessionRevision === before + 1, 'A handle did not adjust the existing range once');
    checks.push('A/B handles adjust the retained Logger range through the same semantic owner');
    const handle = s.root.querySelector('[data-ve-range-handle=b]'), oldEnd = context.bTimeMs;
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); await settle();
    assert(context.bTimeMs < oldEnd && commits === 3, 'Keyboard slider adjustment did not reach owner');
    checks.push('Keyboard boundary adjustment uses the same commit path');
    const count = commits, a = context.aTimeMs, b = context.bTimeMs;
    pointer(track(), 'pointerdown', 0.1); pointer(track(), 'pointermove', 0.9); pointer(track(), 'pointercancel', 0.9); await settle();
    assert(commits === count && context.aTimeMs === a && context.bTimeMs === b, 'Cancelled gesture committed a preview');
    pointer(track(), 'pointerdown', 0.1); pointer(track(), 'pointermove', 0.9); s.view.setActive(false); pointer(track(), 'pointerup', 0.9); s.view.setActive(true); await settle();
    assert(commits === count, 'Inactive gesture committed');
    checks.push('Pointer cancellation and hidden-view transitions reject uncommitted selection');
    pointer(track(), 'pointerdown', 0.1); pointer(track(), 'pointermove', 0.9);
    context = { ...context, source: { ...context.source, identity: {} } }; s.view.setContext(context); pointer(track(), 'pointerup', 0.9); await settle();
    assert(commits === count, 'Old gesture wrote into a replacement source');
    checks.push('Replacement context retires an in-progress gesture');
    await drag(0.9, 0.1);
    assert(Math.abs(context.aTimeMs - 590) < 1e-6 && Math.abs(context.bTimeMs - 5310) < 1e-6, 'Reverse gesture was not normalized');
    const retainedA = context.aTimeMs, retainedB = context.bTimeMs;
    field().value='full';field().dispatchEvent(new Event('change',{bubbles:true})); await settle();
    assert(field().value === 'full' && context.aTimeMs === retainedA && context.bTimeMs === retainedB, 'Full Log deleted selected range');
    checks.push('Reverse drags normalize bounds; Full Log retains the editable range for later reuse');
    field().value='ab';field().dispatchEvent(new Event('change',{bubbles:true}));await settle();
    const width = context.bTimeMs - context.aTimeMs;
    await drag(0.5, 1, s.root.querySelector('[data-ve-edit-range]'));
    assert(Math.abs(context.bTimeMs - 5900) < 1e-6 && Math.abs(context.bTimeMs - context.aTimeMs - width) < 1e-6, 'Moving selection failed to preserve width at source boundary');
    checks.push('Dragging the band preserves its duration and clamps movement to real source extent');
    const acceptedA = context.aTimeMs, acceptedB = context.bTimeMs;
    context = { ...context, setAnalysisRange: () => false }; s.view.setContext(context);
    await drag(0.1, 0.8);
    assert(context.aTimeMs === acceptedA && context.bTimeMs === acceptedB, 'Rejected owner command was presented as accepted selection');
    pointer(track(), 'pointerdown', 0.1); pointer(track(), 'pointermove', 0.8);
    track().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); pointer(track(), 'pointerup', 0.8);
    assert(context.aTimeMs === acceptedA && context.bTimeMs === acceptedB, 'Escape committed preview');
    checks.push('Rejected commits and Escape cannot fabricate authoritative A/B values');
    const hidden = document.createElement('section'); hidden.hidden = true; hidden.style.cssText = 'width:600px;height:450px';
    const timeline = createTimelineShell(), graph = createGraphViewport(); graph.element.style.cssText = 'width:600px;height:200px';
    hidden.append(timeline.element, graph.element); document.body.append(hidden);
    try {
      const count = 320459, values = new Float64Array(count).fill(10), timeMs = Float64Array.from({ length: count }, (_, i) => i), validity = new Uint8Array(count).fill(1);
      let arrayReads = 0;
      const range = { startSampleIndex: 0, timeMs, validity, get values() { arrayReads++; return values; } };
      const channel = { id: 'rpm', sourceName: 'RPM', displayName: 'RPM', valueType: 'number', unit: 'rpm' };
      const source = { sampleCount: count, sampleRangeForTime: () => ({ startSampleIndex: 0, sampleCount: count }), readChannelRange: async () => { throw Error('Unexpected source read'); } };
      const extent = { startMs: 0, endMs: count - 1, durationMs: count - 1 };
      timeline.setTimeRange(extent, count); timeline.setOverviewContent([{ channelId: 'rpm', channelName: 'RPM', range, color: '#fff' }], []);
      graph.setLog([channel], source, extent); graph.activatePreloadedChannels(new Map([['rpm', range]]));
      arrayReads = 0; timeline.setAnalysisRange(100, 200); graph.setAnalysisRange(100, 200);
      assert(arrayReads === 0, 'Hidden A/B update inspected cached full-log arrays');
      hidden.hidden = false;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      assert(arrayReads > 0, 'Existing resize owners did not paint after reveal');
      graph.clearChannels(); timeline.setOverviewContent([], []);
      checks.push('Hidden Logger graph/overview range updates do not inspect320459 cached values; existing resize owners paint on reveal');
    } finally { hidden.remove(); }
    return { passed: checks.length, checks };
  } finally { s.view.dispose(); s.host.remove(); }
}
