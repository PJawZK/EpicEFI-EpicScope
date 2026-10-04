import type {
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../../../core/log-model/log-types';
import { clearMlgColumnSidecars } from './mlg-column-sidecar-storage';

const DATABASE_NAME = 'epicscope-column-cache';
const DATABASE_VERSION = 2;
const COLUMN_STORE_NAME = 'columns';
const UPDATED_AT_INDEX = 'updatedAt';
const MAX_PERSISTED_COLUMNS = 128;
const CACHE_SCHEMA_VERSION = 1;
const MAX_PERSISTED_SELECTION_BATCH = 4;

interface StoredColumnRecord {
  readonly key: string;
  readonly sampleCount: number;
  readonly values: ArrayBuffer;
  readonly updatedAt: number;
}

export interface PersistentChannelColumnStore {
  get(logKey: string, channelId: string, sampleCount: number): Promise<Float64Array | undefined>;
  put(logKey: string, channelId: string, values: Float64Array): Promise<void>;
  listCachedChannelIds?(logKey: string, sampleCount: number): Promise<ReadonlySet<string>>;
}

function cacheKeyPrefix(logKey: string, sampleCount: number): string {
  return `${CACHE_SCHEMA_VERSION}|${logKey}|${sampleCount}|`;
}

function cacheKey(logKey: string, channelId: string, sampleCount: number): string {
  return `${cacheKeyPrefix(logKey, sampleCount)}${channelId}`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

export class IndexedDbPersistentChannelColumnStore implements PersistentChannelColumnStore {
  private readonly databasePromise: Promise<IDBDatabase>;

  public constructor(indexedDb: IDBFactory = globalThis.indexedDB) {
    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.objectStoreNames.contains(COLUMN_STORE_NAME)
          ? request.transaction!.objectStore(COLUMN_STORE_NAME)
          : database.createObjectStore(COLUMN_STORE_NAME, { keyPath: 'key' });
        if (!store.indexNames.contains(UPDATED_AT_INDEX)) {
          store.createIndex(UPDATED_AT_INDEX, UPDATED_AT_INDEX);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB column cache.'));
    });
  }

  public async get(
    logKey: string,
    channelId: string,
    sampleCount: number,
  ): Promise<Float64Array | undefined> {
    const database = await this.databasePromise;
    const transaction = database.transaction(COLUMN_STORE_NAME, 'readonly');
    const store = transaction.objectStore(COLUMN_STORE_NAME);
    const record = await requestResult(
      store.get(cacheKey(logKey, channelId, sampleCount)) as IDBRequest<StoredColumnRecord | undefined>,
    );
    await transactionDone(transaction);
    if (!record || record.sampleCount !== sampleCount) return undefined;
    return new Float64Array(record.values);
  }

  public async listCachedChannelIds(
    logKey: string,
    sampleCount: number,
  ): Promise<ReadonlySet<string>> {
    const database = await this.databasePromise;
    const transaction = database.transaction(COLUMN_STORE_NAME, 'readonly');
    const store = transaction.objectStore(COLUMN_STORE_NAME);
    const prefix = cacheKeyPrefix(logKey, sampleCount);
    const keys = await requestResult(
      store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}\uffff`)),
    );
    await transactionDone(transaction);
    const channelIds = new Set<string>();
    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        channelIds.add(key.slice(prefix.length));
      }
    }
    return channelIds;
  }

  public async put(logKey: string, channelId: string, values: Float64Array): Promise<void> {
    const database = await this.databasePromise;
    const copiedValues = values.slice();
    const transaction = database.transaction(COLUMN_STORE_NAME, 'readwrite');
    transaction.objectStore(COLUMN_STORE_NAME).put({
      key: cacheKey(logKey, channelId, copiedValues.length),
      sampleCount: copiedValues.length,
      values: copiedValues.buffer,
      updatedAt: Date.now(),
    } satisfies StoredColumnRecord);
    await transactionDone(transaction);
    await this.pruneToLimit(database);
  }

  private async pruneToLimit(database: IDBDatabase): Promise<void> {
    const countTransaction = database.transaction(COLUMN_STORE_NAME, 'readonly');
    const count = await requestResult(countTransaction.objectStore(COLUMN_STORE_NAME).count());
    await transactionDone(countTransaction);
    let excess = count - MAX_PERSISTED_COLUMNS;
    if (excess <= 0) return;

    const transaction = database.transaction(COLUMN_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(COLUMN_STORE_NAME);
    const index = store.index(UPDATED_AT_INDEX);
    await new Promise<void>((resolve, reject) => {
      const cursorRequest = index.openKeyCursor();
      cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('IndexedDB cache pruning failed.'));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || excess <= 0) {
          resolve();
          return;
        }
        store.delete(cursor.primaryKey);
        excess -= 1;
        cursor.continue();
      };
    });
    await transactionDone(transaction);
  }
}

export async function clearPersistentChannelCache(): Promise<void> {
  if (typeof globalThis.indexedDB !== 'undefined') {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(COLUMN_STORE_NAME)
          ? request.transaction!.objectStore(COLUMN_STORE_NAME)
          : db.createObjectStore(COLUMN_STORE_NAME, { keyPath: 'key' });
        if (!store.indexNames.contains(UPDATED_AT_INDEX)) store.createIndex(UPDATED_AT_INDEX, UPDATED_AT_INDEX);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB column cache.'));
    });
    try {
      const transaction = database.transaction(COLUMN_STORE_NAME, 'readwrite');
      transaction.objectStore(COLUMN_STORE_NAME).clear();
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  }

  await clearMlgColumnSidecars();
}

function buildRange(
  startSampleIndex: number,
  sampleCount: number,
  values: Float64Array,
  timeMs: Float64Array,
  validity: Uint8Array,
): NumericChannelRange {
  const end = startSampleIndex + sampleCount;
  return {
    startSampleIndex,
    timeMs: startSampleIndex === 0 && sampleCount === timeMs.length
      ? timeMs
      : timeMs.slice(startSampleIndex, end),
    values: startSampleIndex === 0 && sampleCount === values.length
      ? values
      : values.slice(startSampleIndex, end),
    validity: startSampleIndex === 0 && sampleCount === validity.length
      ? validity
      : validity.slice(startSampleIndex, end),
  };
}

export class PersistentColumnCacheDataSource implements NumericChannelDataSource {
  readonly sampleCount: number;
  readonly preferredBatchWindowMs: number;
  readonly requiresExplicitBatchSelection: boolean;

  private readonly source: NumericChannelDataSource;
  private readonly logKey: string;
  private readonly timeMs: Float64Array;
  private readonly validity: Uint8Array;
  private readonly store: PersistentChannelColumnStore;
  private readonly missingColumns = new Set<string>();
  private readonly residentColumns = new Map<string, Float64Array>();
  private cachedChannelIdIndex: Set<string> | undefined;

  public constructor(
    source: NumericChannelDataSource,
    logKey: string,
    timeMs: Float64Array,
    validity: Uint8Array,
    store: PersistentChannelColumnStore,
  ) {
    this.source = source;
    this.logKey = logKey;
    this.timeMs = timeMs;
    this.validity = validity;
    this.store = store;
    this.sampleCount = source.sampleCount;
    this.preferredBatchWindowMs = source.preferredBatchWindowMs ?? 0;
    this.requiresExplicitBatchSelection = source.requiresExplicitBatchSelection ?? false;
    if (store.listCachedChannelIds) {
      void store.listCachedChannelIds(logKey, this.sampleCount).then((channelIds) => {
        const warmed = new Set(channelIds);
        for (const channelId of this.residentColumns.keys()) warmed.add(channelId);
        this.cachedChannelIdIndex = warmed;
      }).catch(() => undefined);
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
    if (this.residentColumns.has(channelId)) return true;
    return this.source.hasCachedChannelRange?.(channelId, startSampleIndex, sampleCount) ?? false;
  }

  private async persistedColumn(channelId: string): Promise<Float64Array | undefined> {
    const resident = this.residentColumns.get(channelId);
    if (resident) return resident;
    if (this.missingColumns.has(channelId)) return undefined;
    if (this.cachedChannelIdIndex && !this.cachedChannelIdIndex.has(channelId)) {
      this.missingColumns.add(channelId);
      return undefined;
    }

    try {
      const values = await this.store.get(this.logKey, channelId, this.sampleCount);
      if (!values || values.length !== this.sampleCount) {
        this.missingColumns.add(channelId);
        this.cachedChannelIdIndex?.delete(channelId);
        return undefined;
      }
      this.cachedChannelIdIndex?.add(channelId);
      this.residentColumns.set(channelId, values);
      return values;
    } catch {
      this.missingColumns.add(channelId);
      return undefined;
    }
  }

  private retainFullColumn(channelId: string, range: NumericChannelRange): boolean {
    if (range.startSampleIndex !== 0 || range.values.length !== this.sampleCount) return false;
    this.residentColumns.set(channelId, range.values);
    this.missingColumns.delete(channelId);
    this.cachedChannelIdIndex?.add(channelId);
    return true;
  }

  private persistFullColumn(channelId: string, range: NumericChannelRange): void {
    if (!this.retainFullColumn(channelId, range)) return;
    void this.store.put(this.logKey, channelId, range.values).catch(() => undefined);
  }

  public async readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange> {
    const persisted = await this.persistedColumn(channelId);
    if (persisted) {
      return buildRange(startSampleIndex, sampleCount, persisted, this.timeMs, this.validity);
    }

    const range = await this.source.readChannelRange(channelId, startSampleIndex, sampleCount);
    this.persistFullColumn(channelId, range);
    return range;
  }

  public async readChannelsRange(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult> {
    if (!this.source.readChannelsRange || channelIds.length > MAX_PERSISTED_SELECTION_BATCH) {
      const delegated = this.source.readChannelsRange
        ? await this.source.readChannelsRange(channelIds, startSampleIndex, sampleCount)
        : {
            ranges: new Map(await Promise.all(channelIds.map(async (channelId) => [
              channelId,
              await this.source.readChannelRange(channelId, startSampleIndex, sampleCount),
            ] as const))),
            performance: {
              channelCount: channelIds.length,
              cacheHitChannelIds: [] as readonly string[],
              physicalReadCount: 0,
              physicalBytesRead: 0,
              physicalReadMs: 0,
            },
          };
      for (const [channelId, range] of delegated.ranges) {
        this.retainFullColumn(channelId, range);
      }
      return delegated;
    }

    const ranges = new Map<string, NumericChannelRange>();
    const persistentHits: string[] = [];
    const misses: string[] = [];
    const now = (): number => globalThis.performance?.now() ?? Date.now();
    let persistentLookupMs = 0;
    let persistentRangeBuildMs = 0;

    for (const channelId of channelIds) {
      const lookupStarted = now();
      const persisted = await this.persistedColumn(channelId);
      persistentLookupMs += now() - lookupStarted;
      if (!persisted) {
        misses.push(channelId);
        continue;
      }
      persistentHits.push(channelId);
      const rangeStarted = now();
      ranges.set(
        channelId,
        buildRange(startSampleIndex, sampleCount, persisted, this.timeMs, this.validity),
      );
      persistentRangeBuildMs += now() - rangeStarted;
    }

    let physicalReadCount = 0;
    let physicalBytesRead = 0;
    let physicalReadMs = 0;
    let delegatedSourceMs = 0;
    let delegatedPerformance: NumericChannelBatchResult['performance'] | undefined;
    const delegatedCacheHits: string[] = [];

    if (misses.length > 0) {
      const delegatedStarted = now();
      const delegated = await this.source.readChannelsRange(misses, startSampleIndex, sampleCount);
      delegatedSourceMs = now() - delegatedStarted;
      delegatedPerformance = delegated.performance;
      physicalReadCount = delegated.performance.physicalReadCount;
      physicalBytesRead = delegated.performance.physicalBytesRead;
      physicalReadMs = delegated.performance.physicalReadMs;
      delegatedCacheHits.push(...delegated.performance.cacheHitChannelIds);
      for (const [channelId, range] of delegated.ranges) {
        ranges.set(channelId, range);
        if (channelIds.length <= MAX_PERSISTED_SELECTION_BATCH) {
          this.persistFullColumn(channelId, range);
        }
      }
    }

    return {
      ranges,
      performance: {
        channelCount: channelIds.length,
        cacheHitChannelIds: [...persistentHits, ...delegatedCacheHits],
        physicalReadCount,
        physicalBytesRead,
        physicalReadMs,
        persistentLookupMs,
        persistentRangeBuildMs,
        delegatedSourceMs,
        ...(delegatedPerformance?.sidecarManifestMs !== undefined ? { sidecarManifestMs: delegatedPerformance.sidecarManifestMs } : {}),
        ...(delegatedPerformance?.sidecarFileOpenAggregateMs !== undefined ? { sidecarFileOpenAggregateMs: delegatedPerformance.sidecarFileOpenAggregateMs } : {}),
        ...(delegatedPerformance?.sidecarBlobReadAggregateMs !== undefined ? { sidecarBlobReadAggregateMs: delegatedPerformance.sidecarBlobReadAggregateMs } : {}),
        ...(delegatedPerformance?.sidecarDecodeAggregateMs !== undefined ? { sidecarDecodeAggregateMs: delegatedPerformance.sidecarDecodeAggregateMs } : {}),
        ...(delegatedPerformance?.sidecarRangeBuildMs !== undefined ? { sidecarRangeBuildMs: delegatedPerformance.sidecarRangeBuildMs } : {}),
      },
    };
  }
}

export function createPersistentColumnCacheDataSource(
  source: NumericChannelDataSource,
  logKey: string,
  timeMs: Float64Array,
  validity: Uint8Array,
): NumericChannelDataSource {
  if (typeof globalThis.indexedDB === 'undefined') return source;
  return new PersistentColumnCacheDataSource(
    source,
    logKey,
    timeMs,
    validity,
    new IndexedDbPersistentChannelColumnStore(),
  );
}
