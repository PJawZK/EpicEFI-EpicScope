from pathlib import Path

# 1) Optional low-level batch timing fields.
p = Path('core/log-model/log-types.ts')
s = p.read_text()
needle = "  readonly physicalReadMs: number;\n}"
replace = "  readonly physicalReadMs: number;\n  readonly persistentLookupMs?: number;\n  readonly persistentRangeBuildMs?: number;\n  readonly delegatedSourceMs?: number;\n  readonly sidecarManifestMs?: number;\n  readonly sidecarFileOpenMs?: number;\n  readonly sidecarBlobReadMs?: number;\n  readonly sidecarDecodeMs?: number;\n  readonly sidecarRangeBuildMs?: number;\n}"
if needle not in s: raise SystemExit('batch perf interface needle not found')
s = s.replace(needle, replace, 1)
p.write_text(s)

# 2) Persistent cache timing: distinguish IndexedDB lookup from delegated source/sidecar.
p = Path('apps/web/src/adapters/persistent-channel-cache.ts')
s = p.read_text()
needle = "    const ranges = new Map<string, NumericChannelRange>();\n    const persistentHits: string[] = [];\n    const misses: string[] = [];\n\n    for (const channelId of channelIds) {\n      const persisted = await this.persistedColumn(channelId);\n"
replace = "    const ranges = new Map<string, NumericChannelRange>();\n    const persistentHits: string[] = [];\n    const misses: string[] = [];\n    const now = (): number => globalThis.performance?.now() ?? Date.now();\n    let persistentLookupMs = 0;\n    let persistentRangeBuildMs = 0;\n\n    for (const channelId of channelIds) {\n      const lookupStarted = now();\n      const persisted = await this.persistedColumn(channelId);\n      persistentLookupMs += now() - lookupStarted;\n"
if needle not in s: raise SystemExit('persistent loop needle not found')
s = s.replace(needle, replace, 1)
needle = "      persistentHits.push(channelId);\n      ranges.set(\n        channelId,\n        buildRange(startSampleIndex, sampleCount, persisted, this.timeMs, this.validity),\n      );\n"
replace = "      persistentHits.push(channelId);\n      const rangeStarted = now();\n      ranges.set(\n        channelId,\n        buildRange(startSampleIndex, sampleCount, persisted, this.timeMs, this.validity),\n      );\n      persistentRangeBuildMs += now() - rangeStarted;\n"
if needle not in s: raise SystemExit('persistent buildRange needle not found')
s = s.replace(needle, replace, 1)
needle = "    let physicalReadCount = 0;\n    let physicalBytesRead = 0;\n    let physicalReadMs = 0;\n    const delegatedCacheHits: string[] = [];\n\n    if (misses.length > 0) {\n      const delegated = await this.source.readChannelsRange(misses, startSampleIndex, sampleCount);\n"
replace = "    let physicalReadCount = 0;\n    let physicalBytesRead = 0;\n    let physicalReadMs = 0;\n    let delegatedSourceMs = 0;\n    let delegatedPerformance: NumericChannelBatchResult['performance'] | undefined;\n    const delegatedCacheHits: string[] = [];\n\n    if (misses.length > 0) {\n      const delegatedStarted = now();\n      const delegated = await this.source.readChannelsRange(misses, startSampleIndex, sampleCount);\n      delegatedSourceMs = now() - delegatedStarted;\n      delegatedPerformance = delegated.performance;\n"
if needle not in s: raise SystemExit('delegated timing needle not found')
s = s.replace(needle, replace, 1)
needle = "        physicalReadCount,\n        physicalBytesRead,\n        physicalReadMs,\n      },\n"
replace = "        physicalReadCount,\n        physicalBytesRead,\n        physicalReadMs,\n        persistentLookupMs,\n        persistentRangeBuildMs,\n        delegatedSourceMs,\n        ...(delegatedPerformance?.sidecarManifestMs !== undefined ? { sidecarManifestMs: delegatedPerformance.sidecarManifestMs } : {}),\n        ...(delegatedPerformance?.sidecarFileOpenMs !== undefined ? { sidecarFileOpenMs: delegatedPerformance.sidecarFileOpenMs } : {}),\n        ...(delegatedPerformance?.sidecarBlobReadMs !== undefined ? { sidecarBlobReadMs: delegatedPerformance.sidecarBlobReadMs } : {}),\n        ...(delegatedPerformance?.sidecarDecodeMs !== undefined ? { sidecarDecodeMs: delegatedPerformance.sidecarDecodeMs } : {}),\n        ...(delegatedPerformance?.sidecarRangeBuildMs !== undefined ? { sidecarRangeBuildMs: delegatedPerformance.sidecarRangeBuildMs } : {}),\n      },\n"
# replace last occurrence in normal <=4 return only
idx = s.rfind(needle)
if idx < 0: raise SystemExit('persistent perf return needle not found')
s = s[:idx] + s[idx:].replace(needle, replace, 1)
p.write_text(s)

# 3) Sidecar detailed timing.
p = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
s = p.read_text()
needle = "    await this.waitForPrioritizedChannels(channelIds);\n    const manifest = await this.ensureManifest();\n    if (!manifest) return undefined;\n"
replace = "    const manifestStarted = now();\n    await this.waitForPrioritizedChannels(channelIds);\n    const manifest = await this.ensureManifest();\n    const sidecarManifestMs = now() - manifestStarted;\n    if (!manifest) return undefined;\n"
if needle not in s: raise SystemExit('sidecar manifest needle not found')
s = s.replace(needle, replace, 1)
needle = "      const valuesByChannel = new Map<string, Float64Array>();\n      await Promise.all([...byStripe.values()].map(async ({ stripe, fields }) => {\n        const file = await this.sidecarDataFile(manifest);\n        const byteStart = stripe.storageOffset + startSampleIndex * stripe.widthBytes;\n        const byteLength = sampleCount * stripe.widthBytes;\n        const bytes = new Uint8Array(await file.slice(byteStart, byteStart + byteLength).arrayBuffer());\n"
replace = "      const valuesByChannel = new Map<string, Float64Array>();\n      let sidecarFileOpenMs = 0;\n      let sidecarBlobReadMs = 0;\n      let sidecarDecodeMs = 0;\n      await Promise.all([...byStripe.values()].map(async ({ stripe, fields }) => {\n        const fileStarted = now();\n        const file = await this.sidecarDataFile(manifest);\n        sidecarFileOpenMs += now() - fileStarted;\n        const byteStart = stripe.storageOffset + startSampleIndex * stripe.widthBytes;\n        const byteLength = sampleCount * stripe.widthBytes;\n        const readStarted = now();\n        const bytes = new Uint8Array(await file.slice(byteStart, byteStart + byteLength).arrayBuffer());\n        sidecarBlobReadMs += now() - readStarted;\n"
if needle not in s: raise SystemExit('sidecar read needle not found')
s = s.replace(needle, replace, 1)
needle = "        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);\n        for (const field of fields) {\n"
replace = "        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);\n        const decodeStarted = now();\n        for (const field of fields) {\n"
if needle not in s: raise SystemExit('sidecar decode start needle not found')
s = s.replace(needle, replace, 1)
needle = "          valuesByChannel.set(`mlg:${field.fieldIndex}`, values);\n        }\n      }));\n\n      const ranges = new Map<string, NumericChannelRange>();\n"
replace = "          valuesByChannel.set(`mlg:${field.fieldIndex}`, values);\n        }\n        sidecarDecodeMs += now() - decodeStarted;\n      }));\n\n      const rangeBuildStarted = now();\n      const ranges = new Map<string, NumericChannelRange>();\n"
if needle not in s: raise SystemExit('sidecar decode end needle not found')
s = s.replace(needle, replace, 1)
needle = "      return {\n        ranges,\n        performance: {\n          channelCount: channelIds.length,\n          cacheHitChannelIds: [...channelIds],\n          physicalReadCount: 0,\n          physicalBytesRead: 0,\n          physicalReadMs: 0,\n        },\n      };\n"
replace = "      const sidecarRangeBuildMs = now() - rangeBuildStarted;\n      return {\n        ranges,\n        performance: {\n          channelCount: channelIds.length,\n          cacheHitChannelIds: [...channelIds],\n          physicalReadCount: 0,\n          physicalBytesRead: 0,\n          physicalReadMs: 0,\n          sidecarManifestMs,\n          sidecarFileOpenMs,\n          sidecarBlobReadMs,\n          sidecarDecodeMs,\n          sidecarRangeBuildMs,\n        },\n      };\n"
# target the non-captured sidecar return after ranges; exact block should occur once formatted multiline
if needle not in s: raise SystemExit('sidecar perf return needle not found')
s = s.replace(needle, replace, 1)
p.write_text(s)

# 4) Surface low-level timing in graph channel performance (cache path + other result-backed paths).
p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()
needle = "  readonly physicalReadMs: number;\n}\n\nexport interface GraphPreloadedActivationPerformance"
replace = "  readonly physicalReadMs: number;\n  readonly persistentLookupMs?: number;\n  readonly persistentRangeBuildMs?: number;\n  readonly delegatedSourceMs?: number;\n  readonly sidecarManifestMs?: number;\n  readonly sidecarFileOpenMs?: number;\n  readonly sidecarBlobReadMs?: number;\n  readonly sidecarDecodeMs?: number;\n  readonly sidecarRangeBuildMs?: number;\n}\n\nexport interface GraphPreloadedActivationPerformance"
if needle not in s: raise SystemExit('graph perf interface needle not found')
s = s.replace(needle, replace, 1)
# Inject optional timings after each physicalReadMs: result.performance.physicalReadMs occurrence in listener objects.
needle = "          physicalReadMs: result.performance.physicalReadMs,\n"
replace = needle + "          persistentLookupMs: result.performance.persistentLookupMs,\n          persistentRangeBuildMs: result.performance.persistentRangeBuildMs,\n          delegatedSourceMs: result.performance.delegatedSourceMs,\n          sidecarManifestMs: result.performance.sidecarManifestMs,\n          sidecarFileOpenMs: result.performance.sidecarFileOpenMs,\n          sidecarBlobReadMs: result.performance.sidecarBlobReadMs,\n          sidecarDecodeMs: result.performance.sidecarDecodeMs,\n          sidecarRangeBuildMs: result.performance.sidecarRangeBuildMs,\n"
count = s.count(needle)
if count < 3: raise SystemExit(f'expected >=3 graph result perf sites, found {count}')
s = s.replace(needle, replace)
p.write_text(s)

# 5) Add optional low-level fields to channel diagnostics line only when present.
p = Path('apps/web/src/components/performance-diagnostics.ts')
s = p.read_text()
needle = "        lines.push(\n          `${index + 1}. ${run.channelName}: phase=${run.phase}; startSample=${run.startSampleIndex}; requestedSamples=${run.requestedSampleCount}; returnedSamples=${run.sampleCount}; total=${run.totalMs.toFixed(2)} ms; readDecode=${run.readDecodeMs.toFixed(2)} ms; scale=${run.scaleMs.toFixed(2)} ms; render=${run.renderMs.toFixed(2)} ms; batch=${run.batchSize}; cacheHit=${run.cacheHit}; physicalReads=${run.physicalReadCount}; physicalBytes=${run.physicalBytesRead}; physicalReadMs=${run.physicalReadMs.toFixed(2)} ms`,\n        );\n"
replace = "        const lowLevel = [\n          run.persistentLookupMs !== undefined ? `persistentLookup=${run.persistentLookupMs.toFixed(2)} ms` : '',\n          run.persistentRangeBuildMs !== undefined ? `persistentRange=${run.persistentRangeBuildMs.toFixed(2)} ms` : '',\n          run.delegatedSourceMs !== undefined ? `delegatedSource=${run.delegatedSourceMs.toFixed(2)} ms` : '',\n          run.sidecarManifestMs !== undefined ? `sidecarManifest=${run.sidecarManifestMs.toFixed(2)} ms` : '',\n          run.sidecarFileOpenMs !== undefined ? `sidecarFileOpen=${run.sidecarFileOpenMs.toFixed(2)} ms` : '',\n          run.sidecarBlobReadMs !== undefined ? `sidecarBlobRead=${run.sidecarBlobReadMs.toFixed(2)} ms` : '',\n          run.sidecarDecodeMs !== undefined ? `sidecarDecode=${run.sidecarDecodeMs.toFixed(2)} ms` : '',\n          run.sidecarRangeBuildMs !== undefined ? `sidecarRange=${run.sidecarRangeBuildMs.toFixed(2)} ms` : '',\n        ].filter(Boolean).join('; ');\n        lines.push(\n          `${index + 1}. ${run.channelName}: phase=${run.phase}; startSample=${run.startSampleIndex}; requestedSamples=${run.requestedSampleCount}; returnedSamples=${run.sampleCount}; total=${run.totalMs.toFixed(2)} ms; readDecode=${run.readDecodeMs.toFixed(2)} ms; scale=${run.scaleMs.toFixed(2)} ms; render=${run.renderMs.toFixed(2)} ms; batch=${run.batchSize}; cacheHit=${run.cacheHit}; physicalReads=${run.physicalReadCount}; physicalBytes=${run.physicalBytesRead}; physicalReadMs=${run.physicalReadMs.toFixed(2)} ms${lowLevel ? `; ${lowLevel}` : ''}`,\n        );\n"
if needle not in s: raise SystemExit('diagnostics channel line needle not found')
s = s.replace(needle, replace, 1)
p.write_text(s)
