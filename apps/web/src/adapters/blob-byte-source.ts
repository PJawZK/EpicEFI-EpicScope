import {
  validateReadRange,
  type RandomAccessByteSource,
} from '../../../../core/parsers/byte-source';

const CACHE_PAGE_SIZE = 8 * 1024 * 1024;
const CACHE_LIMIT_BYTES = 96 * 1024 * 1024;

interface CachedPage {
  readonly index: number;
  readonly bytes: Uint8Array;
  lastUsed: number;
}

export interface BlobByteSourceStats {
  readonly readCount: number;
  readonly bytesRead: number;
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly cacheHitBytes: number;
  readonly cacheBytes: number;
  readonly cachePageCount: number;
}

export class BlobByteSource implements RandomAccessByteSource {
  readonly size: number;
  private readonly blob: Blob;
  private readCountValue = 0;
  private bytesReadValue = 0;
  private physicalReadCountValue = 0;
  private physicalBytesReadValue = 0;
  private cacheHitBytesValue = 0;
  private cacheBytesValue = 0;
  private useCounter = 0;
  private readonly pages = new Map<number, CachedPage>();

  public constructor(blob: Blob) {
    this.blob = blob;
    this.size = blob.size;
  }

  private touch(page: CachedPage): void {
    this.useCounter += 1;
    page.lastUsed = this.useCounter;
  }

  private evictIfNeeded(): void {
    while (this.cacheBytesValue > CACHE_LIMIT_BYTES && this.pages.size > 1) {
      let oldest: CachedPage | undefined;
      for (const page of this.pages.values()) {
        if (!oldest || page.lastUsed < oldest.lastUsed) oldest = page;
      }
      if (!oldest) break;
      this.pages.delete(oldest.index);
      this.cacheBytesValue -= oldest.bytes.byteLength;
    }
  }

  private async page(pageIndex: number): Promise<{ page: CachedPage; cacheHit: boolean }> {
    const cached = this.pages.get(pageIndex);
    if (cached) {
      this.touch(cached);
      return { page: cached, cacheHit: true };
    }

    const start = pageIndex * CACHE_PAGE_SIZE;
    const length = Math.min(CACHE_PAGE_SIZE, this.size - start);
    const buffer = await this.blob.slice(start, start + length).arrayBuffer();
    const page: CachedPage = {
      index: pageIndex,
      bytes: new Uint8Array(buffer),
      lastUsed: 0,
    };
    this.physicalReadCountValue += 1;
    this.physicalBytesReadValue += length;
    this.cacheBytesValue += length;
    this.touch(page);
    this.pages.set(pageIndex, page);
    this.evictIfNeeded();
    return { page, cacheHit: false };
  }

  public async read(offset: number, length: number): Promise<Uint8Array> {
    validateReadRange(this.size, offset, length);
    this.readCountValue += 1;
    this.bytesReadValue += length;
    if (length === 0) return new Uint8Array(0);

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

  public stats(): BlobByteSourceStats {
    return {
      readCount: this.readCountValue,
      bytesRead: this.bytesReadValue,
      physicalReadCount: this.physicalReadCountValue,
      physicalBytesRead: this.physicalBytesReadValue,
      cacheHitBytes: this.cacheHitBytesValue,
      cacheBytes: this.cacheBytesValue,
      cachePageCount: this.pages.size,
    };
  }
}
