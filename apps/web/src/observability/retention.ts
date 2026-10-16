import type { ObservabilityRecord } from './record';
export class SessionSchemaError extends Error { override name = 'ObservabilitySchemaError'; }
export const PERSISTENCE_LIMITS = Object.freeze({ sessions: 4, records: 5000, windows: 8, contextRadius: 10, sessionBytes: 1024 * 1024, totalBytes: 5 * 1024 * 1024, ageMs: 7 * 86400000, batchMs: 30000 });
export interface SessionSummary {
  readonly sessionId: string;
  readonly startedAt: number;
  readonly lastSeen: number;
  readonly lastSequence: number;
  readonly confirmedEnd: boolean;
  readonly lastActiveView: string;
  readonly lastCompletedOperation: string;
  readonly lastCheckpoint: string;
  readonly lastCheckpointSequence: number;
  readonly observedErrors: number;
  readonly observedAnomalies: number;
  readonly coalesced: number;
  readonly evicted: number;
}
export interface ContextWindow { readonly triggerSequence: number; readonly sequences: readonly number[] }
export interface PersistedSession {
  readonly schemaVersion: 1;
  readonly summary: SessionSummary;
  readonly records: readonly ObservabilityRecord[];
  readonly windows: readonly ContextWindow[];
}
const encoder = new TextEncoder();
export function payloadBytes(value: unknown): number { return encoder.encode(JSON.stringify(value)).byteLength; }

/** Record-sized cache is local to the writer and bounded by its current selections. */
export function selectSessionEvidence(summary: SessionSummary, current: readonly ObservabilityRecord[], previous?: PersistedSession, sizeOf: (record: ObservabilityRecord) => number = payloadBytes): PersistedSession {
  const bySequence = new Map<number, ObservabilityRecord>();
  for (const record of previous?.records ?? []) if (summary.lastSeen - record.wallTime <= PERSISTENCE_LIMITS.ageMs) bySequence.set(record.sequence, record);
  for (const record of current) if (summary.lastSeen - record.wallTime <= PERSISTENCE_LIMITS.ageMs) bySequence.set(record.sequence, record);
  const ordered = [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
  const windows = new Map<number, ContextWindow>();
  for (const window of previous?.windows ?? []) windows.set(window.triggerSequence, window);
  let currentWindows = 0;
  for (let i = current.length - 1; i >= 0 && currentWindows < PERSISTENCE_LIMITS.windows; i--) {
    const record = current[i]!;
    if (!bySequence.has(record.sequence) || (record.name !== 'anomaly.detected' && record.severity !== 'error')) continue;
    currentWindows++;
    windows.set(record.sequence, { triggerSequence: record.sequence, sequences: current.slice(Math.max(0, i - PERSISTENCE_LIMITS.contextRadius), i + PERSISTENCE_LIMITS.contextRadius + 1).map(r => r.sequence) });
  }
  const selectedWindows = [...windows.values()].filter(w => bySequence.has(w.triggerSequence)).sort((a, b) => b.triggerSequence - a.triggerSequence).slice(0, PERSISTENCE_LIMITS.windows);
  const chosen = new Map<number, ObservabilityRecord>();
  // Reserve framing/summary/window bytes before accepting record-sized payloads.
  let bytes = payloadBytes({ schemaVersion: 1, summary, records: [], windows: selectedWindows }) + 1024;
  const add = (record: ObservabilityRecord | undefined) => {
    if (!record || chosen.has(record.sequence) || chosen.size >= PERSISTENCE_LIMITS.records) return;
    const size = sizeOf(record) + 1;
    if (bytes + size > PERSISTENCE_LIMITS.sessionBytes) return;
    chosen.set(record.sequence, record); bytes += size;
  };
  for (const window of selectedWindows) add(bySequence.get(window.triggerSequence));
  for (let i = ordered.length - 1; i >= Math.max(0, ordered.length - 20); i--) add(ordered[i]);
  for (const window of selectedWindows) for (const sequence of window.sequences) add(bySequence.get(sequence));
  for (let i = ordered.length - 1; i >= Math.max(0, ordered.length - PERSISTENCE_LIMITS.records); i--) add(ordered[i]);
  return Object.freeze({ schemaVersion: 1, summary: Object.freeze(summary), records: Object.freeze([...chosen.values()].sort((a, b) => a.sequence - b.sequence)), windows: Object.freeze(selectedWindows.map(w => Object.freeze({ triggerSequence: w.triggerSequence, sequences: Object.freeze(w.sequences.filter(s => chosen.has(s))) }))) });
}

/** Strict version-1 recovery boundary. Unknown versions are never silently rewritten. */
export function validatePersistedSession(value: unknown): PersistedSession {
  const fail = (): never => { throw new SessionSchemaError('Invalid or unsupported observability session schema'); };
  if (!value || typeof value !== 'object') return fail();
  const only = (object: object, keys: readonly string[]) => Object.keys(object).every(k => keys.includes(k));
  const v = value as PersistedSession;
  if (!only(v, ['schemaVersion', 'summary', 'records', 'windows'])) return fail();
  if (v.schemaVersion !== 1 || !v.summary || !Array.isArray(v.records) || !Array.isArray(v.windows)) return fail();
  const s = v.summary;
  if (!only(s, ['sessionId', 'startedAt', 'lastSeen', 'lastSequence', 'confirmedEnd', 'lastActiveView', 'lastCompletedOperation', 'lastCheckpoint', 'lastCheckpointSequence', 'observedErrors', 'observedAnomalies', 'coalesced', 'evicted'])) return fail();
  if (typeof s.sessionId !== 'string' || !s.sessionId || s.sessionId.length > 96 || typeof s.confirmedEnd !== 'boolean') return fail();
  for (const key of ['startedAt', 'lastSeen', 'lastSequence', 'lastCheckpointSequence', 'observedErrors', 'observedAnomalies', 'coalesced', 'evicted'] as const) if (!Number.isFinite(s[key]) || s[key] < 0) return fail();
  if (s.startedAt > 8640000000000000 || s.lastSeen > 8640000000000000 || !Number.isSafeInteger(s.lastSequence) || !Number.isSafeInteger(s.lastCheckpointSequence) || s.lastCheckpointSequence > s.lastSequence) return fail();
  for (const key of ['lastActiveView', 'lastCompletedOperation', 'lastCheckpoint'] as const) if (typeof s[key] !== 'string' || s[key].length > 128) return fail();
  if (v.records.length > PERSISTENCE_LIMITS.records || v.windows.length > PERSISTENCE_LIMITS.windows) return fail();
  let lastSequence = 0;
  for (const record of v.records) {
    if (!record || record.schemaVersion !== 1 || record.sessionId !== s.sessionId || !Number.isSafeInteger(record.sequence) || record.sequence <= lastSequence || record.sequence > s.lastSequence || !Number.isFinite(record.wallTime) || Math.abs(record.wallTime) > 8640000000000000 || !Number.isFinite(record.monotonicTime)) return fail();
    lastSequence = record.sequence;
    if (!only(record, ['schemaVersion', 'sessionId', 'sequence', 'wallTime', 'monotonicTime', 'recordKind', 'subsystem', 'component', 'name', 'origin', 'severity', 'priority', 'operationId', 'parentOperationId', 'activeView', 'visibility', 'sourceIdentity', 'sourceRevision', 'tuneIdentity', 'tuneRevision', 'stateRevision', 'semanticFingerprint', 'durationMs', 'outcome', 'reason', 'metadata'])) return fail();
    if (!['event', 'metric', 'snapshot'].includes(record.recordKind) || !['critical', 'normal', 'detail'].includes(record.priority) || !['user', 'programmatic', 'observer', 'async', 'worker', 'system', 'persistence'].includes(record.origin)) return fail();
    for (const key of ['name', 'subsystem', 'component'] as const) if (typeof record[key] !== 'string' || record[key].length > 128) return fail();
    for (const key of ['operationId', 'parentOperationId', 'activeView', 'sourceIdentity', 'tuneIdentity', 'semanticFingerprint', 'reason'] as const) if (record[key] !== undefined && (typeof record[key] !== 'string' || record[key].length > 128)) return fail();
    for (const key of ['durationMs', 'sourceRevision', 'tuneRevision', 'stateRevision'] as const) if (record[key] !== undefined && !Number.isFinite(record[key])) return fail();
    if (record.outcome !== undefined && !['success', 'failure', 'cancelled', 'superseded', 'stale'].includes(record.outcome)) return fail();
    if (record.severity !== undefined && !['info', 'warning', 'error'].includes(record.severity)) return fail();
    if (record.visibility !== undefined && !['active', 'hidden'].includes(record.visibility)) return fail();
    if (!record.metadata || typeof record.metadata !== 'object' || Array.isArray(record.metadata) || Object.keys(record.metadata).length > 16) return fail();
    for (const [key, item] of Object.entries(record.metadata)) if (key.length > 64 || !(item === null || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)) || (typeof item === 'string' && item.length <= 256))) return fail();
    if (payloadBytes(record) > 8192) return fail();
  }
  const sequences = new Set(v.records.map(r => r.sequence));
  for (const w of v.windows) if (!w || !only(w, ['triggerSequence', 'sequences']) || !sequences.has(w.triggerSequence) || !Array.isArray(w.sequences) || !w.sequences.includes(w.triggerSequence) || w.sequences.length > 21 || w.sequences.some((n: unknown) => typeof n !== 'number' || !sequences.has(n))) return fail();
  if (payloadBytes(v) > PERSISTENCE_LIMITS.sessionBytes) return fail();
  // Recovered records are not inserted into the current recorder or domain state.
  return v;
}
