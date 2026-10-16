import type { ObservabilityRecord } from '../record';
import { buildAnomalyReport } from './anomaly-report';
import { buildOwnerEvidenceTail } from './owner-report';
import { buildParserSessionEvidence } from './parser-report';
import type { ObservabilityRecorder } from '../recorder';

/** Small transitional lens; existing performance/parser ownership is unchanged. */
export function buildSessionEvidence(recorder: ObservabilityRecorder, capturedRecords?: readonly ObservabilityRecord[]): string {
  if (!capturedRecords) recorder.checkAnomalies();
  const records = capturedRecords ?? recorder.snapshot();
  const health = recorder.status();
  return [
    '[Observability session]',
    `sessionId=${records[0]?.sessionId ?? 'unavailable'}`,
    `records=${health.records}; lastSequence=${health.lastSequence}; bytes=${health.recordBytes}`,
    `coalesced=${health.coalesced}; evicted=${health.evicted}; evictedCritical=${health.evictedCritical}; rejected=${health.rejected}; internalFailures=${health.internalFailures}; reentrant=${health.reentrant}`,
    'Current-session bounded in-memory evidence; recovered history is a separate shell-owned report lens.',
    buildParserSessionEvidence(records),
    buildOwnerEvidenceTail(records),
    buildAnomalyReport(records, recorder.anomalyStatus()),
    ...records.slice(-50).map(r => `${r.sequence} | ${r.name} | ${r.component} | origin=${r.origin}${r.activeView ? ` | view=${r.activeView}` : ''}${r.visibility ? ` | ${r.visibility}` : ''}${r.semanticFingerprint ? ` | state=${r.semanticFingerprint}` : ''}`),
  ].join('\n');
}
