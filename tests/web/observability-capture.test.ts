import { describe, expect, it, vi } from 'vitest';
import { captureDiagnostics, type CurrentDiagnosticsContext } from '../../apps/web/src/observability/capture';
import { createObservabilitySession } from '../../apps/web/src/observability/session';
import { recordRuntimeError, runtimeErrorsForReport } from '../../apps/web/src/observability/producers/runtime-errors';
import { buildBugReportText } from '../../apps/web/src/observability/reports/runtime-report';
import { buildSessionEvidence } from '../../apps/web/src/observability/reports/session-report';
import { buildPreviousSessionReport } from '../../apps/web/src/observability/reports/previous-session-report';
import { buildPerformanceReport } from '../../apps/web/src/observability/reports/performance-report';
import { projectCurrentHealth } from '../../apps/web/src/observability/health-rules';
function fixture() {
 const session = createObservabilitySession({ sessionId: 'capture', wallNow: () => 1000, monotonicNow: () => 0 });
 const current: CurrentDiagnosticsContext = {
  snapshot: { hasChannelDataSource: true, channelDefinitionCount: 1, catalogChannelCount: 1, unavailableChannelCount: 0, aliasCount: 0, activeWorkspaceId: 'w', workspaceCount: 1, restoringWorkspaceState: false, visiblePaneCount: 1, assignedChannelCount: 1, renderableAssignedChannelCount: 1, unavailableAssignedChannelCount: 0, activeTraceCount: 1, activeTraceRangeBytes: 0, panes: [] },
  workspaceState: { activeWorkspaceId: 'w', workspaces: [], timeline: { expanded: false, userMarkers: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] }, inspector: { visible: true, favoriteChannelIds: [], recentChannelIds: [], searchQuery: '', selectedGroup: 'All', visibilityFilter: 'all', sortKey: 'name', sortAscending: true } },
  source: { logLoaded: true, recordCount: 320459, logChannelCount: 1, dataSourceSamples: 320459, iniLoaded: false, iniCatalogEntries: 0, bindingActive: false },
  application: { generatedAtIso: '2026-10-16T18:00:00.000Z', url: 'https://example.test', userAgent: 'test', viewportWidth: 1200, viewportHeight: 800, devicePixelRatio: 1, documentVisibility: 'visible', online: true, appStatus: 'ready', parserStatus: 'valid', openLogState: 'success', openLogTitle: '', loadIniState: 'idle', loadIniTitle: '' },
 };
 const performance = { loadRuns: [], iniLoadRuns: [], bindingRuns: [], workspaceRestoreRuns: [], channelRuns: [], incomplete: 0, truncated: 0, retention: session.recorder.status() };
 const persistence = { state: 'ready' as const, lastError: '', writes: 1, lastSavedSequence: 1, previous: [] };
 return { recorder: session.recorder, sessionId: session.sessionId, current, performance, parserReport: 'complete Parser report', parserDiagnostics: [{ code: 'CRC', severity: 'error' as const, message: '界'.repeat(1000), offset: 1234, recoverable: false }], persistence };
}
describe('single authoritative Diagnostics assembly', () => {
 it('queries/checks once, borrows prepared Perf/Parser inputs, and derives runtime health from the same recorder', () => {
  const f = fixture(); recordRuntimeError(f.recorder, { kind: 'error', time: 1000, message: 'owned runtime failure' });
  const snapshot = vi.spyOn(f.recorder, 'snapshot'), check = vi.spyOn(f.recorder, 'checkAnomalies');
  const result = captureDiagnostics(f);
  expect(snapshot).toHaveBeenCalledTimes(1); expect(check).toHaveBeenCalledTimes(1);
  expect(result.issueCount).toBe(1); expect(result.capture.health.issues).toEqual(['1 runtime error/unhandled rejection event(s) captured.']);
  expect(result.text).toContain('owned runtime failure'); expect(result.capture.parserDiagnostics[0]?.message).toHaveLength(1000);
  expect(result.capture.records.filter(r => r.name === 'health.snapshot')).toHaveLength(1);
 });
 it('preserves complete runtime/Perf/Parser/session/recovery report parity with the pre-cleanup projections', () => {
  const f = fixture(); const result = captureDiagnostics(f), records = result.capture.records;
  const expected = buildBugReportText({ ...f.current, ...result.capture.health, runtimeErrors: runtimeErrorsForReport(f.recorder, records), performanceReport: buildPerformanceReport(f.performance), parserReport: f.parserReport, observabilityReport: `${buildSessionEvidence(f.recorder, records)}\n${buildPreviousSessionReport(f.persistence)}` });
  expect(result.text).toBe(expected.text); expect(result.capture.reportText).toBe(expected.text);
 });
 it('keeps a retained capture stable after new records/canonical input changes and recollects only when called', () => {
  const f = fixture(); const initial = captureDiagnostics(f), length = initial.capture.records.length;
  recordRuntimeError(f.recorder, { kind: 'error', time: 1001, message: 'later error' }); f.parserDiagnostics[0]!.message = 'replacement canonical message';
  expect(initial.capture.records).toHaveLength(length); expect(initial.text).not.toContain('later error'); expect(initial.capture.parserDiagnostics[0]?.message).toHaveLength(1000);
  const fresh = captureDiagnostics(f); expect(fresh.text).toContain('later error'); expect(fresh.capture.parserDiagnostics[0]?.message).toBe('replacement canonical message');
 });
 it('uses the same pure health projection for badge/capture without recording or scanning for badge work', () => {
  const f = fixture(); const snapshot = vi.spyOn(f.recorder, 'snapshot'), record = vi.spyOn(f.recorder, 'record');
  expect(projectCurrentHealth(f.current.snapshot, { logLoaded: true, iniLoaded: false, bindingActive: false, runtimeErrorCount: 0 })).toEqual({ issues: [], warnings: [] });
  expect(snapshot).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled();
 });
});
