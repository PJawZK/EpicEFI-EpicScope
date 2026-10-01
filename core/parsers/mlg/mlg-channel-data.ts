import type {
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../log-model/log-types';
import type { RandomAccessByteSource } from '../byte-source';
import type { MlgFieldDescriptor } from './mlg-format';
import type { MlgRecordIndex } from './mlg-records';

const BLOCK_HEADER_LENGTH = 4;
const MAX_BATCH_SPAN = 256 * 1024;

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
  if (field.kind === 'bitfield') {
    return rawValue;
  }
  return (rawValue + field.transform) * field.scale;
}

export class MlgNumericChannelDataSource implements NumericChannelDataSource {
  readonly sampleCount: number;

  private readonly source: RandomAccessByteSource;
  private readonly fields: readonly MlgFieldDescriptor[];
  private readonly recordIndex: MlgRecordIndex;
  private readonly fieldOffsets: Uint32Array;
  private readonly channelIndexById = new Map<string, number>();

  public constructor(
    source: RandomAccessByteSource,
    fields: readonly MlgFieldDescriptor[],
    recordIndex: MlgRecordIndex,
  ) {
    this.source = source;
    this.fields = fields;
    this.recordIndex = recordIndex;
    this.sampleCount = recordIndex.offsets.length;
    this.fieldOffsets = new Uint32Array(fields.length);

    let fieldOffset = 0;
    fields.forEach((field, index) => {
      this.fieldOffsets[index] = fieldOffset;
      fieldOffset += field.widthBytes;
      this.channelIndexById.set(`mlg:${index}`, index);
    });
  }

  public async readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange> {
    if (!Number.isSafeInteger(startSampleIndex) || startSampleIndex < 0) {
      throw new RangeError(`Invalid start sample index: ${startSampleIndex}`);
    }
    if (!Number.isSafeInteger(sampleCount) || sampleCount < 0) {
      throw new RangeError(`Invalid sample count: ${sampleCount}`);
    }
    if (startSampleIndex > this.sampleCount || sampleCount > this.sampleCount - startSampleIndex) {
      throw new RangeError(
        `Sample range [${startSampleIndex}, ${startSampleIndex + sampleCount}) exceeds ${this.sampleCount} samples.`,
      );
    }

    const fieldIndex = this.channelIndexById.get(channelId);
    if (fieldIndex === undefined) {
      throw new RangeError(`Unknown channel id: ${channelId}`);
    }
    const field = this.fields[fieldIndex];
    if (!field) {
      throw new RangeError(`Missing field definition for channel id: ${channelId}`);
    }
    const fieldOffset = this.fieldOffsets[fieldIndex] ?? 0;
    const timeMs = this.recordIndex.timeMs.slice(
      startSampleIndex,
      startSampleIndex + sampleCount,
    );
    const validity = this.recordIndex.crcValid.slice(
      startSampleIndex,
      startSampleIndex + sampleCount,
    );
    const values = new Float64Array(sampleCount);

    let outputIndex = 0;
    const endSampleIndex = startSampleIndex + sampleCount;
    while (startSampleIndex + outputIndex < endSampleIndex) {
      const batchFirstIndex = startSampleIndex + outputIndex;
      const firstRecordOffset = this.recordIndex.offsets[batchFirstIndex];
      if (firstRecordOffset === undefined) {
        throw new RangeError(`Missing record offset for sample ${batchFirstIndex}.`);
      }
      const batchStartByte = firstRecordOffset + BLOCK_HEADER_LENGTH + fieldOffset;

      let batchLastIndex = batchFirstIndex;
      let batchEndByte = batchStartByte + field.widthBytes;
      while (batchLastIndex + 1 < endSampleIndex) {
        const nextIndex = batchLastIndex + 1;
        const nextRecordOffset = this.recordIndex.offsets[nextIndex];
        if (nextRecordOffset === undefined) {
          break;
        }
        const nextEndByte = nextRecordOffset
          + BLOCK_HEADER_LENGTH
          + fieldOffset
          + field.widthBytes;
        if (nextEndByte - batchStartByte > MAX_BATCH_SPAN) {
          break;
        }
        batchLastIndex = nextIndex;
        batchEndByte = nextEndByte;
      }

      const bytes = await this.source.read(batchStartByte, batchEndByte - batchStartByte);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      for (let sampleIndex = batchFirstIndex; sampleIndex <= batchLastIndex; sampleIndex += 1) {
        const recordOffset = this.recordIndex.offsets[sampleIndex];
        if (recordOffset === undefined) {
          throw new RangeError(`Missing record offset for sample ${sampleIndex}.`);
        }
        const valueOffset = recordOffset
          + BLOCK_HEADER_LENGTH
          + fieldOffset
          - batchStartByte;
        values[sampleIndex - startSampleIndex] = displayValue(
          decodeRawValue(view, valueOffset, field),
          field,
        );
      }

      outputIndex += batchLastIndex - batchFirstIndex + 1;
    }

    return {
      startSampleIndex,
      timeMs,
      values,
      validity,
    };
  }
}
