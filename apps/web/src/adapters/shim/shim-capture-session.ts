import {
  NUMERIC_SAMPLE_QUALITY,
  numericSampleQualityToValidity,
  type NumericChannelRange,
  type NumericSampleQualityCode,
} from '../../../../core/log-model/log-types';
import { nanosecondsDeltaToMilliseconds, type ShimTelemetryFrame } from './shim-binary-decoder';
import { ShimProtocolError, type ShimStreamDefinitionMessage } from './shim-protocol';

export interface ShimCaptureSegment {
  readonly index: number;
  readonly clockId: string;
  readonly generation: number;
  readonly streamId: number;
  readonly startSampleIndex: number;
  readonly startTimeMs: number;
  readonly startTimestampNs?: bigint;
}

export interface ShimCaptureSegmentStart {
  readonly clockId: string;
  readonly definition: ShimStreamDefinitionMessage;
  /** Capture-relative timeline position for the first sample in this segment. */
  readonly startTimeMs?: number;
}

export interface ShimCaptureSnapshot {
  readonly sampleCount: number;
  readonly channelIds: readonly string[];
  readonly segments: readonly ShimCaptureSegment[];
  readonly deliveryLossCount: number;
}

interface MutableSegment {
  index: number;
  clockId: string;
  generation: number;
  streamId: number;
  startSampleIndex: number;
  startTimeMs: number;
  startTimestampNs?: bigint;
  lastTimestampNs?: bigint;
  lastAcquisitionSequence?: bigint;
}

function isQualityCode(value: number): value is NumericSampleQualityCode {
  return value >= NUMERIC_SAMPLE_QUALITY.valid
    && value <= NUMERIC_SAMPLE_QUALITY.lost
    && Number.isInteger(value);
}

function sameChannels(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export class ShimCaptureSession {
  private readonly channelIdsInternal: string[] = [];
  private readonly valuesByChannel = new Map<string, number[]>();
  private readonly qualityByChannel = new Map<string, number[]>();
  private readonly timeMs: number[] = [];
  private readonly acquisitionSequences: bigint[] = [];
  private readonly segmentsInternal: MutableSegment[] = [];
  private activeDefinition: ShimStreamDefinitionMessage | undefined;
  private activeSegment: MutableSegment | undefined;
  private deliveryLossCountInternal = 0;

  get sampleCount(): number {
    return this.timeMs.length;
  }

  get channelIds(): readonly string[] {
    return this.channelIdsInternal;
  }

  get deliveryLossCount(): number {
    return this.deliveryLossCountInternal;
  }

  get segments(): readonly ShimCaptureSegment[] {
    return this.segmentsInternal.map((segment) => ({
      index: segment.index,
      clockId: segment.clockId,
      generation: segment.generation,
      streamId: segment.streamId,
      startSampleIndex: segment.startSampleIndex,
      startTimeMs: segment.startTimeMs,
      ...(segment.startTimestampNs === undefined ? {} : { startTimestampNs: segment.startTimestampNs }),
    }));
  }

  beginSegment(start: ShimCaptureSegmentStart): void {
    const definition = start.definition;
    if (definition.channels.length < 1) {
      throw new ShimProtocolError('emptyCaptureStream', 'A capture segment must contain at least one channel.');
    }

    if (this.channelIdsInternal.length === 0) {
      this.channelIdsInternal.push(...definition.channels);
      for (const channelId of definition.channels) {
        this.valuesByChannel.set(channelId, []);
        this.qualityByChannel.set(channelId, []);
      }
    } else if (!sameChannels(this.channelIdsInternal, definition.channels)) {
      throw new ShimProtocolError(
        'captureChannelSetChanged',
        'Selected-channel capture requires the same channel order across segments.',
      );
    }

    const defaultStartTimeMs = this.sampleCount === 0 ? 0 : this.timeMs[this.timeMs.length - 1]!;
    const startTimeMs = start.startTimeMs ?? defaultStartTimeMs;
    if (!Number.isFinite(startTimeMs) || startTimeMs < 0) {
      throw new ShimProtocolError('invalidCaptureTime', 'Capture segment startTimeMs must be a finite non-negative number.');
    }
    if (this.sampleCount > 0 && startTimeMs < this.timeMs[this.timeMs.length - 1]!) {
      throw new ShimProtocolError('captureTimeRegression', 'A new capture segment cannot start before the current capture time.');
    }

    const segment: MutableSegment = {
      index: this.segmentsInternal.length,
      clockId: start.clockId,
      generation: definition.generation,
      streamId: definition.streamId,
      startSampleIndex: this.sampleCount,
      startTimeMs,
    };
    this.segmentsInternal.push(segment);
    this.activeSegment = segment;
    this.activeDefinition = definition;
  }

  appendFrame(frame: ShimTelemetryFrame): void {
    const segment = this.activeSegment;
    const definition = this.activeDefinition;
    if (!segment || !definition) {
      throw new ShimProtocolError('captureSegmentMissing', 'Begin a capture segment before appending telemetry.');
    }
    if (frame.streamId !== definition.streamId) {
      throw new ShimProtocolError('captureStreamMismatch', `Frame stream ${frame.streamId} does not match capture stream ${definition.streamId}.`);
    }
    if (frame.generation !== BigInt(definition.generation)) {
      throw new ShimProtocolError('captureGenerationMismatch', `Frame generation ${frame.generation} does not match capture generation ${definition.generation}.`);
    }
    if (frame.channelCount !== definition.channels.length) {
      throw new ShimProtocolError('captureChannelCountMismatch', 'Telemetry channel count does not match the active stream definition.');
    }

    this.deliveryLossCountInternal += frame.deliveryLoss;
    for (const sample of frame.samples) {
      if (segment.lastAcquisitionSequence !== undefined && sample.acquisitionSequence <= segment.lastAcquisitionSequence) {
        throw new ShimProtocolError('captureSequenceRegression', 'Acquisition sequence must increase within one capture segment.');
      }
      if (segment.lastTimestampNs !== undefined && sample.timestampNs < segment.lastTimestampNs) {
        throw new ShimProtocolError('captureTimestampRegression', 'Shim timestamps must not move backwards within one capture segment.');
      }
      if (segment.startTimestampNs === undefined) segment.startTimestampNs = sample.timestampNs;

      const elapsedMs = nanosecondsDeltaToMilliseconds(sample.timestampNs, segment.startTimestampNs);
      const captureTimeMs = segment.startTimeMs + elapsedMs;
      const previousTime = this.timeMs[this.timeMs.length - 1];
      if (previousTime !== undefined && captureTimeMs < previousTime) {
        throw new ShimProtocolError('captureTimeRegression', 'Computed capture time moved backwards.');
      }

      for (let channelIndex = 0; channelIndex < definition.channels.length; channelIndex += 1) {
        const channelId = definition.channels[channelIndex]!;
        const quality = sample.quality[channelIndex];
        if (quality === undefined || !isQualityCode(quality)) {
          throw new ShimProtocolError('invalidTelemetryQuality', `Unsupported telemetry quality code ${String(quality)}.`);
        }
        this.valuesByChannel.get(channelId)!.push(sample.values[channelIndex]!);
        this.qualityByChannel.get(channelId)!.push(quality);
      }

      this.timeMs.push(captureTimeMs);
      this.acquisitionSequences.push(sample.acquisitionSequence);
      segment.lastTimestampNs = sample.timestampNs;
      segment.lastAcquisitionSequence = sample.acquisitionSequence;
    }
  }

  snapshot(): ShimCaptureSnapshot {
    return {
      sampleCount: this.sampleCount,
      channelIds: [...this.channelIdsInternal],
      segments: this.segments,
      deliveryLossCount: this.deliveryLossCountInternal,
    };
  }

  sampleRangeForTime(startMs: number, endMs: number): { readonly startSampleIndex: number; readonly sampleCount: number } {
    const lowTime = Math.min(startMs, endMs);
    const highTime = Math.max(startMs, endMs);
    const startSampleIndex = this.lowerBoundTime(lowTime);
    const endSampleIndex = this.upperBoundTime(highTime);
    return { startSampleIndex, sampleCount: Math.max(0, endSampleIndex - startSampleIndex) };
  }

  readChannelRange(channelId: string, startSampleIndex: number, sampleCount: number): NumericChannelRange {
    const values = this.valuesByChannel.get(channelId);
    const quality = this.qualityByChannel.get(channelId);
    if (!values || !quality) throw new ShimProtocolError('unknownCaptureChannel', `Channel ${channelId} is not part of this capture.`);
    if (!Number.isSafeInteger(startSampleIndex) || startSampleIndex < 0 || !Number.isSafeInteger(sampleCount) || sampleCount < 0) {
      throw new ShimProtocolError('invalidCaptureRange', 'Capture range indices must be non-negative safe integers.');
    }

    const snapshotCount = this.sampleCount;
    const start = Math.min(startSampleIndex, snapshotCount);
    const end = Math.min(start + sampleCount, snapshotCount);
    const length = Math.max(0, end - start);
    const rangeTime = new Float64Array(length);
    const rangeValues = new Float64Array(length);
    const rangeQuality = new Uint8Array(length);
    const validity = new Uint8Array(length);

    for (let index = 0; index < length; index += 1) {
      const sourceIndex = start + index;
      rangeTime[index] = this.timeMs[sourceIndex]!;
      rangeValues[index] = values[sourceIndex]!;
      const qualityCode = quality[sourceIndex]!;
      rangeQuality[index] = qualityCode;
      validity[index] = numericSampleQualityToValidity(qualityCode);
    }

    return {
      startSampleIndex: start,
      timeMs: rangeTime,
      values: rangeValues,
      validity,
      quality: rangeQuality,
    };
  }

  acquisitionSequenceAt(sampleIndex: number): bigint | undefined {
    return this.acquisitionSequences[sampleIndex];
  }

  private lowerBoundTime(target: number): number {
    let low = 0;
    let high = this.timeMs.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (this.timeMs[middle]! < target) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  private upperBoundTime(target: number): number {
    let low = 0;
    let high = this.timeMs.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (this.timeMs[middle]! <= target) low = middle + 1;
      else high = middle;
    }
    return low;
  }
}
