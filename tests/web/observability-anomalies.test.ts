import { describe, expect, it, vi } from 'vitest';
import { ANOMALY_POLICY, AnomalyDetector } from '../../apps/web/src/observability/anomaly-detector';
import { evaluateHealthRules } from '../../apps/web/src/observability/health-rules';
import { recordHealthSnapshot } from '../../apps/web/src/observability/producers/health';
import { ObservabilityRecorder } from '../../apps/web/src/observability/recorder';
import { createOperationFactory } from '../../apps/web/src/observability/operation';
import { buildSessionEvidence } from '../../apps/web/src/observability/reports/session-report';
import { buildAnomalyReport } from '../../apps/web/src/observability/reports/anomaly-report';
import type { RecordInput } from '../../apps/web/src/observability/record';
const event: RecordInput = { recordKind: 'event', subsystem: 'owners', component: 'test-owner', name: 'owner.changed', origin: 'programmatic', priority: 'detail', metadata: { ownerId: 'one' } };
function fixture(options: Partial<ConstructorParameters<typeof ObservabilityRecorder>[0]> = {}) {
  let time = 0;
  const recorder = new ObservabilityRecorder({ sessionId: 'anomalies', detectAnomalies: true, wallNow: () => 1000 + time, monotonicNow: () => time, ...options });
  const anomalies = (code?: string) => recorder.snapshot().filter(r => r.name === 'anomaly.detected' && (!code || r.metadata?.ruleCode === code));
  return { recorder, anomalies, advance: (value: number) => { time = value; } };
}
const clean = { hasChannelDataSource: true, channelDefinitionCount: 10, catalogChannelCount: 10, renderableAssignedChannelCount: 1, unavailableAssignedChannelCount: 0, activeTraceCount: 1 };
const context = { logLoaded: true, iniLoaded: true, bindingActive: true, runtimeErrorCount: 0 };

describe('bounded evidence-based anomaly rules', () => {
  it('ports every existing issue/warning to a stable code without making Logger the detector owner', () => {
    expect(evaluateHealthRules(clean, context)).toEqual([]);
    const bad = { ...clean, hasChannelDataSource: false, channelDefinitionCount: 0, renderableAssignedChannelCount: 3, unavailableAssignedChannelCount: 2, activeTraceCount: 1 };
    const f = fixture(); recordHealthSnapshot(f.recorder, bad, { ...context, bindingActive: false, runtimeErrorCount: 2 });
    expect(f.anomalies().map(r => [r.metadata?.ruleCode, r.severity])).toEqual([
      ['logger.missing-source', 'error'], ['logger.missing-channels', 'error'], ['logger.missing-traces', 'error'],
      ['logger.unavailable-channels', 'warning'], ['runtime.errors', 'error'], ['logger.missing-binding', 'warning'],
    ]);
    recordHealthSnapshot(f.recorder, { ...clean, activeTraceCount: 2 }, context);
    expect(f.anomalies('logger.excess-traces')).toHaveLength(1);
  });
  it('preserves binding/loaded guards, healthy state, and exact rule ordering', () => {
    expect(evaluateHealthRules(clean, { ...context, bindingActive: false })).toEqual([]);
    expect(evaluateHealthRules({ ...clean, hasChannelDataSource: false, channelDefinitionCount: 0, activeTraceCount: 0 }, { ...context, logLoaded: false })).toEqual([]);
    expect(evaluateHealthRules({ ...clean, catalogChannelCount: 11 }, { ...context, iniLoaded: false, bindingActive: false })).toEqual([]);
    const f = fixture(); recordHealthSnapshot(f.recorder, clean, context);
    f.recorder.record({ ...event, name: 'health.snapshot', metadata: {} });
    expect(f.anomalies()).toEqual([]);
  });
  it('does not record or evaluate when disabled and contains no automatic hooks', () => {
    const f = fixture({ detectAnomalies: false });
    for (let i = 0; i < 500; i++) f.recorder.record(event);
    f.advance(100000); f.recorder.checkAnomalies();
    expect(f.anomalies()).toEqual([]); expect(f.recorder.anomalyStatus()).toBeUndefined();
  });
  it('detects exact coalesced repetition at threshold and references original sequence range', () => {
    const f = fixture();
    for (let i = 0; i < ANOMALY_POLICY.burstCount - 1; i++) f.recorder.record(event);
    expect(f.anomalies()).toEqual([]);
    f.recorder.record(event);
    expect(f.anomalies('repetition.burst')).toMatchObject([{ metadata: { evidenceFirstSequence: 1, evidenceLastSequence: 101, count: 100, windowMs: 0 } }]);
    // snapshot above flushes the first 98 suppressed records as sequence 100.
    expect(f.recorder.status().internalFailures).toBe(0);
  });
  it('limits storms without losing coalescing or recursively observing its own findings', () => {
    const f = fixture({ maxRecords: 20 });
    for (let i = 0; i < 100000; i++) f.recorder.record(event);
    expect(f.anomalies('repetition.burst')).toHaveLength(1);
    expect(f.recorder.status().records).toBeLessThanOrEqual(20);
    expect(f.recorder.status().coalesced).toBeGreaterThan(99990);
    expect(f.recorder.status().internalFailures).toBe(0);
    for (let i = 0; i < 200; i++) f.recorder.record({ ...event, subsystem: 'observability' });
    expect(f.anomalies()).toHaveLength(1);
  });
  it('resets burst windows and separates owners/components/origins', () => {
    const f = fixture();
    for (let i = 0; i < 99; i++) f.recorder.record(event);
    f.advance(1001); f.recorder.record(event);
    for (let i = 0; i < 99; i++) f.recorder.record({ ...event, metadata: { ownerId: 'two' } });
    f.recorder.record({ ...event, origin: 'user' }); f.recorder.record({ ...event, component: 'other' });
    expect(f.anomalies()).toEqual([]);
  });
  it('only flags actual same-state work with complete explicit semantics', () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) f.recorder.record({ ...event, name: 'analysis.completed', semanticFingerprint: 'source=1;tune=2;scope=all;qualification=3', outcome: 'success' });
    expect(f.anomalies('work.same-state')).toMatchObject([{ metadata: { count: 3 } }]);
  });
  it('does not infer redundant work from requests, revisions, no-ops, view changes or hidden completions', () => {
    const f = fixture();
    for (const name of ['ve.context.noop', 've.tune.noop', 've.result-view.changed', 've.tables.render', 'histogram.render.request', 'histogram.completion.current', 'analysis.completed']) {
      for (let i = 0; i < 5; i++) f.recorder.record({ ...event, name, stateRevision: 4, metadata: { domHidden: true } });
    }
    expect(f.anomalies()).toEqual([]);
  });
  it('resets same-state work when semantic state/source/tune changes and excludes failed work', () => {
    const f = fixture(); const work = { ...event, name: 'analysis.completed', semanticFingerprint: 'a', outcome: 'success' as const };
    f.recorder.record(work); f.recorder.record(work);
    f.recorder.record({ ...work, semanticFingerprint: 'b' });
    f.recorder.record(work); f.recorder.record(work);
    f.recorder.record({ ...work, sourceRevision: 2 });
    f.recorder.record({ ...work, tuneRevision: 3 });
    for (let i = 0; i < 5; i++) f.recorder.record({ ...work, outcome: 'failure' });
    expect(f.anomalies('work.same-state')).toEqual([]);
  });
  it.each(['cancelled', 'superseded'] as const)('records rejected stale completion after %s as informational with the same operation', outcome => {
    const f = fixture(); const op = createOperationFactory(f.recorder, 's').begin(event);
    op.finish(outcome); op.staleCompletion('old generation'); op.staleCompletion('old generation');
    expect(op.outcome).toBe(outcome);
    expect(f.anomalies('async.stale-completion')).toMatchObject([{ operationId: op.id, severity: 'info' }]);
    expect(f.recorder.snapshot().filter(r => r.name === 'owner.changed.completed')).toHaveLength(1);
  });
  it('recognizes current controller stale markers without fabricating operation identity', () => {
    const f = fixture(); f.recorder.record({ ...event, name: 'histogram.read.stale', metadata: { generation: 1, currentGeneration: 2 } });
    expect(f.anomalies('async.stale-completion')[0]?.operationId).toBeUndefined();
  });
  it('checks unfinished operations only on explicit request and retains observed-completion semantics', () => {
    const f = fixture(); const op = createOperationFactory(f.recorder, 's').begin(event);
    f.advance(ANOMALY_POLICY.unfinishedMs - 1); f.recorder.checkAnomalies(); expect(f.anomalies()).toEqual([]);
    f.advance(ANOMALY_POLICY.unfinishedMs); expect(f.anomalies()).toEqual([]);
    f.recorder.checkAnomalies();
    expect(f.anomalies('async.unfinished')).toMatchObject([{ severity: 'info', operationId: op.id, metadata: { evidenceFirstSequence: 1, elapsedMs: 30000 } }]);
    f.recorder.checkAnomalies(); expect(f.anomalies('async.unfinished')).toHaveLength(1);
    expect(op.finish('success')).toBe(true); expect(f.recorder.anomalyStatus()?.pendingOperations).toBe(0);
  });
  it.each(['success', 'failure', 'cancelled', 'superseded', 'stale'] as const)('cleans tracking for a %s terminal including interleaved child operations', outcome => {
    const f = fixture(); const factory = createOperationFactory(f.recorder, 's'); const a = factory.begin(event), b = factory.begin(event), child = a.child(event)!;
    b.finish(outcome); child.finish(outcome); a.finish(outcome);
    f.advance(60000); f.recorder.checkAnomalies();
    expect(f.anomalies('async.unfinished')).toEqual([]); expect(f.recorder.anomalyStatus()?.pendingOperations).toBe(0);
  });
  it('reports known session-only persistence, without extra writes or treating adapter failure alone as divergence', () => {
    const f = fixture();
    f.recorder.record({ ...event, name: 'storage.save.completed', outcome: 'failure' });
    f.recorder.record({ ...event, name: 'persistence.result', metadata: { persisted: true } });
    expect(f.anomalies()).toEqual([]);
    f.recorder.record({ ...event, name: 'persistence.result', metadata: { persisted: false, action: 'delete' } });
    expect(f.anomalies('persistence.session-only')).toMatchObject([{ metadata: { action: 'delete', durableOutcome: 'failure' } }]);
    f.recorder.record({ ...event, component: 'ini', name: 'persistence.result', metadata: { acceptedInMemory: true, outcome: 'unavailable', action: 'save' } });
    expect(f.anomalies('persistence.session-only')).toHaveLength(2);
  });
  it('bounds every index under unique storms and exposes incomplete tracking rather than claiming complete coverage', () => {
    const f = fixture({ maxRecords: 20 });
    for (let i = 0; i < 2000; i++) f.recorder.record({ ...event, component: `c${i}`, name: 'analysis.started', operationId: `op${i}`, semanticFingerprint: String(i) });
    const state = f.recorder.anomalyStatus()!;
    expect(state.burstKeys).toBe(128); expect(state.pendingOperations).toBe(128); expect(state.trackingEvictions).toBeGreaterThan(0);
    f.advance(30000); f.recorder.checkAnomalies();
    expect(f.recorder.anomalyStatus()?.cooldownKeys).toBeLessThanOrEqual(128);
    expect(f.recorder.status().records).toBeLessThanOrEqual(20);
    expect(buildSessionEvidence(f.recorder)).toContain('trackingEvictions=');
  });
  it('cooldown bounds repeated findings, then allows a later independent pattern', () => {
    const f = fixture(); const failure = { ...event, name: 'persistence.result', metadata: { persisted: false } };
    f.recorder.record(failure); f.recorder.record(failure); expect(f.anomalies('persistence.session-only')).toHaveLength(1);
    f.advance(ANOMALY_POLICY.cooldownMs); f.recorder.record(failure); expect(f.anomalies('persistence.session-only')).toHaveLength(2);
  });
  it('does not traverse domain objects and keeps production detection off snapshot/history APIs', () => {
    const f = fixture(); const snapshot = vi.spyOn(f.recorder, 'snapshot');
    const fields = new Proxy({}, { get() { throw Error('domain payload traversed'); } });
    f.recorder.record({ ...event, metadata: { fields } as unknown as NonNullable<RecordInput['metadata']> });
    for (let i = 0; i < 100; i++) f.recorder.record(event);
    expect(snapshot).not.toHaveBeenCalled(); expect(f.recorder.status().internalFailures).toBe(0);
  });
  it('contains detector failure without changing an accepted producer record or throwing into the domain', () => {
    const f = fixture(); const spy = vi.spyOn(AnomalyDetector.prototype, 'observe').mockImplementationOnce(() => { throw Error('detector'); });
    try { expect(f.recorder.record(event)?.name).toBe(event.name); expect(f.recorder.status().internalFailures).toBe(1); }
    finally { spy.mockRestore(); }
  });
  it('excludes performance metrics and never calls awaited read duration a CPU freeze', () => {
    const f = fixture();
    for (let i = 0; i < 200; i++) f.recorder.record({ ...event, subsystem: 'performance', recordKind: 'metric', durationMs: 60000 });
    expect(f.anomalies()).toEqual([]);
    const op = createOperationFactory(f.recorder, 's').begin({ ...event, name: 'logger.analysis-traces' });
    f.advance(90000); op.finish('success'); f.recorder.checkAnomalies(); expect(f.anomalies()).toEqual([]);
  });
  it('caps distinct anomaly output during a stale-operation storm and reports suppressed coverage', () => {
    const f = fixture({ maxRecords: 1000 });
    for (let i = 0; i < 2000; i++) f.recorder.record({ ...event, name: 'async.completion.stale', operationId: `old${i}` });
    expect(f.anomalies('async.stale-completion')).toHaveLength(ANOMALY_POLICY.maxFindingsPerWindow);
    expect(f.recorder.anomalyStatus()?.suppressedFindings).toBeGreaterThan(1900);
    expect(f.recorder.status().records).toBeLessThanOrEqual(1000);
    f.advance(1000); f.recorder.record({ ...event, name: 'async.completion.stale', operationId: 'new-window' });
    expect(f.anomalies('async.stale-completion')).toHaveLength(17);
  });
  it('does not claim identical semantics when fingerprints reached the recorder truncation bound', () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) f.recorder.record({ ...event, name: 'analysis.completed', outcome: 'success', semanticFingerprint: 'x'.repeat(128) + i });
    expect(f.anomalies('work.same-state')).toEqual([]);
  });
  it('retains owner/generation references for domain/comparison stale decisions', () => {
    const f = fixture();
    for (const name of ['domain.read.stale', 'analyzer.compare.stale']) f.recorder.record({ ...event, name, component: name, metadata: { ownerId: 'original', generation: 1, currentGeneration: 2 } });
    expect(f.anomalies('async.stale-completion')).toMatchObject([
      { metadata: { ownerId: 'original', generation: 1, currentGeneration: 2 } },
      { metadata: { ownerId: 'original', generation: 1, currentGeneration: 2 } },
    ]);
  });
  it('projects a bounded historical tail with explicit coverage and evidence references', () => {
    const f = fixture();
    for (let i = 0; i < 40; i++) { f.advance(i * 1000); f.recorder.record({ ...event, component: `owner${i}`, name: 'persistence.result', metadata: { persisted: false } }); }
    const report = buildAnomalyReport(f.recorder.snapshot(), f.recorder.anomalyStatus());
    expect(report).toContain('retained=40; shown=30'); expect(report).not.toContain('owner=owner0 |');
    expect(report).toContain('owner=owner39 |'); expect(report).toContain('evidence=');
    expect(report).toContain('Historical evidence patterns, not current health');
  });
});
