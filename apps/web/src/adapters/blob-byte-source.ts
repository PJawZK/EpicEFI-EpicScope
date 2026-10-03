import {
  validateReadRange,
  type RandomAccessByteSource,
} from '../../../../core/parsers/byte-source';

const CACHE_PAGE_SIZE = 16 * 1024 * 1024;
const CACHE_LIMIT_BYTES = 96 * 1024 * 1024;
const PINNED_CACHE_LIMIT_BYTES = CACHE_LIMIT_BYTES - CACHE_PAGE_SIZE;
const MAX_PHYSICAL_READ_DIAGNOSTICS = 512;

export interface BlobPhysicalReadDiagnostic {
  readonly offset: number;
  readonly bytes: number;
  readonly durationMs: number;
}

export interface BlobByteSourceRuntimeDiagnostics {
  readonly scope: 'main-thread-source-lifetime';
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

  public constructor(blob: Blob) {
    this.blob = blob;
    this.size = blob.size;
    this.preferredReadAlignmentBytes = this.size > CACHE_LIMIT_BYTES
      ? CACHE_PAGE_SIZE
      : undefined;
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

    const start = pageIndex * CACHE_PAGE_SIZE;
    const length = Math.min(CACHE_PAGE_SIZE, this.size - start);
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
    // - the first ~80 MiB admitted stays pinned between sequential passes;
    // - one 16 MiB rolling page preserves the boundary page for the next batch.
    //
    // Larger backing pages reduce Blob.slice().arrayBuffer() calls while the
    // decoder's preferred-read hint keeps channel extraction inside one page
    // whenever possible, avoiding cross-page join/copy work.
    if (this.cacheBytesValue + length <= PINNED_CACHE_LIMIT_BYTES) {
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

    const firstPageIndex = Math.floor(offset / CACHE_PAGE_SIZE);
    const lastPageIndex = Math.floor((offset + length - 1) / CACHE_PAGE_SIZE);

    if (firstPageIndex === lastPageIndex) {
      const loaded = await this.page(firstPageIndex);
      const pageStart = firstPageIndex * CACHE_PAGE_SIZE;
      const relativeStart = offset - pageStart;
      if (loaded.cacheHit) this.cacheHitBytesValue += length;
      return loaded.page.bytes.subarray(relativeStart, relativeStart + length);
    }

    const output = new Uint8Array(length);
    let outputOffset = 0;
    let sourceOffset = offset;

    for (let pageIndex = firstPageIndex; pageIndex <= lastPageIndex; pageIndex += 1) {
      const loaded = await this.page(pageIndex);
      const pageStart = pageIndex * CACHE_PAGE_SIZE;
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
    return {
      scope: 'main-thread-source-lifetime',
      pageSizeBytes: CACHE_PAGE_SIZE,
      cacheLimitBytes: CACHE_LIMIT_BYTES,
      pinnedCacheLimitBytes: PINNED_CACHE_LIMIT_BYTES,
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
