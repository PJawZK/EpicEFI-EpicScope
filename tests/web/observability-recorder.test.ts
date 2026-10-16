import { describe, expect, it } from 'vitest';
import { ObservabilityRecorder } from '../../apps/web/src/observability/recorder';
import { createObservabilitySession } from '../../apps/web/src/observability/session';
import type { RecordInput, Outcome } from '../../apps/web/src/observability/record';
const input: RecordInput = { recordKind: 'event', subsystem: 'analyzer', component: 've', name: 'render.completed', origin: 'programmatic' };
function fixture(options: Partial<ConstructorParameters<typeof ObservabilityRecorder>[0]> = {}) {
  let time = 0;
  const recorder = new ObservabilityRecorder({ sessionId: 'test', wallNow: () => 1000 + time, monotonicNow: () => time, ...options });
  return { recorder, advance: (value: number) => { time = value; } };
}

describe('bounded observability foundation', () => {
  it('orders events/metrics/snapshots and preserves owner identity and semantic fields', () => {
    const { recorder, advance } = fixture();
    recorder.record({ ...input, sourceRevision: 3, tuneRevision: 7, semanticFingerprint: 'source=3;tune=7', visibility: 'hidden' });
    advance(5); recorder.record({ ...input, recordKind: 'metric', durationMs: 5 });
    advance(10); recorder.record({ ...input, recordKind: 'snapshot', activeView: 'logger' });
    expect(recorder.snapshot().map(r => [r.sequence, r.monotonicTime])).toEqual([[1, 0], [2, 5], [3, 10]]);
    expect(recorder.snapshot()[0]).toMatchObject({ schemaVersion: 1, sessionId: 'test', sourceRevision: 3, tuneRevision: 7, semanticFingerprint: 'source=3;tune=7', visibility: 'hidden' });
  });
  it('owns immutable compact copies and never retains nested domain payloads', () => {
    const { recorder } = fixture(); const metadata = { count: 3, label: 'x'.repeat(1000), payload: [1, 2, 3] };
    recorder.record({ ...input, metadata: metadata as unknown as NonNullable<RecordInput['metadata']> });
    metadata.count = 9;
    const first = recorder.snapshot()[0]!;
    expect(first.metadata).toEqual({ count: 3, label: 'x'.repeat(256) });
    expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(first.metadata)).toBe(true);
    const snapshot = recorder.snapshot(); recorder.record(input); expect(snapshot).toHaveLength(1);
  });
  it('enforces record count while preserving chronological order across priority queues', () => {
    const { recorder } = fixture({ maxRecords: 3 });
    recorder.record({ ...input, name: 'operation.started', priority: 'critical' });
    recorder.record({ ...input, name: 'detail', priority: 'detail' });
    recorder.record({ ...input, name: 'normal' });
    recorder.record({ ...input, name: 'next' });
    expect(recorder.snapshot().map(r => r.name)).toEqual(['operation.started', 'normal', 'next']);
    expect(recorder.status().evicted).toBe(1);
  });
  it('rejects low priority pressure before discarding critical evidence and exposes eventual critical eviction', () => {
    const { recorder } = fixture({ maxRecords: 1 });
    recorder.record({ ...input, name: 'error', severity: 'error' });
    expect(recorder.record(input)).toBeUndefined();
    expect(recorder.snapshot()[0]?.name).toBe('error');
    recorder.record({ ...input, name: 'terminal', priority: 'critical' });
    expect(recorder.snapshot()[0]?.name).toBe('terminal');
    expect(recorder.status()).toMatchObject({ rejected: 1, evictedCritical: 1 });
  });
  it('enforces a UTF-8 byte budget including reserved emergency/repetition space', () => {
    const { recorder } = fixture({ maxBytes: 8192, maxRecordBytes: 1024, maxRecords: 1000 });
    for (let i = 0; i < 100; i++) recorder.record({ ...input, metadata: { value: '😀'.repeat(70), i } });
    const status = recorder.status();
    expect(status.evicted).toBeGreaterThan(0);
    expect(status.recordBytes + status.reservedBytes).toBeLessThanOrEqual(status.maxBytes);
    expect(new TextEncoder().encode(JSON.stringify(recorder.snapshot())).length).toBeLessThan(8192);
  });
  it('rejects oversized individual records with bounded loss accounting', () => {
    const { recorder } = fixture({ maxRecordBytes: 512 });
    recorder.record({ ...input, metadata: { a: 'a'.repeat(256), b: 'b'.repeat(256) } });
    expect(recorder.snapshot()).toEqual([]); expect(recorder.status().rejected).toBe(1);
  });
  it('expires records by monotonic age on writes and queries, despite wall clock regression', () => {
    const { recorder, advance } = fixture({ maxAgeMs: 10, wallNow: () => -100 });
    recorder.record(input); advance(11);
    expect(recorder.snapshot()).toEqual([]);
    recorder.record(input); advance(2); recorder.record(input);
    expect(recorder.snapshot().map(r => r.monotonicTime)).toEqual([11, 11]);
  });
  it('coalesces a 100k detail storm with exact pressure/sequence evidence and retains a terminal error', () => {
    const { recorder } = fixture({ maxRecords: 20 });
    for (let i = 0; i < 100000; i++) recorder.record({ ...input, priority: 'detail', semanticFingerprint: 'unchanged' });
    recorder.record({ ...input, name: 'analysis.failed', severity: 'error' });
    const records = recorder.snapshot();
    expect(records.map(r => r.name)).toEqual(['render.completed', 'observability.records-coalesced', 'analysis.failed']);
    expect(records[1]?.metadata).toMatchObject({ originalComponent: 've', originalSubsystem: 'analyzer', count: 99999, firstSequence: 2, lastSequence: 100000 });
    expect(records[2]?.sequence).toBe(100002);
    expect(recorder.status()).toMatchObject({ records: 3, coalesced: 99999, rejected: 0 });
  });
  it('does not coalesce distinct fingerprints, metadata, origins, operations or windows', () => {
    const { recorder, advance } = fixture({ coalesceWindowMs: 10 });
    const detail = { ...input, priority: 'detail' as const };
    recorder.record(detail); recorder.record({ ...detail, semanticFingerprint: 'new' });
    recorder.record({ ...detail, metadata: { count: 2 } }); recorder.record({ ...detail, origin: 'user' });
    recorder.record({ ...detail, operationId: 'other' }); advance(11); recorder.record(detail);
    expect(recorder.snapshot()).toHaveLength(6); expect(recorder.status().coalesced).toBe(0);
  });
  it('bounds alternating event storms and keeps earlier snapshots stable', () => {
    const { recorder } = fixture({ maxRecords: 10 }); const first = recorder.record(input);
    for (let i = 0; i < 10000; i++) recorder.record({ ...input, name: i % 2 ? 'a' : 'b' });
    expect(recorder.snapshot()).toHaveLength(10); expect(first?.sequence).toBe(1);
    expect(recorder.status().evicted).toBe(9991);
  });
  it('guards recorder reentry and contains throwing producers/clocks without recursive recording', () => {
    let recorder: ObservabilityRecorder;
    recorder = new ObservabilityRecorder({ sessionId: 'recursion', monotonicNow: () => { recorder.record(input); return 0; } });
    recorder.record(input); expect(recorder.status().reentrant).toBe(1); expect(recorder.status().records).toBe(1);
    const bad = fixture({ wallNow: () => { throw Error('denied'); } }).recorder;
    expect(() => bad.record(input)).not.toThrow(); expect(bad.status().internalFailures).toBe(1);
    const metadata = Object.defineProperty({}, 'x', { enumerable: true, get() { throw Error('bad getter'); } });
    expect(() => recorder.record({ ...input, metadata })).not.toThrow();
    expect(recorder.status().internalFailures).toBe(1);
  });
  it('rejects invalid retention configuration at explicit construction', () => {
    expect(() => fixture({ maxRecords: 0 })).toThrow(RangeError);
    expect(() => fixture({ maxBytes: 100 })).toThrow(RangeError);
  });
  it.each<Outcome>(['success', 'failure', 'cancelled', 'superseded', 'stale'])('terminates operations exactly once with %s and separately records stale completion', outcome => {
    let now = 10; const session = createObservabilitySession({ sessionId: 's', monotonicNow: () => now });
    const operation = session.beginOperation(input)!; now = 20;
    expect(operation.finish(outcome, 'owner decision')).toBe(true);
    expect(operation.finish('success')).toBe(false); expect(operation.child(input)).toBeUndefined();
    expect(operation.staleCompletion('old generation')).toBe(true); expect(operation.outcome).toBe(outcome);
    const records = session.recorder.snapshot();
    expect(records.filter(r => r.name === 'render.completed.completed')).toHaveLength(1);
    expect(records.find(r => r.outcome === outcome && r.durationMs !== undefined)).toMatchObject({ durationMs: 10 });
    expect(records.at(-1)).toMatchObject({ name: 'async.completion.stale', operationId: operation.id, outcome: 'stale' });
  });
  it('correlates explicit interleaved parents and children without an ambient async operation', () => {
    const session = createObservabilitySession({ sessionId: 's' });
    const metadata = { revision: 1 }; const parent = session.beginOperation({ ...input, metadata })!;
    metadata.revision = 2; const other = session.beginOperation(input)!; const child = parent.child({ ...input, name: 'read' })!;
    other.finish('success'); child.finish('success'); parent.finish('success');
    expect(session.recorder.snapshot().find(r => r.operationId === child.id)).toMatchObject({ parentOperationId: parent.id, metadata: { revision: 1 } });
    expect(session.recorder.snapshot().find(r => r.operationId === parent.id && r.outcome === 'success')?.metadata).toEqual({ revision: 1 });
  });
  it('marks confirmed end once and rejects new session operations/checkpoints after end', () => {
    const session = createObservabilitySession({ sessionId: 's' });
    expect(session.checkpoint('healthy')).toBe(true); expect(session.end()).toBe(true); expect(session.end()).toBe(false);
    expect(session.beginOperation(input)).toBeUndefined(); expect(session.checkpoint('late')).toBe(false);
    expect(session.recorder.snapshot().map(r => r.name)).toEqual(['session.started', 'session.checkpoint', 'session.ended']);
  });
});
