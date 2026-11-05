// Real-browser Logger owner checks. Deferred data-source reads control replacement
// ordering without exposing private controllers or instrumenting production code.
import { createLoggerPage } from '../../apps/web/src/pages/logger-page';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const channel = (id, label) => ({ id, sourceName: label, displayName: label, unit: label === 'A' ? 'rpm' : 'krpm', valueType: 'number' });
function fixture(label, batch = false) {
  let count = 6;
  let gate;
  let partial = false;
  const calls = [];
  const channels = ['rpm', 'map', 'blocked'].map((id) => channel(id, label));
  const range = (id, start, length) => {
    if (partial) length = Math.min(2, length);
    return {
      startSampleIndex: start,
      timeMs: Float64Array.from({ length }, (_, index) => (start + index) * 100),
      values: new Float64Array(length).fill(label === 'A' ? 100 : 900),
      validity: new Uint8Array(length).fill(1),
    };
  };
  const read = async (ids, start, length) => {
    calls.push({ ids, start, length });
    const result = new Map(ids.map((id) => [id, range(id, start, length)]));
    if (gate) await gate.promise;
    return result;
  };
  const source = {
    get sampleCount() { return count; },
    sampleRangeForTime(start, end) {
      const first = Math.min(count, Math.max(0, Math.ceil(start / 100)));
      const last = Math.min(count, Math.floor(end / 100) + 1);
      return { startSampleIndex: first, sampleCount: Math.max(0, last - first) };
    },
    readChannelRange: async (id, start, length) => (await read([id], start, length)).get(id),
    ...(batch ? { readChannelsRange: async (ids, start, length) => ({ ranges: await read(ids, start, length), performance: { channelCount: ids.length, cacheHitChannelIds: [], physicalReadCount: 0, physicalBytesRead: 0, physicalReadMs: 0 } }) } : {}),
  };
  const summary = {
    source: { id: `context:${label}`, displayName: label, format: 'TEST', sizeBytes: 0 },
    channels, diagnostics: [], markers: [], timeRange: { startMs: 0, endMs: 500, durationMs: 500 },
  };
  return { source, summary, channels, calls, delay: () => (gate = deferred()), grow: () => { count = 12; }, partial: () => { partial = true; } };
}

export async function runLoggerAnalysisContextChecks() {
  const checks = [];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const logger = createLoggerPage();
  document.body.append(logger.element);
  const set = (data, unavailable = []) => logger.setLog(data.summary, data.source.sampleCount, data.source, { unavailableChannelIds: unavailable });
  try {
    const a = fixture('A'), b = fixture('B');
    set(a);
    logger.setDiagnostics([{code:'delivery',severity:'warning',message:'display wording',recoverable:true,timeMs:250,sourceIntegrity:{kind:'delivery-loss',breaksContinuity:true}}],a.summary.source);
    const old = logger.getAnalysisContext();
    assert(old.source.descriptor?.displayName === 'A' && old.source.descriptor.id === a.summary.source.id, 'Source descriptor was not captured with source lifetime');
    logger.element.hidden = true;
    let rangeMutations = 0; logger.onWorkspaceMutation(() => rangeMutations++);
    const beforeSelection = a.calls.length;
    assert(old.setAnalysisRange({ startMs: 300, endMs: -100 }), 'Current context did not accept/clamp reversed selection');
    const range = logger.getAnalysisContext(), workspaceRange = logger.getWorkspaceState().timeline;
    assert(range.aTimeMs === 0 && range.bTimeMs === 300 && workspaceRange.aTimeMs === 0 && workspaceRange.bTimeMs === 300 && rangeMutations === 1 && a.calls.length === beforeSelection, 'Selection was not atomic, persisted in wrong owner or read hidden data');
    assert(old.setAnalysisRange({ startMs: 0, endMs: 300 }) && rangeMutations === 1, 'Unchanged range created another workspace mutation');
    assert(!old.setAnalysisRange({ startMs: 1000, endMs: 2000 }) && !old.setAnalysisRange({ startMs: NaN, endMs: 300 }) && !old.setAnalysisRange({ startMs: 200, endMs: 200 }) && rangeMutations === 1, 'Invalid range mutated Logger');
    checks.push('Source-bound A/B commit is atomic, clamps reversed bounds, preserves workspace and rejects no-op/invalid mutations without hidden reads');
    set(b);
    assert(old.source.descriptor.displayName === 'A' && logger.getAnalysisContext().source.descriptor.displayName === 'B', 'Source descriptor rebound across replacement');
    assert(!old.setAnalysisRange({ startMs: 100, endMs: 200 }) && logger.getAnalysisContext().aTimeMs === undefined, 'Stale range command changed replacement source');
    checks.push('Old source-bound selection cannot write A/B into replacement Logger source');
    assert(old.sourceIntegrity?.length===1&&old.sourceIntegrity[0].timeMs===250&&old.sourceIntegrity[0].breaksContinuity&&logger.getAnalysisContext().sourceIntegrity?.length===0,'Canonical continuity metadata rebound across replacement');
    checks.push('analysis context captures canonical continuity markers with the original source, independent of display wording');
    const before = b.calls.length;
    const loaded = await old.loadTraces(['rpm']);
    assert(old.source.identity === a.source && loaded[0]?.range.values[0] === 100 && loaded[0].channel === a.channels[0] && b.calls.length === before, 'Retained context used replacement source or metadata');
    checks.push('retained context invoked after replacement reads only its advertised source/metadata');
    assert(old.sourceTimeRange?.startMs === 0 && old.sourceTimeRange?.endMs === 500, 'Retained context lost its authoritative source time extent');
    checks.push('analysis context captures authoritative whole-source time extent with its source lifetime');

    set(a);
    const pendingContext = logger.getAnalysisContext();
    const gate = a.delay();
    const pending = pendingContext.loadTraces(['rpm']);
    set(b, ['rpm']);
    gate.resolve();
    const completed = await pending;
    assert(completed[0]?.channel === a.channels[0] && completed[0].range.values[0] === 100, 'Pending read completed with replacement metadata/availability');
    checks.push('pending single-channel read retains original metadata across replacement');

    const batchA = fixture('A', true), batchB = fixture('B', true);
    set(batchA, ['blocked']);
    const batchContext = logger.getAnalysisContext();
    const batchGate = batchA.delay();
    const batchPending = batchContext.loadTraces(['map', 'rpm', 'map', 'blocked', 'missing']);
    set({ ...batchB, summary: { ...batchB.summary, channels: [batchB.channels[0]] } }, ['rpm']);
    batchGate.resolve();
    const batchResult = await batchPending;
    assert(batchResult.length === 2 && batchResult[0].channel === batchA.channels[1] && batchResult[1].channel === batchA.channels[0], 'Batch completion lost old channel metadata/order');
    assert(batchA.calls.at(-1).ids.join(',') === 'map,rpm', 'Batch did not deduplicate/filter captured availability');
    checks.push('pending batch keeps original channel catalog, order and unavailable filtering');
    const batchReads = batchB.calls.length;
    const retained = await batchContext.loadTraces(['rpm', 'blocked']);
    assert(retained.length === 1 && retained[0].channel === batchA.channels[0] && batchB.calls.length === batchReads, 'Retained context used changed unavailable set');
    checks.push('availability remains captured for later calls, not just pending reads');

    const replacement = logger.getAnalysisContext();
    assert(replacement.source.identity === batchB.source && (await replacement.loadTraces(['rpm', 'map'])).length === 0, 'New context did not reflect current source/catalog/availability');
    checks.push('new context observes replacement source and current unavailable channels');

    logger.setImportError('Controlled unload');
    const empty = logger.getAnalysisContext();
    const fresh = fixture('B');
    set(fresh);
    const emptyReads = fresh.calls.length;
    assert(!empty.source && (await empty.loadTraces(['rpm'])).length === 0 && fresh.calls.length === emptyReads, 'No-source context adopted a later source');
    checks.push('no-source context remains empty after a later load');

    const unloadContext = logger.getAnalysisContext();
    logger.setImportError('Controlled unload');
    assert((await unloadContext.loadTraces(['rpm']))[0]?.channel === fresh.channels[0], 'Unloading erased retained context metadata');
    checks.push('retained context keeps its original source and definitions after Logger unload');

    const live = fixture('A');
    set(live);
    const initialReads = live.calls.length;
    const bounded = logger.getAnalysisContext();
    assert(bounded.source.sampleCount === 6 && live.calls.length === initialReads, 'Context creation eagerly read sample arrays');
    live.grow();
    const full = await bounded.loadTraces(['rpm']);
    assert(full[0].range.values.length === 6 && full[0].complete && live.calls.at(-1).length === 6, 'Old live context read beyond advertised sample count');
    checks.push('old live context full reads remain bounded to its captured sample count');
    const scoped = await bounded.loadTraces(['rpm'], 1000, 200);
    assert(scoped[0]?.range.startSampleIndex === 2 && scoped[0].range.values.length === 4, 'Reversed live scope escaped captured extent');
    const scopeReads = live.calls.length;
    assert((await bounded.loadTraces(['rpm'], 900, 1100)).length === 0 && live.calls.length === scopeReads, 'Outside-snapshot scope read newer samples');
    checks.push('scoped reads clamp to captured extent; outside scopes issue no reads');
    const grown = logger.getAnalysisContext();
    assert(grown.source.identity === live.source && grown.source.sampleCount === 12 && (await grown.loadTraces(['rpm']))[0].range.values.length === 12, 'Fresh context missed live growth');
    checks.push('fresh context on the same live source sees the grown extent');
    live.partial();
    assert(!(await bounded.loadTraces(['rpm']))[0].complete, 'Partial source range reported complete');
    checks.push('completeness still reflects actual coverage of the captured request');

    const failing = fixture('A');
    set(failing);
    const rejectedContext = logger.getAnalysisContext();
    const failure = failing.delay();
    const rejection = rejectedContext.loadTraces(['rpm']).then(() => undefined, (error) => error);
    set(fresh);
    const expected = Error('original source read failed');
    failure.reject(expected);
    assert(await rejection === expected, 'Old source failure was swallowed or substituted');
    checks.push('old source failures propagate to existing controller error/generation ownership');
    return { passed: checks.length, checks };
  } finally {
    logger.element.remove();
  }
}
