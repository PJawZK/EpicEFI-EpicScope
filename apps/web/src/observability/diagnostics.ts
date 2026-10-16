import type { PerformanceProjection } from './producers/performance';
import type { ParserDiagnostic } from '../../../../core/log-model/log-types';
import type { ObservabilityRecord } from './record';
import type { ObservabilityRecorder } from './recorder';
import type { PersistenceSnapshot } from './session-persistence';
export interface DiagnosticsCapture {
  readonly schemaVersion: 1;
  readonly capturedAt: string;
  readonly sessionId: string;
  readonly reportText: string;
  readonly health: { readonly issues: readonly string[]; readonly warnings: readonly string[] };
  readonly records: readonly ObservabilityRecord[];
  readonly retention: ReturnType<ObservabilityRecorder['status']>;
  readonly anomalyTracking: ReturnType<ObservabilityRecorder['anomalyStatus']>;
  readonly persistence: PersistenceSnapshot;
  readonly performanceReport: string;
  readonly parserReport: string;
  readonly resources: Pick<PerformanceProjection, 'incomplete' | 'truncated' | 'retention'> & { readonly blob?: PerformanceProjection['blob']; readonly decode?: PerformanceProjection['decode']; readonly memory?: PerformanceProjection['memory'] };
  readonly parserDiagnostics: readonly ParserDiagnostic[];
}
/** Capture explicit evidence only, never a domain/source/workspace object. */
export function createDiagnosticsCapture(input: Omit<DiagnosticsCapture, 'schemaVersion'>): DiagnosticsCapture {
  return Object.freeze({ schemaVersion: 1, capturedAt: input.capturedAt, sessionId: input.sessionId,
    reportText: input.reportText, health: Object.freeze({ issues: Object.freeze([...input.health.issues]), warnings: Object.freeze([...input.health.warnings]) }),
    records: input.records, retention: input.retention, anomalyTracking: input.anomalyTracking,
    persistence: Object.freeze({ ...input.persistence, previous: [...input.persistence.previous] }),
    performanceReport: input.performanceReport, parserReport: input.parserReport, resources: Object.freeze({ blob: input.resources.blob, decode: input.resources.decode, memory: input.resources.memory, incomplete: input.resources.incomplete, truncated: input.resources.truncated, retention: input.resources.retention }),
    parserDiagnostics: Object.freeze(input.parserDiagnostics.map(d => Object.freeze({
      code: d.code, severity: d.severity, message: d.message, recoverable: d.recoverable,
      ...(d.offset === undefined ? {} : { offset: d.offset }),
      ...(d.timeMs === undefined ? {} : { timeMs: d.timeMs }),
      ...(d.sourceIntegrity === undefined ? {} : {
        sourceIntegrity: Object.freeze({
          kind: d.sourceIntegrity.kind,
          breaksContinuity: d.sourceIntegrity.breaksContinuity,
        }),
      }),
    }))),
  });
}
export const RECORD_FILTERS = ['subsystem', 'component', 'operationId', 'origin', 'severity', 'visibility', 'recordKind', 'outcome', 'sourceRevision', 'tuneRevision', 'anomalyCode', 'search'] as const;
export type RecordFilters = Partial<Record<typeof RECORD_FILTERS[number], string>>;
export function filterRecords(records: readonly ObservabilityRecord[], filters: RecordFilters): readonly ObservabilityRecord[] {
  const entries = Object.entries(filters).filter(([, value]) => value !== '');
  if (!entries.length) return records;
  return records.filter(record => entries.every(([key, value]) => {
    if (key === 'search') return [record.name, record.reason, record.operationId, record.metadata?.ruleCode].some(field => String(field ?? '').toLowerCase().includes(value!.toLowerCase()));
    if (key === 'anomalyCode') return record.metadata?.ruleCode === value;
    return String(record[key as keyof ObservabilityRecord] ?? '') === value;
  }));
}
export interface OperationRow { readonly id: string; readonly parentId: string | undefined; readonly depth: number; readonly name: string; readonly outcome: string; readonly durationMs: number | undefined; readonly missingStart: boolean; readonly orphan: boolean; readonly cycle: boolean; readonly staleCompletions: number }
/** Linear iterative traversal; missing parents/cycles never invent causal work or recurse. */
export function operationRows(records: readonly ObservabilityRecord[]): readonly OperationRow[] {
  const nodes = new Map<string, { record: ObservabilityRecord; start: boolean; terminal?: ObservabilityRecord; stale: number }>();
  for (const record of records) {
    if (!record.operationId) continue;
    let node = nodes.get(record.operationId);
    if (!node) { node = { record, start: false, stale: 0 }; nodes.set(record.operationId, node); }
    if (record.name.endsWith('.started')) { node.record = record; node.start = true; }
    if (record.name.endsWith('.completed') && record.outcome) node.terminal = record;
    if (record.name === 'async.completion.stale') node.stale++;
  }
  const children = new Map<string, string[]>(), roots: string[] = [];
  for (const [id, node] of nodes) {
    const parent = node.record.parentOperationId;
    if (!parent || !nodes.has(parent)) roots.push(id);
    else { const list = children.get(parent) ?? []; list.push(id); children.set(parent, list); }
  }
  const rows: OperationRow[] = [], visited = new Set<string>();
  const walk = (root: string, cycle: boolean) => {
    const stack = [{ id: root, depth: 0 }];
    while (stack.length) {
      const { id, depth } = stack.pop()!; if (visited.has(id)) continue; visited.add(id);
      const node = nodes.get(id)!; const parent = node.record.parentOperationId;
      rows.push({ id, parentId: parent, depth, name: node.record.name, outcome: node.terminal?.outcome ?? 'no terminal retained', durationMs: node.terminal?.durationMs, missingStart: !node.start, orphan: Boolean(parent && !nodes.has(parent)), cycle, staleCompletions: node.stale });
      const list = children.get(id) ?? []; for (let i = list.length - 1; i >= 0; i--) stack.push({ id: list[i]!, depth: depth + 1 });
    }
  };
  for (const root of roots) walk(root, false);
  for (const id of nodes.keys()) if (!visited.has(id)) walk(id, true);
  return rows;
}
