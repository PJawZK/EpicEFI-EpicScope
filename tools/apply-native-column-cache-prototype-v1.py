from pathlib import Path

# 1) Restore 64-byte sidecar stripes and add native-width on-demand cache.
p = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
s = p.read_text()
s = s.replace("const TARGET_STRIPE_BYTES = 16;", "const TARGET_STRIPE_BYTES = 64;", 1)

anchor = "const DATA_FILE = 'columns.bin';\nconst BLOCK_HEADER_LENGTH = 4;"
insert = """const DATA_FILE = 'columns.bin';
const NATIVE_INDEX_FILE = 'native-columns.json';
const NATIVE_FILE_PREFIX = 'native-column-';
const BLOCK_HEADER_LENGTH = 4;

interface MlgNativeColumnIndex {
  readonly schemaVersion: 1;
  readonly logKey: string;
  readonly sampleCount: number;
  readonly fieldIndices: readonly number[];
}

function nativeColumnFileName(fieldIndex: number): string {
  return `${NATIVE_FILE_PREFIX}${fieldIndex}.bin`;
}"""
if anchor not in s:
    raise SystemExit('constants anchor not found')
s = s.replace(anchor, insert, 1)

anchor = "async function removeManifest(directory: OpfsDirectoryHandle): Promise<void> {"
helper = """async function readNativeColumnIndex(
  logKey: string,
  sampleCount: number,
): Promise<MlgNativeColumnIndex | undefined> {
  try {
    const directory = await openLogDirectory(logKey, false);
    if (!directory) return undefined;
    const file = await (await directory.getFileHandle(NATIVE_INDEX_FILE)).getFile();
    const index = JSON.parse(await file.text()) as MlgNativeColumnIndex;
    return index.schemaVersion === 1
      && index.logKey === logKey
      && index.sampleCount === sampleCount
      ? index
      : undefined;
  } catch {
    return undefined;
  }
}

async function removeManifest(directory: OpfsDirectoryHandle): Promise<void> {"""
if anchor not in s:
    raise SystemExit('removeManifest anchor not found')
s = s.replace(anchor, helper, 1)

anchor = "export class MlgColumnSidecarDataSource implements NumericChannelDataSource {\n  readonly sampleCount: number;"
replace = """export class MlgColumnSidecarDataSource implements NumericChannelDataSource {
  readonly sampleCount: number;
  readonly managesPersistentColumns = true;"""
if anchor not in s:
    raise SystemExit('class anchor not found')
s = s.replace(anchor, replace, 1)

anchor = "  private readonly existingManifestPromise: Promise<void>;\n  private prioritizedChannelIds = new Set<string>();"
replace = """  private readonly existingManifestPromise: Promise<void>;
  private readonly nativeIndexPromise: Promise<void>;
  private readonly nativeFieldIndices = new Set<number>();
  private nativeWritePromise: Promise<void> = Promise.resolve();
  private prioritizedChannelIds = new Set<string>();"""
if anchor not in s:
    raise SystemExit('class fields anchor not found')
s = s.replace(anchor, replace, 1)

anchor = """    this.existingManifestPromise = readStoredManifest(logKey).then((manifest) => {
      if (manifest) this.activate(manifest);
    });
  }
"""
replace = """    this.existingManifestPromise = readStoredManifest(logKey).then((manifest) => {
      if (manifest) this.activate(manifest);
    });
    this.nativeIndexPromise = readNativeColumnIndex(logKey, this.sampleCount).then((index) => {
      if (!index) return;
      for (const fieldIndex of index.fieldIndices) {
        if (Number.isSafeInteger(fieldIndex) && fieldIndex >= 0 && fieldIndex < this.fields.length) {
          this.nativeFieldIndices.add(fieldIndex);
        }
      }
    });
  }
"""
if anchor not in s:
    raise SystemExit('constructor anchor not found')
s = s.replace(anchor, replace, 1)

anchor = """  private async readFromSidecar(
    channelIds: readonly string[],
"""
methods = """  private async readNativeColumn(
    field: PlannedField,
  ): Promise<{
    readonly values: Float64Array;
    readonly fileOpenMs: number;
    readonly blobReadMs: number;
    readonly decodeMs: number;
  } | undefined> {
    await this.nativeIndexPromise;
    if (!this.nativeFieldIndices.has(field.fieldIndex)) return undefined;
    try {
      const fileStarted = now();
      const directory = await openLogDirectory(this.logKey, false);
      if (!directory) return undefined;
      const file = await (await directory.getFileHandle(nativeColumnFileName(field.fieldIndex))).getFile();
      const fileOpenMs = now() - fileStarted;
      const expectedBytes = this.sampleCount * field.field.widthBytes;
      if (file.size !== expectedBytes) {
        this.nativeFieldIndices.delete(field.fieldIndex);
        return undefined;
      }
      const readStarted = now();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blobReadMs = now() - readStarted;
      if (bytes.byteLength !== expectedBytes) {
        this.nativeFieldIndices.delete(field.fieldIndex);
        return undefined;
      }
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const values = new Float64Array(this.sampleCount);
      const decodeStarted = now();
      for (let sample = 0; sample < this.sampleCount; sample += 1) {
        values[sample] = displayValue(
          decodeRawValue(view, sample * field.field.widthBytes, field.field),
          field.field,
        );
      }
      return { values, fileOpenMs, blobReadMs, decodeMs: now() - decodeStarted };
    } catch {
      this.nativeFieldIndices.delete(field.fieldIndex);
      return undefined;
    }
  }

  private queueNativeColumnPersist(field: PlannedField, bytes: Uint8Array): void {
    if (this.nativeFieldIndices.has(field.fieldIndex)) return;
    this.nativeWritePromise = this.nativeWritePromise.then(async () => {
      await this.nativeIndexPromise;
      if (this.nativeFieldIndices.has(field.fieldIndex)) return;
      const directory = await openLogDirectory(this.logKey, true);
      if (!directory) return;
      const stream = await (await directory.getFileHandle(nativeColumnFileName(field.fieldIndex), { create: true }))
        .createWritable({ keepExistingData: false });
      await stream.write(bytes);
      await stream.close();
      this.nativeFieldIndices.add(field.fieldIndex);
      const indexStream = await (await directory.getFileHandle(NATIVE_INDEX_FILE, { create: true }))
        .createWritable({ keepExistingData: false });
      const index: MlgNativeColumnIndex = {
        schemaVersion: 1,
        logKey: this.logKey,
        sampleCount: this.sampleCount,
        fieldIndices: [...this.nativeFieldIndices].sort((a, b) => a - b),
      };
      await indexStream.write(JSON.stringify(index));
      await indexStream.close();
    }).catch(() => undefined);
  }

  private async readFromSidecar(
    channelIds: readonly string[],
"""
if anchor not in s:
    raise SystemExit('readFromSidecar anchor not found')
s = s.replace(anchor, methods, 1)

anchor = """    const planned = channelIds.map((channelId) => this.fieldByChannelId.get(channelId));
    if (planned.some((field) => field === undefined)) return undefined;

    try {
"""
replace = """    const planned = channelIds.map((channelId) => this.fieldByChannelId.get(channelId));
    if (planned.some((field) => field === undefined)) return undefined;

    if (startSampleIndex === 0 && sampleCount === this.sampleCount) {
      await this.nativeIndexPromise;
      const nativePlanned = planned as PlannedField[];
      if (nativePlanned.length > 0 && nativePlanned.every((field) => this.nativeFieldIndices.has(field.fieldIndex))) {
        const ranges = new Map<string, NumericChannelRange>();
        let sidecarFileOpenAggregateMs = 0;
        let sidecarBlobReadAggregateMs = 0;
        let sidecarDecodeAggregateMs = 0;
        let nativeComplete = true;
        for (const field of nativePlanned) {
          const native = await this.readNativeColumn(field);
          if (!native) {
            nativeComplete = false;
            break;
          }
          sidecarFileOpenAggregateMs += native.fileOpenMs;
          sidecarBlobReadAggregateMs += native.blobReadMs;
          sidecarDecodeAggregateMs += native.decodeMs;
          ranges.set(`mlg:${field.fieldIndex}`, buildRange(this.recordIndex, 0, this.sampleCount, native.values));
        }
        if (nativeComplete && ranges.size === channelIds.length) {
          return {
            ranges,
            performance: {
              channelCount: channelIds.length,
              cacheHitChannelIds: [...channelIds],
              physicalReadCount: 0,
              physicalBytesRead: 0,
              physicalReadMs: 0,
              sidecarManifestMs,
              sidecarFileOpenAggregateMs,
              sidecarBlobReadAggregateMs,
              sidecarDecodeAggregateMs,
              sidecarRangeBuildMs: 0,
            },
          };
        }
      }
    }

    try {
"""
if anchor not in s:
    raise SystemExit('planned anchor not found')
s = s.replace(anchor, replace, 1)

anchor = """        for (const field of fields) {
          const values = new Float64Array(sampleCount);
          for (let sample = 0; sample < sampleCount; sample += 1) {
            const offset = sample * stripe.widthBytes + field.stripeOffset;
            values[sample] = displayValue(
              decodeRawValue(view, offset, field.field),
              field.field,
            );
          }
          valuesByChannel.set(`mlg:${field.fieldIndex}`, values);
        }
"""
replace = """        for (const field of fields) {
          const values = new Float64Array(sampleCount);
          const persistNative = startSampleIndex === 0
            && sampleCount === this.sampleCount
            && !this.nativeFieldIndices.has(field.fieldIndex);
          const nativeBytes = persistNative
            ? new Uint8Array(sampleCount * field.field.widthBytes)
            : undefined;
          for (let sample = 0; sample < sampleCount; sample += 1) {
            const offset = sample * stripe.widthBytes + field.stripeOffset;
            values[sample] = displayValue(
              decodeRawValue(view, offset, field.field),
              field.field,
            );
            if (nativeBytes) {
              nativeBytes.set(
                bytes.subarray(offset, offset + field.field.widthBytes),
                sample * field.field.widthBytes,
              );
            }
          }
          if (nativeBytes) this.queueNativeColumnPersist(field, nativeBytes);
          valuesByChannel.set(`mlg:${field.fieldIndex}`, values);
        }
"""
if anchor not in s:
    raise SystemExit('decode loop anchor not found')
s = s.replace(anchor, replace, 1)
p.write_text(s)

# 2) Let sources that own compact persistence opt out of Float64 IndexedDB persistence.
p = Path('core/log-model/log-types.ts')
s = p.read_text()
anchor = "  readonly requiresExplicitBatchSelection?: boolean;\n  sampleRangeForTime?("
replace = "  readonly requiresExplicitBatchSelection?: boolean;\n  readonly managesPersistentColumns?: boolean;\n  sampleRangeForTime?("
if anchor not in s:
    raise SystemExit('data source property anchor not found')
s = s.replace(anchor, replace, 1)
p.write_text(s)

p = Path('apps/web/src/adapters/persistent-channel-cache.ts')
s = p.read_text()
s = s.replace(
    "    if (store.listCachedChannelIds) {",
    "    if (!source.managesPersistentColumns && store.listCachedChannelIds) {",
    1,
)
anchor = "  private async persistedColumn(channelId: string): Promise<Float64Array | undefined> {\n    const resident = this.residentColumns.get(channelId);"
replace = "  private async persistedColumn(channelId: string): Promise<Float64Array | undefined> {\n    const resident = this.residentColumns.get(channelId);\n    if (this.source.managesPersistentColumns) return undefined;"
if anchor not in s:
    raise SystemExit('persistedColumn anchor not found')
s = s.replace(anchor, replace, 1)
anchor = """  private persistFullColumn(channelId: string, range: NumericChannelRange): void {
    if (!this.retainFullColumn(channelId, range)) return;
    void this.store.put(this.logKey, channelId, range.values).catch(() => undefined);
  }
"""
replace = """  private persistFullColumn(channelId: string, range: NumericChannelRange): void {
    if (!this.retainFullColumn(channelId, range)) return;
    if (this.source.managesPersistentColumns) return;
    void this.store.put(this.logKey, channelId, range.values).catch(() => undefined);
  }
"""
if anchor not in s:
    raise SystemExit('persistFullColumn anchor not found')
s = s.replace(anchor, replace, 1)
p.write_text(s)
