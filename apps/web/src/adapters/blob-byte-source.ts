import {
  validateReadRange,
  type RandomAccessByteSource,
} from '../../../../core/parsers/byte-source';

export class BlobByteSource implements RandomAccessByteSource {
  readonly size: number;
  private readonly blob: Blob;

  public constructor(blob: Blob) {
    this.blob = blob;
    this.size = blob.size;
  }

  public async read(offset: number, length: number): Promise<Uint8Array> {
    validateReadRange(this.size, offset, length);
    const buffer = await this.blob.slice(offset, offset + length).arrayBuffer();
    return new Uint8Array(buffer);
  }
}
