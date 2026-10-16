import type { createObservabilitySession } from './session';
import { createIndexedDbSessionStore, type SessionStore } from './persistence';
import { PERSISTENCE_LIMITS, payloadBytes, selectSessionEvidence, type PersistedSession, type SessionSummary } from './retention';
import { ownerFailureReason } from './producers/owner';
export interface PersistenceSnapshot {
  readonly state: 'loading' | 'ready' | 'failed' | 'closed';
  readonly lastError: string;
  readonly writes: number;
  readonly lastSavedSequence: number;
  readonly previous: readonly PersistedSession[];
}
/** One shell-owned periodic writer; no record callback, per-event write or global hook. */
export function createSessionPersistence(session: ReturnType<typeof createObservabilitySession>, options: {
  readonly store?: SessionStore;
  readonly now?: () => number;
  readonly automatic?: boolean;
} = {}) {
  const store = options.store ?? createIndexedDbSessionStore();
  const now = options.now ?? Date.now;
  const recorder = session.recorder;
  let state: PersistenceSnapshot['state'] = 'loading', lastError = '', writes = 0, lastSavedSequence = -1;
  let previous: readonly PersistedSession[] = [];
  let selected: PersistedSession | undefined;
  let evidenceDirty = false;
  let expiresAt = Infinity;
  let blocked = false, failed = false, requested = false, closed = false;
  let running: Promise<void> | undefined, disposing: Promise<void> | undefined;
  const sizes = new WeakMap<object, number>();
  const sizeOf = (record: object) => { let size = sizes.get(record); if (size === undefined) { size = payloadBytes(record); sizes.set(record, size); } return size; };
  let summary: SessionSummary = { sessionId: session.sessionId, startedAt: now(), lastSeen: now(), lastSequence: 0, confirmedEnd: false, lastActiveView: '', lastCompletedOperation: '', lastCheckpoint: '', lastCheckpointSequence: 0, observedErrors: 0, observedAnomalies: 0, coalesced: 0, evicted: 0 };
  const failure = (error: unknown) => {
    state = 'failed'; lastError = ownerFailureReason(error);
    if (failed) return;
    failed = true;
    recorder.record({ recordKind: 'event', subsystem: 'observability', component: 'session-persistence', name: 'observability.persistence.failed', origin: 'persistence', severity: 'warning', priority: 'critical', reason: lastError });
  };
  const ready = Promise.resolve().then(() => store.load()).then(sessions => {
    previous = sessions.filter(s => s.summary.sessionId !== session.sessionId).slice(0, 3);
    state = 'ready';
  }).catch(error => { blocked = true; failure(error); });
  const flush = (): Promise<void> => {
    if (closed) return Promise.resolve();
    requested = true;
    if (running) return running;
    running = (async () => {
      await ready;
      while (requested && !closed && !blocked) {
        requested = false;
        try {
          const status = recorder.status();
          const changed = !selected || status.lastSequence !== summary.lastSequence || now() > expiresAt;
          if (changed) {
            const records = recorder.snapshot();
            const next = { ...summary };
            for (const record of records) {
              if (record.sequence <= summary.lastSequence) continue;
              if (record.activeView !== undefined) next.lastActiveView = record.activeView;
              if (record.name === 'session.ended') next.confirmedEnd = true;
              if (record.name === 'session.checkpoint') { next.lastCheckpoint = String(record.metadata?.checkpoint ?? '').slice(0, 128); next.lastCheckpointSequence = record.sequence; }
              if (record.name.endsWith('.completed') && record.operationId) next.lastCompletedOperation = record.operationId;
              if (record.severity === 'error') next.observedErrors++;
              if (record.name === 'anomaly.detected') next.observedAnomalies++;
            }
            summary = next;
            summary = { ...summary, lastSequence: recorder.status().lastSequence, lastSeen: now(), coalesced: status.coalesced, evicted: recorder.status().evicted };
            selected = selectSessionEvidence(summary, records, selected, sizeOf);
            evidenceDirty = true;
            expiresAt = Infinity;
            for (const record of selected.records) expiresAt = Math.min(expiresAt, record.wallTime + PERSISTENCE_LIMITS.ageMs);
          } else {
            summary = { ...summary, lastSeen: now(), coalesced: status.coalesced, evicted: status.evicted };
            selected = { ...selected!, summary };
          }
          await store.save(selected, evidenceDirty);
          evidenceDirty = false;
          writes++; lastSavedSequence = summary.lastSequence; state = 'ready'; lastError = '';
          if (failed) {
            failed = false;
            recorder.record({ recordKind: 'event', subsystem: 'observability', component: 'session-persistence', name: 'observability.persistence.recovered', origin: 'persistence', priority: 'critical' });
          }
        } catch (error) { failure(error); }
      }
    })().finally(() => { running = undefined; });
    return running;
  };
  const timer = options.automatic === false ? undefined : globalThis.setInterval(() => { void flush(); }, PERSISTENCE_LIMITS.batchMs);
  if (options.automatic !== false) void flush();
  return {
    ready, flush,
    snapshot(): PersistenceSnapshot { return { state, lastError, writes, lastSavedSequence, previous: previous.filter(s => now() - s.summary.lastSeen <= PERSISTENCE_LIMITS.ageMs) }; },
    dispose(): Promise<void> {
      if (disposing) return disposing;
      if (timer !== undefined) globalThis.clearInterval(timer);
      disposing = flush().finally(() => { closed = true;
        try { store.close(); } catch (error) { failure(error); }
        state = 'closed'; });
      return disposing;
    },
  };
}
