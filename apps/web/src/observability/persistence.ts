import { SessionSchemaError, PERSISTENCE_LIMITS, payloadBytes, validatePersistedSession, type PersistedSession, type SessionSummary } from './retention';
export interface SessionStore {
  load(): Promise<readonly PersistedSession[]>;
  save(session: PersistedSession, recordsChanged: boolean): Promise<void>;
  close(): void;
}
interface IndexEntry { readonly schemaVersion: 1; readonly summary: SessionSummary; readonly bytes: number }
interface EvidenceEntry { readonly sessionId: string; readonly schemaVersion: 1; readonly records: PersistedSession['records']; readonly windows: PersistedSession['windows'] }
export const OBSERVABILITY_DATABASE = 'epicscope.observability';
/** Lazy versioned browser adapter. No localStorage, imports, globals or per-event writes. */
export function createIndexedDbSessionStore(options: { readonly factory?: () => IDBFactory; readonly name?: string; readonly now?: () => number } = {}): SessionStore {
  let opening: Promise<IDBDatabase> | undefined;
  let database: IDBDatabase | undefined;
  let closed = false;
  const now = options.now ?? Date.now;
  const open = (): Promise<IDBDatabase> => {
    if (closed) return Promise.reject(new Error('Observability store closed'));
    return opening ??= new Promise((resolve, reject) => {
      try {
        const request = (options.factory?.() ?? globalThis.indexedDB).open(options.name ?? OBSERVABILITY_DATABASE, 1);
        let failed = false;
        request.onupgradeneeded = () => {
          request.result.createObjectStore('summaries', { keyPath: 'summary.sessionId' });
          request.result.createObjectStore('evidence', { keyPath: 'sessionId' });
        };
        request.onerror = () => { failed = true; reject(request.error ?? new Error('Observability database open failed')); };
        request.onblocked = () => { failed = true; reject(new Error('Observability database upgrade blocked')); };
        request.onsuccess = () => {
          if (failed || closed) { request.result.close(); reject(new Error('Observability store closed')); return; }
          database = request.result;
          database.onversionchange = () => { database?.close(); closed = true; };
          resolve(database);
        };
      } catch (error) { reject(error); }
    });
  };
  const validateIndex = (value: unknown): IndexEntry => {
    const entry = value as IndexEntry;
    if (!entry || Object.keys(entry).some(k => !['schemaVersion', 'summary', 'bytes'].includes(k)) || entry.schemaVersion !== 1 || !entry.summary || typeof entry.summary.sessionId !== 'string' || !Number.isFinite(entry.summary.lastSeen) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > PERSISTENCE_LIMITS.sessionBytes) throw new SessionSchemaError('Invalid or unsupported observability index schema');
    validatePersistedSession({ schemaVersion: 1, summary: entry.summary, records: [], windows: [] });
    return entry;
  };
  return {
    async load() {
      const db = await open();
      return new Promise<readonly PersistedSession[]>((resolve, reject) => {
        const transaction = db.transaction(['summaries', 'evidence'], 'readwrite');
        const index = transaction.objectStore('summaries'), evidence = transaction.objectStore('evidence');
        const request = index.getAll(undefined, PERSISTENCE_LIMITS.sessions + 1);
        const loaded: PersistedSession[] = [];
        let failure: unknown;
        request.onsuccess = () => {
          try {
            if (request.result.length > PERSISTENCE_LIMITS.sessions) throw new SessionSchemaError('Observability index exceeds retention schema');
            let bytes = 0;
            for (const raw of request.result) {
              const entry = validateIndex(raw); bytes += entry.bytes;
              if (now() - entry.summary.lastSeen > PERSISTENCE_LIMITS.ageMs) { index.delete(entry.summary.sessionId); evidence.delete(entry.summary.sessionId); continue; }
              const data = evidence.get(entry.summary.sessionId);
              data.onsuccess = () => {
                try {
                  const body = data.result as EvidenceEntry;
                  if (!body || Object.keys(body).some(k => !['schemaVersion', 'sessionId', 'records', 'windows'].includes(k)) || body.schemaVersion !== 1 || body.sessionId !== entry.summary.sessionId) throw new SessionSchemaError('Missing or unsupported observability evidence');
                  const session = validatePersistedSession({ schemaVersion: 1, summary: entry.summary, records: body.records, windows: body.windows });
                  if (payloadBytes(session) !== entry.bytes) throw new SessionSchemaError('Observability byte index mismatch');
                  loaded.push(session);
                } catch (error) { failure = error; transaction.abort(); }
              };
            }
            if (bytes > PERSISTENCE_LIMITS.totalBytes) throw new SessionSchemaError('Observability byte budget exceeded');
          } catch (error) { failure = error; transaction.abort(); }
        };
        transaction.oncomplete = () => resolve(loaded.sort((a, b) => b.summary.lastSeen - a.summary.lastSeen));
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Observability recovery transaction aborted'));
        transaction.onerror = () => { /* onabort reports one failure to the owning writer. */ };
      });
    },
    async save(session, recordsChanged) {
      // Heartbeats update only the compact summary index, not the evidence body.
      const db = await open();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['summaries', 'evidence'], 'readwrite');
        const index = transaction.objectStore('summaries'), evidence = transaction.objectStore('evidence');
        const request = index.getAll(undefined, PERSISTENCE_LIMITS.sessions + 1);
        let failure: unknown;
        request.onsuccess = () => {
          try {
            if (request.result.length > PERSISTENCE_LIMITS.sessions) throw new SessionSchemaError('Observability index exceeds retention schema');
            const old = request.result.map(validateIndex);
            const current = old.find(e => e.summary.sessionId === session.summary.sessionId);
            const bytes = !recordsChanged && current
              ? current.bytes - payloadBytes(current.summary) + payloadBytes(session.summary)
              : payloadBytes(session);
            if (bytes > PERSISTENCE_LIMITS.sessionBytes) throw new Error('Observability session byte budget exceeded');
            // Never delete/overwrite a newer version. load() has validated current-version evidence.
            const entries = old.filter(e => e.summary.sessionId !== session.summary.sessionId && now() - e.summary.lastSeen <= PERSISTENCE_LIMITS.ageMs);
            entries.sort((a, b) => b.summary.lastSeen - a.summary.lastSeen);
            entries.unshift({ schemaVersion: 1, summary: session.summary, bytes });
            let total = 0;
            const keep = new Set<string>();
            for (const entry of entries) if (keep.size < PERSISTENCE_LIMITS.sessions && total + entry.bytes <= PERSISTENCE_LIMITS.totalBytes) { keep.add(entry.summary.sessionId); total += entry.bytes; }
            for (const entry of old) if (!keep.has(entry.summary.sessionId)) { index.delete(entry.summary.sessionId); evidence.delete(entry.summary.sessionId); }
            if (keep.has(session.summary.sessionId)) {
              index.put({ schemaVersion: 1, summary: session.summary, bytes } satisfies IndexEntry);
              if (recordsChanged || !old.some(e => e.summary.sessionId === session.summary.sessionId)) evidence.put({ schemaVersion: 1, sessionId: session.summary.sessionId, records: session.records, windows: session.windows } satisfies EvidenceEntry);
            }
          } catch (error) { failure = error; transaction.abort(); }
        };
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Observability save transaction aborted'));
        transaction.onerror = () => { /* Transaction rejection is contained by the writer. */ };
      });
    },
    close() { closed = true; database?.close(); },
  };
}
