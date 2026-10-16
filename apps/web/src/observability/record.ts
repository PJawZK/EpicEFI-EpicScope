export type Origin = 'user' | 'programmatic' | 'observer' | 'async' | 'worker' | 'system' | 'persistence';
export type Outcome = 'success' | 'failure' | 'cancelled' | 'superseded' | 'stale';
export type Priority = 'critical' | 'normal' | 'detail';
export type Metadata = Readonly<Record<string, string | number | boolean | null>>;
export interface RecordInput {
  readonly recordKind: 'event' | 'metric' | 'snapshot';
  readonly subsystem: string;
  readonly component: string;
  readonly name: string;
  readonly origin: Origin;
  readonly severity?: 'info' | 'warning' | 'error';
  readonly priority?: Priority;
  readonly operationId?: string;
  readonly parentOperationId?: string;
  readonly activeView?: string;
  readonly visibility?: 'active' | 'hidden';
  readonly sourceIdentity?: string;
  readonly sourceRevision?: number;
  readonly tuneIdentity?: string;
  readonly tuneRevision?: number;
  readonly stateRevision?: number;
  readonly semanticFingerprint?: string;
  readonly durationMs?: number;
  readonly outcome?: Outcome;
  readonly reason?: string;
  readonly metadata?: Metadata;
}
export interface ObservabilityRecord extends RecordInput {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly wallTime: number;
  readonly monotonicTime: number;
  readonly sessionId: string;
  readonly priority: Priority;
}

/** Copy only compact scalar metadata, never traverse source/tune/DOM objects. */
export function compactMetadata(input: Metadata | undefined): Metadata {
  const output: Record<string, string | number | boolean | null> = Object.create(null);
  if (!input) return Object.freeze(output);
  let count = 0;
  for (const key in input) {
    if (!Object.hasOwn(input, key)) continue;
    if (++count > 16) break;
    const value = input[key];
    if (typeof value === 'string') output[key.slice(0, 64)] = value.slice(0, 256);
    else if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) output[key.slice(0, 64)] = value;
  }
  return Object.freeze(output);
}
