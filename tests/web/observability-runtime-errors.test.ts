import { describe, expect, it } from 'vitest';
import { createObservabilitySession } from '../../apps/web/src/observability/session';
import { recordRuntimeError, runtimeErrorCount, runtimeErrorsForReport, runtimeRejectionEntry } from '../../apps/web/src/observability/producers/runtime-errors';
import { buildSessionEvidence } from '../../apps/web/src/observability/reports/session-report';
const session = () => createObservabilitySession({ sessionId: 'errors', maxRecordBytes: 8192 });
describe('runtime evidence migration', () => {
  it('projects legacy report fields exactly for normal messages and stacks', () => {
    const s = session(); const entry = { time: 1000, kind: 'error' as const, message: 'boom', source: 'app.js', line: 10, column: 4, stack: 'boom\n at app.js:10:4' };
    recordRuntimeError(s.recorder, entry);
    expect(runtimeErrorsForReport(s.recorder)).toEqual([entry]);
    expect(runtimeErrorCount(s.recorder)).toBe(1);
    expect(s.recorder.snapshot().at(-1)).toMatchObject({ name: 'runtime.error', priority: 'critical', origin: 'async' });
  });
  it('preserves chronological last-50 report semantics with mixed error kinds', () => {
    const s = session();
    for (let i = 0; i < 60; i++) recordRuntimeError(s.recorder, { time: i, kind: i % 2 ? 'error' : 'unhandledrejection', message: `error ${i}` });
    expect(runtimeErrorCount(s.recorder)).toBe(50);
    expect(runtimeErrorsForReport(s.recorder).map(e => e.time)).toEqual(Array.from({ length: 50 }, (_, i) => i + 10));
    expect(s.recorder.countNamed('runtime.error')).toBe(30);
    expect(s.recorder.countNamed('runtime.unhandledrejection')).toBe(30);
  });
  it('bounds unicode evidence and visibly marks truncation without dropping the error', () => {
    const s = session();
    recordRuntimeError(s.recorder, { time: 1, kind: 'error', message: '😀'.repeat(1000), source: '界'.repeat(1000), stack: '界'.repeat(5000) });
    const [entry] = runtimeErrorsForReport(s.recorder);
    expect(entry?.message).toContain('[truncated]'); expect(entry?.source).toContain('[truncated]'); expect(entry?.stack).toContain('[truncated]');
    expect(s.recorder.status().rejected).toBe(0);
    expect(JSON.stringify(s.recorder.snapshot()).length).toBeLessThan(8192);
  });
  it('contains hostile/non-Error rejections without invoking domain object serialization', () => {
    const reason = { toString() { throw Error('must not be called'); } };
    expect(runtimeRejectionEntry(reason, 5)).toEqual({ time: 5, kind: 'unhandledrejection', message: 'Non-Error rejection (object)' });
    expect(runtimeRejectionEntry('failed', 6).message).toBe('failed');
    const error = new Error('original'); expect(runtimeRejectionEntry(error, 7).stack).toBe(error.stack);
    Object.defineProperty(error, 'message', { get() { throw Error('denied'); } });
    expect(runtimeRejectionEntry(error).message).toBe('Rejection details unavailable');
  });
  it('keeps name counts consistent under eviction and age expiry', () => {
    let now = 0; const s = createObservabilitySession({ sessionId: 'bounds', maxRecords: 4, maxAgeMs: 10, monotonicNow: () => now });
    for (let i = 0; i < 20; i++) recordRuntimeError(s.recorder, { time: i, kind: 'error', message: 'x' });
    expect(runtimeErrorCount(s.recorder)).toBe(4);
    expect(s.recorder.status().evictedCritical).toBeGreaterThan(0);
    now = 11; expect(runtimeErrorCount(s.recorder)).toBe(0);
    expect(s.recorder.status().records).toBe(0);
  });
  it('counts without flushing detail or scanning/projecting a snapshot for health polling', () => {
    const s = session(); s.recorder.record({ recordKind: 'event', subsystem: 'ui', component: 'view', name: 'render', origin: 'observer', priority: 'detail' });
    s.recorder.record({ recordKind: 'event', subsystem: 'ui', component: 'view', name: 'render', origin: 'observer', priority: 'detail' });
    const sequence = s.recorder.status().lastSequence;
    expect(runtimeErrorCount(s.recorder)).toBe(0); expect(s.recorder.status().lastSequence).toBe(sequence);
  });
  it('renders bounded session and pressure evidence while preserving the stream', () => {
    const s = session(); recordRuntimeError(s.recorder, { time: 1, kind: 'error', message: 'synthetic' });
    const report = buildSessionEvidence(s.recorder);
    expect(report).toContain('[Observability session]'); expect(report).toContain('runtime.error');
    expect(report).toContain('evictedCritical=0'); expect(report).toContain('recovered history is a separate shell-owned report lens');
    expect(runtimeErrorsForReport(s.recorder)[0]?.message).toBe('synthetic');
  });
});
