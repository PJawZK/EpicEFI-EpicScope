import { AnomalyDetector } from './anomaly-detector';
import { compactMetadata, type ObservabilityRecord, type Priority, type RecordInput } from './record';

export interface RecorderOptions {
  readonly sessionId: string;
  readonly detectAnomalies?: boolean;
  readonly maxRecords?: number;
  readonly maxBytes?: number;
  readonly maxAgeMs?: number;
  readonly maxRecordBytes?: number;
  readonly coalesceWindowMs?: number;
  readonly wallNow?: () => number;
  readonly monotonicNow?: () => number;
}
interface Node {
  record: ObservabilityRecord;
  bytes: number;
  previous?: Node | undefined;
  next?: Node | undefined;
  previousPriority?: Node | undefined;
  nextPriority?: Node | undefined;
}
interface Queue { head?: Node | undefined; tail?: Node | undefined }
interface Repetition { key: string; first: ObservabilityRecord; count: number; firstSequence: number; lastSequence: number; lastTime: number }

/** Passive bounded store. No hooks, timers, persistence or domain-state ownership. */
export class ObservabilityRecorder {
  private readonly detector: AnomalyDetector | undefined;
  private readonly sessionId: string;
  private readonly wallNow: () => number;
  private readonly monotonicNow: () => number;
  private readonly limit: { records: number; bytes: number; age: number; recordBytes: number; window: number };
  private readonly queues: Record<Priority, Queue> = { critical: {}, normal: {}, detail: {} };
  private readonly ordered: Queue = {};
  private readonly encoder = new TextEncoder();
  private readonly names = new Map<string, number>();
  private sequence = 0;
  private latestTime = 0;
  private count = 0;
  private bytes = 0;
  private entered = false;
  private repetition: Repetition | undefined;
  // Fixed-size emergency accounting bypasses the normal recording path entirely.
  private readonly health = { rejected: 0, evicted: 0, evictedCritical: 0, coalesced: 0, reentrant: 0, internalFailures: 0 };

  constructor(options: RecorderOptions) {
    const positive = (value: number, minimum: number): number => {
      if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError('Invalid observability retention limit.');
      return value;
    };
    this.detector = options.detectAnomalies ? new AnomalyDetector() : undefined;
    this.sessionId = options.sessionId.slice(0, 128);
    if (!this.sessionId) throw new Error('Observability requires a session ID.');
    const recordBytes = positive(options.maxRecordBytes ?? 2048, 512);
    this.limit = {
      records: positive(options.maxRecords ?? 20000, 1),
      bytes: positive(options.maxBytes ?? 4 * 1024 * 1024, recordBytes * 3 + 1024),
      age: positive(options.maxAgeMs ?? 30 * 60 * 1000, 1),
      recordBytes,
      window: positive(options.coalesceWindowMs ?? 1000, 1),
    };
    this.wallNow = options.wallNow ?? Date.now;
    this.monotonicNow = options.monotonicNow ?? (() => performance.now());
  }

  private guarded<T>(action: () => T, fallback: T): T {
    if (this.entered) { this.health.reentrant += 1; return fallback; }
    this.entered = true;
    try { return action(); }
    catch { this.health.internalFailures += 1; return fallback; }
    finally { this.entered = false; }
  }

  private now(): number {
    const value = this.monotonicNow();
    if (!Number.isFinite(value)) throw new Error('Invalid recorder clock.');
    this.latestTime = Math.max(this.latestTime, value);
    return this.latestTime;
  }

  private unlink(node: Node): void {
    const priority = this.queues[node.record.priority];
    if (node.previous) node.previous.next = node.next;
    else this.ordered.head = node.next;
    if (node.next) node.next.previous = node.previous;
    else this.ordered.tail = node.previous;
    if (node.previousPriority) node.previousPriority.nextPriority = node.nextPriority;
    else priority.head = node.nextPriority;
    if (node.nextPriority) node.nextPriority.previousPriority = node.previousPriority;
    else priority.tail = node.previousPriority;
    const remaining = (this.names.get(node.record.name) ?? 1) - 1;
    if (remaining) this.names.set(node.record.name, remaining);
    else this.names.delete(node.record.name);
    this.count -= 1; this.bytes -= node.bytes;
    this.health.evicted += 1;
    if (node.record.priority === 'critical') this.health.evictedCritical += 1;
  }

  private expire(now: number): void {
    while (this.ordered.head && now - this.ordered.head.record.monotonicTime > this.limit.age) this.unlink(this.ordered.head);
  }

  private append(record: ObservabilityRecord): boolean {
    const bytes = this.encoder.encode(JSON.stringify(record)).byteLength;
    if (bytes > this.limit.recordBytes) { this.health.rejected += 1; return false; }
    // Reserve a bounded repetition slot and emergency accounting outside the ring.
    const ringBudget = this.limit.bytes - this.limit.recordBytes * 2 - 1024;
    if (bytes > ringBudget) { this.health.rejected += 1; return false; }
    while (this.count >= this.limit.records || this.bytes + bytes > ringBudget) {
      const victim = this.queues.detail.head
        ?? (record.priority !== 'detail' ? this.queues.normal.head : undefined)
        ?? (record.priority === 'critical' ? this.queues.critical.head : undefined);
      if (!victim) { this.health.rejected += 1; return false; }
      this.unlink(victim);
    }
    const queue = this.queues[record.priority];
    const node: Node = { record, bytes };
    if (this.ordered.tail) { node.previous = this.ordered.tail; this.ordered.tail.next = node; }
    else this.ordered.head = node;
    this.ordered.tail = node;
    if (queue.tail) { node.previousPriority = queue.tail; queue.tail.nextPriority = node; }
    else queue.head = node;
    queue.tail = node;
    this.count += 1; this.bytes += bytes;
    this.names.set(record.name, (this.names.get(record.name) ?? 0) + 1);
    return true;
  }

  private prepare(input: RecordInput): RecordInput {
    if (!['event', 'metric', 'snapshot'].includes(input.recordKind)
      || !['user', 'programmatic', 'observer', 'async', 'worker', 'system', 'persistence'].includes(input.origin)
      || (input.priority !== undefined && !['critical', 'normal', 'detail'].includes(input.priority))
      || (input.severity !== undefined && !['info', 'warning', 'error'].includes(input.severity))
      || (input.visibility !== undefined && !['active', 'hidden'].includes(input.visibility))
      || (input.outcome !== undefined && !['success', 'failure', 'cancelled', 'superseded', 'stale'].includes(input.outcome))) {
      throw new Error('Invalid record envelope.');
    }
    const output: Record<string, unknown> = {
      recordKind: input.recordKind, subsystem: input.subsystem.slice(0, 64), component: input.component.slice(0, 64),
      name: input.name.slice(0, 96), origin: input.origin, severity: input.severity ?? 'info', priority: input.severity === 'error' ? 'critical' : input.priority ?? 'normal',
      metadata: compactMetadata(input.metadata),
    };
    for (const key of ['operationId', 'parentOperationId', 'activeView', 'sourceIdentity', 'tuneIdentity', 'semanticFingerprint', 'reason'] as const) {
      if (input[key] !== undefined) output[key] = input[key].slice(0, 128);
    }
    for (const key of ['sourceRevision', 'tuneRevision', 'stateRevision', 'durationMs'] as const) {
      if (input[key] !== undefined && Number.isFinite(input[key])) output[key] = input[key];
    }
    if (input.visibility !== undefined) output.visibility = input.visibility;
    if (input.outcome !== undefined) output.outcome = input.outcome;
    return output as unknown as RecordInput;
  }

  private envelope(input: RecordInput, now: number, sequence: number): ObservabilityRecord {
    const wallTime = this.wallNow();
    if (!Number.isFinite(wallTime)) throw new Error('Invalid recorder clock.');
    return Object.freeze({ ...input, priority: input.severity === 'error' ? 'critical' : input.priority ?? 'normal', schemaVersion: 1, sessionId: this.sessionId, sequence, monotonicTime: now, wallTime });
  }

  private flush(now: number): void {
    const pending = this.repetition; this.repetition = undefined;
    if (!pending || !pending.count || now - pending.first.monotonicTime > this.limit.age) return;
    this.append(this.envelope({
      recordKind: 'event', subsystem: 'observability', component: 'recorder',
      name: 'observability.records-coalesced', origin: 'system', priority: 'normal',
      ...(pending.first.operationId === undefined ? {} : { operationId: pending.first.operationId }),
      ...(pending.first.parentOperationId === undefined ? {} : { parentOperationId: pending.first.parentOperationId }),
      metadata: compactMetadata({
        originalComponent: pending.first.component, originalSubsystem: pending.first.subsystem,
        originalOrigin: pending.first.origin, count: pending.count,
        firstSequence: pending.firstSequence, lastSequence: pending.lastSequence,
        recordName: pending.first.name, windowMs: pending.lastTime - pending.first.monotonicTime,
      }),
    }, now, ++this.sequence));
  }

  private detect(input: RecordInput, sequence: number, now: number): void {
    if (!this.detector) return;
    try { this.appendAnomalies(this.detector.observe({ ...input, sequence, monotonicTime: now }), now); }
    catch { this.health.internalFailures += 1; }
  }

  private appendAnomalies(findings: readonly RecordInput[], now: number): void {
    // Internal append deliberately bypasses record()/detector/coalescing. No recursion.
    for (const input of findings) {
      this.flush(now);
      this.append(this.envelope(this.prepare(input), now, ++this.sequence));
    }
  }

  /** Explicit report check only: bounded pending operations, no timer/history scan. */
  checkAnomalies(): void {
    if (!this.detector) return;
    this.guarded(() => {
      const now = this.now(); this.expire(now);
      this.appendAnomalies(this.detector!.check(now), now);
    }, undefined);
  }

  anomalyStatus() { return this.detector?.status(); }

  record(input: RecordInput): ObservabilityRecord | undefined {
    return this.guarded(() => {
      const now = this.now(); this.expire(now);
      const prepared = this.prepare(input);
      const key = prepared.priority === 'detail' ? JSON.stringify(prepared) : '';
      const pending = this.repetition;
      if (pending && key && pending.key === key && now - pending.first.monotonicTime <= this.limit.window) {
        const sequence = ++this.sequence;
        pending.count += 1; pending.lastTime = now; pending.lastSequence = sequence;
        this.health.coalesced += 1;
        this.detect(prepared, sequence, now);
        return undefined;
      }
      this.flush(now);
      const record = this.envelope(prepared, now, ++this.sequence);
      if (!this.append(record)) return undefined;
      if (key) this.repetition = { key, first: record, count: 0, firstSequence: record.sequence + 1, lastSequence: record.sequence, lastTime: now };
      this.detect(record, record.sequence, now);
      return record;
    }, undefined);
  }

  snapshot(): readonly ObservabilityRecord[] {
    return this.guarded(() => {
      const now = this.now(); this.expire(now); this.flush(now);
      const result: ObservabilityRecord[] = [];
      for (let node = this.ordered.head; node; node = node.next) result.push(node.record);
      return Object.freeze(result);
    }, Object.freeze([]) as readonly ObservabilityRecord[]);
  }

  /** Bounded retained-name index avoids history scans for health polling. */
  countNamed(name: string): number {
    return this.guarded(() => { this.expire(this.now()); return this.names.get(name) ?? 0; }, 0);
  }

  time(): number | undefined { return this.guarded(() => this.now(), undefined); }

  status() {
    return Object.freeze({ ...this.health, records: this.count, recordBytes: this.bytes, reservedBytes: this.limit.recordBytes * 2 + 1024, maxBytes: this.limit.bytes, lastSequence: this.sequence });
  }
}
