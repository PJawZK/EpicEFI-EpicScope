import type {
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../../../core/log-model/log-types';
import { ShimCaptureSession } from './shim-capture-session';

export class ShimLiveNumericChannelDataSource implements NumericChannelDataSource {
  readonly preferredBatchWindowMs = 50;
  readonly requiresExplicitBatchSelection = false;
  readonly managesPersistentColumns = false;

  constructor(private readonly capture: ShimCaptureSession) {}

  get sampleCount(): number {
    return this.capture.sampleCount;
  }

  sampleRangeForTime(
    startMs: number,
    endMs: number,
  ): { readonly startSampleIndex: number; readonly sampleCount: number } {
    return this.capture.sampleRangeForTime(startMs, endMs);
  }

  async readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange> {
    return this.capture.readChannelRange(channelId, startSampleIndex, sampleCount);
  }

  async readChannelsRange(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult> {
    const snapshotCount = this.capture.sampleCount;
    const boundedStart = Math.min(Math.max(0, startSampleIndex), snapshotCount);
    const boundedCount = Math.min(Math.max(0, sampleCount), snapshotCount - boundedStart);
    const ranges = new Map<string, NumericChannelRange>();
    for (const channelId of channelIds) {
      ranges.set(channelId, this.capture.readChannelRange(channelId, boundedStart, boundedCount));
    }
    return {
      ranges,
      performance: {
        channelCount: channelIds.length,
        cacheHitChannelIds: [...channelIds],
        physicalReadCount: 0,
        physicalBytesRead: 0,
        physicalReadMs: 0,
      },
    };
  }
}
