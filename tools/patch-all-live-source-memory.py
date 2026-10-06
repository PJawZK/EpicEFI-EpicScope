from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, count))


persistent = 'apps/web/src/adapters/persistent-channel-cache.ts'
replace(
    persistent,
    "let latestPersistentColumnMemory: PersistentColumnMemoryDiagnostics | undefined;\nlet persistentMemorySourceSequence = 0;\n",
    "let latestPersistentColumnMemory: PersistentColumnMemoryDiagnostics | undefined;\nlet persistentMemorySourceSequence = 0;\nconst persistentMemorySourceRefs = new Set<WeakRef<PersistentColumnCacheDataSource>>();\nlet persistentCollectedSourceCount = 0;\nconst persistentMemoryFinalizer = new FinalizationRegistry<number>(() => {\n  persistentCollectedSourceCount += 1;\n});\n",
)
replace(
    persistent,
    "export function latestPersistentColumnMemoryDiagnostics(): PersistentColumnMemoryDiagnostics | undefined {\n  return latestPersistentColumnMemory ? { ...latestPersistentColumnMemory } : undefined;\n}\n",
    "export function latestPersistentColumnMemoryDiagnostics(): PersistentColumnMemoryDiagnostics | undefined {\n  return latestPersistentColumnMemory ? { ...latestPersistentColumnMemory } : undefined;\n}\n\nexport interface PersistentColumnMemoryAggregateDiagnostics {\n  readonly liveSourceCount: number;\n  readonly previousLiveSourceCount: number;\n  readonly collectedSourceCount: number;\n  readonly totalResidentColumnCount: number;\n  readonly totalResidentBytes: number;\n  readonly previousResidentColumnCount: number;\n  readonly previousResidentBytes: number;\n}\n\nexport function persistentColumnMemoryAggregateDiagnostics(): PersistentColumnMemoryAggregateDiagnostics {\n  let liveSourceCount = 0;\n  let previousLiveSourceCount = 0;\n  let totalResidentColumnCount = 0;\n  let totalResidentBytes = 0;\n  let previousResidentColumnCount = 0;\n  let previousResidentBytes = 0;\n\n  for (const ref of [...persistentMemorySourceRefs]) {\n    const source = ref.deref();\n    if (!source) {\n      persistentMemorySourceRefs.delete(ref);\n      continue;\n    }\n    const snapshot = source.memoryDiagnosticsSnapshot();\n    liveSourceCount += 1;\n    totalResidentColumnCount += snapshot.residentColumnCount;\n    totalResidentBytes += snapshot.residentBytes;\n    if (source.memorySourceId !== persistentMemorySourceSequence) {\n      previousLiveSourceCount += 1;\n      previousResidentColumnCount += snapshot.residentColumnCount;\n      previousResidentBytes += snapshot.residentBytes;\n    }\n  }\n\n  return {\n    liveSourceCount,\n    previousLiveSourceCount,\n    collectedSourceCount: persistentCollectedSourceCount,\n    totalResidentColumnCount,\n    totalResidentBytes,\n    previousResidentColumnCount,\n    previousResidentBytes,\n  };\n}\n",
)
replace(
    persistent,
    "  private readonly memorySourceId = ++persistentMemorySourceSequence;\n",
    "  readonly memorySourceId = ++persistentMemorySourceSequence;\n",
)
replace(
    persistent,
    "    this.updateMemoryDiagnostics();\n    if (!source.managesPersistentColumns && store.listCachedChannelIds) {\n",
    "    this.updateMemoryDiagnostics();\n    persistentMemorySourceRefs.add(new WeakRef(this));\n    persistentMemoryFinalizer.register(this, this.memorySourceId);\n    if (!source.managesPersistentColumns && store.listCachedChannelIds) {\n",
)
replace(
    persistent,
    "  private updateMemoryDiagnostics(): void {\n",
    "  public memoryDiagnosticsSnapshot(): PersistentColumnMemoryDiagnostics {\n    const residentBytes = [...this.residentColumns.values()]\n      .reduce((sum, values) => sum + values.byteLength, 0);\n    return {\n      residentColumnCount: this.residentColumns.size,\n      residentBytes,\n      peakResidentColumnCount: this.peakResidentColumnCount,\n      peakResidentBytes: this.peakResidentBytes,\n      residentHitCount: this.residentHitCount,\n      diskLoadCount: this.diskLoadCount,\n      retainedColumnCount: this.retainedColumnCount,\n      storeMissCount: this.storeMissCount,\n    };\n  }\n\n  private updateMemoryDiagnostics(): void {\n",
)

bound = 'core/channels/channel-binding.ts'
replace(
    bound,
    "let latestBoundChannelMemory: BoundChannelMemoryDiagnostics | undefined;\nlet boundMemorySourceSequence = 0;\n",
    "let latestBoundChannelMemory: BoundChannelMemoryDiagnostics | undefined;\nlet boundMemorySourceSequence = 0;\nconst boundMemorySourceRefs = new Set<WeakRef<BoundNumericChannelDataSource>>();\nlet boundCollectedSourceCount = 0;\nconst boundMemoryFinalizer = new FinalizationRegistry<number>(() => {\n  boundCollectedSourceCount += 1;\n});\n",
)
replace(
    bound,
    "export function latestBoundChannelMemoryDiagnostics(): BoundChannelMemoryDiagnostics | undefined {\n  return latestBoundChannelMemory ? { ...latestBoundChannelMemory } : undefined;\n}\n",
    "export function latestBoundChannelMemoryDiagnostics(): BoundChannelMemoryDiagnostics | undefined {\n  return latestBoundChannelMemory ? { ...latestBoundChannelMemory } : undefined;\n}\n\nexport interface BoundChannelMemoryAggregateDiagnostics {\n  readonly liveSourceCount: number;\n  readonly previousLiveSourceCount: number;\n  readonly collectedSourceCount: number;\n  readonly totalResidentRangeCount: number;\n  readonly totalResidentBytes: number;\n  readonly previousResidentRangeCount: number;\n  readonly previousResidentBytes: number;\n}\n\nexport function boundChannelMemoryAggregateDiagnostics(): BoundChannelMemoryAggregateDiagnostics {\n  let liveSourceCount = 0;\n  let previousLiveSourceCount = 0;\n  let totalResidentRangeCount = 0;\n  let totalResidentBytes = 0;\n  let previousResidentRangeCount = 0;\n  let previousResidentBytes = 0;\n\n  for (const ref of [...boundMemorySourceRefs]) {\n    const source = ref.deref();\n    if (!source) {\n      boundMemorySourceRefs.delete(ref);\n      continue;\n    }\n    const snapshot = source.memoryDiagnosticsSnapshot();\n    liveSourceCount += 1;\n    totalResidentRangeCount += snapshot.residentRangeCount;\n    totalResidentBytes += snapshot.residentBytes;\n    if (source.memorySourceId !== boundMemorySourceSequence) {\n      previousLiveSourceCount += 1;\n      previousResidentRangeCount += snapshot.residentRangeCount;\n      previousResidentBytes += snapshot.residentBytes;\n    }\n  }\n\n  return {\n    liveSourceCount,\n    previousLiveSourceCount,\n    collectedSourceCount: boundCollectedSourceCount,\n    totalResidentRangeCount,\n    totalResidentBytes,\n    previousResidentRangeCount,\n    previousResidentBytes,\n  };\n}\n",
)
replace(
    bound,
    "  private readonly memorySourceId = ++boundMemorySourceSequence;\n",
    "  readonly memorySourceId = ++boundMemorySourceSequence;\n",
)
replace(
    bound,
    "    this.residentFullRanges = residentFullRangesForSource(source);\n    this.updateMemoryDiagnostics();\n",
    "    this.residentFullRanges = residentFullRangesForSource(source);\n    this.updateMemoryDiagnostics();\n    boundMemorySourceRefs.add(new WeakRef(this));\n    boundMemoryFinalizer.register(this, this.memorySourceId);\n",
)
replace(
    bound,
    "  private updateMemoryDiagnostics(): void {\n",
    "  public memoryDiagnosticsSnapshot(): BoundChannelMemoryDiagnostics {\n    const residentBytes = [...this.residentFullRanges.values()].reduce(\n      (sum, range) => sum + range.timeMs.byteLength + range.values.byteLength + range.validity.byteLength,\n      0,\n    );\n    return {\n      residentRangeCount: this.residentFullRanges.size,\n      residentBytes,\n      peakResidentRangeCount: this.peakResidentRangeCount,\n      peakResidentBytes: this.peakResidentBytes,\n      residentHitCount: this.residentHitCount,\n      residentMissCount: this.residentMissCount,\n      retainedRangeCount: this.retainedRangeCount,\n    };\n  }\n\n  private updateMemoryDiagnostics(): void {\n",
)

perf = 'apps/web/src/components/performance-diagnostics.ts'
replace(
    perf,
    "import { latestPersistentColumnMemoryDiagnostics } from '../adapters/persistent-channel-cache';\nimport { latestBoundChannelMemoryDiagnostics } from '../../../../core/channels/channel-binding';\n",
    "import {\n  latestPersistentColumnMemoryDiagnostics,\n  persistentColumnMemoryAggregateDiagnostics,\n} from '../adapters/persistent-channel-cache';\nimport {\n  boundChannelMemoryAggregateDiagnostics,\n  latestBoundChannelMemoryDiagnostics,\n} from '../../../../core/channels/channel-binding';\n",
)
replace(
    perf,
    "    const persistent = latestPersistentColumnMemoryDiagnostics();\n    const bound = latestBoundChannelMemoryDiagnostics();\n    const runtime = runtimeMemoryProvider?.();\n",
    "    const persistent = latestPersistentColumnMemoryDiagnostics();\n    const persistentAll = persistentColumnMemoryAggregateDiagnostics();\n    const bound = latestBoundChannelMemoryDiagnostics();\n    const boundAll = boundChannelMemoryAggregateDiagnostics();\n    const runtime = runtimeMemoryProvider?.();\n",
)
replace(
    perf,
    "      `persistentEvictions=0`,\n      `boundResidentRanges=${bound?.residentRangeCount ?? 0}`,\n",
    "      `persistentEvictions=0`,\n      `persistentLiveSources=${persistentAll.liveSourceCount}`,\n      `persistentPreviousLiveSources=${persistentAll.previousLiveSourceCount}`,\n      `persistentCollectedSources=${persistentAll.collectedSourceCount}`,\n      `persistentAllResidentColumns=${persistentAll.totalResidentColumnCount}`,\n      `persistentAllResidentBytes=${persistentAll.totalResidentBytes}`,\n      `persistentPreviousResidentColumns=${persistentAll.previousResidentColumnCount}`,\n      `persistentPreviousResidentBytes=${persistentAll.previousResidentBytes}`,\n      `boundResidentRanges=${bound?.residentRangeCount ?? 0}`,\n",
)
replace(
    perf,
    "      `boundEvictions=0`,\n      'note=Layer byte counts are retained payload estimates and may overlap; do not sum them as unique process memory.',\n",
    "      `boundEvictions=0`,\n      `boundLiveSources=${boundAll.liveSourceCount}`,\n      `boundPreviousLiveSources=${boundAll.previousLiveSourceCount}`,\n      `boundCollectedSources=${boundAll.collectedSourceCount}`,\n      `boundAllResidentRanges=${boundAll.totalResidentRangeCount}`,\n      `boundAllResidentBytes=${boundAll.totalResidentBytes}`,\n      `boundPreviousResidentRanges=${boundAll.previousResidentRangeCount}`,\n      `boundPreviousResidentBytes=${boundAll.previousResidentBytes}`,\n      'note=Layer byte counts are retained payload estimates and may overlap; do not sum them as unique process memory.',\n      'noteSourceLifetime=Live-source counts use weak references; previous sources can remain until browser garbage collection, so a nonzero previous-live count alone does not prove a strong-reference leak.',\n",
)
replace(
    perf,
    "    const persistentMemory = latestPersistentColumnMemoryDiagnostics();\n    const boundMemory = latestBoundChannelMemoryDiagnostics();\n    const graphMemory = runtimeMemoryProvider?.();\n",
    "    const persistentMemory = latestPersistentColumnMemoryDiagnostics();\n    const persistentAllMemory = persistentColumnMemoryAggregateDiagnostics();\n    const boundMemory = latestBoundChannelMemoryDiagnostics();\n    const boundAllMemory = boundChannelMemoryAggregateDiagnostics();\n    const graphMemory = runtimeMemoryProvider?.();\n",
)
replace(
    perf,
    "      ['Persistent disk reloads', (persistentMemory?.diskLoadCount ?? 0).toLocaleString()],\n      ['Bound resident', `${bytes(boundMemory?.residentBytes ?? 0)} · ${boundMemory?.residentRangeCount ?? 0} ranges`],\n",
    "      ['Persistent disk reloads', (persistentMemory?.diskLoadCount ?? 0).toLocaleString()],\n      ['Persistent live sources', `${persistentAllMemory.liveSourceCount} · previous ${persistentAllMemory.previousLiveSourceCount} · collected ${persistentAllMemory.collectedSourceCount}`],\n      ['Persistent all live', `${bytes(persistentAllMemory.totalResidentBytes)} · ${persistentAllMemory.totalResidentColumnCount} columns`],\n      ['Persistent previous live', `${bytes(persistentAllMemory.previousResidentBytes)} · ${persistentAllMemory.previousResidentColumnCount} columns`],\n      ['Bound resident', `${bytes(boundMemory?.residentBytes ?? 0)} · ${boundMemory?.residentRangeCount ?? 0} ranges`],\n",
)
replace(
    perf,
    "      ['Bound peak', `${bytes(boundMemory?.peakResidentBytes ?? 0)} · ${boundMemory?.peakResidentRangeCount ?? 0} ranges`],\n      ['Evictions', '0 · not budgeted yet'],\n",
    "      ['Bound peak', `${bytes(boundMemory?.peakResidentBytes ?? 0)} · ${boundMemory?.peakResidentRangeCount ?? 0} ranges`],\n      ['Bound live sources', `${boundAllMemory.liveSourceCount} · previous ${boundAllMemory.previousLiveSourceCount} · collected ${boundAllMemory.collectedSourceCount}`],\n      ['Bound all live', `${bytes(boundAllMemory.totalResidentBytes)} · ${boundAllMemory.totalResidentRangeCount} ranges`],\n      ['Bound previous live', `${bytes(boundAllMemory.previousResidentBytes)} · ${boundAllMemory.previousResidentRangeCount} ranges`],\n      ['Evictions', '0 · not budgeted yet'],\n",
)
