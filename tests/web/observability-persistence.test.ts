import { describe, expect, it, vi, afterEach } from 'vitest';
import { createObservabilitySession } from '../../apps/web/src/observability/session';
import { createSessionPersistence } from '../../apps/web/src/observability/session-persistence';
import { PERSISTENCE_LIMITS, payloadBytes, selectSessionEvidence, validatePersistedSession, type PersistedSession, type SessionSummary } from '../../apps/web/src/observability/retention';
import { buildPreviousSessionReport } from '../../apps/web/src/observability/reports/previous-session-report';
import type { SessionStore } from '../../apps/web/src/observability/persistence';
import type { ObservabilityRecord } from '../../apps/web/src/observability/record';
function fixture() {
  let now = 1000;
  const session = createObservabilitySession({ sessionId: 'current', wallNow: () => now, monotonicNow: () => now, maxRecordBytes: 8192 });
  const saved: { session: PersistedSession; changed: boolean }[] = [];
  const store: SessionStore = { load: vi.fn(async () => []), save: vi.fn(async (session, changed) => { saved.push({ session: structuredClone(session), changed }); }), close: vi.fn() };
  return { session, saved, store, advance: (time: number) => { now = time; }, now: () => now };
}
function summary(lastSequence: number, lastSeen = 1000): SessionSummary {
  return { sessionId: 's', startedAt: 1000, lastSeen, lastSequence, confirmedEnd: false, lastActiveView: '', lastCompletedOperation: '', lastCheckpoint: '', lastCheckpointSequence: 0, observedErrors: 0, observedAnomalies: 0, coalesced: 0, evicted: 0 };
}
function records(count: number, large = false): ObservabilityRecord[] {
  return Array.from({ length: count }, (_, i) => ({ schemaVersion: 1, sessionId: 's', sequence: i + 1, wallTime: 1000, monotonicTime: i, recordKind: 'event', subsystem: 'test', component: 'test', name: 'test.event', origin: 'system', priority: 'normal', metadata: large ? { text: '界'.repeat(256), more: '😀'.repeat(128), last: 'x'.repeat(256) } : {} }));
}
afterEach(() => vi.useRealTimers());
describe('bounded session black-box selection and recovery', () => {
  it('enforces count/UTF-8 byte bounds and keeps a newest tail', () => {
    const input = records(10000);
    const selected = selectSessionEvidence(summary(10000), input);
    expect(selected.records.length).toBeLessThanOrEqual(5000); expect(selected.records[0]?.sequence).toBe(10001 - selected.records.length); expect(selected.records.at(-1)?.sequence).toBe(10000);
    const large = selectSessionEvidence(summary(10000), records(10000, true));
    expect(large.records.length).toBeLessThan(5000); expect(large.records.at(-1)?.sequence).toBe(10000);
    expect(payloadBytes(large)).toBeLessThanOrEqual(PERSISTENCE_LIMITS.sessionBytes);
    expect(validatePersistedSession(large)).toBe(large);
  });
  it('protects error/anomaly before/after windows across later tail rollover', () => {
    const first = records(100); first[10] = { ...first[10]!, severity: 'error', name: 'runtime.error' };
    const selected = selectSessionEvidence(summary(100), first);
    const later = records(10000).slice(100);
    const next = selectSessionEvidence(summary(10000), later, selected);
    expect(next.records.some(r => r.sequence === 11)).toBe(true);
    expect(next.windows).toMatchObject([{ triggerSequence: 11, sequences: Array.from({ length: 21 }, (_, i) => i + 1) }]);
    expect(next.records.length).toBeLessThanOrEqual(5000); expect(next.records.at(-1)?.sequence).toBe(10000);
  });
  it('refreshes after-context when it arrives in a later batch and caps window count', () => {
    const input = records(40); input[5] = { ...input[5]!, name: 'anomaly.detected' };
    const early = selectSessionEvidence(summary(6), input.slice(0, 6));
    const later = selectSessionEvidence(summary(40), input, early);
    expect(later.windows[0]?.sequences).toContain(16);
    const storm = records(200).map(r => ({ ...r, severity: 'error' as const }));
    expect(selectSessionEvidence(summary(200), storm).windows).toHaveLength(8);
  });
  it('expires old context/tail records by age even in a still-running session', () => {
    const input = records(100); input[10] = { ...input[10]!, severity: 'error' };
    const old = selectSessionEvidence(summary(100), input);
    const later = selectSessionEvidence(summary(100, 1001 + PERSISTENCE_LIMITS.ageMs), [], old);
    expect(later.records).toEqual([]); expect(later.windows).toEqual([]);
  });
  it.each([0, 2, 999])('rejects unsupported payload version %s without migration by guesswork', schemaVersion => {
    expect(() => validatePersistedSession({ schemaVersion, summary: summary(0), records: [], windows: [] })).toThrow('unsupported');
  });
  it.each(['unknown payload', 'bad counter', 'bad date', 'non-monotonic sequence', 'wrong session', 'nested metadata', 'oversized metadata', 'bad window'])('rejects corrupted recovered %s', kind => {
    const v = structuredClone(selectSessionEvidence(summary(2), records(2))) as unknown as Record<string, any>;
    if (kind === 'unknown payload') v.records[0].rawLog = [1, 2, 3];
    if (kind === 'bad counter') v.summary.lastSequence = -1;
    if (kind === 'bad date') v.summary.lastSeen = 1e300;
    if (kind === 'non-monotonic sequence') v.records.reverse();
    if (kind === 'wrong session') v.records[0].sessionId = 'other';
    if (kind === 'nested metadata') v.records[0].metadata = { raw: [1, 2, 3] };
    if (kind === 'oversized metadata') v.records[0].metadata = { text: 'x'.repeat(257) };
    if (kind === 'bad window') v.windows = [{ triggerSequence: 99, sequences: [99] }];
    expect(() => validatePersistedSession(v)).toThrow();
  });
});
describe('session-owned batching and failure isolation', () => {
  it('performs no writes per event, batches once, and updates only summary on idle heartbeat', async () => {
    const f = fixture(), writer = createSessionPersistence(f.session, { store: f.store, now: f.now, automatic: false });
    await writer.ready;
    for (let i = 0; i < 10000; i++) f.session.recorder.record({ recordKind: 'event', subsystem: 'test', component: 'test', name: 'event', origin: 'system' });
    expect(f.saved).toHaveLength(0); await writer.flush(); expect(f.saved).toHaveLength(1);
    expect(f.saved[0]?.changed).toBe(true);
    const spy = vi.spyOn(f.session.recorder, 'snapshot');
    f.advance(2000); await writer.flush(); expect(f.saved[1]?.changed).toBe(false); expect(spy).not.toHaveBeenCalled();
    expect(f.saved[1]?.session.summary.lastSeen).toBe(2000); await writer.dispose(); expect(f.store.close).toHaveBeenCalledTimes(1);
  });
  it('coalesces overlapping flush requests, never overlaps writes, and publishes newest later evidence', async () => {
    const f = fixture(); let release!: () => void; const held = new Promise<void>(r => { release = r; });
    const original = f.store.save; let calls = 0;
    f.store.save = vi.fn(async (s, changed) => { calls++; if (calls === 1) await held; await original(s, changed); });
    const writer = createSessionPersistence(f.session, { store: f.store, now: f.now, automatic: false });
    await writer.ready; const pending = writer.flush(); await Promise.resolve(); await Promise.resolve();
    f.session.checkpoint('newer'); const again = writer.flush(); writer.flush(); expect(calls).toBe(1);
    release(); await Promise.all([pending, again]); expect(f.saved).toHaveLength(2);
    expect(f.saved[1]?.session.summary.lastCheckpoint).toBe('newer'); await writer.dispose();
  });
  it('preserves dirty evidence after failed replacement of an already persisted batch', async () => {
    const f = fixture(), writer = createSessionPersistence(f.session, { store: f.store, now: f.now, automatic: false });
    await writer.flush(); f.session.checkpoint('after-first-write');
    const original = f.store.save;
    f.store.save = vi.fn(async () => { throw new DOMException('full', 'QuotaExceededError'); });
    await writer.flush(); await writer.flush();
    expect(f.session.recorder.countNamed('observability.persistence.failed')).toBe(1);
    expect(writer.snapshot().state).toBe('failed'); expect(writer.snapshot().lastError).toBe('QuotaExceededError');
    f.store.save = original; await writer.flush();
    expect(f.saved.at(-1)?.changed).toBe(true); expect(f.saved.at(-1)?.session.summary.lastCheckpoint).toBe('after-first-write');
    expect(f.session.recorder.countNamed('observability.persistence.recovered')).toBe(1); await writer.dispose();
  });
  it('keeps unavailable/schema-denied recovery read-only and bounded without recursive retries', async () => {
    const f = fixture(); f.store.load = vi.fn(() => { throw new DOMException('denied', 'SecurityError'); });
    const writer = createSessionPersistence(f.session, { store: f.store, now: f.now, automatic: false });
    await writer.ready; for (let i = 0; i < 10; i++) await writer.flush();
    expect(f.store.save).not.toHaveBeenCalled(); expect(f.session.recorder.countNamed('observability.persistence.failed')).toBe(1);
    expect(writer.snapshot().state).toBe('failed'); await writer.dispose();
  });
  it('restores previous diagnostics without inserting their errors/checkpoints into the new current recorder', async () => {
    const f = fixture(); const old = selectSessionEvidence(summary(2), records(2));
    f.store.load = vi.fn(async () => [old]);
    const writer = createSessionPersistence(f.session, { store: f.store, now: f.now, automatic: false }); await writer.ready;
    expect(writer.snapshot().previous).toEqual([old]); expect(f.session.recorder.snapshot()).toHaveLength(1);
    const report = buildPreviousSessionReport(writer.snapshot()); expect(report).toContain('unconfirmed-no-end-observed'); expect(report).toContain('another tab may still be active');
    f.advance(1001 + PERSISTENCE_LIMITS.ageMs); expect(writer.snapshot().previous).toEqual([]); await writer.dispose();
  });
  it('retains normal end, checkpoint and actual navigation/operation identity through final flush', async () => {
    const f = fixture(), writer = createSessionPersistence(f.session, { store: f.store, now: f.now, automatic: false });
    f.session.checkpoint('healthy-boundary'); const operation = f.session.beginOperation({ subsystem: 'source', component: 'loader', name: 'load', origin: 'user', activeView: 'logger' })!;
    operation.finish('success'); f.session.end(); await writer.dispose(); await writer.dispose();
    expect(f.saved.at(-1)?.session.summary).toMatchObject({ confirmedEnd: true, lastCheckpoint: 'healthy-boundary', lastActiveView: 'logger', lastCompletedOperation: operation.id });
    expect(f.store.close).toHaveBeenCalledTimes(1); const count = f.saved.length; await writer.flush(); expect(f.saved).toHaveLength(count);
  });
  it('owns and clears one periodic batch timer and leaves ordinary events asynchronous', async () => {
    vi.useFakeTimers(); const f = fixture(); const writer = createSessionPersistence(f.session, { store: f.store, now: f.now });
    await writer.ready; await writer.flush(); const count = f.saved.length;
    f.session.checkpoint('pending'); expect(f.saved).toHaveLength(count);
    await vi.advanceTimersByTimeAsync(PERSISTENCE_LIMITS.batchMs); expect(f.saved.length).toBe(count + 1);
    await writer.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('prunes expired idle evidence rather than heartbeating it indefinitely', async () => {
    const f = fixture(), writer = createSessionPersistence(f.session, { store: f.store, now: f.now, automatic: false });
    await writer.flush(); f.advance(1001 + PERSISTENCE_LIMITS.ageMs); await writer.flush();
    expect(f.saved.at(-1)?.changed).toBe(true); expect(f.saved.at(-1)?.session.records).toEqual([]); await writer.dispose();
  });
  it('bounds checkpoint identity at the recovery schema limit and contains close failures', async () => {
    const f = fixture(); f.store.close = () => { throw Error('close failed'); };
    const writer = createSessionPersistence(f.session, { store: f.store, now: f.now, automatic: false });
    f.session.checkpoint('x'.repeat(256)); await writer.dispose();
    expect(f.saved.at(-1)?.session.summary.lastCheckpoint).toHaveLength(128);
    expect(() => validatePersistedSession(f.saved.at(-1)!.session)).not.toThrow();
    expect(writer.snapshot().state).toBe('closed');
  });
  it('preserves the newest final tail even when large error windows exhaust the byte budget', () => {
    const input = records(1000, true).map((r, i) => ({ ...r, metadata: Object.fromEntries(Array.from({ length: 8 }, (_, j) => [`text${j}`, '界'.repeat(256)])), severity: i < 900 && i % 30 === 0 ? 'error' as const : 'info' as const }));
    const selected = selectSessionEvidence(summary(1000), input);
    for (let i = 981; i <= 1000; i++) expect(selected.records.some(r => r.sequence === i)).toBe(true);
    expect(payloadBytes(selected)).toBeLessThanOrEqual(PERSISTENCE_LIMITS.sessionBytes);
    expect(() => validatePersistedSession(selected)).not.toThrow();
  });

});
