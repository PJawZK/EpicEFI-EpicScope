import type { AnomalyDetector } from '../anomaly-detector';
import type { ObservabilityRecord } from '../record';

/** Report-time bounded projection. References may point to coalesced/evicted raw evidence. */
export function buildAnomalyReport(records: readonly ObservabilityRecord[], status: ReturnType<AnomalyDetector['status']> | undefined): string {
  const tail: ObservabilityRecord[] = [];
  let retained = 0;
  for (const record of records) if (record.name === 'anomaly.detected') {
    retained++;
    if (tail.length === 30) tail.shift();
    tail.push(record);
  }
  return [
    '[Anomalies]',
    `detector=${status ? 'enabled' : 'disabled'}; retained=${retained}; shown=${tail.length}; trackingEvictions=${status?.trackingEvictions ?? 0}; suppressedFindings=${status?.suppressedFindings ?? 0}`,
    'Historical evidence patterns, not current health, CPU measurements or automatic repair. References may be coalesced/evicted; pending coverage is bounded. Unfinished checks run only on explicit report request.',
    ...tail.map(record => {
      const m = record.metadata ?? {};
      return `${record.sequence} | ${m.ruleCode} | ${record.severity} | owner=${m.ownerComponent}${m.ownerId ? `/${m.ownerId}` : ''} | evidence=${m.evidenceFirstSequence}..${m.evidenceLastSequence}${record.operationId ? ` | operation=${record.operationId}` : ''} | ${record.reason}${m.generation === undefined ? '' : ` | generation=${m.generation}->${m.currentGeneration ?? 'unknown'}`}${m.count === undefined ? '' : ` | count=${m.count}`}${m.elapsedMs === undefined ? '' : ` | elapsedMs=${m.elapsedMs}`}`;
    }),
  ].join('\n');
}
