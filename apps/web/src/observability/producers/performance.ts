import type { ObservabilityRecorder } from '../recorder';
import type { ObservabilityRecord, Metadata } from '../record';
import { performanceFields } from './performance-schema';
import type { LoadPerformanceRun, IniLoadPerformanceRun, ChannelBindingPerformanceRun, WorkspaceRestorePerformanceRun, ChannelPerformanceRun, ValidationPerformanceRun, PerformanceRuntimeMemorySnapshot } from '../performance-types';
import { latestBlobByteSourceRuntimeDiagnostics } from '../../adapters/blob-byte-source';
import { latestChannelDecodePerformance } from '../../../../../core/parsers/mlg/channel-decode-performance';
import { latestPersistentColumnMemoryDiagnostics, persistentColumnMemoryAggregateDiagnostics } from '../../adapters/persistent-channel-cache';
import { latestBoundChannelMemoryDiagnostics, boundChannelMemoryAggregateDiagnostics } from '../../../../../core/channels/channel-binding';

export interface PerformanceMemory {
  readonly persistent?: ReturnType<typeof latestPersistentColumnMemoryDiagnostics>;
  readonly persistentAll: ReturnType<typeof persistentColumnMemoryAggregateDiagnostics>;
  readonly bound?: ReturnType<typeof latestBoundChannelMemoryDiagnostics>;
  readonly boundAll: ReturnType<typeof boundChannelMemoryAggregateDiagnostics>;
  readonly runtime?: PerformanceRuntimeMemorySnapshot | undefined;
}
export interface PerformanceRuns {
  load: LoadPerformanceRun;
  ini: IniLoadPerformanceRun;
  binding: ChannelBindingPerformanceRun;
  restore: WorkspaceRestorePerformanceRun;
  channel: ChannelPerformanceRun;
  validation: ValidationPerformanceRun;
  blob: NonNullable<ReturnType<typeof latestBlobByteSourceRuntimeDiagnostics>>;
  decode: NonNullable<ReturnType<typeof latestChannelDecodePerformance>>;
  memory: PerformanceMemory;
}
export interface PerformanceProjection {
  readonly loadRuns: readonly LoadPerformanceRun[];
  readonly iniLoadRuns: readonly IniLoadPerformanceRun[];
  readonly bindingRuns: readonly ChannelBindingPerformanceRun[];
  readonly workspaceRestoreRuns: readonly WorkspaceRestorePerformanceRun[];
  readonly channelRuns: readonly ChannelPerformanceRun[];
  blob?: PerformanceRuns['blob'];
  decode?: PerformanceRuns['decode'];
  memory?: PerformanceMemory;
  incomplete: number;
  truncated: number;
  retention: Pick<ReturnType<ObservabilityRecorder['status']>, 'evicted' | 'rejected' | 'internalFailures'>;
}
type MutableProjection = { -readonly [K in keyof PerformanceProjection]: PerformanceProjection[K] extends readonly (infer T)[] ? T[] : PerformanceProjection[K] };
type Kind = keyof PerformanceRuns;
type Scalar = Metadata[string];
const MAX_GROUPS = 256;
const MAX_STRING = 65536;
// Four maximally escaped 256-character strings fit the shell's 8-KiB record budget.
const FIELDS_PER_PART = 4;
let nextOwner = 0;

function scalarAt(value: unknown, path: string): unknown {
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
function setPath(target: Record<string, unknown>, path: string, value: Scalar): void {
  const keys = path.split('.');
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    target = (target[key] ??= /^\d+$/.test(keys[i + 1]!) ? [] : Object.create(null)) as Record<string, unknown>;
  }
  target[keys.at(-1)!] = value;
}

/** Existing completion boundaries publish measurements, not fabricated operation start times.
 * Only compact scalar metrics are retained. Multi-part measurements require a complete
 * commit and all parts; retention pressure can never expose half a measurement as valid.
 */
export class PerformanceEvidence {
  readonly owner = `performance:${++nextOwner}`;
  private nextMeasurement = 0;
  private cached: { sequence: number; count: number; projection: PerformanceProjection } | undefined;
  private readonly resourceSignatures: Partial<Record<'blob' | 'decode' | 'memory', string>> = {};
  private cacheIsCurrent(): boolean {
    // Enforce age expiry without allocating/copying the retained stream.
    this.recorder.countNamed('performance.cleared');
    const status = this.recorder.status();
    return this.cached?.sequence === status.lastSequence && this.cached.count === status.records
      && this.cached.projection.retention.rejected === status.rejected
      && this.cached.projection.retention.internalFailures === status.internalFailures;
  }
  constructor(readonly recorder: ObservabilityRecorder) {}

  record<K extends Kind>(kind: K, run: PerformanceRuns[K]): void {
    try { this.recordMeasurement(kind, run); }
    catch {
      this.recorder.record({ recordKind: 'event', subsystem: 'observability', component: this.owner, name: 'observability.performance-producer.failed', origin: 'system', severity: 'warning' });
    }
  }

  private recordMeasurement<K extends Kind>(kind: K, run: PerformanceRuns[K]): void {
    const id = ++this.nextMeasurement;
    const values: [string, Scalar][] = [];
    let truncated = 0;
    const add = (key: string, value: unknown): void => {
      if (typeof value === 'string') {
        if (value.length > MAX_STRING) truncated++;
        const bounded = value.slice(0, MAX_STRING);
        // Fragment long diagnostic strings rather than silently losing scope/cache evidence.
        if (bounded.length > 256) {
          for (let i = 0; i < bounded.length; i += 256) values.push([`${key}:${i / 256}`, bounded.slice(i, i + 256)]);
        } else values.push([key, bounded]);
      } else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) values.push([key, value]);
    };
    for (const field of performanceFields[kind]) add(field, scalarAt(run, field));
    if (kind === 'ini') {
      const groups = (run as IniLoadPerformanceRun).diagnosticGroups;
      add('diagnosticGroupCount', Math.min(groups.length, MAX_GROUPS));
      if (groups.length > MAX_GROUPS) truncated++;
      for (let i = 0; i < Math.min(groups.length, MAX_GROUPS); i++) {
        const group = groups[i]!;
        add(`diagnosticGroups.${i}.code`, group.code); add(`diagnosticGroups.${i}.severity`, group.severity); add(`diagnosticGroups.${i}.count`, group.count);
      }
    }
    const blob = kind === 'blob' ? run as PerformanceRuns['blob'] : kind === 'load' ? (run as LoadPerformanceRun).workerSourceRuntime : undefined;
    if (blob) {
      const prefix = kind === 'blob' ? '' : 'workerSourceRuntime.';
      add(`${prefix}slowReadCount`, Math.min(blob.slowestReads.length, MAX_GROUPS));
      if (blob.slowestReads.length > MAX_GROUPS) truncated++;
      for (let i = 0; i < Math.min(blob.slowestReads.length, MAX_GROUPS); i++) {
        const read = blob.slowestReads[i]!;
        add(`${prefix}slowestReads.${i}.offset`, read.offset); add(`${prefix}slowestReads.${i}.bytes`, read.bytes); add(`${prefix}slowestReads.${i}.durationMs`, read.durationMs);
      }
    }
    if (kind === 'blob' || kind === 'decode' || kind === 'memory') {
      const resourceKind = kind as 'blob' | 'decode' | 'memory';
      const signature = JSON.stringify(values);
      if (this.resourceSignatures[resourceKind] === signature && this.cacheIsCurrent() && this.cached?.projection[resourceKind]) return;
      this.resourceSignatures[resourceKind] = signature;
    }
    const parts = Math.ceil(values.length / FIELDS_PER_PART);
    for (let part = 0; part < parts; part++) this.recorder.record({ recordKind: 'metric', subsystem: 'performance', component: this.owner,
      name: `performance.${kind}.part`, origin: 'system', metadata: { measurement: id, part, ...Object.fromEntries(values.slice(part * FIELDS_PER_PART, (part + 1) * FIELDS_PER_PART)) },
    });
    const duration = scalarAt(run, kind === 'load' ? 'importTotalMs' : kind === 'validation' ? 'validationMs' : 'totalMs');
    this.recorder.record({ recordKind: 'metric', subsystem: 'performance', component: this.owner, name: `performance.${kind}`, origin: 'system',
      ...(typeof duration === 'number' ? { durationMs: duration } : {}), metadata: { measurement: id, parts, truncated },
    });
  }

  clear(origin: 'user' | 'programmatic' = 'programmatic'): void {
    this.recorder.record({ recordKind: 'event', subsystem: 'performance', component: this.owner, name: 'performance.cleared', origin });
  }

  /** Probes remain at their current cache/source owners; capture only on an explicit lens request. */
  captureProbes(runtimeProvider: (() => PerformanceRuntimeMemorySnapshot) | undefined, decodeChannels?: number, captureSourceRuntime = true): void {
    try {
      const runtime = runtimeProvider?.();
      const blob = captureSourceRuntime ? latestBlobByteSourceRuntimeDiagnostics() : undefined;
      if (blob) this.record('blob', blob);
      const decode = latestChannelDecodePerformance(decodeChannels); if (decode) this.record('decode', decode);
      this.record('memory', { persistent: latestPersistentColumnMemoryDiagnostics(), persistentAll: persistentColumnMemoryAggregateDiagnostics(), bound: latestBoundChannelMemoryDiagnostics(), boundAll: boundChannelMemoryAggregateDiagnostics(), runtime });
    } catch {
      this.recorder.record({ recordKind: 'event', subsystem: 'observability', component: this.owner, name: 'observability.performance-probe.failed', origin: 'system', severity: 'warning' });
    }
  }

  project(records?: readonly ObservabilityRecord[]): PerformanceProjection {
    if (records === undefined && this.cacheIsCurrent()) return this.cached!.projection;
    const stream = records ?? this.recorder.snapshot();
    const result: MutableProjection = { loadRuns: [], iniLoadRuns: [], bindingRuns: [], workspaceRestoreRuns: [], channelRuns: [], incomplete: 0, truncated: 0, retention: this.recorder.status() };
    // Select the retained lens tail before reconstructing objects. A long session
    // must not rebuild thousands of old channel runs just to show the latest 24.
    const selected = new Set<number>();
    const counts = new Map<string, number>();
    let beforeLatestLoad = false;
    for (let i = stream.length - 1; i >= 0; i--) {
      const record = stream[i]!;
      if (record.component !== this.owner || record.subsystem !== 'performance') continue;
      if (record.name === 'performance.cleared') break;
      if (record.name.endsWith('.part')) continue;
      const kind = record.name.slice('performance.'.length);
      if (beforeLatestLoad && (kind === 'channel' || kind === 'restore' || kind === 'decode')) continue;
      if (kind === 'load') beforeLatestLoad = true;
      const count = counts.get(kind) ?? 0;
      const limit = kind === 'channel' ? 50 : ['blob', 'decode', 'memory'].includes(kind) ? 1 : 20;
      if (count >= limit || typeof record.metadata?.measurement !== 'number') continue;
      counts.set(kind, count + 1); selected.add(record.metadata.measurement);
    }
    const parts = new Map<number, Map<number, Metadata>>();
    for (const record of stream) {
      if (record.component !== this.owner || record.subsystem !== 'performance') continue;
      if (record.name === 'performance.cleared') {
        result.loadRuns.length = result.iniLoadRuns.length = result.bindingRuns.length = result.workspaceRestoreRuns.length = result.channelRuns.length = 0;
        delete result.decode; parts.clear(); continue;
      }
      const m = record.metadata ?? {};
      if (typeof m.measurement !== 'number' || !selected.has(m.measurement)) continue;
      if (record.name.endsWith('.part')) {
        if (typeof m.part !== 'number') continue;
        let group = parts.get(m.measurement); if (!group) parts.set(m.measurement, group = new Map());
        group.set(m.part, m); continue;
      }
      const group = parts.get(m.measurement); parts.delete(m.measurement);
      if (typeof m.parts !== 'number' || !group || group.size !== m.parts) { result.incomplete++; continue; }
      const flat: Record<string, Scalar> = Object.create(null);
      for (let i = 0; i < m.parts; i++) {
        const part = group.get(i);
        if (!part) { result.incomplete++; break; }
        for (const [key, value] of Object.entries(part)) if (key !== 'measurement' && key !== 'part') flat[key] = value;
      }
      const run: Record<string, unknown> = Object.create(null);
      const fragments = new Map<string, string[]>();
      for (const [key, value] of Object.entries(flat)) {
        const match = /^(.*):(\d+)$/.exec(key);
        if (match && typeof value === 'string') {
          let chunks = fragments.get(match[1]!); if (!chunks) fragments.set(match[1]!, chunks = []);
          chunks[Number(match[2])] = value;
        } else setPath(run, key, value);
      }
      for (const [key, chunks] of fragments) setPath(run, key, chunks.join(''));
      result.truncated += typeof m.truncated === 'number' ? m.truncated : 0;
      const kind = record.name.slice('performance.'.length) as Kind;
      if (kind === 'ini') { run.diagnosticGroups ??= []; delete run.diagnosticGroupCount; }
      if (kind === 'blob') { run.slowestReads ??= []; delete run.slowReadCount; }
      if (run.workerSourceRuntime) { const worker = run.workerSourceRuntime as Record<string, unknown>; worker.slowestReads ??= []; delete worker.slowReadCount; }
      if (kind === 'load') { result.workspaceRestoreRuns.length = result.channelRuns.length = 0; delete result.decode; }
      const destination = { load: result.loadRuns, ini: result.iniLoadRuns, binding: result.bindingRuns, restore: result.workspaceRestoreRuns, channel: result.channelRuns }[kind as 'load' | 'ini' | 'binding' | 'restore' | 'channel'] as unknown[] | undefined;
      if (destination) { destination.push(run); if (destination.length > (kind === 'channel' ? 50 : 20)) destination.shift(); }
      else if (kind === 'validation') {
        const load = [...result.loadRuns].reverse().find(load => load.fileName === run.fileName);
        if (load) Object.assign(load, run);
      } else if (kind === 'blob') result.blob = run as unknown as PerformanceRuns['blob'];
      else if (kind === 'decode') result.decode = run as unknown as PerformanceRuns['decode'];
      else if (kind === 'memory') result.memory = run as unknown as PerformanceMemory;
    }
    result.incomplete += parts.size;
    // This is one immutable derived read model, never a second producer authority.
    const freeze = (value: unknown): void => {
      if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    };
    freeze(result);
    if (records === undefined) {
      const status = this.recorder.status();
      this.cached = { sequence: status.lastSequence, count: status.records, projection: result };
    }
    return result;
  }
}
