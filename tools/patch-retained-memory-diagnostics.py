from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'anchor missing in {path}: {old[:120]!r}')
    p.write_text(s.replace(old, new, count))


# Persistent decoded-column cache instrumentation.
replace(
    'apps/web/src/adapters/persistent-channel-cache.ts',
    "const MAX_PERSISTED_SELECTION_BATCH = 4;",
    """const MAX_PERSISTED_SELECTION_BATCH = 4;

export interface PersistentColumnMemoryDiagnostics {
  readonly residentColumnCount: number;
  readonly residentBytes: number;
  readonly peakResidentColumnCount: number;
  readonly peakResidentBytes: number;
  readonly residentHitCount: number;
  readonly diskLoadCount: number;
  readonly retainedColumnCount: number;
  readonly storeMissCount: number;
}

let latestPersistentColumnMemory: PersistentColumnMemoryDiagnostics | undefined;
let persistentMemorySourceSequence = 0;

export function latestPersistentColumnMemoryDiagnostics(): PersistentColumnMemoryDiagnostics | undefined {
  return latestPersistentColumnMemory ? { ...latestPersistentColumnMemory } : undefined;
}""",
)
replace(
    'apps/web/src/adapters/persistent-channel-cache.ts',
    """  private readonly residentColumns = new Map<string, Float64Array>();
  private cachedChannelIdIndex: Set<string> | undefined;""",
    """  private readonly residentColumns = new Map<string, Float64Array>();
  private cachedChannelIdIndex: Set<string> | undefined;
  private readonly memorySourceId = ++persistentMemorySourceSequence;
  private peakResidentColumnCount = 0;
  private peakResidentBytes = 0;
  private residentHitCount = 0;
  private diskLoadCount = 0;
  private retainedColumnCount = 0;
  private storeMissCount = 0;""",
)
replace(
    'apps/web/src/adapters/persistent-channel-cache.ts',
    """    if (!source.managesPersistentColumns && store.listCachedChannelIds) {""",
    """    this.updateMemoryDiagnostics();
    if (!source.managesPersistentColumns && store.listCachedChannelIds) {""",
)
replace(
    'apps/web/src/adapters/persistent-channel-cache.ts',
    """  public sampleRangeForTime(""",
    """  private updateMemoryDiagnostics(): void {
    const residentBytes = [...this.residentColumns.values()]
      .reduce((sum, values) => sum + values.byteLength, 0);
    this.peakResidentColumnCount = Math.max(this.peakResidentColumnCount, this.residentColumns.size);
    this.peakResidentBytes = Math.max(this.peakResidentBytes, residentBytes);
    if (this.memorySourceId !== persistentMemorySourceSequence) return;
    latestPersistentColumnMemory = {
      residentColumnCount: this.residentColumns.size,
      residentBytes,
      peakResidentColumnCount: this.peakResidentColumnCount,
      peakResidentBytes: this.peakResidentBytes,
      residentHitCount: this.residentHitCount,
      diskLoadCount: this.diskLoadCount,
      retainedColumnCount: this.retainedColumnCount,
      storeMissCount: this.storeMissCount,
    };
  }

  public sampleRangeForTime(""",
)
replace(
    'apps/web/src/adapters/persistent-channel-cache.ts',
    """    const resident = this.residentColumns.get(channelId);
    if (this.source.managesPersistentColumns) return undefined;
    if (resident) return resident;""",
    """    const resident = this.residentColumns.get(channelId);
    if (this.source.managesPersistentColumns) return undefined;
    if (resident) {
      this.residentHitCount += 1;
      this.updateMemoryDiagnostics();
      return resident;
    }""",
)
replace(
    'apps/web/src/adapters/persistent-channel-cache.ts',
    """      if (!values || values.length !== this.sampleCount) {
        this.missingColumns.add(channelId);""",
    """      if (!values || values.length !== this.sampleCount) {
        this.storeMissCount += 1;
        this.missingColumns.add(channelId);""",
)
replace(
    'apps/web/src/adapters/persistent-channel-cache.ts',
    """        this.cachedChannelIdIndex?.delete(channelId);
        return undefined;
      }
      this.cachedChannelIdIndex?.add(channelId);
      this.residentColumns.set(channelId, values);
      return values;""",
    """        this.cachedChannelIdIndex?.delete(channelId);
        this.updateMemoryDiagnostics();
        return undefined;
      }
      this.cachedChannelIdIndex?.add(channelId);
      this.residentColumns.set(channelId, values);
      this.diskLoadCount += 1;
      this.updateMemoryDiagnostics();
      return values;""",
)
replace(
    'apps/web/src/adapters/persistent-channel-cache.ts',
    """  private retainFullColumn(channelId: string, range: NumericChannelRange): boolean {
    if (range.startSampleIndex !== 0 || range.values.length !== this.sampleCount) return false;
    this.residentColumns.set(channelId, range.values);""",
    """  private retainFullColumn(channelId: string, range: NumericChannelRange): boolean {
    if (range.startSampleIndex !== 0 || range.values.length !== this.sampleCount) return false;
    const wasResident = this.residentColumns.has(channelId);
    this.residentColumns.set(channelId, range.values);
    if (!wasResident) this.retainedColumnCount += 1;""",
)
replace(
    'apps/web/src/adapters/persistent-channel-cache.ts',
    """    this.cachedChannelIdIndex?.add(channelId);
    return true;
  }""",
    """    this.cachedChannelIdIndex?.add(channelId);
    this.updateMemoryDiagnostics();
    return true;
  }""",
    1,
)

# Bound full-range cache instrumentation.
replace(
    'core/channels/channel-binding.ts',
    """const residentFullRangesBySource = new WeakMap<
  NumericChannelDataSource,
  Map<string, NumericChannelRange>
>();""",
    """export interface BoundChannelMemoryDiagnostics {
  readonly residentRangeCount: number;
  readonly residentBytes: number;
  readonly peakResidentRangeCount: number;
  readonly peakResidentBytes: number;
  readonly residentHitCount: number;
  readonly residentMissCount: number;
  readonly retainedRangeCount: number;
}

let latestBoundChannelMemory: BoundChannelMemoryDiagnostics | undefined;
let boundMemorySourceSequence = 0;

export function latestBoundChannelMemoryDiagnostics(): BoundChannelMemoryDiagnostics | undefined {
  return latestBoundChannelMemory ? { ...latestBoundChannelMemory } : undefined;
}

const residentFullRangesBySource = new WeakMap<
  NumericChannelDataSource,
  Map<string, NumericChannelRange>
>();""",
)
replace(
    'core/channels/channel-binding.ts',
    """  private readonly residentFullRanges: Map<string, NumericChannelRange>;

  public constructor(""",
    """  private readonly residentFullRanges: Map<string, NumericChannelRange>;
  private readonly memorySourceId = ++boundMemorySourceSequence;
  private peakResidentRangeCount = 0;
  private peakResidentBytes = 0;
  private residentHitCount = 0;
  private residentMissCount = 0;
  private retainedRangeCount = 0;

  public constructor(""",
)
replace(
    'core/channels/channel-binding.ts',
    """    this.residentFullRanges = residentFullRangesForSource(source);
    if (source.preferredBatchWindowMs !== undefined) {""",
    """    this.residentFullRanges = residentFullRangesForSource(source);
    this.updateMemoryDiagnostics();
    if (source.preferredBatchWindowMs !== undefined) {""",
)
replace(
    'core/channels/channel-binding.ts',
    """  private sourceId(channelId: string): string {""",
    """  private updateMemoryDiagnostics(): void {
    const residentBytes = [...this.residentFullRanges.values()].reduce(
      (sum, range) => sum + range.timeMs.byteLength + range.values.byteLength + range.validity.byteLength,
      0,
    );
    this.peakResidentRangeCount = Math.max(this.peakResidentRangeCount, this.residentFullRanges.size);
    this.peakResidentBytes = Math.max(this.peakResidentBytes, residentBytes);
    if (this.memorySourceId !== boundMemorySourceSequence) return;
    latestBoundChannelMemory = {
      residentRangeCount: this.residentFullRanges.size,
      residentBytes,
      peakResidentRangeCount: this.peakResidentRangeCount,
      peakResidentBytes: this.peakResidentBytes,
      residentHitCount: this.residentHitCount,
      residentMissCount: this.residentMissCount,
      retainedRangeCount: this.retainedRangeCount,
    };
  }

  private sourceId(channelId: string): string {""",
)
replace(
    'core/channels/channel-binding.ts',
    """  private retainFullRange(channelId: string, range: NumericChannelRange): void {
    if (range.startSampleIndex === 0 && range.values.length === this.sampleCount) {
      this.residentFullRanges.set(this.sourceId(channelId), range);
    }
  }""",
    """  private retainFullRange(channelId: string, range: NumericChannelRange): void {
    if (range.startSampleIndex === 0 && range.values.length === this.sampleCount) {
      const sourceId = this.sourceId(channelId);
      const wasResident = this.residentFullRanges.has(sourceId);
      this.residentFullRanges.set(sourceId, range);
      if (!wasResident) this.retainedRangeCount += 1;
      this.updateMemoryDiagnostics();
    }
  }""",
)
replace(
    'core/channels/channel-binding.ts',
    """    const full = this.residentFullRanges.get(sourceId);
    if (!full) return undefined;""",
    """    const full = this.residentFullRanges.get(sourceId);
    if (!full) {
      this.residentMissCount += 1;
      this.updateMemoryDiagnostics();
      return undefined;
    }
    this.residentHitCount += 1;
    this.updateMemoryDiagnostics();""",
)

# Active graph retained ranges.
replace(
    'apps/web/src/components/graph-viewport.ts',
    """  hasPendingChannel(channelId: string): boolean;
  activatePreloadedChannels(""",
    """  hasPendingChannel(channelId: string): boolean;
  getRetainedRangeMemory(): { readonly traceCount: number; readonly bytes: number };
  activatePreloadedChannels(""",
)
replace(
    'apps/web/src/components/graph-viewport.ts',
    """    hasPendingChannel: (channelId) => pendingTraces.has(channelId) || loadingTraceIds.has(channelId),
    activatePreloadedChannels,""",
    """    hasPendingChannel: (channelId) => pendingTraces.has(channelId) || loadingTraceIds.has(channelId),
    getRetainedRangeMemory: () => ({
      traceCount: activeTraces.size,
      bytes: [...activeTraces.values()].reduce(
        (sum, trace) => sum + trace.range.timeMs.byteLength + trace.range.values.byteLength + trace.range.validity.byteLength,
        0,
      ),
    }),
    activatePreloadedChannels,""",
)

# Surface active graph bytes in Logger runtime diagnostics.
replace(
    'apps/web/src/pages/logger-page.ts',
    """  readonly activeTraceCount: number;
  readonly panes: readonly {""",
    """  readonly activeTraceCount: number;
  readonly activeTraceRangeBytes: number;
  readonly panes: readonly {""",
)
replace(
    'apps/web/src/pages/logger-page.ts',
    """        activeChannelIds: [...runtime.activeChannelIds],
      };""",
    """        activeChannelIds: [...runtime.activeChannelIds],
        activeTraceRangeBytes: runtime.graph.getRetainedRangeMemory().bytes,
      };""",
)
replace(
    'apps/web/src/pages/logger-page.ts',
    """      activeTraceCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.activeChannelIds.length, 0),
      panes,""",
    """      activeTraceCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.activeChannelIds.length, 0),
      activeTraceRangeBytes: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.activeTraceRangeBytes, 0),
      panes,""",
)

# Add retained-memory section to Perf UI/report.
replace(
    'apps/web/src/components/performance-diagnostics.ts',
    """import type { BlobByteSourceRuntimeDiagnostics } from '../adapters/blob-byte-source';""",
    """import type { BlobByteSourceRuntimeDiagnostics } from '../adapters/blob-byte-source';
import { latestPersistentColumnMemoryDiagnostics } from '../adapters/persistent-channel-cache';
import { latestBoundChannelMemoryDiagnostics } from '../../../../core/channels/channel-binding';""",
)
replace(
    'apps/web/src/components/performance-diagnostics.ts',
    """export interface PerformanceDiagnosticsController {
  readonly element: HTMLElement;""",
    """export interface PerformanceRuntimeMemorySnapshot {
  readonly activeTraceRangeBytes: number;
}

export interface PerformanceDiagnosticsController {
  readonly element: HTMLElement;
  setRuntimeMemoryProvider(provider: () => PerformanceRuntimeMemorySnapshot): void;""",
)
replace(
    'apps/web/src/components/performance-diagnostics.ts',
    """  const channelRuns: ChannelPerformanceRun[] = [];

  const root = document.createElement('div');""",
    """  const channelRuns: ChannelPerformanceRun[] = [];
  let runtimeMemoryProvider: (() => PerformanceRuntimeMemorySnapshot) | undefined;

  const root = document.createElement('div');""",
)
replace(
    'apps/web/src/components/performance-diagnostics.ts',
    """        <section>
          <strong>Recent channel selections</strong>
          <div class=\"performance-channels\"></div>
        </section>""",
    """        <section>
          <strong>Retained memory</strong>
          <div class=\"performance-memory\"></div>
        </section>
        <section>
          <strong>Recent channel selections</strong>
          <div class=\"performance-channels\"></div>
        </section>""",
)
replace(
    'apps/web/src/components/performance-diagnostics.ts',
    """  const workspaceRestoreHost = root.querySelector<HTMLElement>('.performance-workspace-restore');
  const channelsHost = root.querySelector<HTMLElement>('.performance-channels');""",
    """  const workspaceRestoreHost = root.querySelector<HTMLElement>('.performance-workspace-restore');
  const memoryHost = root.querySelector<HTMLElement>('.performance-memory');
  const channelsHost = root.querySelector<HTMLElement>('.performance-channels');""",
)
replace(
    'apps/web/src/components/performance-diagnostics.ts',
    """  if (!button || !popover || !copyButton || !clearButton || !closeButton || !empty || !content || !loadHost || !iniLoadHost || !bindingHost || !workspaceRestoreHost || !channelsHost) {""",
    """  if (!button || !popover || !copyButton || !clearButton || !closeButton || !empty || !content || !loadHost || !iniLoadHost || !bindingHost || !workspaceRestoreHost || !memoryHost || !channelsHost) {""",
)
replace(
    'apps/web/src/components/performance-diagnostics.ts',
    """  const reportText = (): string => buildPerformanceDiagnosticsReport(
    loadRuns,
    iniLoadRuns,
    bindingRuns,
    workspaceRestoreRuns,
    channelRuns,
  );""",
    """  const retainedMemoryReport = (): string[] => {
    const persistent = latestPersistentColumnMemoryDiagnostics();
    const bound = latestBoundChannelMemoryDiagnostics();
    const runtime = runtimeMemoryProvider?.();
    if (!persistent && !bound && !runtime) return [];
    return [
      '',
      '[Retained memory]',
      `graphActiveRangeBytes=${runtime?.activeTraceRangeBytes ?? 0}`,
      `persistentResidentColumns=${persistent?.residentColumnCount ?? 0}`,
      `persistentResidentBytes=${persistent?.residentBytes ?? 0}`,
      `persistentPeakResidentColumns=${persistent?.peakResidentColumnCount ?? 0}`,
      `persistentPeakResidentBytes=${persistent?.peakResidentBytes ?? 0}`,
      `persistentResidentHits=${persistent?.residentHitCount ?? 0}`,
      `persistentDiskLoads=${persistent?.diskLoadCount ?? 0}`,
      `persistentRetainedColumns=${persistent?.retainedColumnCount ?? 0}`,
      `persistentStoreMisses=${persistent?.storeMissCount ?? 0}`,
      `persistentEvictions=0`,
      `boundResidentRanges=${bound?.residentRangeCount ?? 0}`,
      `boundResidentBytes=${bound?.residentBytes ?? 0}`,
      `boundPeakResidentRanges=${bound?.peakResidentRangeCount ?? 0}`,
      `boundPeakResidentBytes=${bound?.peakResidentBytes ?? 0}`,
      `boundResidentHits=${bound?.residentHitCount ?? 0}`,
      `boundResidentMisses=${bound?.residentMissCount ?? 0}`,
      `boundRetainedRanges=${bound?.retainedRangeCount ?? 0}`,
      `boundEvictions=0`,
      'note=Layer byte counts are retained payload estimates and may overlap; do not sum them as unique process memory.',
    ];
  };

  const reportText = (): string => {
    const base = buildPerformanceDiagnosticsReport(
      loadRuns,
      iniLoadRuns,
      bindingRuns,
      workspaceRestoreRuns,
      channelRuns,
    );
    return `${base}${retainedMemoryReport().join('\\n')}`;
  };""",
)
replace(
    'apps/web/src/components/performance-diagnostics.ts',
    """    channelsHost.replaceChildren();
    if (channelRuns.length === 0) {""",
    """    memoryHost.replaceChildren();
    const persistentMemory = latestPersistentColumnMemoryDiagnostics();
    const boundMemory = latestBoundChannelMemoryDiagnostics();
    const graphMemory = runtimeMemoryProvider?.();
    const memoryRows: [string, string][] = [
      ['Graph active ranges', bytes(graphMemory?.activeTraceRangeBytes ?? 0)],
      ['Persistent resident', `${bytes(persistentMemory?.residentBytes ?? 0)} · ${persistentMemory?.residentColumnCount ?? 0} columns`],
      ['Persistent peak', `${bytes(persistentMemory?.peakResidentBytes ?? 0)} · ${persistentMemory?.peakResidentColumnCount ?? 0} columns`],
      ['Persistent disk reloads', (persistentMemory?.diskLoadCount ?? 0).toLocaleString()],
      ['Bound resident', `${bytes(boundMemory?.residentBytes ?? 0)} · ${boundMemory?.residentRangeCount ?? 0} ranges`],
      ['Bound peak', `${bytes(boundMemory?.peakResidentBytes ?? 0)} · ${boundMemory?.peakResidentRangeCount ?? 0} ranges`],
      ['Evictions', '0 · not budgeted yet'],
    ];
    for (const [label, value] of memoryRows) {
      const row = document.createElement('div');
      row.className = 'performance-row';
      const left = document.createElement('span');
      left.textContent = label;
      const right = document.createElement('strong');
      right.textContent = value;
      row.append(left, right);
      memoryHost.append(row);
    }

    channelsHost.replaceChildren();
    if (channelRuns.length === 0) {""",
)
replace(
    'apps/web/src/components/performance-diagnostics.ts',
    """  return {
    element: root,
    recordLoad:""",
    """  return {
    element: root,
    setRuntimeMemoryProvider: (provider) => { runtimeMemoryProvider = provider; render(); },
    recordLoad:""",
)

# Supply graph runtime memory to Perf.
replace(
    'apps/web/src/app/app-shell.ts',
    """  const performanceDiagnostics = createPerformanceDiagnostics();

  const runtimeErrors:""",
    """  const performanceDiagnostics = createPerformanceDiagnostics();
  performanceDiagnostics.setRuntimeMemoryProvider(() => ({
    activeTraceRangeBytes: loggerPage.getRuntimeDiagnosticSnapshot().activeTraceRangeBytes,
  }));

  const runtimeErrors:""",
)
