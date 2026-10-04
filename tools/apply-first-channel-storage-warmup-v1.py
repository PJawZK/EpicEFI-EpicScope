from pathlib import Path

# Persistent cache: warm a compact key index so known misses avoid an IndexedDB transaction.
p = Path('apps/web/src/adapters/persistent-channel-cache.ts')
s = p.read_text()
s = s.replace(
"export interface PersistentChannelColumnStore {\n  get(logKey: string, channelId: string, sampleCount: number): Promise<Float64Array | undefined>;\n  put(logKey: string, channelId: string, values: Float64Array): Promise<void>;\n}\n\nfunction cacheKey(logKey: string, channelId: string, sampleCount: number): string {\n  return `${CACHE_SCHEMA_VERSION}|${logKey}|${sampleCount}|${channelId}`;\n}\n",
"export interface PersistentChannelColumnStore {\n  get(logKey: string, channelId: string, sampleCount: number): Promise<Float64Array | undefined>;\n  put(logKey: string, channelId: string, values: Float64Array): Promise<void>;\n  listCachedChannelIds?(logKey: string, sampleCount: number): Promise<ReadonlySet<string>>;\n}\n\nfunction cacheKeyPrefix(logKey: string, sampleCount: number): string {\n  return `${CACHE_SCHEMA_VERSION}|${logKey}|${sampleCount}|`;\n}\n\nfunction cacheKey(logKey: string, channelId: string, sampleCount: number): string {\n  return `${cacheKeyPrefix(logKey, sampleCount)}${channelId}`;\n}\n")
needle = "  public async put(logKey: string, channelId: string, values: Float64Array): Promise<void> {\n"
insert = "  public async listCachedChannelIds(\n    logKey: string,\n    sampleCount: number,\n  ): Promise<ReadonlySet<string>> {\n    const database = await this.databasePromise;\n    const transaction = database.transaction(COLUMN_STORE_NAME, 'readonly');\n    const store = transaction.objectStore(COLUMN_STORE_NAME);\n    const prefix = cacheKeyPrefix(logKey, sampleCount);\n    const keys = await requestResult(\n      store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}\\uffff`)),\n    );\n    await transactionDone(transaction);\n    const channelIds = new Set<string>();\n    for (const key of keys) {\n      if (typeof key === 'string' && key.startsWith(prefix)) {\n        channelIds.add(key.slice(prefix.length));\n      }\n    }\n    return channelIds;\n  }\n\n"
if needle not in s: raise SystemExit('persistent put anchor missing')
s = s.replace(needle, insert + needle, 1)
s = s.replace(
"  private readonly missingColumns = new Set<string>();\n  private readonly residentColumns = new Map<string, Float64Array>();\n",
"  private readonly missingColumns = new Set<string>();\n  private readonly residentColumns = new Map<string, Float64Array>();\n  private cachedChannelIdIndex: Set<string> | undefined;\n")
needle = "    this.sampleCount = source.sampleCount;\n    this.preferredBatchWindowMs = source.preferredBatchWindowMs ?? 0;\n    this.requiresExplicitBatchSelection = source.requiresExplicitBatchSelection ?? false;\n  }\n"
replacement = "    this.sampleCount = source.sampleCount;\n    this.preferredBatchWindowMs = source.preferredBatchWindowMs ?? 0;\n    this.requiresExplicitBatchSelection = source.requiresExplicitBatchSelection ?? false;\n    if (store.listCachedChannelIds) {\n      void store.listCachedChannelIds(logKey, this.sampleCount).then((channelIds) => {\n        const warmed = new Set(channelIds);\n        for (const channelId of this.residentColumns.keys()) warmed.add(channelId);\n        this.cachedChannelIdIndex = warmed;\n      }).catch(() => undefined);\n    }\n  }\n"
if needle not in s: raise SystemExit('persistent constructor anchor missing')
s = s.replace(needle, replacement, 1)
needle = "    if (resident) return resident;\n    if (this.missingColumns.has(channelId)) return undefined;\n\n    try {\n"
replacement = "    if (resident) return resident;\n    if (this.missingColumns.has(channelId)) return undefined;\n    if (this.cachedChannelIdIndex && !this.cachedChannelIdIndex.has(channelId)) {\n      this.missingColumns.add(channelId);\n      return undefined;\n    }\n\n    try {\n"
if needle not in s: raise SystemExit('persistedColumn anchor missing')
s = s.replace(needle, replacement, 1)
s = s.replace(
"      if (!values || values.length !== this.sampleCount) {\n        this.missingColumns.add(channelId);\n        return undefined;\n      }\n      this.residentColumns.set(channelId, values);\n",
"      if (!values || values.length !== this.sampleCount) {\n        this.missingColumns.add(channelId);\n        this.cachedChannelIdIndex?.delete(channelId);\n        return undefined;\n      }\n      this.cachedChannelIdIndex?.add(channelId);\n      this.residentColumns.set(channelId, values);\n", 1)
s = s.replace(
"    this.residentColumns.set(channelId, range.values);\n    this.missingColumns.delete(channelId);\n    return true;\n",
"    this.residentColumns.set(channelId, range.values);\n    this.missingColumns.delete(channelId);\n    this.cachedChannelIdIndex?.add(channelId);\n    return true;\n", 1)
p.write_text(s)

# Sidecar: share one in-flight File open and prewarm it when a valid manifest activates.
p = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
s = p.read_text()
s = s.replace(
"  private dataFile: File | undefined;\n  private manifest: MlgColumnSidecarManifest | undefined;\n",
"  private dataFile: File | undefined;\n  private dataFilePromise: Promise<File> | undefined;\n  private manifest: MlgColumnSidecarManifest | undefined;\n")
s = s.replace(
"    this.manifest = manifest;\n    this.dataFile = undefined;\n    this.releasePrioritizedChannels();\n    return true;\n",
"    this.manifest = manifest;\n    this.dataFile = undefined;\n    this.dataFilePromise = undefined;\n    this.releasePrioritizedChannels();\n    void this.sidecarDataFile(manifest).catch(() => undefined);\n    return true;\n", 1)
old = "  private async sidecarDataFile(manifest: MlgColumnSidecarManifest): Promise<File> {\n    if (this.dataFile) return this.dataFile;\n    const directory = await openLogDirectory(this.logKey, false);\n    if (!directory) throw new Error('MLG sidecar OPFS directory is unavailable.');\n    const file = await (await directory.getFileHandle(manifest.dataFileName)).getFile();\n    this.dataFile = file;\n    return file;\n  }\n"
new = "  private async sidecarDataFile(manifest: MlgColumnSidecarManifest): Promise<File> {\n    if (this.dataFile) return this.dataFile;\n    if (this.dataFilePromise) return this.dataFilePromise;\n    const opening = (async () => {\n      const directory = await openLogDirectory(this.logKey, false);\n      if (!directory) throw new Error('MLG sidecar OPFS directory is unavailable.');\n      const file = await (await directory.getFileHandle(manifest.dataFileName)).getFile();\n      this.dataFile = file;\n      return file;\n    })();\n    this.dataFilePromise = opening;\n    try {\n      return await opening;\n    } catch (error) {\n      if (this.dataFilePromise === opening) this.dataFilePromise = undefined;\n      throw error;\n    }\n  }\n"
if old not in s: raise SystemExit('sidecarDataFile anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)
