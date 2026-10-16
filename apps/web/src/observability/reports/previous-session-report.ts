import type { PersistenceSnapshot } from '../session-persistence';
/** Local recovered history stays separate from current recorder/errors/domain authority. */
export function buildPreviousSessionReport(snapshot: PersistenceSnapshot): string {
  const lines = ['[Previous-session black box]', `persistence=${snapshot.state}; batches=${snapshot.writes}; lastSavedSequence=${snapshot.lastSavedSequence}${snapshot.lastError ? `; error=${snapshot.lastError}` : ''}`,
    'Local IndexedDB; best-effort batches. Missing end is unconfirmed termination, not crash causality; another tab may still be active. Counts cover observed retained evidence, not complete history.'];
  for (const session of snapshot.previous.slice(0, 3)) {
    const s = session.summary;
    lines.push(`session=${s.sessionId}; termination=${s.confirmedEnd ? 'confirmed-normal-end' : 'unconfirmed-no-end-observed'}; start=${new Date(s.startedAt).toISOString()}; lastSeen=${new Date(s.lastSeen).toISOString()}`,
      `lastSequence=${s.lastSequence}; view=${s.lastActiveView || 'unknown'}; lastOperation=${s.lastCompletedOperation || 'none'}; checkpoint=${s.lastCheckpoint || 'none'}@${s.lastCheckpointSequence}; observedErrors=${s.observedErrors}; observedAnomalies=${s.observedAnomalies}; coalesced=${s.coalesced}; evicted=${s.evicted}`,
      `retained=${session.records.length}; contextWindows=${session.windows.length}; showing final 20 plus up to 3 records around each retained trigger`);
    const selected = new Set(session.records.slice(-20).map(r => r.sequence));
    for (const window of session.windows) {
      const index = window.sequences.indexOf(window.triggerSequence);
      for (const seq of window.sequences.slice(Math.max(0, index - 1), index + 2)) selected.add(seq);
    }
    for (const r of session.records) if (selected.has(r.sequence)) lines.push(`${r.sequence} | ${r.name} | ${r.component}${r.operationId ? ` | operation=${r.operationId}` : ''}${r.outcome ? ` | ${r.outcome}` : ''}${typeof r.metadata?.message === 'string' ? ` | ${r.metadata.message}` : ''}`);
  }
  if (!snapshot.previous.length) lines.push('No recovered previous-session evidence available.');
  return lines.join('\n');
}
