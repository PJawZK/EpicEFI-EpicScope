from pathlib import Path

# 1) core/log-model/log-types.ts
p = Path('core/log-model/log-types.ts')
s = p.read_text()
old = """export interface NumericChannelRange {\n  readonly startSampleIndex: number;\n  readonly timeMs: Float64Array;\n  readonly values: Float64Array;\n  /** 1 = valid source record, 0 = invalid/corrupt source record. */\n  readonly validity: Uint8Array;\n}\n"""
new = """export interface NumericChannelStatistics {\n  readonly validCount: number;\n  readonly invalidCount: number;\n  readonly min: number | undefined;\n  readonly max: number | undefined;\n  readonly mean: number | undefined;\n  readonly standardDeviation: number | undefined;\n}\n\nexport interface NumericChannelRange {\n  readonly startSampleIndex: number;\n  readonly timeMs: Float64Array;\n  readonly values: Float64Array;\n  /** 1 = valid source record, 0 = invalid/corrupt source record. */\n  readonly validity: Uint8Array;\n  /** Optional full-range statistics computed while source samples were already being decoded. */\n  readonly fullStatistics?: NumericChannelStatistics;\n}\n"""
assert old in s, 'log-types range anchor missing'
p.write_text(s.replace(old, new, 1))

# 2) worker protocol
p = Path('apps/web/src/workers/mlg-worker-protocol.ts')
s = p.read_text()
s = s.replace(
"""  ImportedLogSummary,\n  LogSourceIdentity,\n  ParserDiagnostic,\n} from '../../../../core/log-model/log-types';\n""",
"""  ImportedLogSummary,\n  LogSourceIdentity,\n  NumericChannelStatistics,\n  ParserDiagnostic,\n} from '../../../../core/log-model/log-types';\n""",
1)
old = """export interface MlgCapturedPriorityColumn {\n  readonly channelId: string;\n  readonly values: Float64Array;\n}\n"""
new = """export interface MlgCapturedPriorityColumn {\n  readonly channelId: string;\n  readonly values: Float64Array;\n  readonly statistics: NumericChannelStatistics;\n}\n"""
assert old in s, 'protocol captured column anchor missing'
p.write_text(s.replace(old, new, 1))

# 3) worker capture accumulation
p = Path('apps/web/src/workers/mlg-import.worker.ts')
s = p.read_text()
old = """      const capturedPriority = fixedRecordCount > 0 ? priorityFieldIndices.map((index) => ({\n        index,\n        channelId: `mlg:${index}`,\n        field: headerResult.fields[index]!,\n        fieldOffset: fieldOffsets[index] ?? 0,\n        values: new Float64Array(fixedRecordCount),\n      })) : [];\n"""
new = """      const capturedPriority = fixedRecordCount > 0 ? priorityFieldIndices.map((index) => ({\n        index,\n        channelId: `mlg:${index}`,\n        field: headerResult.fields[index]!,\n        fieldOffset: fieldOffsets[index] ?? 0,\n        values: new Float64Array(fixedRecordCount),\n        validCount: 0,\n        invalidCount: 0,\n        min: Number.POSITIVE_INFINITY,\n        max: Number.NEGATIVE_INFINITY,\n        mean: 0,\n        m2: 0,\n      })) : [];\n"""
assert old in s, 'worker capture init anchor missing'
s = s.replace(old, new, 1)
old = """                for (const captured of capturedPriority) {\n                  const raw = decodeMlgRawValue(view, recordStart + captured.fieldOffset, captured.field);\n                  captured.values[sampleIndex] = displayMlgValue(raw, captured.field);\n                }\n"""
new = """                for (const captured of capturedPriority) {\n                  const raw = decodeMlgRawValue(view, recordStart + captured.fieldOffset, captured.field);\n                  const value = displayMlgValue(raw, captured.field);\n                  captured.values[sampleIndex] = value;\n                  if (!Number.isFinite(value)) {\n                    captured.invalidCount += 1;\n                    continue;\n                  }\n                  captured.validCount += 1;\n                  captured.min = Math.min(captured.min, value);\n                  captured.max = Math.max(captured.max, value);\n                  const delta = value - captured.mean;\n                  captured.mean += delta / captured.validCount;\n                  captured.m2 += delta * (value - captured.mean);\n                }\n"""
assert old in s, 'worker capture loop anchor missing'
s = s.replace(old, new, 1)
old = """            capturedPriorityColumns: capturedPriority.map(({ channelId, values }) => ({ channelId, values })),\n"""
new = """            capturedPriorityColumns: capturedPriority.map((captured) => ({\n              channelId: captured.channelId,\n              values: captured.values,\n              statistics: {\n                validCount: captured.validCount,\n                invalidCount: captured.invalidCount,\n                min: captured.validCount > 0 ? captured.min : undefined,\n                max: captured.validCount > 0 ? captured.max : undefined,\n                mean: captured.validCount > 0 ? captured.mean : undefined,\n                standardDeviation: captured.validCount > 1\n                  ? Math.sqrt(captured.m2 / (captured.validCount - 1))\n                  : captured.validCount === 1 ? 0 : undefined,\n              },\n            })),\n"""
assert old in s, 'worker captured payload anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)

# 4) sidecar captured range metadata
p = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
s = p.read_text()
s = s.replace(
"""  NumericChannelDataSource,\n  NumericChannelRange,\n} from '../../../../core/log-model/log-types';\n""",
"""  NumericChannelDataSource,\n  NumericChannelRange,\n  NumericChannelStatistics,\n} from '../../../../core/log-model/log-types';\n""",
1)
s = s.replace(
"""  MlgColumnSidecarStripeManifest,\n} from '../workers/mlg-worker-protocol';\n""",
"""  MlgColumnSidecarStripeManifest,\n  MlgCapturedPriorityColumn,\n} from '../workers/mlg-worker-protocol';\n""",
1)
old = """function buildRange(\n  recordIndex: MlgRecordIndex,\n  startSampleIndex: number,\n  sampleCount: number,\n  values: Float64Array,\n): NumericChannelRange {\n  const end = startSampleIndex + sampleCount;\n  return {\n    startSampleIndex,\n    timeMs: startSampleIndex === 0 && sampleCount === recordIndex.timeMs.length\n      ? recordIndex.timeMs\n      : recordIndex.timeMs.slice(startSampleIndex, end),\n    values,\n    validity: startSampleIndex === 0 && sampleCount === recordIndex.crcValid.length\n      ? recordIndex.crcValid\n      : recordIndex.crcValid.slice(startSampleIndex, end),\n  };\n}\n"""
new = """function buildRange(\n  recordIndex: MlgRecordIndex,\n  startSampleIndex: number,\n  sampleCount: number,\n  values: Float64Array,\n  fullStatistics?: NumericChannelStatistics,\n): NumericChannelRange {\n  const end = startSampleIndex + sampleCount;\n  const isFullRange = startSampleIndex === 0 && sampleCount === recordIndex.timeMs.length;\n  return {\n    startSampleIndex,\n    timeMs: isFullRange\n      ? recordIndex.timeMs\n      : recordIndex.timeMs.slice(startSampleIndex, end),\n    values,\n    validity: startSampleIndex === 0 && sampleCount === recordIndex.crcValid.length\n      ? recordIndex.crcValid\n      : recordIndex.crcValid.slice(startSampleIndex, end),\n    ...(isFullRange && fullStatistics ? { fullStatistics } : {}),\n  };\n}\n"""
assert old in s, 'sidecar buildRange anchor missing'
s = s.replace(old, new, 1)
old = """  private readonly capturedPriorityColumns = new Map<string, Float64Array>();\n"""
new = """  private readonly capturedPriorityColumns = new Map<string, {\n    readonly values: Float64Array;\n    readonly statistics: NumericChannelStatistics;\n  }>();\n"""
assert old in s, 'sidecar captured map anchor missing'
s = s.replace(old, new, 1)
old = """  public seedCapturedPriorityColumns(columns: readonly { readonly channelId: string; readonly values: Float64Array }[]): void {\n    for (const column of columns) {\n      if (column.values.length === this.sampleCount && this.fieldByChannelId.has(column.channelId)) this.capturedPriorityColumns.set(column.channelId, column.values);\n    }\n  }\n"""
new = """  public seedCapturedPriorityColumns(columns: readonly MlgCapturedPriorityColumn[]): void {\n    for (const column of columns) {\n      if (column.values.length === this.sampleCount && this.fieldByChannelId.has(column.channelId)) {\n        this.capturedPriorityColumns.set(column.channelId, {\n          values: column.values,\n          statistics: column.statistics,\n        });\n      }\n    }\n  }\n"""
assert old in s, 'sidecar seed anchor missing'
s = s.replace(old, new, 1)
old = """      const captured = channelIds.map((channelId) => this.capturedPriorityColumns.get(channelId));\n      if (captured.every((values) => values !== undefined)) {\n        const ranges = new Map<string, NumericChannelRange>();\n        for (let index = 0; index < channelIds.length; index += 1) ranges.set(channelIds[index]!, buildRange(this.recordIndex, 0, this.sampleCount, captured[index]!));\n        return { ranges, performance: { channelCount: channelIds.length, cacheHitChannelIds: [...channelIds], physicalReadCount: 0, physicalBytesRead: 0, physicalReadMs: 0 } };\n      }\n"""
new = """      const captured = channelIds.map((channelId) => this.capturedPriorityColumns.get(channelId));\n      if (captured.every((column) => column !== undefined)) {\n        const ranges = new Map<string, NumericChannelRange>();\n        for (let index = 0; index < channelIds.length; index += 1) {\n          const column = captured[index]!;\n          ranges.set(\n            channelIds[index]!,\n            buildRange(this.recordIndex, 0, this.sampleCount, column.values, column.statistics),\n          );\n        }\n        return { ranges, performance: { channelCount: channelIds.length, cacheHitChannelIds: [...channelIds], physicalReadCount: 0, physicalBytesRead: 0, physicalReadMs: 0 } };\n      }\n"""
assert old in s, 'sidecar captured read anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)

# 5) graph activation consumes supplied full statistics
p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()
old = """      const statisticsStarted = now();\n      const fullStatistics = summarizeRange(range);\n      const scale = stableScaleFromStatistics(fullStatistics);\n      statisticsScaleMs += now() - statisticsStarted;\n"""
new = """      const statisticsStarted = now();\n      const fullStatistics = range.fullStatistics ?? summarizeRange(range);\n      const scale = stableScaleFromStatistics(fullStatistics);\n      statisticsScaleMs += now() - statisticsStarted;\n"""
assert old in s, 'graph activation statistics anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)
