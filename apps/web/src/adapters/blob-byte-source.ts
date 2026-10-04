import {
  validateReadRange,
  type RandomAccessByteSource,
} from '../../../../core/parsers/byte-source';
import { latestBoundCacheDiagnosticSnapshot } from '../../../../core/channels/bound-cache-observability';

const DEFAULT_CACHE_PAGE_SIZE = 32 * 1024 * 1024;
const CACHE_LIMIT_BYTES = 96 * 1024 * 1024;
const MAX_PHYSICAL_READ_DIAGNOSTICS = 512;

export interface BlobPhysicalReadDiagnostic {
  readonly offset: number;
  readonly bytes: number;
  readonly durationMs: number;
}

export interface BlobByteSourceRuntimeDiagnostics {
  readonly scope: string;
  readonly pageSizeBytes: number;
  readonly cacheLimitBytes: number;
  readonly pinnedCacheLimitBytes: number;
  readonly physicalReadCount: number;
  readonly physicalReadMs: number;
  readonly physicalReadMinMs: number;
  readonly physicalReadAverageMs: number;
  readonly physicalReadMaxMs: number;
  readonly slowestReads: readonly BlobPhysicalReadDiagnostic[];
}

let latestBlobByteSource: BlobByteSource | undefined;

export function latestBlobByteSourceRuntimeDiagnostics(): BlobByteSourceRuntimeDiagnostics | undefined {
  return latestBlobByteSource?.runtimeDiagnostics();
}

interface CachedPage {
  readonly index: number;
  readonly bytes: Uint8Array;
}

export interface BlobByteSourceCacheSeedPage {
  readonly index: number;
  readonly bytes: Uint8Array;
}

export interface BlobByteSourceOptions {
  readonly pageSizeBytes?: number;
  readonly cacheSeedPages?: readonly BlobByteSourceCacheSeedPage[];
}

export interface BlobByteSourceStats {
  readonly readCount: number;
  readonly bytesRead: number;
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly cacheHitBytes: number;
  readonly cacheBytes: number;
  readonly cachePageCount: number;
  readonly physicalReadMs: number;
}

export class BlobByteSource implements RandomAccessByteSource {
  readonly size: number;
  readonly preferredReadAlignmentBytes: number | undefined;
  private readonly blob: Blob;
  private readonly pageSizeBytes: number;
  private readonly pinnedCacheLimitBytes: number;
  private readCountValue = 0;
  private bytesReadValue = 0;
  private physicalReadCountValue = 0;
  private physicalBytesReadValue = 0;
  private cacheHitBytesValue = 0;
  private cacheBytesValue = 0;
  private physicalReadMsValue = 0;
  private readonly physicalReadDiagnostics: BlobPhysicalReadDiagnostic[] = [];
  private wholeBuffer: Uint8Array | undefined;
  private wholeBufferPromise: Promise<Uint8Array> | undefined;
  private readonly pages = new Map<number, CachedPage>();
  private transientPage: CachedPage | undefined;

  public constructor(blob: Blob, options: BlobByteSourceOptions = {}) {
    this.blob = blob;
    this.size = blob.size;
    this.pageSizeBytes = options.pageSizeBytes ?? DEFAULT_CACHE_PAGE_SIZE;
    if (!Number.isFinite(this.pageSizeBytes) || this.pageSizeBytes <= 0 || this.pageSizeBytes > CACHE_LIMIT_BYTES) {
      throw new RangeError(`Invalid Blob page size: ${this.pageSizeBytes}`);
    }
    this.pinnedCacheLimitBytes = CACHE_LIMIT_BYTES - this.pageSizeBytes;
    this.preferredReadAlignmentBytes = this.size > CACHE_LIMIT_BYTES
      ? this.pageSizeBytes
      : undefined;

    if (this.size > CACHE_LIMIT_BYTES && options.cacheSeedPages) {
      for (const seed of options.cacheSeedPages) {
        const start = seed.index * this.pageSizeBytes;
        const expectedLength = Math.min(this.pageSizeBytes, this.size - start);
        if (
          !Number.isSafeInteger(seed.index)
          || seed.index < 0
          || start < 0
          || start >= this.size
          || seed.bytes.byteLength !== expectedLength
        ) {
          continue;
        }
        if (this.cacheBytesValue + seed.bytes.byteLength > this.pinnedCacheLimitBytes) break;
        this.pages.set(seed.index, { index: seed.index, bytes: seed.bytes });
        this.cacheBytesValue += seed.bytes.byteLength;
      }
    }

    latestBlobByteSource = this;
  }

  private recordPhysicalRead(offset: number, bytes: number, durationMs: number): void {
    this.physicalReadDiagnostics.push({ offset, bytes, durationMs });
    if (this.physicalReadDiagnostics.length > MAX_PHYSICAL_READ_DIAGNOSTICS) {
      this.physicalReadDiagnostics.shift();
    }
  }

  private async loadWholeBuffer(): Promise<Uint8Array> {
    if (this.wholeBuffer) return this.wholeBuffer;
    if (!this.wholeBufferPromise) {
      const started = globalThis.performance?.now() ?? Date.now();
      this.wholeBufferPromise = this.blob.arrayBuffer().then((buffer) => {
        const durationMs = (globalThis.performance?.now() ?? Date.now()) - started;
        this.physicalReadMsValue += durationMs;
        this.recordPhysicalRead(0, buffer.byteLength, durationMs);
        const bytes = new Uint8Array(buffer);
        this.wholeBuffer = bytes;
        this.cacheBytesValue = bytes.byteLength;
        this.physicalReadCountValue += 1;
        this.physicalBytesReadValue += bytes.byteLength;
        return bytes;
      });
    }
    return this.wholeBufferPromise;
  }

  private async page(pageIndex: number): Promise<{ page: CachedPage; cacheHit: boolean }> {
    const cached = this.pages.get(pageIndex);
    if (cached) return { page: cached, cacheHit: true };
    if (this.transientPage?.index === pageIndex) {
      return { page: this.transientPage, cacheHit: true };
    }

    const start = pageIndex * this.pageSizeBytes;
    const length = Math.min(this.pageSizeBytes, this.size - start);
    const readStarted = globalThis.performance?.now() ?? Date.now();
    const buffer = await this.blob.slice(start, start + length).arrayBuffer();
    const durationMs = (globalThis.performance?.now() ?? Date.now()) - readStarted;
    this.physicalReadMsValue += durationMs;
    this.recordPhysicalRead(start, length, durationMs);
    const page: CachedPage = {
      index: pageIndex,
      bytes: new Uint8Array(buffer),
    };
    this.physicalReadCountValue += 1;
    this.physicalBytesReadValue += length;

    // Large logs use a two-tier cache while keeping the total raw-cache
    // budget fixed at 96 MiB:
    // - the first ~64 MiB admitted stays pinned between sequential passes;
    // - one 32 MiB rolling page preserves the boundary page for the next batch.
    //
    // Larger backing pages reduce Blob.slice().arrayBuffer() calls while the
    // decoder's preferred-read hint keeps channel extraction inside one page
    // whenever possible, avoiding cross-page join/copy work.
    if (this.cacheBytesValue + length <= this.pinnedCacheLimitBytes) {
      this.pages.set(pageIndex, page);
      this.cacheBytesValue += length;
    } else {
      this.transientPage = page;
    }

    return { page, cacheHit: false };
  }

  public async read(offset: number, length: number): Promise<Uint8Array> {
    validateReadRange(this.size, offset, length);
    this.readCountValue += 1;
    this.bytesReadValue += length;
    if (length === 0) return new Uint8Array(0);

    // Small/medium logs that already fit within the raw-cache budget use one
    // contiguous backing buffer. This costs no more memory than caching all
    // pages, but avoids repeated cross-page joins/copies during record scans
    // and channel extraction.
    if (this.size <= CACHE_LIMIT_BYTES) {
      const wasCached = this.wholeBuffer !== undefined;
      const bytes = await this.loadWholeBuffer();
      if (wasCached) this.cacheHitBytesValue += length;
      return bytes.subarray(offset, offset + length);
    }

    const firstPageIndex = Math.floor(offset / this.pageSizeBytes);
    const lastPageIndex = Math.floor((offset + length - 1) / this.pageSizeBytes);

    if (firstPageIndex === lastPageIndex) {
      const loaded = await this.page(firstPageIndex);
      const pageStart = firstPageIndex * this.pageSizeBytes;
      const relativeStart = offset - pageStart;
      if (loaded.cacheHit) this.cacheHitBytesValue += length;
      return loaded.page.bytes.subarray(relativeStart, relativeStart + length);
    }

    const output = new Uint8Array(length);
    let outputOffset = 0;
    let sourceOffset = offset;

    for (let pageIndex = firstPageIndex; pageIndex <= lastPageIndex; pageIndex += 1) {
      const loaded = await this.page(pageIndex);
      const pageStart = pageIndex * this.pageSizeBytes;
      const relativeStart = Math.max(0, sourceOffset - pageStart);
      const available = loaded.page.bytes.byteLength - relativeStart;
      const copyLength = Math.min(available, length - outputOffset);
      output.set(
        loaded.page.bytes.subarray(relativeStart, relativeStart + copyLength),
        outputOffset,
      );
      if (loaded.cacheHit) this.cacheHitBytesValue += copyLength;
      outputOffset += copyLength;
      sourceOffset += copyLength;
    }

    return output;
  }

  public async warmCache(): Promise<void> {
    if (this.size <= CACHE_LIMIT_BYTES && this.size > 0) {
      await this.loadWholeBuffer();
    }
  }

  public takePinnedCacheSeed(): readonly BlobByteSourceCacheSeedPage[] {
    if (this.wholeBuffer || this.pages.size === 0) return [];
    const seed = [...this.pages.values()]
      .sort((left, right) => left.index - right.index)
      .map((page) => ({ index: page.index, bytes: page.bytes }));
    this.pages.clear();
    this.cacheBytesValue = 0;
    return seed;
  }

  public performanceSnapshot(): {
    physicalReadMs: number;
    physicalReadCount: number;
    physicalBytesRead: number;
  } {
    return {
      physicalReadMs: this.physicalReadMsValue,
      physicalReadCount: this.physicalReadCountValue,
      physicalBytesRead: this.physicalBytesReadValue,
    };
  }

  public runtimeDiagnostics(): BlobByteSourceRuntimeDiagnostics {
    const durations = this.physicalReadDiagnostics.map((read) => read.durationMs);
    const count = durations.length;
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    const slowestReads = [...this.physicalReadDiagnostics]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 5);
    const boundCache = latestBoundCacheDiagnosticSnapshot();
    const cacheLines = [
      `build=${import.meta.env.VITE_EPICSCOPE_BUILD_SHA ?? 'local'}`,
      '[Bound channel cache]',
      `boundInstances=${boundCache.boundInstances}`,
      `rawSources=${boundCache.rawSources}`,
      `retainAttempts=${boundCache.retainAttempts}`,
      `retainSuccesses=${boundCache.retainSuccesses}`,
      `hasCacheChecks=${boundCache.hasCacheChecks}`,
      ...boundCache.recentEvents.map((event) =>
        `event=${event.sequence};kind=${event.kind};bound=${event.boundInstanceId};source=${event.sourceInstanceId};channels=${event.channelIds.join(',')};sourceChannels=${event.sourceChannelIds.join(',')};resident=${event.residentCount};residentIds=${event.residentSourceIds.join(',')};start=${event.startSampleIndex ?? '-'};samples=${event.sampleCount ?? '-'};retained=${event.retained ?? '-'};cacheReady=${event.cacheReady ?? '-'};cacheHits=${event.cacheHitChannelIds?.join(',') ?? '-'};physicalReads=${event.physicalReadCount ?? '-'};physicalBytes=${event.physicalBytesRead ?? '-'}`,
      ),
    ];
    return {
      scope: ['main-thread-source-lifetime', ...cacheLines].join('\n'),
      pageSizeBytes: this.pageSizeBytes,
      cacheLimitBytes: CACHE_LIMIT_BYTES,
      pinnedCacheLimitBytes: this.pinnedCacheLimitBytes,
      physicalReadCount: count,
      physicalReadMs: total,
      physicalReadMinMs: count > 0 ? Math.min(...durations) : 0,
      physicalReadAverageMs: count > 0 ? total / count : 0,
      physicalReadMaxMs: count > 0 ? Math.max(...durations) : 0,
      slowestReads,
    };
  }

  public stats(): BlobByteSourceStats {
    return {
      readCount: this.readCountValue,
      bytesRead: this.bytesReadValue,
      physicalReadCount: this.physicalReadCountValue,
      physicalBytesRead: this.physicalBytesReadValue,
      cacheHitBytes: this.cacheHitBytesValue,
      cacheBytes: this.wholeBuffer
        ? this.cacheBytesValue
        : this.cacheBytesValue + (this.transientPage?.bytes.byteLength ?? 0),
      cachePageCount: this.wholeBuffer
        ? 1
        : this.pages.size + (this.transientPage ? 1 : 0),
      physicalReadMs: this.physicalReadMsValue,
    };
  }
}
