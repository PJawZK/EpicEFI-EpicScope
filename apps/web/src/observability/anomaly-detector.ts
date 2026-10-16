import type { Metadata, ObservabilityRecord, RecordInput } from './record';
import { evaluateHealthRules } from './health-rules';

/** Policy thresholds describe evidence patterns, never application deadlines or repair decisions. */
export const ANOMALY_POLICY = Object.freeze({ windowMs: 1000, burstCount: 100, sameStateWorkCount: 3, unfinishedMs: 30000, cooldownMs: 60000, maxKeys: 128, maxFindingsPerWindow: 16 });
type Evidence = RecordInput & Pick<ObservabilityRecord, 'sequence' | 'monotonicTime'>;
interface Window { first: number; last: number; time: number; count: number; reported: boolean; semanticKey: string }
interface Pending { evidence: Evidence; reported: boolean }
// Deliberately exclude requests, presentation renders, no-op notifications and cache hits.
const semanticWork = new Set(['ve.rebuild', 'analysis.completed', 'render.completed']);
const staleEvents = new Set(['async.completion.stale', 'domain.read.stale', 'analyzer.compare.stale', 'histogram.read.stale', 've.delay-discovery.stale', 've.delay-file.stale']);

/** Bounded scalar streaming state. Called only by the recorder; never calls back into it. */
export class AnomalyDetector {
  private readonly bursts = new Map<string, Window>();
  private readonly sameState = new Map<string, Window>();
  private readonly pending = new Map<string, Pending>();
  private readonly cooldowns = new Map<string, number>();
  private trackingEvictions = 0;
  private suppressedFindings = 0;
  private findingWindowStart = -Infinity;
  private findingWindowCount = 0;

  private put<T>(map: Map<string, T>, key: string, value: T): void {
    if (!map.has(key) && map.size >= ANOMALY_POLICY.maxKeys) {
      map.delete(map.keys().next().value!); this.trackingEvictions++;
    }
    map.set(key, value);
  }
  private finding(record: Evidence, code: string, reason: string, metadata: Metadata = {}, severity: 'info' | 'warning' | 'error' = 'warning', first = record.sequence): RecordInput | undefined {
    const key = JSON.stringify([code, record.component, record.metadata?.ownerId ?? '', record.operationId ?? '']);
    const last = this.cooldowns.get(key);
    if (last !== undefined && record.monotonicTime - last < ANOMALY_POLICY.cooldownMs) return undefined;
    if (record.monotonicTime - this.findingWindowStart >= ANOMALY_POLICY.windowMs) {
      this.findingWindowStart = record.monotonicTime; this.findingWindowCount = 0;
    }
    if (this.findingWindowCount >= ANOMALY_POLICY.maxFindingsPerWindow) { this.suppressedFindings++; return undefined; }
    this.findingWindowCount++;
    this.put(this.cooldowns, key, record.monotonicTime);
    return {
      recordKind: 'event', subsystem: 'observability', component: 'anomaly-detector', name: 'anomaly.detected',
      origin: 'system', priority: 'critical', severity, reason,
      ...(record.operationId === undefined ? {} : { operationId: record.operationId }),
      ...(record.parentOperationId === undefined ? {} : { parentOperationId: record.parentOperationId }),
      metadata: { ruleCode: code, evidenceFirstSequence: first, evidenceLastSequence: record.sequence, ownerComponent: record.component, ownerId: record.metadata?.ownerId ?? '',
        ...(record.metadata?.generation === undefined ? {} : { generation: record.metadata.generation }),
        ...(record.metadata?.currentGeneration === undefined ? {} : { currentGeneration: record.metadata.currentGeneration }), ...metadata },
    };
  }
  private window(map: Map<string, Window>, key: string, record: Evidence, threshold: number, semanticKey = ''): Window | undefined {
    let state = map.get(key);
    if (!state || state.semanticKey !== semanticKey || record.monotonicTime - state.time > ANOMALY_POLICY.windowMs) {
      state = { first: record.sequence, last: record.sequence, time: record.monotonicTime, count: 0, reported: false, semanticKey };
      this.put(map, key, state);
    }
    state.count++; state.last = record.sequence;
    if (state.count < threshold || state.reported) return undefined;
    state.reported = true;
    return state;
  }
  observe(record: Evidence): readonly RecordInput[] {
    // Derived evidence and recorder internals cannot recursively generate patterns.
    if (record.subsystem === 'observability' || record.subsystem === 'performance' || record.recordKind === 'metric') return [];
    const findings: RecordInput[] = [];
    const add = (finding: RecordInput | undefined) => { if (finding) findings.push(finding); };
    const owner = record.metadata?.ownerId ?? '';
    const key = JSON.stringify([record.component, owner, record.name, record.origin]);
    const burst = this.window(this.bursts, key, record, ANOMALY_POLICY.burstCount);
    if (burst) add(this.finding(record, 'repetition.burst', 'high-event-rate-not-cpu-proof', { count: burst.count, windowMs: record.monotonicTime - burst.time }, 'warning', burst.first));
    // Complete owner-supplied semantics are mandatory. A revision alone does not
    // distinguish presentation settings, and duration may include awaited I/O.
    if (semanticWork.has(record.name) && record.semanticFingerprint && record.semanticFingerprint.length < 128 && (!record.name.endsWith('.completed') || record.outcome === 'success')) {
      const stateKey = JSON.stringify([key, record.sourceIdentity, record.sourceRevision, record.tuneIdentity, record.tuneRevision, record.stateRevision, record.semanticFingerprint]);
      const repeated = this.window(this.sameState, key, record, ANOMALY_POLICY.sameStateWorkCount, stateKey);
      if (repeated) add(this.finding(record, 'work.same-state', 'repeated-work-with-owner-provided-identical-semantics', { count: repeated.count, fingerprint: record.semanticFingerprint }, 'warning', repeated.first));
    }
    if (staleEvents.has(record.name)) {
      add(this.finding(record, 'async.stale-completion', 'obsolete-completion-observed-not-accepted-result-proof', {}, 'info'));
    }
    if (record.operationId && record.name.endsWith('.started')) this.put(this.pending, record.operationId, {
      evidence: { recordKind: 'event', subsystem: record.subsystem, component: record.component, name: record.name,
        origin: record.origin, operationId: record.operationId, sequence: record.sequence, monotonicTime: record.monotonicTime,
        ...(record.parentOperationId === undefined ? {} : { parentOperationId: record.parentOperationId }), metadata: { ownerId: owner } },
      reported: false,
    });
    if (record.operationId && record.name.endsWith('.completed') && record.outcome) this.pending.delete(record.operationId);
    if (record.name === 'persistence.result') {
      const m = record.metadata;
      if (m?.persisted === false || (m?.acceptedInMemory === true && (m.outcome === 'failure' || m.outcome === 'unavailable'))) {
        add(this.finding(record, 'persistence.session-only', 'memory-and-durable-state-diverge-with-visible-session-retention', { action: m.action ?? 'unknown', durableOutcome: m.outcome ?? 'failure' }));
      }
    }
    if (record.name === 'health.snapshot') {
      const m = record.metadata!;
      // This dedicated producer supplies only these compact fields. Malformed
      // synthetic records must not manufacture missing-source/runtime findings.
      if (['logLoaded', 'iniLoaded', 'bindingActive', 'hasChannelDataSource'].every(k => typeof m[k] === 'boolean')
        && ['channelDefinitionCount', 'catalogChannelCount', 'renderableAssignedChannelCount', 'unavailableAssignedChannelCount', 'activeTraceCount', 'runtimeErrorCount'].every(k => typeof m[k] === 'number')) {
        const snapshot = { hasChannelDataSource: m.hasChannelDataSource as boolean, channelDefinitionCount: m.channelDefinitionCount as number, catalogChannelCount: m.catalogChannelCount as number, renderableAssignedChannelCount: m.renderableAssignedChannelCount as number, unavailableAssignedChannelCount: m.unavailableAssignedChannelCount as number, activeTraceCount: m.activeTraceCount as number };
        const context = { logLoaded: m.logLoaded as boolean, iniLoaded: m.iniLoaded as boolean, bindingActive: m.bindingActive as boolean, runtimeErrorCount: m.runtimeErrorCount as number };
        for (const finding of evaluateHealthRules(snapshot, context)) add(this.finding(record, finding.code, 'existing-runtime-health-rule', {}, finding.severity));
      }
    }
    return findings;
  }
  /** Explicit report boundary, not a timer. Absence of a terminal is inconclusive. */
  check(now: number): readonly RecordInput[] {
    const findings: RecordInput[] = [];
    for (const { evidence, reported } of this.pending.values()) {
      if (reported || now - evidence.monotonicTime < ANOMALY_POLICY.unfinishedMs) continue;
      this.pending.get(evidence.operationId!)!.reported = true;
      const result = this.finding({ ...evidence, monotonicTime: now }, 'async.unfinished', 'no-terminal-observed-at-report-boundary-not-timeout-or-crash-proof', { elapsedMs: now - evidence.monotonicTime, thresholdMs: ANOMALY_POLICY.unfinishedMs }, 'info');
      if (result) findings.push(result);
    }
    return findings;
  }
  status() {
    return Object.freeze({ burstKeys: this.bursts.size, semanticKeys: this.sameState.size, pendingOperations: this.pending.size, cooldownKeys: this.cooldowns.size, trackingEvictions: this.trackingEvictions, suppressedFindings: this.suppressedFindings });
  }
}
