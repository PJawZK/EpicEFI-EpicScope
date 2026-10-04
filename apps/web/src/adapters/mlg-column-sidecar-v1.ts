import type {
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../../../core/log-model/log-types';
import type { MlgFieldDescriptor } from '../../../../core/parsers/mlg/mlg-format';
import type { MlgRecordIndex } from '../../../../core/parsers/mlg/mlg-records';
import type {
  MlgColumnSidecarBuildResult,
  MlgColumnSidecarManifest,
  MlgColumnSidecarStripeManifest,
} from '../workers/mlg-worker-protocol';

const SIDECAR_ROOT = 'epicscope-mlg-sidecars-v1';
const MANIFEST_FILE = 'manifest.json';
const TARGET_STRIPE_BYTES = 64;
const DATA_FILE = 'columns.bin';
const BLOCK_HEADER_LENGTH = 4;

interface OpfsWritable {
  write(data: Uint8Array | Blob | string): Promise<void>;
  close(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}

interface OpfsSyncAccessHandle {
  write(data: BufferSource, options?: { readonly at?: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}

interface OpfsFileHandle {
  getFile(): Promise<File>;
  createWritable(options?: { readonly keepExistingData?: boolean }): Promise<OpfsWritable>;
  createSyncAccessHandle?: () => Promise<OpfsSyncAccessHandle>;
}

interface OpfsDirectoryHandle {
  getDirectoryHandle(name: string, options?: { readonly create?: boolean }): Promise<OpfsDirectoryHandle>;
  getFileHandle(name: string, options?: { readonly create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry(name: string, options?: { readonly recursive?: boolean }): Promise<void>;
}

interface OpfsStorageLike {
  estimate(): Promise<StorageEstimate>;
  getDirectory?: () => Promise<OpfsDirectoryHandle>;
}

export interface MlgColumnSidecarBatch {
  readonly bytes: Uint8Array;
  readonly firstOffset: number;
  readonly firstIndex: number;
  readonly lastIndex: number;
}

export interface MlgColumnSidecarBuilder {
  append(batch: MlgColumnSidecarBatch): Promise<void>;
  finish(): Promise<MlgColumnSidecarBuildResult>;
  abort(): Promise<void>;
}

interface PlannedField {
  readonly fieldIndex: number;
  readonly recordOffset: number;
  readonly stripeIndex: number;
  readonly stripeOffset: number;
  readonly field: MlgFieldDescriptor;
}

export interface MlgColumnStripePlan {
  readonly stripes: readonly MlgColumnSidecarStripeManifest[];
  readonly fields: readonly PlannedField[];
  readonly fieldPayloadBytes: number;
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function storageManager(): OpfsStorageLike | undefined {
  return globalThis.navigator?.storage as unknown as OpfsStorageLike | undefined;
}

function sidecarStorageKey(logKey: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < logKey.length; index += 1) {
    hash ^= logKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `log-${hash.toString(16).padStart(8, '0')}`;
}

export function planMlgColumnStripes(
  fields: readonly MlgFieldDescriptor[],
  targetStripeBytes = TARGET_STRIPE_BYTES,
): MlgColumnStripePlan {
  if (!Number.isSafeInteger(targetStripeBytes) || targetStripeBytes <= 0) {
    throw new RangeError(`Invalid MLG sidecar stripe width: ${targetStripeBytes}`);
  }

  const stripes: MlgColumnSidecarStripeManifest[] = [];
  const plannedFields: PlannedField[] = [];
  let recordOffset = 0;
  let stripeStartByte = 0;
  let stripeWidth = 0;
  let stripeFirstField = 0;

  const finishStripe = (lastFieldIndexExclusive: number): void => {
    if (stripeWidth <= 0) return;
    const index = stripes.length;
    stripes.push({
      index,
      startByte: stripeStartByte,
      widthBytes: stripeWidth,
      firstFieldIndex: stripeFirstField,
      lastFieldIndexExclusive,
      storageOffset: 0,
    });
    stripeStartByte += stripeWidth;
    stripeWidth = 0;
    stripeFirstField = lastFieldIndexExclusive;
  };

  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
    const field = fields[fieldIndex];
    if (!field) continue;
    if (stripeWidth > 0 && stripeWidth + field.widthBytes > targetStripeBytes) {
      finishStripe(fieldIndex);
    }
    plannedFields.push({
      fieldIndex,
      recordOffset,
      stripeIndex: stripes.length,
      stripeOffset: stripeWidth,
      field,
    });
    stripeWidth += field.widthBytes;
    recordOffset += field.widthBytes;
  }
  finishStripe(fields.length);

  return {
    stripes,
    fields: plannedFields,
    fieldPayloadBytes: recordOffset,
  };
}

async function openLogDirectory(
  logKey: string,
  create: boolean,
): Promise<OpfsDirectoryHandle | undefined> {
  const storage = storageManager();
  if (!storage?.getDirectory) return undefined;
  const root = await storage.getDirectory();
  const sidecars = await root.getDirectoryHandle(SIDECAR_ROOT, { create });
  return sidecars.getDirectoryHandle(sidecarStorageKey(logKey), { create });
}

async function resetLogDirectory(logKey: string): Promise<OpfsDirectoryHandle | undefined> {
  const storage = storageManager();
  if (!storage?.getDirectory) return undefined;
  const root = await storage.getDirectory();
  const sidecars = await root.getDirectoryHandle(SIDECAR_ROOT, { create: true });
  try {
    await sidecars.removeEntry(sidecarStorageKey(logKey), { recursive: true });
  } catch {
    // Missing or incomplete prior sidecar storage needs no cleanup.
  }
  return sidecars.getDirectoryHandle(sidecarStorageKey(logKey), { create: true });
}

async function readStoredManifest(logKey: string): Promise<MlgColumnSidecarManifest | undefined> {
  try {
    const directory = await openLogDirectory(logKey, false);
    if (!directory) return undefined;
    const file = await (await directory.getFileHandle(MANIFEST_FILE)).getFile();
    const manifest = JSON.parse(await file.text()) as MlgColumnSidecarManifest;
    return manifest.logKey === logKey ? manifest : undefined;
  } catch {
    return undefined;
  }
}

async function removeManifest(directory: OpfsDirectoryHandle): Promise<void> {
  try {
    await directory.removeEntry(MANIFEST_FILE);
  } catch {
    // Missing manifests are expected for a new/incomplete sidecar.
  }
}

export async function createMlgColumnSidecarBuilder(
  logKey: string,
  fields: readonly MlgFieldDescriptor[],
  recordIndex: MlgRecordIndex,
  recordLength: number,
): Promise<MlgColumnSidecarBuilder | undefined> {
  const storage = storageManager();
  if (!storage?.getDirectory) return undefined;

  const plan = planMlgColumnStripes(fields);
  if (plan.fieldPayloadBytes <= 0 || recordIndex.offsets.length === 0) return undefined;
  if (plan.fieldPayloadBytes > recordLength) return undefined;

  const estimatedBytes = plan.fieldPayloadBytes * recordIndex.offsets.length;

  let directory: OpfsDirectoryHandle;
  try {
    const opened = await resetLogDirectory(logKey);
    if (!opened) return undefined;
    directory = opened;
  } catch {
    return undefined;
  }

  try {
    const estimate = await storage.estimate();
    if (
      estimate.quota !== undefined
      && estimate.usage !== undefined
      && estimatedBytes > Math.max(0, estimate.quota - estimate.usage) * 0.95
    ) {
      return undefined;
    }
  } catch {
    // Quota estimates are advisory only.
  }

  let dataFileHandle: OpfsFileHandle;
  let access: OpfsSyncAccessHandle;
  try {
    dataFileHandle = await directory.getFileHandle(DATA_FILE, { create: true });
    if (!dataFileHandle.createSyncAccessHandle) return undefined;
    access = await dataFileHandle.createSyncAccessHandle();
    access.truncate(estimatedBytes);
  } catch {
    return undefined;
  }

  const laidOutStripes = plan.stripes.map((stripe, index) => {
    let storageOffset = 0;
    for (let prior = 0; prior < index; prior += 1) {
      const previous = plan.stripes[prior];
      if (previous) storageOffset += previous.widthBytes * recordIndex.offsets.length;
    }
    return { ...stripe, storageOffset };
  });

  const buildStarted = now();
  let transposeMs = 0;
  let writeMs = 0;
  let bytesWritten = 0;
  let completedSamples = 0;
  let aborted = false;
  let closed = false;

  const closeAccess = (): void => {
    if (closed) return;
    closed = true;
    access.close();
  };

  const abort = async (): Promise<void> => {
    if (aborted) return;
    aborted = true;
    closeAccess();
    await removeManifest(directory);
    try {
      await directory.removeEntry(DATA_FILE);
    } catch {
      // Missing partial data file is already equivalent to an aborted sidecar.
    }
  };

  return {
    append: async (batch) => {
      if (aborted) return;
      const sampleCount = batch.lastIndex - batch.firstIndex + 1;
      if (sampleCount <= 0) return;

      const transposeStarted = now();
      const outputs = laidOutStripes.map(
        (stripe) => new Uint8Array(sampleCount * stripe.widthBytes),
      );
      for (let index = batch.firstIndex; index <= batch.lastIndex; index += 1) {
        const absoluteOffset = recordIndex.offsets[index];
        if (absoluteOffset === undefined) {
          throw new RangeError(`Missing MLG record offset for sidecar sample ${index}.`);
        }
        const relativeRecordOffset = absoluteOffset - batch.firstOffset;
        const outputSampleIndex = index - batch.firstIndex;
        for (const stripe of laidOutStripes) {
          const sourceStart = relativeRecordOffset + BLOCK_HEADER_LENGTH + stripe.startByte;
          const sourceEnd = sourceStart + stripe.widthBytes;
          const outputStart = outputSampleIndex * stripe.widthBytes;
          outputs[stripe.index]!.set(batch.bytes.subarray(sourceStart, sourceEnd), outputStart);
        }
      }
      transposeMs += now() - transposeStarted;

      const writeStarted = now();
      for (let index = 0; index < outputs.length; index += 1) {
        const stripe = laidOutStripes[index];
        const output = outputs[index];
        if (!stripe || !output) continue;
        const at = stripe.storageOffset + batch.firstIndex * stripe.widthBytes;
        const written = access.write(output, { at });
        if (written != output.byteLength) {
          throw new RangeError(
            `MLG sidecar stripe ${stripe.index} wrote ${written} bytes, expected ${output.byteLength}.`,
          );
        }
      }
      writeMs += now() - writeStarted;
      bytesWritten += outputs.reduce((sum, output) => sum + output.byteLength, 0);
      completedSamples += sampleCount;
    },
    finish: async () => {
      if (aborted) throw new Error('MLG sidecar build was aborted.');
      if (completedSamples !== recordIndex.offsets.length) {
        await abort();
        throw new Error(
          `MLG sidecar expected ${recordIndex.offsets.length} samples, wrote ${completedSamples}.`,
        );
      }
      access.flush();
      closeAccess();

      const manifest: MlgColumnSidecarManifest = {
        schemaVersion: 2,
        logKey,
        storageKey: sidecarStorageKey(logKey),
        dataFileName: DATA_FILE,
        sampleCount: recordIndex.offsets.length,
        fieldCount: fields.length,
        recordLength,
        fieldPayloadBytes: plan.fieldPayloadBytes,
        targetStripeBytes: TARGET_STRIPE_BYTES,
        totalBytes: bytesWritten,
        stripes: laidOutStripes,
        createdAt: Date.now(),
      };
      const stream = await (await directory.getFileHandle(MANIFEST_FILE, { create: true }))
        .createWritable({ keepExistingData: false });
      await stream.write(JSON.stringify(manifest));
      await stream.close();

      return {
        manifest,
        performance: {
          totalMs: now() - buildStarted,
          transposeMs,
          writeMs,
          bytesWritten,
        },
      };
    },
    abort,
  };
}

function decodeRawValue(view: DataView, offset: number, field: MlgFieldDescriptor): number {
  switch (field.type) {
    case 0:
    case 10:
      return view.getUint8(offset);
    case 1:
      return view.getInt8(offset);
    case 2:
    case 11:
      return view.getUint16(offset, false);
    case 3:
      return view.getInt16(offset, false);
    case 4:
    case 12:
      return view.getUint32(offset, false);
    case 5:
      return view.getInt32(offset, false);
    case 6:
      return Number(view.getBigInt64(offset, false));
    case 7:
      return view.getFloat32(offset, false);
  }
}

function displayValue(rawValue: number, field: MlgFieldDescriptor): number {
  return field.kind === 'bitfield'
    ? rawValue
    : (rawValue + field.transform) * field.scale;
}

function buildRange(
  recordIndex: MlgRecordIndex,
  startSampleIndex: number,
  sampleCount: number,
  values: Float64Array,
): NumericChannelRange {
  const end = startSampleIndex + sampleCount;
  return {
    startSampleIndex,
    timeMs: startSampleIndex === 0 && sampleCount === recordIndex.timeMs.length
      ? recordIndex.timeMs
      : recordIndex.timeMs.slice(startSampleIndex, end),
    values,
    validity: startSampleIndex === 0 && sampleCount === recordIndex.crcValid.length
      ? recordIndex.crcValid
      : recordIndex.crcValid.slice(startSampleIndex, end),
  };
}

export class MlgColumnSidecarDataSource implements NumericChannelDataSource {
  readonly sampleCount: number;
  readonly preferredBatchWindowMs?: number;
  readonly requiresExplicitBatchSelection?: boolean;

  private readonly plan: MlgColumnStripePlan;
  private readonly fieldByChannelId = new Map<string, PlannedField>();
  private dataFile: File | undefined;
  private manifest: MlgColumnSidecarManifest | undefined;
  private readonly existingManifestPromise: Promise<void>;
  private prioritizedChannelIds = new Set<string>();
  private readonly capturedPriorityColumns = new Map<string, Float64Array>();
  private priorityReadyPromise: Promise<void> | undefined;
  private resolvePriorityReady: (() => void) | undefined;

  public constructor(
    private readonly source: NumericChannelDataSource,
    private readonly logKey: string,
    private readonly fields: readonly MlgFieldDescriptor[],
    private readonly recordIndex: MlgRecordIndex,
  ) {
    this.sampleCount = source.sampleCount;
    if (source.preferredBatchWindowMs !== undefined) {
      this.preferredBatchWindowMs = source.preferredBatchWindowMs;
    }
    if (source.requiresExplicitBatchSelection !== undefined) {
      this.requiresExplicitBatchSelection = source.requiresExplicitBatchSelection;
    }
    this.plan = planMlgColumnStripes(fields);
    this.plan.fields.forEach((field) => {
      this.fieldByChannelId.set(`mlg:${field.fieldIndex}`, field);
    });
    this.existingManifestPromise = readStoredManifest(logKey).then((manifest) => {
      if (manifest) this.activate(manifest);
    });
  }

  public seedCapturedPriorityColumns(columns: readonly { readonly channelId: string; readonly values: Float64Array }[]): void {
    for (const column of columns) {
      if (column.values.length === this.sampleCount && this.fieldByChannelId.has(column.channelId)) this.capturedPriorityColumns.set(column.channelId, column.values);
    }
  }

  public activate(manifest: MlgColumnSidecarManifest): boolean {
    if (
      manifest.schemaVersion !== 2
      || manifest.logKey !== this.logKey
      || manifest.sampleCount !== this.sampleCount
      || manifest.fieldCount !== this.fields.length
      || manifest.fieldPayloadBytes !== this.plan.fieldPayloadBytes
      || manifest.stripes.length !== this.plan.stripes.length
    ) {
      return false;
    }
    for (let index = 0; index < manifest.stripes.length; index += 1) {
      const actual = manifest.stripes[index];
      const expected = this.plan.stripes[index];
      if (
        !actual
        || !expected
        || actual.index !== expected.index
        || actual.startByte !== expected.startByte
        || actual.widthBytes !== expected.widthBytes
        || actual.firstFieldIndex !== expected.firstFieldIndex
        || actual.lastFieldIndexExclusive !== expected.lastFieldIndexExclusive
        || actual.storageOffset < 0
      ) {
        return false;
      }
    }
    this.manifest = manifest;
    this.dataFile = undefined;
    this.releasePrioritizedChannels();
    return true;
  }

  public prioritizeChannelsUntilReady(channelIds: readonly string[]): void {
    this.prioritizedChannelIds = new Set(
      channelIds.filter((channelId) => this.fieldByChannelId.has(channelId)),
    );
    if (this.manifest || this.prioritizedChannelIds.size === 0) {
      this.releasePrioritizedChannels();
      return;
    }
    if (!this.priorityReadyPromise) {
      this.priorityReadyPromise = new Promise<void>((resolve) => {
        this.resolvePriorityReady = resolve;
      });
    }
  }

  public releasePrioritizedChannels(): void {
    this.resolvePriorityReady?.();
    this.resolvePriorityReady = undefined;
    this.priorityReadyPromise = undefined;
    this.prioritizedChannelIds.clear();
  }

  private async waitForPrioritizedChannels(channelIds: readonly string[]): Promise<void> {
    const wait = this.priorityReadyPromise;
    if (!wait || this.manifest || channelIds.length === 0) return;
    if (!channelIds.every((channelId) => this.prioritizedChannelIds.has(channelId))) return;
    await wait;
  }

  private async ensureManifest(): Promise<MlgColumnSidecarManifest | undefined> {
    await this.existingManifestPromise;
    return this.manifest;
  }

  private async sidecarDataFile(manifest: MlgColumnSidecarManifest): Promise<File> {
    if (this.dataFile) return this.dataFile;
    const directory = await openLogDirectory(this.logKey, false);
    if (!directory) throw new Error('MLG sidecar OPFS directory is unavailable.');
    const file = await (await directory.getFileHandle(manifest.dataFileName)).getFile();
    this.dataFile = file;
    return file;
  }

  private async readFromSidecar(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult | undefined> {
    if (startSampleIndex === 0 && sampleCount === this.sampleCount) {
      const captured = channelIds.map((channelId) => this.capturedPriorityColumns.get(channelId));
      if (captured.every((values) => values !== undefined)) {
        const ranges = new Map<string, NumericChannelRange>();
        for (let index = 0; index < channelIds.length; index += 1) ranges.set(channelIds[index]!, buildRange(this.recordIndex, 0, this.sampleCount, captured[index]!));
        return { ranges, performance: { channelCount: channelIds.length, cacheHitChannelIds: [...channelIds], physicalReadCount: 0, physicalBytesRead: 0, physicalReadMs: 0 } };
      }
    }
    await this.waitForPrioritizedChannels(channelIds);
    const manifest = await this.ensureManifest();
    if (!manifest) return undefined;

    const planned = channelIds.map((channelId) => this.fieldByChannelId.get(channelId));
    if (planned.some((field) => field === undefined)) return undefined;

    try {
      const byStripe = new Map<number, {
        stripe: MlgColumnSidecarStripeManifest;
        fields: PlannedField[];
      }>();
      for (const field of planned as PlannedField[]) {
        const stripe = manifest.stripes[field.stripeIndex];
        if (!stripe) return undefined;
        const group = byStripe.get(stripe.index);
        if (group) group.fields.push(field);
        else byStripe.set(stripe.index, { stripe, fields: [field] });
      }

      const valuesByChannel = new Map<string, Float64Array>();
      await Promise.all([...byStripe.values()].map(async ({ stripe, fields }) => {
        const file = await this.sidecarDataFile(manifest);
        const byteStart = stripe.storageOffset + startSampleIndex * stripe.widthBytes;
        const byteLength = sampleCount * stripe.widthBytes;
        const bytes = new Uint8Array(await file.slice(byteStart, byteStart + byteLength).arrayBuffer());
        if (bytes.byteLength !== byteLength) {
          throw new RangeError(
            `MLG sidecar stripe ${stripe.index} returned ${bytes.byteLength} bytes, expected ${byteLength}.`,
          );
        }
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (const field of fields) {
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
      }));

      const ranges = new Map<string, NumericChannelRange>();
      for (const channelId of channelIds) {
        const values = valuesByChannel.get(channelId);
        if (!values) return undefined;
        ranges.set(channelId, buildRange(this.recordIndex, startSampleIndex, sampleCount, values));
      }
      return {
        ranges,
        performance: {
          channelCount: channelIds.length,
          cacheHitChannelIds: [...channelIds],
          physicalReadCount: 0,
          physicalBytesRead: 0,
          physicalReadMs: 0,
        },
      };
    } catch {
      this.manifest = undefined;
      this.dataFile = undefined;
      return undefined;
    }
  }

  public sampleRangeForTime(
    startMs: number,
    endMs: number,
  ): { readonly startSampleIndex: number; readonly sampleCount: number } {
    return this.source.sampleRangeForTime?.(startMs, endMs)
      ?? { startSampleIndex: 0, sampleCount: this.sampleCount };
  }

  public hasCachedChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean {
    if (this.manifest && this.fieldByChannelId.has(channelId)) return true;
    return this.source.hasCachedChannelRange?.(channelId, startSampleIndex, sampleCount) ?? false;
  }

  public async readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange> {
    const sidecar = await this.readFromSidecar([channelId], startSampleIndex, sampleCount);
    const range = sidecar?.ranges.get(channelId);
    return range ?? this.source.readChannelRange(channelId, startSampleIndex, sampleCount);
  }

  public async readChannelsRange(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult> {
    const sidecar = await this.readFromSidecar(channelIds, startSampleIndex, sampleCount);
    if (sidecar) return sidecar;
    if (this.source.readChannelsRange) {
      return this.source.readChannelsRange(channelIds, startSampleIndex, sampleCount);
    }
    return {
      ranges: new Map(await Promise.all(channelIds.map(async (channelId) => [
        channelId,
        await this.source.readChannelRange(channelId, startSampleIndex, sampleCount),
      ] as const))),
      performance: {
        channelCount: channelIds.length,
        cacheHitChannelIds: [],
        physicalReadCount: 0,
        physicalBytesRead: 0,
        physicalReadMs: 0,
      },
    };
  }
}
