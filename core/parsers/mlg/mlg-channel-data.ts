import type {
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../log-model/log-types';
import { recordChannelDecodePerformance } from './channel-decode-performance';
import type { RandomAccessByteSource } from '../byte-source';
import type { MlgFieldDescriptor } from './mlg-format';
import type { MlgRecordIndex } from './mlg-records';

const BLOCK_HEADER_LENGTH = 4;
const MAX_BATCH_SPAN = 8 * 1024 * 1024;
const DECODED_CHANNEL_CACHE_LIMIT = 32 * 1024 * 1024;
const DECODED_CHANNEL_CHUNK_SAMPLES = 8192;

interface ResolvedChannel {
  readonly channelId: string;
  readonly field: MlgFieldDescriptor;
  readonly fieldOffset: number;
  readonly values: Float64Array;
}

interface CachedChannel {
  readonly channelId: string;
  readonly range: NumericChannelRange;
  readonly bytes: number;
}

interface DecodeChannelsPerformance {
  readonly batchCount: number;
  readonly batchPlanMs: number;
  readonly sourceReadAwaitMs: number;
  readonly decodeTransformMs: number;
  readonly resultAssemblyMs: number;
}

interface DecodeChannelsResult {
  readonly ranges: ReadonlyMap<string, NumericChannelRange>;
  readonly performance: DecodeChannelsPerformance;
}

function nowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

export function decodeMlgRawValue(view: DataView, offset: number, field: MlgFieldDescriptor): number {
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

export function displayMlgValue(rawValue: number, field: MlgFieldDescriptor): number {
  if (field.kind === 'bitfield') return rawValue;
  return (rawValue + field.transform) * field.scale;
}

export class MlgNumericChannelDataSource implements NumericChannelDataSource {
  readonly sampleCount: number;
  readonly preferredBatchWindowMs: number;
  readonly requiresExplicitBatchSelection: boolean;

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
    this.requiresExplicitBatchSelection = source.size > 128 * 1024 * 1024;
    this.preferredBatchWindowMs = 0;
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

  private cacheKey(channelId: string, startSampleIndex: number, sampleCount: number): string {
    return `${channelId}:${startSampleIndex}:${sampleCount}`;
  }

  private touchCached(key: string): CachedChannel | undefined {
    const entry = this.decodedCache.get(key);
    if (!entry) return undefined;
    this.decodedCache.delete(key);
    this.decodedCache.set(key, entry);
    return entry;
  }

  private cachedEntryContaining(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): readonly [string, CachedChannel] | undefined {
    const requestedEnd = startSampleIndex + sampleCount;
    let match: readonly [string, CachedChannel] | undefined;
    for (const entry of this.decodedCache) {
      const [key, cached] = entry;
      if (cached.channelId !== channelId) continue;
      const cachedStart = cached.range.startSampleIndex;
      const cachedEnd = cachedStart + cached.range.values.length;
      if (startSampleIndex >= cachedStart && requestedEnd <= cachedEnd) match = [key, cached];
    }
    return match;
  }

  private cached(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): NumericChannelRange | undefined {
    const match = this.cachedEntryContaining(channelId, startSampleIndex, sampleCount);
    if (!match) return undefined;
    const [key, entry] = match;
    this.touchCached(key);

    const offset = startSampleIndex - entry.range.startSampleIndex;
    if (offset === 0 && sampleCount === entry.range.values.length) return entry.range;
    const end = offset + sampleCount;
    return {
      startSampleIndex,
      timeMs: entry.range.timeMs.slice(offset, end),
      values: entry.range.values.slice(offset, end),
      validity: entry.range.validity.slice(offset, end),
    };
  }

  private cache(channelId: string, range: NumericChannelRange): void {
    const bytes = range.values.byteLength + range.timeMs.byteLength + range.validity.byteLength;
    if (bytes > DECODED_CHANNEL_CACHE_LIMIT) return;
    const key = this.cacheKey(channelId, range.startSampleIndex, range.values.length);

    const previous = this.decodedCache.get(key);
    if (previous) {
      this.decodedCache.delete(key);
      this.decodedCacheBytes -= previous.bytes;
    }

    while (
      this.decodedCache.size > 0
      && this.decodedCacheBytes + bytes > DECODED_CHANNEL_CACHE_LIMIT
    ) {
      const oldestKey = this.decodedCache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldest = this.decodedCache.get(oldestKey);
      this.decodedCache.delete(oldestKey);
      this.decodedCacheBytes -= oldest?.bytes ?? 0;
    }

    this.decodedCache.set(key, { channelId, range, bytes });
    this.decodedCacheBytes += bytes;
  }

  private async decodeChannels(
    channels: readonly ResolvedChannel[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<DecodeChannelsResult> {
    const ranges = new Map<string, NumericChannelRange>();
    let batchCount = 0;
    let batchPlanMs = 0;
    let sourceReadAwaitMs = 0;
    let decodeTransformMs = 0;
    let resultAssemblyMs = 0;
    if (channels.length === 0) {
      return {
        ranges,
        performance: {
          batchCount,
          batchPlanMs,
          sourceReadAwaitMs,
          decodeTransformMs,
          resultAssemblyMs,
        },
      };
    }

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
        const planStarted = nowMs();
        const batchFirstIndex = startSampleIndex + outputIndex;
        const firstRecordOffset = this.recordIndex.offsets[batchFirstIndex];
        if (firstRecordOffset === undefined) {
          throw new RangeError(`Missing record offset for sample ${batchFirstIndex}.`);
        }
        const batchStartByte = firstRecordOffset + BLOCK_HEADER_LENGTH + minFieldOffset;

        let batchLastIndex = batchFirstIndex;
        let batchEndByte = firstRecordOffset + BLOCK_HEADER_LENGTH + maxFieldEnd;
        const readAlignmentBytes = this.source.preferredReadAlignmentBytes;
        const alignedBoundaryEnd = readAlignmentBytes && readAlignmentBytes > 0
          ? (Math.floor(batchStartByte / readAlignmentBytes) + 1) * readAlignmentBytes
          : undefined;
        while (batchLastIndex + 1 < endSampleIndex) {
          const nextIndex = batchLastIndex + 1;
          const nextRecordOffset = this.recordIndex.offsets[nextIndex];
          if (nextRecordOffset === undefined) break;
          const nextEndByte = nextRecordOffset + BLOCK_HEADER_LENGTH + maxFieldEnd;
          if (nextEndByte - batchStartByte > MAX_BATCH_SPAN) break;
          // A paged source can return a subarray without copying when a read
          // stays within one backing page. Stop before the next page boundary
          // instead of forcing BlobByteSource to allocate/join an ~8 MiB span.
          // If the first record itself crosses a boundary, keep that unavoidable
          // small cross-page read but do not add more records to it.
          if (alignedBoundaryEnd !== undefined && nextEndByte > alignedBoundaryEnd) break;
          batchLastIndex = nextIndex;
          batchEndByte = nextEndByte;
        }
        batchPlanMs += nowMs() - planStarted;
        batchCount += 1;

        const readStarted = nowMs();
        const bytes = await this.source.read(batchStartByte, batchEndByte - batchStartByte);
        sourceReadAwaitMs += nowMs() - readStarted;

        const decodeStarted = nowMs();
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
            channel.values[sampleIndex - startSampleIndex] = displayMlgValue(
              decodeMlgRawValue(view, valueOffset, channel.field),
              channel.field,
            );
          }
        }
        decodeTransformMs += nowMs() - decodeStarted;

        outputIndex += batchLastIndex - batchFirstIndex + 1;
      }
    }

    const assemblyStarted = nowMs();
    for (const channel of channels) {
      ranges.set(channel.channelId, {
        startSampleIndex,
        timeMs,
        values: channel.values,
        validity,
      });
    }
    resultAssemblyMs += nowMs() - assemblyStarted;

    return {
      ranges,
      performance: {
        batchCount,
        batchPlanMs,
        sourceReadAwaitMs,
        decodeTransformMs,
        resultAssemblyMs,
      },
    };
  }

  public sampleRangeForTime(
    startMs: number,
    endMs: number,
  ): { readonly startSampleIndex: number; readonly sampleCount: number } {
    const times = this.recordIndex.timeMs;
    if (times.length === 0) return { startSampleIndex: 0, sampleCount: 0 };

    const lowTarget = Math.min(startMs, endMs);
    const highTarget = Math.max(startMs, endMs);

    let low = 0;
    let high = times.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if ((times[mid] ?? Number.POSITIVE_INFINITY) < lowTarget) low = mid + 1;
      else high = mid;
    }
    const startSampleIndex = Math.max(0, low - 1);

    low = startSampleIndex;
    high = times.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if ((times[mid] ?? Number.NEGATIVE_INFINITY) <= highTarget) low = mid + 1;
      else high = mid;
    }
    const endSampleIndex = Math.min(times.length, low + 1);

    return {
      startSampleIndex,
      sampleCount: Math.max(0, endSampleIndex - startSampleIndex),
    };
  }

  public hasCachedChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean {
    if (this.cachedEntryContaining(channelId, startSampleIndex, sampleCount) !== undefined) return true;
    if (sampleCount === 0) return true;
    const firstChunk = Math.floor(startSampleIndex / DECODED_CHANNEL_CHUNK_SAMPLES);
    const lastChunk = Math.floor((startSampleIndex + sampleCount - 1) / DECODED_CHANNEL_CHUNK_SAMPLES);
    for (let chunkIndex = firstChunk; chunkIndex <= lastChunk; chunkIndex += 1) {
      const chunkStart = chunkIndex * DECODED_CHANNEL_CHUNK_SAMPLES;
      const chunkCount = Math.min(DECODED_CHANNEL_CHUNK_SAMPLES, this.sampleCount - chunkStart);
      if (!this.decodedCache.has(this.cacheKey(channelId, chunkStart, chunkCount))) return false;
    }
    return true;
  }

  private composeCachedChunks(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): NumericChannelRange | undefined {
    const containing = this.cached(channelId, startSampleIndex, sampleCount);
    if (containing) return containing;
    if (sampleCount === 0) {
      return {
        startSampleIndex,
        timeMs: new Float64Array(),
        values: new Float64Array(),
        validity: new Uint8Array(),
      };
    }

    const values = new Float64Array(sampleCount);
    const timeMs = this.recordIndex.timeMs.slice(startSampleIndex, startSampleIndex + sampleCount);
    const validity = this.recordIndex.crcValid.slice(startSampleIndex, startSampleIndex + sampleCount);
    const firstChunk = Math.floor(startSampleIndex / DECODED_CHANNEL_CHUNK_SAMPLES);
    const lastChunk = Math.floor((startSampleIndex + sampleCount - 1) / DECODED_CHANNEL_CHUNK_SAMPLES);

    for (let chunkIndex = firstChunk; chunkIndex <= lastChunk; chunkIndex += 1) {
      const chunkStart = chunkIndex * DECODED_CHANNEL_CHUNK_SAMPLES;
      const chunkCount = Math.min(DECODED_CHANNEL_CHUNK_SAMPLES, this.sampleCount - chunkStart);
      const key = this.cacheKey(channelId, chunkStart, chunkCount);
      const entry = this.touchCached(key);
      if (!entry) return undefined;
      const copyStart = Math.max(startSampleIndex, chunkStart);
      const copyEnd = Math.min(startSampleIndex + sampleCount, chunkStart + chunkCount);
      values.set(
        entry.range.values.subarray(copyStart - chunkStart, copyEnd - chunkStart),
        copyStart - startSampleIndex,
      );
    }

    return { startSampleIndex, timeMs, values, validity };
  }

  public async readChannelsRange(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult> {
    const totalStarted = nowMs();
    this.validateRange(startSampleIndex, sampleCount);
    const uniqueIds = [...new Set(channelIds)];
    const before = this.source.performanceSnapshot?.();
    const ranges = new Map<string, NumericChannelRange>();
    const cacheHitChannelIds: string[] = [];
    let batchCount = 0;
    let batchPlanMs = 0;
    let sourceReadAwaitMs = 0;
    let decodeTransformMs = 0;
    let resultAssemblyMs = 0;

    const cacheResolveStarted = nowMs();
    const isFullRange = startSampleIndex === 0 && sampleCount === this.sampleCount;
    if (isFullRange) {
      const misses: ResolvedChannel[] = [];
      for (const channelId of uniqueIds) {
        const cached = this.cached(channelId, startSampleIndex, sampleCount);
        if (cached) {
          ranges.set(channelId, cached);
          cacheHitChannelIds.push(channelId);
        } else {
          misses.push(this.resolveChannel(channelId, sampleCount));
        }
      }
      const cacheResolveMs = nowMs() - cacheResolveStarted;
      const decoded = await this.decodeChannels(misses, startSampleIndex, sampleCount);
      batchCount += decoded.performance.batchCount;
      batchPlanMs += decoded.performance.batchPlanMs;
      sourceReadAwaitMs += decoded.performance.sourceReadAwaitMs;
      decodeTransformMs += decoded.performance.decodeTransformMs;
      resultAssemblyMs += decoded.performance.resultAssemblyMs;
      const cacheStoreStarted = nowMs();
      for (const [channelId, range] of decoded.ranges) {
        ranges.set(channelId, range);
        this.cache(channelId, range);
      }
      const cacheStoreMs = nowMs() - cacheStoreStarted;
      const after = this.source.performanceSnapshot?.();
      const totalMs = nowMs() - totalStarted;
      recordChannelDecodePerformance({
        recordedAt: Date.now(), channelCount: uniqueIds.length, sampleCount, batchCount, totalMs,
        cacheResolveMs, batchPlanMs, sourceReadAwaitMs, decodeTransformMs, resultAssemblyMs, cacheStoreMs,
      });
      return {
        ranges,
        performance: {
          channelCount: uniqueIds.length, cacheHitChannelIds,
          physicalReadCount: Math.max(0, (after?.physicalReadCount ?? 0) - (before?.physicalReadCount ?? 0)),
          physicalBytesRead: Math.max(0, (after?.physicalBytesRead ?? 0) - (before?.physicalBytesRead ?? 0)),
          physicalReadMs: Math.max(0, (after?.physicalReadMs ?? 0) - (before?.physicalReadMs ?? 0)),
        },
      };
    }

    const firstChunk = sampleCount === 0 ? 0 : Math.floor(startSampleIndex / DECODED_CHANNEL_CHUNK_SAMPLES);
    const lastChunk = sampleCount === 0 ? -1 : Math.floor((startSampleIndex + sampleCount - 1) / DECODED_CHANNEL_CHUNK_SAMPLES);
    for (let chunkIndex = firstChunk; chunkIndex <= lastChunk; chunkIndex += 1) {
      const chunkStart = chunkIndex * DECODED_CHANNEL_CHUNK_SAMPLES;
      const chunkCount = Math.min(DECODED_CHANNEL_CHUNK_SAMPLES, this.sampleCount - chunkStart);
      const missingIds = uniqueIds.filter((channelId) =>
        !this.decodedCache.has(this.cacheKey(channelId, chunkStart, chunkCount))
        && this.cachedEntryContaining(channelId, chunkStart, chunkCount) === undefined
      );
      if (missingIds.length === 0) continue;
      const decoded = await this.decodeChannels(
        missingIds.map((channelId) => this.resolveChannel(channelId, chunkCount)),
        chunkStart,
        chunkCount,
      );
      batchCount += decoded.performance.batchCount;
      batchPlanMs += decoded.performance.batchPlanMs;
      sourceReadAwaitMs += decoded.performance.sourceReadAwaitMs;
      decodeTransformMs += decoded.performance.decodeTransformMs;
      resultAssemblyMs += decoded.performance.resultAssemblyMs;
      for (const [channelId, range] of decoded.ranges) this.cache(channelId, range);
    }
    const cacheResolveMs = nowMs() - cacheResolveStarted;
    const cacheStoreStarted = nowMs();
    for (const channelId of uniqueIds) {
      const composed = this.composeCachedChunks(channelId, startSampleIndex, sampleCount);
      if (!composed) throw new Error(`Decoded chunk cache could not compose ${channelId}.`);
      ranges.set(channelId, composed);
      if (batchCount === 0) cacheHitChannelIds.push(channelId);
    }
    const cacheStoreMs = nowMs() - cacheStoreStarted;

    const after = this.source.performanceSnapshot?.();
    const totalMs = nowMs() - totalStarted;
    recordChannelDecodePerformance({
      recordedAt: Date.now(),
      channelCount: uniqueIds.length,
      sampleCount,
      batchCount,
      totalMs,
      cacheResolveMs,
      batchPlanMs,
      sourceReadAwaitMs,
      decodeTransformMs,
      resultAssemblyMs,
      cacheStoreMs,
    });

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
