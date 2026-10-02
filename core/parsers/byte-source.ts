export interface ByteSourcePerformanceSnapshot {
  readonly physicalReadMs: number;
  readonly physicalReadCount?: number;
  readonly physicalBytesRead?: number;
}

export interface RandomAccessByteSource {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
  performanceSnapshot?(): ByteSourcePerformanceSnapshot;
}

export class ByteSourceRangeError extends RangeError {
  public constructor(message: string) {
    super(message);
    this.name = 'ByteSourceRangeError';
  }
}

export function validateReadRange(size: number, offset: number, length: number): void {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new ByteSourceRangeError(`Invalid source size: ${size}`);
  }

  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new ByteSourceRangeError(`Invalid read offset: ${offset}`);
  }

  if (!Number.isSafeInteger(length) || length < 0) {
    throw new ByteSourceRangeError(`Invalid read length: ${length}`);
  }

  if (offset > size || length > size - offset) {
    throw new ByteSourceRangeError(
      `Read range [${offset}, ${offset + length}) exceeds source size ${size}`,
    );
  }
}

export class MemoryByteSource implements RandomAccessByteSource {
  readonly size: number;
  private readonly bytes: Uint8Array;

  public constructor(bytes: Uint8Array) {
    this.bytes = bytes.slice();
    this.size = this.bytes.byteLength;
  }

  public async read(offset: number, length: number): Promise<Uint8Array> {
    validateReadRange(this.size, offset, length);
    return this.bytes.slice(offset, offset + length);
  }
}
