import { describe, expect, it } from 'vitest';
import { ObservabilityRecorder } from '../../apps/web/src/observability/recorder';
import { PerformanceEvidence } from '../../apps/web/src/observability/producers/performance';
import { buildPerformanceReport } from '../../apps/web/src/observability/reports/performance-report';
import { performanceFixtures as f } from './performance-fixtures';
const setup = (options: Partial<ConstructorParameters<typeof ObservabilityRecorder>[0]> = {}) => {
  const recorder = new ObservabilityRecorder({ sessionId: 'perf', maxRecordBytes: 8192, ...options });
  return { recorder, bridge: new PerformanceEvidence(recorder) };
};
describe('performance evidence projection', () => {
  it('round-trips every existing run category and merges validation without mutating inputs', () => {
    const { bridge } = setup();
    bridge.record('load', f.Load); bridge.record('ini', f.IniLoad); bridge.record('binding', f.ChannelBinding);
    bridge.record('restore', f.WorkspaceRestore); bridge.record('channel', f.Channel); bridge.record('validation', f.Validation);
    const result = bridge.project();
    expect(result.loadRuns).toEqual([{ ...f.Load, ...f.Validation }]);
    expect(result.iniLoadRuns).toEqual([f.IniLoad]); expect(result.bindingRuns).toEqual([f.ChannelBinding]);
    expect(result.workspaceRestoreRuns).toEqual([f.WorkspaceRestore]); expect(result.channelRuns).toEqual([f.Channel]);
    expect(f.Load).not.toHaveProperty('validationMode');
    expect(result.incomplete).toBe(0); expect(result.truncated).toBe(0);
  });
  it('preserves worker/cache scope, slow physical reads, all decode phases and resource payloads', () => {
    const { bridge } = setup();
    const blob = { scope: 'physical/source/cache\n'.repeat(200), pageSizeBytes: 32, cacheLimitBytes: 96, pinnedCacheLimitBytes: 64, physicalReadCount: 7, physicalReadMs: 20, physicalReadMinMs: 1, physicalReadAverageMs: 2, physicalReadMaxMs: 5, slowestReads: [{ offset: 10, bytes: 30, durationMs: 5 }] };
    const decode = { recordedAt: 0, channelCount: 3, sampleCount: 320459, batchCount: 2, totalMs: 10, cacheResolveMs: 1, batchPlanMs: 1, sourceReadAwaitMs: 2, decodeTransformMs: 2, resultAssemblyMs: 1, cacheStoreMs: 1 };
    bridge.record('load', { ...f.Load, workerSourceRuntime: blob }); bridge.record('blob', blob); bridge.record('decode', decode);
    const result = bridge.project();
    expect(result.loadRuns[0]?.workerSourceRuntime).toEqual(blob); expect(result.blob).toEqual(blob); expect(result.decode).toEqual(decode);
    const report = buildPerformanceReport(result); expect(report).toContain(blob.scope); expect(report).toContain('slowRead1=offset:10;bytes:30;ms:5.00');
  });
  it('clear/new-load reset only the Perf lens and preserve other diagnostic history', () => {
    const { bridge, recorder } = setup();
    recorder.record({ recordKind: 'event', subsystem: 'runtime', component: 'runtime', name: 'runtime.error', origin: 'async', severity: 'error' });
    bridge.record('ini', f.IniLoad); bridge.record('load', f.Load); bridge.record('restore', f.WorkspaceRestore); bridge.record('channel', f.Channel);
    bridge.record('load', { ...f.Load, fileName: 'next.mlg' });
    expect(bridge.project().workspaceRestoreRuns).toEqual([]); expect(bridge.project().channelRuns).toEqual([]);
    expect(bridge.project().iniLoadRuns).toHaveLength(1);
    bridge.clear(); expect(bridge.project().loadRuns).toEqual([]);
    expect(recorder.countNamed('runtime.error')).toBe(1); expect(recorder.countNamed('performance.load')).toBe(2);
  });
  it('never presents partial multi-record measurements as complete after pressure', () => {
    const { bridge, recorder } = setup({ maxRecords: 3 });
    bridge.record('restore', f.WorkspaceRestore);
    const state = bridge.project(); expect(state.workspaceRestoreRuns).toEqual([]); expect(state.incomplete).toBeGreaterThan(0);
    expect(buildPerformanceReport(state)).toContain('[Performance evidence loss]'); expect(recorder.status().records).toBeLessThanOrEqual(3);
  });
  it('retains a bounded report tail and exposes shared retention loss under a storm', () => {
    const { bridge, recorder } = setup({ maxRecords: 400 });
    for (let i = 0; i < 1000; i++) bridge.record('channel', { ...f.Channel, channelName: `channel ${i}` });
    const state = bridge.project(); expect(state.channelRuns.at(-1)?.channelName).toBe('channel 999');
    expect(state.channelRuns.length).toBeLessThanOrEqual(50); expect(recorder.status().records).toBeLessThanOrEqual(400);
    expect(buildPerformanceReport(state)).toContain('[Shared session retention]');
  });
  it('marks explicit payload truncation and ignores unrecognized/domain fields', () => {
    const { bridge, recorder } = setup();
    const run = { ...f.IniLoad, fileName: '界'.repeat(70000), rawSamples: new Float64Array(320459) };
    bridge.record('ini', run); const state = bridge.project();
    expect(state.truncated).toBe(1); expect(state.iniLoadRuns[0]?.fileName.length).toBe(65536);
    expect(recorder.status().rejected).toBe(0); expect(state.iniLoadRuns[0]).not.toHaveProperty('rawSamples');
    expect(buildPerformanceReport(state)).toContain('truncatedFields=1');
  });
  it('contains hostile measurement getters at the producer boundary', () => {
    const { bridge, recorder } = setup(); const bad = { ...f.Channel };
    Object.defineProperty(bad, 'channelName', { get() { throw Error('denied'); } });
    expect(() => bridge.record('channel', bad)).not.toThrow(); expect(bridge.project().channelRuns).toEqual([]);
    expect(recorder.countNamed('observability.performance-producer.failed')).toBe(1);
  });
  it('caches one immutable derived projection and invalidates on writes and age expiry', () => {
    let now = 0; const { bridge } = setup({ maxAgeMs: 10, monotonicNow: () => now });
    bridge.record('channel', f.Channel); const state = bridge.project();
    expect(bridge.project()).toBe(state); expect(Object.isFrozen(state.channelRuns[0])).toBe(true);
    now = 11; expect(bridge.project()).not.toBe(state); expect(bridge.project().channelRuns).toEqual([]);
    bridge.record('load', f.Load); expect(bridge.project().loadRuns).toHaveLength(1);
  });
  it('keeps reports for separate component owners isolated in one recorder', () => {
    const { bridge, recorder } = setup(); const other = new PerformanceEvidence(recorder);
    bridge.record('channel', f.Channel); other.record('load', f.Load); other.clear();
    expect(bridge.project().channelRuns).toEqual([f.Channel]); expect(other.project().channelRuns).toEqual([]);
  });
  it('does not invent operation durations or conflate cached CPU with physical reads', () => {
    const { bridge, recorder } = setup(); bridge.record('channel', f.Channel);
    const record = recorder.snapshot().find(r => r.name === 'performance.channel');
    expect(record?.durationMs).toBe(f.Channel.totalMs); expect(record?.operationId).toBeUndefined();
    const text = buildPerformanceReport(bridge.project()); expect(text).toContain('readDecode=18.75 ms'); expect(text).toContain('physicalReads=0; physicalBytes=0; physicalReadMs=0.00 ms');
  });
  it('deduplicates unchanged resource probes without hiding expiry or later resource updates', () => {
    let now = 0; const { bridge, recorder } = setup({ maxAgeMs: 10, monotonicNow: () => now });
    bridge.captureProbes(() => ({ activeTraceRangeBytes: 123 })); bridge.project();
    const sequence = recorder.status().lastSequence;
    bridge.captureProbes(() => ({ activeTraceRangeBytes: 123 })); expect(recorder.status().lastSequence).toBe(sequence);
    bridge.captureProbes(() => ({ activeTraceRangeBytes: 456 })); expect(bridge.project().memory?.runtime?.activeTraceRangeBytes).toBe(456);
    now = 11; bridge.captureProbes(() => ({ activeTraceRangeBytes: 456 }));
    expect(recorder.status().lastSequence).toBeGreaterThan(sequence); expect(bridge.project().memory?.runtime?.activeTraceRangeBytes).toBe(456);
  });

  it('contains failed owner resource probes without breaking the existing report lens', () => {
    const { bridge, recorder } = setup(); bridge.record('load', f.Load);
    expect(() => bridge.captureProbes(() => { throw Error('resource getter denied'); })).not.toThrow();
    expect(bridge.project().loadRuns).toEqual([f.Load]);
    expect(recorder.countNamed('observability.performance-probe.failed')).toBe(1);
  });

  it('preserves maximally escaped bounded strings within the shell byte allowance', () => {
    const { bridge, recorder } = setup(); const fileName = '\ud800'.repeat(2000);
    bridge.record('load', { ...f.Load, fileName });
    expect(bridge.project().loadRuns[0]?.fileName).toBe(fileName); expect(recorder.status().rejected).toBe(0);
  });

});
