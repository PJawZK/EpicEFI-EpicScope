import type { ObservabilityRecord } from '../record';
/** Explicit-report lens only; never traverses application state or re-records evidence. */
export function buildOwnerEvidenceTail(records: readonly ObservabilityRecord[]): string {
  const tail = records.filter(r => ['owners', 'persistence', 'workspace'].includes(r.subsystem)
    || (r.name === 'observability.records-coalesced' && r.metadata?.originalSubsystem === 'owners')).slice(-30);
  if (!tail.length) return '';
  const scalar = (value: unknown) => {
    const text = String(value);
    return JSON.stringify(text.length > 80 ? `${text.slice(0, 80)} [truncated]` : value);
  };
  return ['[Recent owner evidence]', 'Bounded retained tail; omitted/evicted history is not reconstructed.',
    ...tail.map(r => `${r.sequence} | ${r.component} | ${r.name}${r.operationId ? ` | operation=${r.operationId}` : ''}${r.outcome ? ` | outcome=${r.outcome}` : ''}${r.reason ? ` | reason=${r.reason}` : ''}${r.stateRevision !== undefined ? ` | stateRevision=${r.stateRevision}` : ''} | ${Object.entries(r.metadata ?? {}).map(([key,value]) => `${key}=${scalar(value)}`).join('; ')}`),
  ].join('\n');
}
