from pathlib import Path

p = Path('core/parsers/mlg/mlg-channel-data.ts')
s = p.read_text()
s = s.replace('function decodeRawValue(view: DataView, offset: number, field: MlgFieldDescriptor): number {', 'export function decodeMlgRawValue(view: DataView, offset: number, field: MlgFieldDescriptor): number {', 1)
s = s.replace('function displayValue(rawValue: number, field: MlgFieldDescriptor): number {', 'export function displayMlgValue(rawValue: number, field: MlgFieldDescriptor): number {', 1)
s = s.replace('decodeRawValue(view, offset, channel.field)', 'decodeMlgRawValue(view, offset, channel.field)')
s = s.replace('displayValue(\n              decodeMlgRawValue(view, offset, channel.field),', 'displayMlgValue(\n              decodeMlgRawValue(view, offset, channel.field),')
p.write_text(s)

p = Path('core/parsers/mlg/mlg-records.ts')
s = p.read_text()
s = s.replace("export interface MlgRecordScanOptions {\n  readonly validateCrc?: boolean;\n}", "export interface MlgRecordScanOptions {\n  readonly validateCrc?: boolean;\n  readonly onFixedRecordChunk?: (bytes: Uint8Array, firstRecordIndex: number, recordCount: number, blockLength: number) => void;\n}", 1)
s = s.replace('async function tryScanFixedRecords(\n  source: RandomAccessByteSource,\n  header: MlgHeader,\n  validateCrc: boolean,\n): Promise<MlgRecordScanResult | undefined> {', 'async function tryScanFixedRecords(\n  source: RandomAccessByteSource,\n  header: MlgHeader,\n  validateCrc: boolean,\n  onFixedRecordChunk?: MlgRecordScanOptions[\'onFixedRecordChunk\'],\n): Promise<MlgRecordScanResult | undefined> {', 1)
s = s.replace('    benchmarkChunk ??= chunk;\n\n    for (let localIndex = 0; localIndex < batchCount; localIndex += 1) {', '    benchmarkChunk ??= chunk;\n    onFixedRecordChunk?.(chunk, batchFirst, batchCount, blockLength);\n\n    for (let localIndex = 0; localIndex < batchCount; localIndex += 1) {', 1)
s = s.replace('  const fixed = await tryScanFixedRecords(source, header, validateCrc);', '  const fixed = await tryScanFixedRecords(source, header, validateCrc, options.onFixedRecordChunk);', 1)
p.write_text(s)

p = Path('apps/web/src/workers/mlg-worker-protocol.ts')
s = p.read_text()
s = s.replace('export interface MlgWorkerImportRequest {', "export interface MlgPriorityCaptureSelector {\n  readonly logicalChannelId: string;\n  readonly logicalKey?: string;\n  readonly displayName?: string;\n  readonly unit?: string;\n  readonly sourceChannelId?: string;\n}\n\nexport interface MlgCapturedPriorityColumn {\n  readonly channelId: string;\n  readonly values: Float64Array;\n}\n\nexport interface MlgWorkerImportRequest {", 1)
s = s.replace('  readonly sourceIdentity: LogSourceIdentity;\n}', '  readonly sourceIdentity: LogSourceIdentity;\n  readonly priorityCapture?: readonly MlgPriorityCaptureSelector[];\n}', 1)
s = s.replace('  readonly importTotalMs: number;\n}', '  readonly importTotalMs: number;\n  readonly capturedPriorityColumns?: readonly MlgCapturedPriorityColumn[];\n}', 1)
p.write_text(s)

p = Path('apps/web/src/workers/mlg-import.worker.ts')
s = p.read_text()
s = s.replace("import { BlobByteSource } from '../adapters/blob-byte-source';", "import { BlobByteSource } from '../adapters/blob-byte-source';\nimport { decodeMlgRawValue, displayMlgValue } from '../../../../core/parsers/mlg/mlg-channel-data';", 1)
s = s.replace('  MlgColumnSidecarBuildResult,\n  MlgWorkerRequest,', '  MlgColumnSidecarBuildResult,\n  MlgPriorityCaptureSelector,\n  MlgWorkerRequest,', 1)
anchor = 'const SERIAL_VALIDATION_CHUNK_SIZE = 32 * 1024 * 1024;\nconst PARALLEL_VALIDATION_CHUNK_SIZE = 32 * 1024 * 1024;'
helper = """const SERIAL_VALIDATION_CHUNK_SIZE = 32 * 1024 * 1024;\nconst PARALLEL_VALIDATION_CHUNK_SIZE = 32 * 1024 * 1024;\n\nfunction normalized(value: string | undefined): string { return value?.trim().toLowerCase() ?? ''; }\n\nfunction resolvePriorityFieldIndices(\n  selectors: readonly MlgPriorityCaptureSelector[] | undefined,\n  channels: readonly { readonly id: string; readonly sourceName: string; readonly unit?: string }[],\n): number[] {\n  if (!selectors || selectors.length === 0) return [];\n  const indices = new Set<number>();\n  for (const selector of selectors) {\n    if (selector.sourceChannelId?.startsWith('mlg:')) {\n      const index = Number(selector.sourceChannelId.slice(4));\n      if (Number.isSafeInteger(index) && index >= 0 && index < channels.length) indices.add(index);\n      continue;\n    }\n    const logicalKey = normalized(selector.logicalKey);\n    const displayName = normalized(selector.displayName);\n    let candidates = logicalKey\n      ? channels.map((channel, index) => ({ channel, index })).filter(({ channel }) => normalized(channel.sourceName) === logicalKey)\n      : [];\n    if (candidates.length !== 1 && displayName) {\n      candidates = channels.map((channel, index) => ({ channel, index })).filter(({ channel }) => normalized(channel.sourceName) === displayName);\n      if (candidates.length > 1 && selector.unit) {\n        const unit = normalized(selector.unit);\n        const unitMatches = candidates.filter(({ channel }) => normalized(channel.unit) === unit);\n        if (unitMatches.length === 1) candidates = unitMatches;\n      }\n    }\n    if (candidates.length === 1) indices.add(candidates[0]!.index);\n  }\n  return [...indices];\n}\n"""
if anchor not in s: raise SystemExit('worker constants anchor missing')
s = s.replace(anchor, helper, 1)
old = """      const scanStart = now();\n      const scanResult = await scanMlgRecords(\n        source,\n        headerResult.header,\n        { validateCrc: false },\n      );\n      const recordScanMs = now() - scanStart;\n"""
new = """      const priorityFieldIndices = resolvePriorityFieldIndices(importRequest.priorityCapture, headerResult.channels);\n      const blockLength = BLOCK_HEADER_LENGTH + headerResult.header.recordLength + 1;\n      const fixedRecordCount = blockLength > 0 && (importRequest.file.size - headerResult.header.dataBeginIndex) % blockLength === 0\n        ? (importRequest.file.size - headerResult.header.dataBeginIndex) / blockLength\n        : 0;\n      const fieldOffsets = new Uint32Array(headerResult.fields.length);\n      let fieldOffset = 0;\n      headerResult.fields.forEach((field, index) => { fieldOffsets[index] = fieldOffset; fieldOffset += field.widthBytes; });\n      const capturedPriority = fixedRecordCount > 0 ? priorityFieldIndices.map((index) => ({\n        index,\n        channelId: `mlg:${index}`,\n        field: headerResult.fields[index]!,\n        fieldOffset: fieldOffsets[index] ?? 0,\n        values: new Float64Array(fixedRecordCount),\n      })) : [];\n\n      const scanStart = now();\n      const scanResult = await scanMlgRecords(\n        source,\n        headerResult.header,\n        {\n          validateCrc: false,\n          ...(capturedPriority.length > 0 ? {\n            onFixedRecordChunk: (bytes, firstRecordIndex, recordCount, fixedBlockLength) => {\n              const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);\n              for (let localIndex = 0; localIndex < recordCount; localIndex += 1) {\n                const recordStart = localIndex * fixedBlockLength + BLOCK_HEADER_LENGTH;\n                const sampleIndex = firstRecordIndex + localIndex;\n                for (const captured of capturedPriority) {\n                  const raw = decodeMlgRawValue(view, recordStart + captured.fieldOffset, captured.field);\n                  captured.values[sampleIndex] = displayMlgValue(raw, captured.field);\n                }\n              }\n            },\n          } : {}),\n        },\n      );\n      const recordScanMs = now() - scanStart;\n"""
if old not in s: raise SystemExit('worker scan block missing')
s = s.replace(old, new, 1)
s = s.replace('          importTotalMs: now() - started,\n          performance: {', "          importTotalMs: now() - started,\n          ...(capturedPriority.length > 0 && scanResult.performance.scanMode === 'fixed' ? {\n            capturedPriorityColumns: capturedPriority.map(({ channelId, values }) => ({ channelId, values })),\n          } : {}),\n          performance: {", 1)
s = s.replace('      }, sourceCacheSeed.map((page) => page.bytes.buffer as ArrayBuffer));', "      }, [\n        ...sourceCacheSeed.map((page) => page.bytes.buffer as ArrayBuffer),\n        ...capturedPriority.map((captured) => captured.values.buffer as ArrayBuffer),\n      ]);", 1)
p.write_text(s)

p = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
s = p.read_text()
s = s.replace('  private prioritizedChannelIds = new Set<string>();', '  private prioritizedChannelIds = new Set<string>();\n  private readonly capturedPriorityColumns = new Map<string, Float64Array>();', 1)
s = s.replace('  public activate(manifest: MlgColumnSidecarManifest): boolean {', "  public seedCapturedPriorityColumns(columns: readonly { readonly channelId: string; readonly values: Float64Array }[]): void {\n    for (const column of columns) {\n      if (column.values.length === this.sampleCount && this.fieldByChannelId.has(column.channelId)) this.capturedPriorityColumns.set(column.channelId, column.values);\n    }\n  }\n\n  public activate(manifest: MlgColumnSidecarManifest): boolean {", 1)
old = """  ): Promise<NumericChannelBatchResult | undefined> {\n    await this.waitForPrioritizedChannels(channelIds);\n    const manifest = await this.ensureManifest();\n"""
new = """  ): Promise<NumericChannelBatchResult | undefined> {\n    if (startSampleIndex === 0 && sampleCount === this.sampleCount) {\n      const captured = channelIds.map((channelId) => this.capturedPriorityColumns.get(channelId));\n      if (captured.every((values) => values !== undefined)) {\n        const ranges = new Map<string, NumericChannelRange>();\n        for (let index = 0; index < channelIds.length; index += 1) ranges.set(channelIds[index]!, buildRange(this.recordIndex, 0, this.sampleCount, captured[index]!));\n        return { ranges, performance: { channelCount: channelIds.length, cacheHitChannelIds: [...channelIds], physicalReadCount: 0, physicalBytesRead: 0, physicalReadMs: 0 } };\n      }\n    }\n    await this.waitForPrioritizedChannels(channelIds);\n    const manifest = await this.ensureManifest();\n"""
if old not in s: raise SystemExit('sidecar read anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('apps/web/src/adapters/mlg-staged-import.ts')
s = p.read_text()
s = s.replace('  MlgWorkerIndexedPayload,\n  MlgWorkerResponse,', '  MlgPriorityCaptureSelector,\n  MlgWorkerIndexedPayload,\n  MlgWorkerResponse,', 1)
s = s.replace('export function importMlgFileStaged(file: File): StagedMlgImportHandle {', 'export function importMlgFileStaged(file: File, priorityCapture: readonly MlgPriorityCaptureSelector[] = []): StagedMlgImportHandle {', 1)
needle = """      sidecarChannelData = new MlgColumnSidecarDataSource(\n        baseChannelData,\n        message.payload.summary.source.id,\n        message.payload.fields,\n        message.payload.recordIndex,\n      );\n"""
if needle not in s: raise SystemExit('staged sidecar anchor missing')
s = s.replace(needle, needle + "      if (message.payload.capturedPriorityColumns) sidecarChannelData.seedCapturedPriorityColumns(message.payload.capturedPriorityColumns);\n", 1)
s = s.replace('      sizeBytes: file.size,\n    },\n  });', '      sizeBytes: file.size,\n    },\n    ...(priorityCapture.length > 0 ? { priorityCapture } : {}),\n  });', 1)
p.write_text(s)

p = Path('apps/web/src/app/app-shell.ts')
s = p.read_text()
anchor = '  const prioritizedWorkspaceSourceChannelIds = (\n'
helper = """  const priorityCaptureSelectorsForWorkspace = (workspaceState: WebWorkspaceState) => {\n    const activeWorkspace = workspaceState.logger.workspaces.find((workspace) => workspace.id === workspaceState.logger.activeWorkspaceId);\n    if (!activeWorkspace) return [];\n    const ids = new Set<string>();\n    if (activeWorkspace.panes && activeWorkspace.panes.length > 0) {\n      for (const pane of activeWorkspace.panes) for (const id of pane.channelIds) ids.add(id);\n    } else {\n      for (const id of activeWorkspace.channelIds) ids.add(id);\n    }\n    const selectors: Array<{ logicalChannelId: string; logicalKey?: string; displayName?: string; unit?: string; sourceChannelId?: string }> = [];\n    for (const logicalChannelId of ids) {\n      if (logicalChannelId.startsWith('mlg:')) { selectors.push({ logicalChannelId, sourceChannelId: logicalChannelId }); continue; }\n      if (!logicalChannelId.startsWith('ini:') || !activeIniCatalog) continue;\n      const logicalKey = logicalChannelId.slice(4);\n      const entry = activeIniCatalog.byLogicalKey.get(logicalKey);\n      if (!entry) continue;\n      selectors.push({ logicalChannelId, logicalKey: entry.logicalKey, displayName: entry.displayName, ...(entry.unit ? { unit: entry.unit } : {}) });\n    }\n    return selectors;\n  };\n\n  const prioritizedWorkspaceSourceChannelIds = (\n"""
if anchor not in s: raise SystemExit('app helper anchor missing')
s = s.replace(anchor, helper, 1)
s = s.replace('    const staged = importMlgFileStaged(file);\n    activeStagedImport = staged;', '    const priorityCapture = priorityCaptureSelectorsForWorkspace(captureWorkspaceState());\n    const staged = importMlgFileStaged(file, priorityCapture);\n    activeStagedImport = staged;', 1)
p.write_text(s)
