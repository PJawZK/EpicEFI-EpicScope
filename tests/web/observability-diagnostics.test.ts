import { describe, expect, it, vi } from 'vitest';
import { createDiagnosticsCapture, filterRecords, operationRows, type DiagnosticsCapture } from '../../apps/web/src/observability/diagnostics';
import { structuredDiagnostics, buildDiagnosticsBundle } from '../../apps/web/src/observability/export';
import { createObservabilitySession } from '../../apps/web/src/observability/session';
import { buildSessionEvidence } from '../../apps/web/src/observability/reports/session-report';
import { runtimeErrorsForReport } from '../../apps/web/src/observability/producers/runtime-errors';
import type { ObservabilityRecord } from '../../apps/web/src/observability/record';
function record(sequence: number, other: Partial<ObservabilityRecord> = {}): ObservabilityRecord { return { schemaVersion: 1, sessionId: 's', sequence, wallTime: 1000, monotonicTime: sequence, recordKind: 'event', subsystem: 'owners', component: 've', name: 'work.started', origin: 'async', priority: 'normal', metadata: {}, ...other }; }
export function diagnosticFixture(): DiagnosticsCapture {
 const session = createObservabilitySession({ sessionId: 's' }); const retention = session.recorder.status();
 return createDiagnosticsCapture({ capturedAt: '2026-10-16T18:00:00.000Z', sessionId: 's', reportText: 'Complete report 界\nfull text', health: { issues: [], warnings: [] }, records: [record(1)], retention, anomalyTracking: undefined, persistence: { state: 'ready', lastError: '', writes: 1, lastSavedSequence: 1, previous: [] }, performanceReport: 'exact performance', parserReport: 'exact parser', parserDiagnostics: [{ code: 'CRC', severity: 'error', message: '界'.repeat(1000), offset: 12345, recoverable: false, timeMs: 250, sourceIntegrity: { kind: 'corrupt-record', breaksContinuity: true } }], resources: { incomplete: 0, truncated: 0, retention } });
}
describe('unified Diagnostics projections', () => {
 it('captures only explicit diagnostic fields and complete canonical parser evidence', () => {
  const input = { ...diagnosticFixture(), rawLog: [1, 2, 3] }; const c = createDiagnosticsCapture(input);
  expect(c).not.toHaveProperty('rawLog'); expect(c.parserDiagnostics[0]?.message).toHaveLength(1000);
  const original = input.parserDiagnostics[0]!; expect(c.parserDiagnostics[0]).not.toBe(original); expect(Object.isFrozen(c.parserDiagnostics[0])).toBe(true);
 });
 it('captures source time and integrity as an immutable explicit-field snapshot', () => {
  const sourceIntegrity = { kind: 'recovered-retry' as const, breaksContinuity: false, rawPayload: [1, 2] };
  const diagnostic = { code: 'retry', severity: 'info' as const, message: 'Recovered', recoverable: true, timeMs: 0, sourceIntegrity };
  const c = createDiagnosticsCapture({ ...diagnosticFixture(), parserDiagnostics: [diagnostic] });
  const expected = { ...diagnostic, sourceIntegrity: { kind: 'recovered-retry', breaksContinuity: false } };
  expect(c.parserDiagnostics[0]).toEqual(expected);
  expect(c.parserDiagnostics[0]?.sourceIntegrity).not.toBe(sourceIntegrity);
  expect(Object.isFrozen(c.parserDiagnostics[0]?.sourceIntegrity)).toBe(true);
  diagnostic.timeMs = 999; sourceIntegrity.breaksContinuity = true;
  expect(c.parserDiagnostics[0]).toEqual(expected);
  expect(JSON.parse(JSON.stringify(structuredDiagnostics(c))).parserDiagnostics).toEqual([expected]);
 });
 it('keeps absent optional integrity fields absent and preserves corruption semantics', () => {
  const plain = { code: 'legacy', severity: 'info' as const, message: 'Legacy', recoverable: true };
  const corrupt = { ...plain, timeMs: 250, sourceIntegrity: { kind: 'corrupt-record' as const, breaksContinuity: true } };
  const c = createDiagnosticsCapture({ ...diagnosticFixture(), parserDiagnostics: [plain, corrupt] });
  expect(c.parserDiagnostics[0]).not.toHaveProperty('timeMs');
  expect(c.parserDiagnostics[0]).not.toHaveProperty('sourceIntegrity');
  expect(c.parserDiagnostics[1]).toEqual(corrupt);
 });
 it('filters all exact envelope dimensions, anomaly code and case-insensitive text without changing chronological order', () => {
  const selected = record(2, { operationId: 'op1', severity: 'warning', visibility: 'hidden', outcome: 'stale', sourceRevision: 2, tuneRevision: 3, metadata: { ruleCode: 'async.stale' } });
  const records = [record(1), selected, record(3)];
  expect(filterRecords(records, { subsystem: 'owners', component: 've', operationId: 'op1', origin: 'async', severity: 'warning', visibility: 'hidden', recordKind: 'event', outcome: 'stale', sourceRevision: '2', tuneRevision: '3', anomalyCode: 'async.stale', search: 'WORK' })).toEqual([selected]);
  expect(filterRecords(records, { sourceRevision: '20' })).toEqual([]); expect(filterRecords(records, {})).toBe(records);
 });
 it('does not confuse missing revisions with zero', () => { expect(filterRecords([record(1), record(2, { sourceRevision: 0 })], { sourceRevision: '0' }).map(r => r.sequence)).toEqual([2]); });
 it('preserves interleaved parent/child identity and actual terminal outcome despite stale completion', () => {
  const rows = operationRows([record(1, { operationId: 'a' }), record(2, { operationId: 'b', parentOperationId: 'a' }), record(3, { operationId: 'b', parentOperationId: 'a', name: 'work.completed', outcome: 'cancelled', durationMs: 20 }), record(4, { operationId: 'b', parentOperationId: 'a', name: 'async.completion.stale', outcome: 'stale' })]);
  expect(rows).toMatchObject([{ id: 'a', depth: 0, outcome: 'no terminal retained' }, { id: 'b', parentId: 'a', depth: 1, outcome: 'cancelled', durationMs: 20, staleCompletions: 1 }]);
 });
 it('marks missing starts/parents without inventing ancestry or start duration', () => {
  expect(operationRows([record(5, { operationId: 'child', parentOperationId: 'lost', name: 'work.completed', outcome: 'success' })])).toMatchObject([{ missingStart: true, orphan: true, durationMs: undefined }]);
 });
 it('handles cyclic and 20000-deep operation relationships iteratively', () => {
  const records = Array.from({ length: 20000 }, (_, i) => record(i + 1, { operationId: `op${i}`, ...(i ? { parentOperationId: `op${i - 1}` } : {}) }));
  expect(operationRows(records).at(-1)?.depth).toBe(19999);
  expect(operationRows([record(1, { operationId: 'a', parentOperationId: 'b' }), record(2, { operationId: 'b', parentOperationId: 'a' })])).toMatchObject([{ cycle: true }, { cycle: true }]);
 });
 it('uses one supplied capture for legacy/session projections without fresh scans or anomaly checks', () => {
  const s = createObservabilitySession(); const records = s.recorder.snapshot(); const snapshot = vi.spyOn(s.recorder, 'snapshot'), check = vi.spyOn(s.recorder, 'checkAnomalies');
  buildSessionEvidence(s.recorder, records); runtimeErrorsForReport(s.recorder, records);
  expect(snapshot).not.toHaveBeenCalled(); expect(check).not.toHaveBeenCalled();
 });
 it('structured evidence preserves all current/previous record relationships and complete Parser messages', () => {
  const c = diagnosticFixture(), exported = structuredDiagnostics(c);
  expect(exported.records).toBe(c.records); expect(exported.parserDiagnostics[0]?.message).toHaveLength(1000);
  expect(exported.scope).toBe('full-local-diagnostics'); expect(exported).not.toHaveProperty('rawLog');
 });
 it('builds a standard two-entry ZIP with independently checked bytes/CRC and exact text/JSON parity', async () => {
  const c = diagnosticFixture(), bytes = new Uint8Array(await (await buildDiagnosticsBundle(c)).arrayBuffer());
  const view = new DataView(bytes.buffer), decoder = new TextDecoder(), files = new Map<string, string>(); let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
   const length = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), start = offset + 30 + nameLength;
   const body = bytes.subarray(start, start + length); let crc = 0xffffffff;
   for (const byte of body) { crc ^= byte; for (let b = 0; b < 8; b++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
   expect((crc ^ 0xffffffff) >>> 0).toBe(view.getUint32(offset + 14, true));
   files.set(decoder.decode(bytes.subarray(offset + 30, start)), decoder.decode(body)); offset = start + length;
  }
  expect(view.getUint32(offset, true)).toBe(0x02014b50); expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  expect([...files.keys()]).toEqual(['report.txt', 'observability.json']); expect(files.get('report.txt')).toBe(c.reportText);
  expect(JSON.parse(files.get('observability.json')!).parserDiagnostics).toEqual(c.parserDiagnostics);
  expect(JSON.parse(files.get('observability.json')!).records).toEqual(c.records); expect(JSON.parse(files.get('observability.json')!).capturedAt).toBe(c.capturedAt);
 });
 it('cancels before or during bounded export work', async () => {
  const controller = new AbortController(); controller.abort(); await expect(buildDiagnosticsBundle(diagnosticFixture(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  const other = new AbortController(); const task = buildDiagnosticsBundle({ ...diagnosticFixture(), reportText: 'x'.repeat(200000) }, other.signal); setTimeout(() => other.abort(), 0);
  await expect(task).rejects.toMatchObject({ name: 'AbortError' });
 });
});
