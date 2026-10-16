import type { ParserDiagnostic } from '../../../../core/log-model/log-types';
import { createDiagnosticsCapture } from './diagnostics';
import { projectCurrentHealth } from './health-rules';
import type { ObservabilityRecorder } from './recorder';
import type { PerformanceProjection } from './producers/performance';
import type { PersistenceSnapshot } from './session-persistence';
import { recordHealthSnapshot } from './producers/health';
import { runtimeErrorCount, runtimeErrorsForReport } from './producers/runtime-errors';
import { buildPerformanceReport } from './reports/performance-report';
import { buildSessionEvidence } from './reports/session-report';
import { buildPreviousSessionReport } from './reports/previous-session-report';
import { buildBugReportText, type BuildBugReportInput } from './reports/runtime-report';
export type CurrentDiagnosticsContext = Omit<BuildBugReportInput, 'issues' | 'warnings' | 'runtimeErrors' | 'performanceReport' | 'parserReport' | 'observabilityReport'>;
/** Single explicit report assembly boundary, borrowing actual owners' prepared evidence.
 * No controller wrappers, source reads, sampling, context delivery or automatic hooks.
 */
export function captureDiagnostics(input: {
  readonly recorder: ObservabilityRecorder;
  readonly sessionId: string;
  readonly current: CurrentDiagnosticsContext;
  readonly performance: PerformanceProjection;
  readonly parserReport: string;
  readonly parserDiagnostics: readonly ParserDiagnostic[];
  readonly persistence: PersistenceSnapshot;
}) {
  const { recorder, current, performance: perf } = input;
  const context = { logLoaded: current.source.logLoaded, iniLoaded: current.source.iniLoaded, bindingActive: current.source.bindingActive, runtimeErrorCount: runtimeErrorCount(recorder) };
  const health = projectCurrentHealth(current.snapshot, context);
  recordHealthSnapshot(recorder, current.snapshot, context);
  recorder.checkAnomalies();
  const records = recorder.snapshot();
  const performanceReport = buildPerformanceReport(perf);
  const report = buildBugReportText({ ...current, ...health,
    runtimeErrors: runtimeErrorsForReport(recorder, records), performanceReport, parserReport: input.parserReport,
    observabilityReport: `${buildSessionEvidence(recorder, records)}\n${buildPreviousSessionReport(input.persistence)}`,
  });
  const capture = createDiagnosticsCapture({ capturedAt: current.application.generatedAtIso, sessionId: input.sessionId,
    reportText: report.text, health, records, retention: recorder.status(), anomalyTracking: recorder.anomalyStatus(),
    persistence: input.persistence, performanceReport, parserReport: input.parserReport, parserDiagnostics: input.parserDiagnostics,
    resources: { blob: perf.blob, decode: perf.decode, memory: perf.memory, incomplete: perf.incomplete, truncated: perf.truncated, retention: perf.retention },
  });
  return { ...report, capture };
}
