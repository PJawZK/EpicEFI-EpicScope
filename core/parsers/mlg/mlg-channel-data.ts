import type {
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../log-model/log-types';
import type { RandomAccessByteSource } from '../byte-source';
import type { MlgFieldDescriptor } from './mlg-format';
import type { MlgRecordIndex } from './mlg-records';

const BLOCK_HEADER_LENGTH = 4;
const MAX_BATCH_SPAN = 8 * 1024 * 1024;
const DECODED_CHANNEL_CACHE_LIMIT = 32 * 1024 * 1024;

interface ResolvedChannel {
  readonly channelId: string;
  readonly field: MlgFieldDescriptor;
  readonly fieldOffset: number;
  readonly values: Float64Array;
}

interface CachedChannel {
  readonly range: NumericChannelRange;
  readonly bytes: number;
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
  if (field.kind === 'bitfield') return rawValue;
  return (rawValue + field.transform) * field.scale;
}

export class MlgNumericChannelDataSource implements NumericChannelDataSource {
  readonly sampleCount: number;
  readonly preferredBatchWindowMs: number;

  private readonly source: RandomAccessByteSource;
  private readonly fields: readonly MlgFieldDescriptor[];
  private readonly recordIndex: MlgRecordIndex;
  private readonly fieldOffsets: Uint32Array;
  private readonly channelIndexById = new Map<string, number>();
  private readonly decodedCache = new Map<string, CachedChannel>();
  private decodedCacheBytes = 0;

  public constructor(
    source: RandomAccessByteSource,
    fields: readonly MlgFieldDescriptor[],
    recordIndex: MlgRecordIndex,
  ) {
    this.source = source;
    this.fields = fields;
    this.recordIndex = recordIndex;
    this.sampleCount = recordIndex.offsets.length;
    this.preferredBatchWindowMs = source.size > 128 * 1024 * 1024 ? 400 : 0;
    this.fieldOffsets = new Uint32Array(fields.length);

    let fieldOffset = 0;
    fields.forEach((field, index) => {
      this.fieldOffsets[index] = fieldOffset;
      fieldOffset += field.widthBytes;
      this.channelIndexById.set(`mlg:${index}`, index);
    });
  }

  private validateRange(startSampleIndex: number, sampleCount: number): void {
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
  }

  private resolveChannel(channelId: string, sampleCount: number): ResolvedChannel {
    const fieldIndex = this.channelIndexById.get(channelId);
    if (fieldIndex === undefined) {
      throw new RangeError(`Unknown channel id: ${channelId}`);
    }
    const field = this.fields[fieldIndex];
    if (!field) {
      throw new RangeError(`Missing field definition for channel id: ${channelId}`);
    }
    return {
      channelId,
      field,
      fieldOffset: this.fieldOffsets[fieldIndex] ?? 0,
      values: new Float64Array(sampleCount),
    };
  }

  private cached(channelId: string): NumericChannelRange | undefined {
    const entry = this.decodedCache.get(channelId);
    if (!entry) return undefined;
    this.decodedCache.delete(channelId);
    this.decodedCache.set(channelId, entry);
    return entry.range;
  }

  private cache(channelId: string, range: NumericChannelRange): void {
    const bytes = range.values.byteLength;
    if (bytes > DECODED_CHANNEL_CACHE_LIMIT) return;

    const previous = this.decodedCache.get(channelId);
    if (previous) {
      this.decodedCache.delete(channelId);
      this.decodedCacheBytes -= previous.bytes;
    }

    while (
      this.decodedCache.size > 0
      && this.decodedCacheBytes + bytes > DECODED_CHANNEL_CACHE_LIMIT
    ) {
      const oldestId = this.decodedCache.keys().next().value as string | undefined;
      if (!oldestId) break;
      const oldest = this.decodedCache.get(oldestId);
      this.decodedCache.delete(oldestId);
      this.decodedCacheBytes -= oldest?.bytes ?? 0;
    }

    this.decodedCache.set(channelId, { range, bytes });
    this.decodedCacheBytes += bytes;
  }

  private async decodeChannels(
    channels: readonly ResolvedChannel[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<ReadonlyMap<string, NumericChannelRange>> {
    const ranges = new Map<string, NumericChannelRange>();
    if (channels.length === 0) return ranges;

    const isFullRange = startSampleIndex === 0 && sampleCount === this.sampleCount;
    const timeMs = isFullRange
      ? this.recordIndex.timeMs
      : this.recordIndex.timeMs.slice(startSampleIndex, startSampleIndex + sampleCount);
    const validity = isFullRange
      ? this.recordIndex.crcValid
      : this.recordIndex.crcValid.slice(startSampleIndex, startSampleIndex + sampleCount);

    if (sampleCount > 0) {
      const minFieldOffset = Math.min(...channels.map((channel) => channel.fieldOffset));
      const maxFieldEnd = Math.max(
        ...channels.map((channel) => channel.fieldOffset + channel.field.widthBytes),
      );

      let outputIndex = 0;
      const endSampleIndex = startSampleIndex + sampleCount;
      while (startSampleIndex + outputIndex < endSampleIndex) {
        const batchFirstIndex = startSampleIndex + outputIndex;
        const firstRecordOffset = this.recordIndex.offsets[batchFirstIndex];
        if (firstRecordOffset === undefined) {
          throw new RangeError(`Missing record offset for sample ${batchFirstIndex}.`);
        }
        const batchStartByte = firstRecordOffset + BLOCK_HEADER_LENGTH + minFieldOffset;

        let batchLastIndex = batchFirstIndex;
        let batchEndByte = firstRecordOffset + BLOCK_HEADER_LENGTH + maxFieldEnd;
        while (batchLastIndex + 1 < endSampleIndex) {
          const nextIndex = batchLastIndex + 1;
          const nextRecordOffset = this.recordIndex.offsets[nextIndex];
          if (nextRecordOffset === undefined) break;
          const nextEndByte = nextRecordOffset + BLOCK_HEADER_LENGTH + maxFieldEnd;
          if (nextEndByte - batchStartByte > MAX_BATCH_SPAN) break;
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
          for (const channel of channels) {
            const valueOffset = recordOffset
              + BLOCK_HEADER_LENGTH
              + channel.fieldOffset
              - batchStartByte;
            channel.values[sampleIndex - startSampleIndex] = displayValue(
              decodeRawValue(view, valueOffset, channel.field),
              channel.field,
            );
          }
        }

        outputIndex += batchLastIndex - batchFirstIndex + 1;
      }
    }

    for (const channel of channels) {
      ranges.set(channel.channelId, {
        startSampleIndex,
        timeMs,
        values: channel.values,
        validity,
      });
    }
    return ranges;
  }

  public hasCachedChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean {
    return startSampleIndex === 0
      && sampleCount === this.sampleCount
      && this.decodedCache.has(channelId);
  }

  public async readChannelsRange(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult> {
    this.validateRange(startSampleIndex, sampleCount);
    const uniqueIds = [...new Set(channelIds)];
    const isFullRange = startSampleIndex === 0 && sampleCount === this.sampleCount;
    const before = this.source.performanceSnapshot?.();
    const ranges = new Map<string, NumericChannelRange>();
    const cacheHitChannelIds: string[] = [];
    const misses: ResolvedChannel[] = [];

    for (const channelId of uniqueIds) {
      if (isFullRange) {
        const cached = this.cached(channelId);
        if (cached) {
          ranges.set(channelId, cached);
          cacheHitChannelIds.push(channelId);
          continue;
        }
      }
      misses.push(this.resolveChannel(channelId, sampleCount));
    }

    const decoded = await this.decodeChannels(misses, startSampleIndex, sampleCount);
    for (const [channelId, range] of decoded) {
      ranges.set(channelId, range);
      if (isFullRange) this.cache(channelId, range);
    }

    const after = this.source.performanceSnapshot?.();
    return {
      ranges,
      performance: {
        channelCount: uniqueIds.length,
        cacheHitChannelIds,
        physicalReadCount: Math.max(
          0,
          (after?.physicalReadCount ?? 0) - (before?.physicalReadCount ?? 0),
        ),
        physicalBytesRead: Math.max(
          0,
          (after?.physicalBytesRead ?? 0) - (before?.physicalBytesRead ?? 0),
        ),
        physicalReadMs: Math.max(
          0,
          (after?.physicalReadMs ?? 0) - (before?.physicalReadMs ?? 0),
        ),
      },
    };
  }

  public async readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange> {
    const batch = await this.readChannelsRange([channelId], startSampleIndex, sampleCount);
    const range = batch.ranges.get(channelId);
    if (!range) throw new RangeError(`Channel ${channelId} was not decoded.`);
    return range;
  }
}
