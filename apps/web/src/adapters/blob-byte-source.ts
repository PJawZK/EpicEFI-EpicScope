import {
  validateReadRange,
  type RandomAccessByteSource,
} from '../../../../core/parsers/byte-source';

export interface BlobByteSourceStats {
  readonly readCount: number;
  readonly bytesRead: number;
}

export class BlobByteSource implements RandomAccessByteSource {
  readonly size: number;
  private readonly blob: Blob;
  private readCountValue = 0;
  private bytesReadValue = 0;

  public constructor(blob: Blob) {
    this.blob = blob;
    this.size = blob.size;
  }

  public async read(offset: number, length: number): Promise<Uint8Array> {
    validateReadRange(this.size, offset, length);
    this.readCountValue += 1;
    this.bytesReadValue += length;
    const buffer = await this.blob.slice(offset, offset + length).arrayBuffer();
    return new Uint8Array(buffer);
  }

  public stats(): BlobByteSourceStats {
    return {
      readCount: this.readCountValue,
      bytesRead: this.bytesReadValue,
    };
  }
}
